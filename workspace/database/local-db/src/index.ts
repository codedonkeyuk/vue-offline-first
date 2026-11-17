import PouchDB from "pouchdb-core";
import IDBAdapter from "pouchdb-adapter-idb";
import HttpAdapter from "pouchdb-adapter-http";
import Replication from "pouchdb-replication";

PouchDB.plugin(IDBAdapter).plugin(HttpAdapter).plugin(Replication);

export interface BaseDocument {
  _id: string;
  _rev?: string;
  type: string;
  updatedAt: string;
  _deleted?: boolean;
}

export interface SyncCallbacks<T extends BaseDocument> {
  onChange?: (info: PouchDB.Replication.SyncResult<T>) => void;
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
}

export default class LocalDb<T extends BaseDocument = BaseDocument> {
  private localDb: PouchDB.Database<T>;
  private remoteDb: PouchDB.Database<T> | null = null;
  private syncHandler: PouchDB.Replication.Sync<T> | null = null;
  private changesHandler: PouchDB.Core.Changes<T> | null = null;
  private token: string | undefined;

  constructor(dbName: string, options: DbClientOptions = {}) {
    this.token = options.token;

    this.localDb = new PouchDB<T>(dbName, {
      adapter: options.adapter ?? "idb",
    });

    if (options.remoteBaseUrl) {
      const cleanUrl = options.remoteBaseUrl.replace(/\/$/, "");
      const targetDb = options.remoteDbName ?? dbName;

      this.remoteDb = new PouchDB<T>(`${cleanUrl}/${targetDb}`, {
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

  startSync(callbacks: SyncCallbacks<T> = {}) {
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
    onDocChange: (change: PouchDB.Core.ChangesResponseChange<T>) => void,
  ) {
    if (this.changesHandler) {
      this.changesHandler.cancel();
    }

    this.changesHandler = this.localDb
      .changes({ since: "now", live: true, include_docs: true })
      .on("change", (change) => onDocChange(change));

    return this.changesHandler;
  }

  async put(doc: T) {
    return this.localDb.put(doc);
  }

  async getById<D extends T = T>(id: string): Promise<D | null> {
    try {
      return await this.localDb.get<D>(id);
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async getAllByType<D extends T>(type: D["type"]): Promise<D[]> {
    const res = await this.localDb.allDocs({
      include_docs: true,
      startkey: `${type}:`,
      endkey: `${type}:\ufff0`,
    });

    return res.rows
      .map((row) => row.doc as D | undefined)
      .filter((doc): doc is D => Boolean(doc));
  }

  async remove(existing: T) {
    return this.localDb.remove(existing as PouchDB.Core.RemoveDocument);
  }

  async destroyLocal() {
    this.token = undefined;
    this.close();
    return this.localDb.destroy();
  }
}
