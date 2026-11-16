import PouchDB from "pouchdb-core";
import IDBAdapter from "pouchdb-adapter-idb";
import HttpAdapter from "pouchdb-adapter-http";
import Replication from "pouchdb-replication";
import {
  assertValidDoc,
  type AppDocument,
  type CoverLetterDoc,
  type CvDoc,
  type JobApplicationDoc,
} from "@job-search/db-config";

PouchDB.plugin(IDBAdapter).plugin(HttpAdapter).plugin(Replication);

export interface SyncCallbacks {
  onChange?: (info: PouchDB.Replication.SyncResult<AppDocument>) => void;
  onPaused?: (err?: any) => void;
  onActive?: () => void;
  onDenied?: (err: any) => void;
  onError?: (err: any) => void;
}

export interface DbClientOptions {
  remoteBaseUrl?: string;
  remoteDbName?: string;
  token?: string;
  adapter?: string;
  onActivity?: () => void;
}

export class JobSearchLocalDb {
  private localDb: PouchDB.Database<AppDocument>;
  private remoteDb: PouchDB.Database<AppDocument> | null = null;
  private syncHandler: PouchDB.Replication.Sync<AppDocument> | null = null;
  private changesHandler: PouchDB.Core.Changes<AppDocument> | null = null;
  private token: string | undefined;
  private onActivity?: () => void;

  constructor(dbName: string, options: DbClientOptions = {}) {
    this.token = options.token;
    this.onActivity = options.onActivity;

    this.localDb = new PouchDB<AppDocument>(dbName, {
      adapter: options.adapter ?? "idb",
    });

    if (options.remoteBaseUrl) {
      const cleanUrl = options.remoteBaseUrl.replace(/\/$/, "");
      const targetDb = options.remoteDbName ?? dbName;

      this.remoteDb = new PouchDB<AppDocument>(`${cleanUrl}/${targetDb}`, {
        fetch: (url, opts) => {
          const headers: Record<string, string> = {};
          if (opts?.headers) {
            new Headers(opts.headers).forEach((value, key) => {
              headers[key] = value;
            });
          }
          if (this.token) {
            headers["Authorization"] = `Bearer ${this.token}`;
          }
          return fetch(url, {
            ...opts,
            headers,
            credentials: "omit",
          });
        },
      });
    }
  }

  setToken(token: string | undefined) {
    this.token = token;
  }

  private notifyActivity() {
    this.onActivity?.();
  }

  startSync(callbacks: SyncCallbacks = {}) {
    if (!this.remoteDb) {
      throw new Error("Cannot start sync: remoteBaseUrl was not provided.");
    }

    this.stopSync();

    this.syncHandler = this.localDb
      .sync(this.remoteDb, {
        live: true,
        retry: true,
        filter: (doc) => !doc._id.startsWith("_design/"),
      })
      .on("change", (info) => callbacks.onChange?.(info))
      .on("paused", (err) => callbacks.onPaused?.(err))
      .on("active", () => callbacks.onActive?.())
      .on("denied", (err) => callbacks.onDenied?.(err))
      .on("error", (err) => callbacks.onError?.(err));

    return this.syncHandler;
  }

  stopSync() {
    if (this.syncHandler) {
      this.syncHandler.cancel();
      this.syncHandler = null;
    }
  }

  close() {
    this.stopSync();
    if (this.changesHandler) {
      this.changesHandler.cancel();
      this.changesHandler = null;
    }
  }

  watchChanges(
    onDocChange: (
      change: PouchDB.Core.ChangesResponseChange<AppDocument>,
    ) => void,
  ) {
    if (this.changesHandler) {
      this.changesHandler.cancel();
    }

    this.changesHandler = this.localDb
      .changes({ since: "now", live: true, include_docs: true })
      .on("change", (change) => onDocChange(change));

    return this.changesHandler;
  }

  async createCoverLetter(
    input: Omit<CoverLetterDoc, "_id" | "_rev" | "type" | "updatedAt">,
  ) {
    this.notifyActivity();
    const doc: CoverLetterDoc = {
      ...input,
      _id: `cover_letter:${crypto.randomUUID()}`,
      type: "cover_letter",
      updatedAt: new Date().toISOString(),
    };

    assertValidDoc(doc, null);
    return this.localDb.put(doc);
  }

  async createCv(input: Omit<CvDoc, "_id" | "_rev" | "type" | "updatedAt">) {
    this.notifyActivity();
    const doc: CvDoc = {
      ...input,
      _id: `cv:${crypto.randomUUID()}`,
      type: "cv",
      updatedAt: new Date().toISOString(),
    };

    assertValidDoc(doc, null);
    return this.localDb.put(doc);
  }

  async saveJobApplication(
    input: Omit<JobApplicationDoc, "type" | "updatedAt">,
  ) {
    this.notifyActivity();
    const id = input._id ?? `job_application:${crypto.randomUUID()}`;
    let existing: JobApplicationDoc | null = null;

    try {
      existing = await this.localDb.get<JobApplicationDoc>(id);
    } catch (err: any) {
      if (err.status !== 404) throw err;
    }

    const doc: JobApplicationDoc = {
      ...existing,
      ...input,
      _id: id,
      type: "job_application",
      updatedAt: new Date().toISOString(),
    };

    assertValidDoc(doc, existing);
    return this.localDb.put(doc);
  }

  async getById<T extends AppDocument = AppDocument>(
    id: string,
  ): Promise<T | null> {
    this.notifyActivity();
    try {
      return await this.localDb.get<T>(id);
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async getAllByType<T extends AppDocument>(type: T["type"]): Promise<T[]> {
    this.notifyActivity();
    const res = await this.localDb.allDocs({
      include_docs: true,
      startkey: `${type}:`,
      endkey: `${type}:\ufff0`,
    });

    return res.rows
      .map((row) => row.doc as T | undefined)
      .filter((doc): doc is T => Boolean(doc));
  }

  async getCoverLetterVersions(
    coverLetterId: string,
  ): Promise<CoverLetterDoc[]> {
    const all = await this.getAllByType<CoverLetterDoc>("cover_letter");
    return all
      .filter((doc) => doc.coverLetterId === coverLetterId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }

  async getCvVersions(cvId: string): Promise<CvDoc[]> {
    const all = await this.getAllByType<CvDoc>("cv");
    return all
      .filter((doc) => doc.cvId === cvId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }

  async remove(id: string) {
    this.notifyActivity();
    const existing = await this.localDb.get(id);
    assertValidDoc(
      { _id: existing._id, _rev: existing._rev, _deleted: true },
      existing,
    );
    return this.localDb.remove(existing);
  }

  async destroyLocal() {
    this.token = undefined;
    this.close();
    return this.localDb.destroy();
  }
}
