import type {} from "pouchdb-core";
import { inject, ref, type App, type InjectionKey, type Ref } from "vue";
import type { DbClientOptions } from "@job-search/local-db";
import type {
  AppDocument,
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
} from "@job-search/db-validator";

export type SyncState = "idle" | "syncing" | "paused" | "error" | "denied";

export interface JobDbContext {
  isSyncEnabled: Ref<boolean>;
  syncState: Ref<SyncState>;
  syncError: Ref<unknown>;
  lastDocChange: Ref<PouchDB.Core.ChangesResponseChange<AppDocument> | null>;

  connectSync: (options: DbClientOptions) => Promise<void>;
  disconnectSync: () => Promise<void>;
  destroyLocal: () => Promise<void>;

  createCoverLetter: (
    input: Omit<CoverLetterDoc, "_id" | "_rev" | "type" | "updatedAt">,
  ) => Promise<PouchDB.Core.Response>;
  createCv: (
    input: Omit<CvDoc, "_id" | "_rev" | "type" | "updatedAt">,
  ) => Promise<PouchDB.Core.Response>;
  saveJobApplication: (
    input: Omit<JobApplicationDoc, "type" | "updatedAt">,
  ) => Promise<PouchDB.Core.Response>;
  getById: <T extends AppDocument = AppDocument>(
    id: string,
  ) => Promise<T | null>;
  getAllByType: <T extends AppDocument>(type: T["type"]) => Promise<T[]>;
  getCoverLetterVersions: (coverLetterId: string) => Promise<CoverLetterDoc[]>;
  getCvVersions: (cvId: string) => Promise<CvDoc[]>;
  remove: (id: string) => Promise<PouchDB.Core.Response>;
}

const JOB_DB_KEY: InjectionKey<JobDbContext> = Symbol("JobSearchLocalDbWorker");

export function createJobDbPlugin(
  dbName: string,
  initialOptions?: DbClientOptions,
) {
  return {
    install(app: App) {
      const worker = new Worker(
        new URL("../workers/db.worker.ts", import.meta.url),
        { type: "module" },
      );

      const isSyncEnabled = ref(Boolean(initialOptions?.remoteBaseUrl));
      const syncState = ref<SyncState>("idle");
      const syncError = ref<unknown>(null);
      const lastDocChange =
        ref<PouchDB.Core.ChangesResponseChange<AppDocument> | null>(null);

      let requestId = 0;
      const pending = new Map<
        number,
        { resolve: (val: any) => void; reject: (err: any) => void }
      >();

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;

        if (msg.event) {
          switch (msg.event) {
            case "db:change":
              lastDocChange.value = msg.data;
              break;
            case "sync:change":
            case "sync:active":
              syncState.value = "syncing";
              syncError.value = null;
              break;
            case "sync:paused": {
              const hasRealError = Boolean(
                msg.error?.message || msg.error?.status || msg.error?.error,
              );
              syncState.value = hasRealError ? "error" : "paused";
              syncError.value = hasRealError ? msg.error : null;
              break;
            }
            case "sync:denied":
              syncState.value = "denied";
              syncError.value = msg.error;
              break;
            case "sync:error":
              syncState.value = "error";
              syncError.value = msg.error;
              break;
          }
          return;
        }

        const entry = pending.get(msg.id);
        if (entry) {
          pending.delete(msg.id);
          if (msg.error) entry.reject(new Error(msg.error));
          else entry.resolve(msg.result);
        }
      };

      const send = <T = unknown>(
        type: string,
        payload?: unknown,
      ): Promise<T> => {
        const id = ++requestId;
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          worker.postMessage({ id, type, payload });
        });
      };

      const call = <T = unknown>(
        method: string,
        ...args: unknown[]
      ): Promise<T> => {
        return send<T>("CALL", { method, args });
      };

      const connectSync = async (options: DbClientOptions) => {
        await send("INIT", { dbName, options });
        isSyncEnabled.value = Boolean(options.remoteBaseUrl);
        syncState.value = options.remoteBaseUrl ? "syncing" : "idle";
      };

      const disconnectSync = async () => {
        await send("STOP_SYNC");
        isSyncEnabled.value = false;
        syncState.value = "idle";
      };

      const destroyLocal = async () => {
        await send("DESTROY");
        isSyncEnabled.value = false;
        syncState.value = "idle";
        lastDocChange.value = null;
      };

      void connectSync(initialOptions ?? {});

      app.provide(JOB_DB_KEY, {
        isSyncEnabled,
        syncState,
        syncError,
        lastDocChange,
        connectSync,
        disconnectSync,
        destroyLocal,
        createCoverLetter: (input) => call("createCoverLetter", input),
        createCv: (input) => call("createCv", input),
        saveJobApplication: (input) => call("saveJobApplication", input),
        getById: (id) => call("getById", id),
        getAllByType: (type) => call("getAllByType", type),
        getCoverLetterVersions: (coverLetterId) =>
          call("getCoverLetterVersions", coverLetterId),
        getCvVersions: (cvId) => call("getCvVersions", cvId),
        remove: (id) => call("remove", id),
      });
    },
  };
}

export function useJobDb(): JobDbContext {
  const context = inject(JOB_DB_KEY);
  if (!context) {
    throw new Error(
      "useJobDb() must be used inside a Vue app with createJobDbPlugin installed.",
    );
  }
  return context;
}
