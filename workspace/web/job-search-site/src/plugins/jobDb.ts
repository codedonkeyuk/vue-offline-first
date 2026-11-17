import type {} from "pouchdb-core";
import { inject, ref, type App, type InjectionKey, type Ref } from "vue";
import type { JobDbOptions } from "@job-search/db-config";
import type {
  AppDocument,
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
} from "@job-search/db-config";

export type SyncState = "idle" | "syncing" | "paused" | "error" | "denied";
export type SessionState = "authenticated" | "unauthenticated" | "expired";

export interface WorkerDbOptions extends JobDbOptions {
  authBaseUrl?: string;
  renewThrottleMs?: number;
}

export interface JobDbContext {
  isSyncEnabled: Ref<boolean>;
  syncState: Ref<SyncState>;
  syncError: Ref<unknown>;
  sessionState: Ref<SessionState>;
  lastDocChange: Ref<PouchDB.Core.ChangesResponseChange<AppDocument> | null>;

  connectSync: (options: WorkerDbOptions) => Promise<void>;
  disconnectSync: () => Promise<void>;
  destroyLocal: () => Promise<void>;
  logout: () => Promise<void>;

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
const STORAGE_KEY = "job_search_sync_session";

function loadSavedSession(): WorkerDbOptions | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkerDbOptions) : null;
  } catch {
    return null;
  }
}

function saveSession(options: WorkerDbOptions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function clearSavedSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function createJobDbPlugin(
  dbName: string,
  initialOptions?: WorkerDbOptions,
) {
  return {
    install(app: App) {
      const worker = new Worker(
        new URL("../workers/db.worker.ts", import.meta.url),
        { type: "module" },
      );

      const savedSession = loadSavedSession();
      const bootOptions: WorkerDbOptions = {
        ...savedSession,
        ...initialOptions,
      };

      const isSyncEnabled = ref(Boolean(bootOptions.remoteBaseUrl));
      const syncState = ref<SyncState>("idle");
      const syncError = ref<unknown>(null);
      const sessionState = ref<SessionState>(
        bootOptions.token ? "authenticated" : "unauthenticated",
      );
      const lastDocChange =
        ref<PouchDB.Core.ChangesResponseChange<AppDocument> | null>(null);

      let requestId = 0;
      const pending = new Map<
        number,
        { resolve: (val: any) => void; reject: (err: any) => void }
      >();

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

      const resetToLocalOnly = async (nextSessionState: SessionState) => {
        clearSavedSession();
        isSyncEnabled.value = false;
        syncState.value = "idle";
        syncError.value = null;
        sessionState.value = nextSessionState;
        lastDocChange.value = null;

        // Re-initialise an empty local-only DB so the worker stays ready for local use or next login
        await send("INIT", { dbName, options: {} });
      };

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
            case "session:renewed": {
              const current = loadSavedSession();
              if (current && msg.token) {
                saveSession({ ...current, token: msg.token });
              }
              break;
            }
            case "session:expired":
              void resetToLocalOnly("expired");
              break;
            case "session:logged_out":
              void resetToLocalOnly("unauthenticated");
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

      const connectSync = async (options: WorkerDbOptions) => {
        const initialised = await send<boolean>("INIT", { dbName, options });

        if (!initialised) {
          // Worker detected that the saved token was already expired on startup
          await resetToLocalOnly("expired");
          return;
        }

        if (options.remoteBaseUrl && options.token) {
          saveSession(options);
          isSyncEnabled.value = true;
          syncState.value = "syncing";
          sessionState.value = "authenticated";
        } else {
          isSyncEnabled.value = false;
          syncState.value = "idle";
        }
      };

      const disconnectSync = async () => {
        await send("STOP_SYNC");
        isSyncEnabled.value = false;
        syncState.value = "idle";
      };

      const destroyLocal = async () => {
        await send("DESTROY");
        clearSavedSession();
        isSyncEnabled.value = false;
        syncState.value = "idle";
        sessionState.value = "unauthenticated";
        lastDocChange.value = null;
      };

      const logout = async () => {
        // Worker stops sync, calls POST /logout, destroys IndexedDB, and emits session:logged_out
        await send("LOGOUT");
      };

      void connectSync(bootOptions);

      app.provide(JOB_DB_KEY, {
        isSyncEnabled,
        syncState,
        syncError,
        sessionState,
        lastDocChange,
        connectSync,
        disconnectSync,
        destroyLocal,
        logout,
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
