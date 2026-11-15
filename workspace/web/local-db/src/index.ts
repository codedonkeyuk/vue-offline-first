import PouchDB from "pouchdb-browser";
import {
  assertValidDoc,
  type AppDocument,
  type CoverLetterDoc,
  type CvDoc,
  type JobApplicationDoc,
} from "@job-search/db-validator";

export interface SyncCallbacks {
  onChange?: (info: PouchDB.Replication.SyncResult<AppDocument>) => void;
  onPaused?: (err?: any) => void;
  onActive?: () => void;
  onDenied?: (err: any) => void;
  onError?: (err: any) => void;
}

export interface RemoteSyncOptions {
  remoteBaseUrl: string;
  remoteDbName: string;
  token: string;
}

export interface DbClientOptions {
  sync?: RemoteSyncOptions;
}

export class JobSearchLocalDb {
  private localDb: PouchDB.Database<AppDocument>;
  private remoteDb: PouchDB.Database<AppDocument> | null = null;
  private syncHandler: PouchDB.Replication.Sync<AppDocument> | null = null;
  private changesHandler: PouchDB.Core.Changes<AppDocument> | null = null;
  private authToken: string | null = null;

  constructor(
    localDbName: string = "job-search-local",
    options: DbClientOptions = {},
  ) {
    // Always boots locally first—works 100% offline with zero auth required
    this.localDb = new PouchDB<AppDocument>(localDbName);

    if (options.sync) {
      this.configureRemote(options.sync);
    }
  }

  /**
   * Configures or updates the remote CouchDB target and token without touching local data.
   */
  configureRemote(syncOptions: RemoteSyncOptions) {
    const cleanUrl = syncOptions.remoteBaseUrl.replace(/\/$/, "");
    this.authToken = syncOptions.token;

    this.remoteDb = new PouchDB<AppDocument>(
      `${cleanUrl}/${syncOptions.remoteDbName}`,
      {
        fetch: (url, opts) => {
          const headers = new Headers(opts?.headers);
          if (this.authToken) {
            headers.set("Authorization", `Bearer ${this.authToken}`);
          }
          return PouchDB.fetch(url, { ...opts, headers });
        },
      },
    );
  }

  /**
   * Starts live, two-way replication between local IndexedDB and CouchDB.
   */
  startSync(callbacks: SyncCallbacks = {}) {
    if (!this.remoteDb) {
      throw new Error("Cannot start sync: remote CouchDB is not configured.");
    }

    this.stopSync();

    this.syncHandler = this.localDb
      .sync(this.remoteDb, { live: true, retry: true })
      .on("change", (info) => callbacks.onChange?.(info))
      .on("paused", (err) => callbacks.onPaused?.(err))
      .on("active", () => callbacks.onActive?.())
      .on("denied", (err) => callbacks.onDenied?.(err))
      .on("error", (err) => callbacks.onError?.(err));

    return this.syncHandler;
  }

  /**
   * Stops live sync cleanly while leaving local IndexedDB intact and usable offline.
   */
  stopSync() {
    if (this.syncHandler) {
      this.syncHandler.cancel();
      this.syncHandler = null;
    }
  }

  /**
   * Listens for local and synced document changes so the Web Worker
   * can post updates back to the main UI thread.
   */
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

  /**
   * Creates a new immutable Cover Letter version.
   */
  async createCoverLetter(
    input: Omit<CoverLetterDoc, "_id" | "_rev" | "type" | "updatedAt">,
  ) {
    const doc: CoverLetterDoc = {
      ...input,
      _id: `cover_letter:${crypto.randomUUID()}`,
      type: "cover_letter",
      updatedAt: new Date().toISOString(),
    };

    assertValidDoc(doc, null);
    return this.localDb.put(doc);
  }

  /**
   * Creates a new immutable CV version.
   */
  async createCv(input: Omit<CvDoc, "_id" | "_rev" | "type" | "updatedAt">) {
    const doc: CvDoc = {
      ...input,
      _id: `cv:${crypto.randomUUID()}`,
      type: "cv",
      updatedAt: new Date().toISOString(),
    };

    assertValidDoc(doc, null);
    return this.localDb.put(doc);
  }

  /**
   * Creates or updates a mutable Job Application.
   */
  async saveJobApplication(
    input: Omit<JobApplicationDoc, "type" | "updatedAt">,
  ) {
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

  /**
   * Retrieves a single document by ID, or null if not found.
   */
  async getById<T extends AppDocument = AppDocument>(
    id: string,
  ): Promise<T | null> {
    try {
      return await this.localDb.get<T>(id);
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Fetches all documents of a specific type using _id prefixes.
   */
  async getAllByType<T extends AppDocument>(type: T["type"]): Promise<T[]> {
    const res = await this.localDb.allDocs({
      include_docs: true,
      startkey: `${type}:`,
      endkey: `${type}:\ufff0`,
    });

    return res.rows
      .map((row) => row.doc as T | undefined)
      .filter((doc): doc is T => Boolean(doc));
  }

  /**
   * Fetches all immutable versions belonging to a specific coverLetterId or cvId,
   * sorted newest first.
   */
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

  /**
   * Deletes a mutable document. Immutable documents are rejected by assertValidDoc.
   */
  async remove(id: string) {
    const existing = await this.localDb.get(id);
    assertValidDoc(
      { _id: existing._id, _rev: existing._rev, _deleted: true },
      existing,
    );
    return this.localDb.remove(existing);
  }

  /**
   * Stops sync/listeners and wipes the local IndexedDB (optional hard reset).
   */
  async destroyLocal() {
    this.stopSync();
    if (this.changesHandler) {
      this.changesHandler.cancel();
      this.changesHandler = null;
    }
    return this.localDb.destroy();
  }
}
