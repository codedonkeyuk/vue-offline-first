import LocalDb, {
  type BaseDocument,
  type DbClientOptions,
  type SyncCallbacks,
} from "./LocalDb.ts";
import {
  assertValidDoc,
  type AppDocument,
  type CoverLetterDoc,
  type CvDoc,
  type JobApplicationDoc,
} from "@job-search/db-config";

type JobDbDoc = AppDocument & BaseDocument;

export interface JobDbOptions extends DbClientOptions {
  onActivity?: () => void;
}

export default class JobDb {
  private db: LocalDb<JobDbDoc>;
  private onActivity?: () => void;

  constructor(dbName: string, options: JobDbOptions = {}) {
    this.onActivity = options.onActivity;
    this.db = new LocalDb<JobDbDoc>(dbName, options);
  }

  private notifyActivity() {
    this.onActivity?.();
  }

  setToken(token: string | undefined) {
    this.db.setToken(token);
  }

  startSync(callbacks: SyncCallbacks<JobDbDoc> = {}) {
    return this.db.startSync(callbacks);
  }

  stopSync() {
    this.db.stopSync();
  }

  close() {
    this.db.close();
  }

  watchChanges(
    onDocChange: (change: PouchDB.Core.ChangesResponseChange<JobDbDoc>) => void,
  ) {
    return this.db.watchChanges(onDocChange);
  }

  async createCoverLetter(
    input: Omit<CoverLetterDoc, "_id" | "_rev" | "type" | "updatedAt">,
  ) {
    this.notifyActivity();
    const doc: CoverLetterDoc & BaseDocument = {
      ...input,
      _id: `cover_letter:${crypto.randomUUID()}`,
      type: "cover_letter",
      updatedAt: new Date().toISOString(),
    };

    assertValidDoc(doc, null);
    return this.db.put(doc);
  }

  async createCv(input: Omit<CvDoc, "_id" | "_rev" | "type" | "updatedAt">) {
    this.notifyActivity();
    const doc: CvDoc & BaseDocument = {
      ...input,
      _id: `cv:${crypto.randomUUID()}`,
      type: "cv",
      updatedAt: new Date().toISOString(),
    };

    assertValidDoc(doc, null);
    return this.db.put(doc);
  }

  async saveJobApplication(
    input: Omit<JobApplicationDoc, "type" | "updatedAt">,
  ) {
    this.notifyActivity();
    const id = input._id ?? `job_application:${crypto.randomUUID()}`;
    const existing = (await this.db.getById(id)) as JobApplicationDoc | null;

    const doc: JobApplicationDoc & BaseDocument = {
      ...existing,
      ...input,
      _id: id,
      type: "job_application",
      updatedAt: new Date().toISOString(),
    };

    assertValidDoc(doc, existing);
    return this.db.put(doc);
  }

  async getById<T extends AppDocument = AppDocument>(
    id: string,
  ): Promise<T | null> {
    this.notifyActivity();
    return this.db.getById(id) as Promise<T | null>;
  }

  async getAllByType<T extends AppDocument>(type: T["type"]): Promise<T[]> {
    this.notifyActivity();
    return this.db.getAllByType(type) as Promise<T[]>;
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
    const existing = await this.db.getById(id);
    if (!existing) {
      throw Object.assign(new Error("missing"), { status: 404 });
    }
    assertValidDoc(
      { _id: existing._id, _rev: existing._rev, _deleted: true },
      existing,
    );
    return this.db.remove(existing);
  }

  async destroyLocal() {
    return this.db.destroyLocal();
  }
}
