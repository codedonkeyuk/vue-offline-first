import type {} from "pouchdb-core";
import LocalDb, {
  type BaseDocument,
  type DbClientOptions,
  type SyncCallbacks,
} from "@vue-offline-first/local-db";
import {
  type AppDocument,
  type CoverLetterDoc,
  type CvDoc,
  type JobApplicationDoc,
  type TextDoc,
} from "../types.ts";
import { assertValidDoc } from "../validation/validateDocUpdate.ts";

type ClientDbDoc = AppDocument & BaseDocument;

export interface ClientDbOptions extends DbClientOptions {
  onActivity?: () => void;
}

export default class ClientDb {
  private db: LocalDb<ClientDbDoc>;
  private onActivity?: () => void;

  constructor(dbName: string, options: ClientDbOptions = {}) {
    this.onActivity = options.onActivity;
    this.db = new LocalDb<ClientDbDoc>(dbName, options);
  }

  private notifyActivity() {
    this.onActivity?.();
  }

  setToken(token: string | undefined) {
    this.db.setToken(token);
  }

  startSync(callbacks: SyncCallbacks<ClientDbDoc> = {}) {
    return this.db.startSync(callbacks);
  }

  stopSync() {
    this.db.stopSync();
  }

  close() {
    this.db.close();
  }

  watchChanges(
    onDocChange: (
      change: PouchDB.Core.ChangesResponseChange<ClientDbDoc>,
    ) => void,
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

  async saveTextDocument(input: Omit<TextDoc, "type" | "updatedAt">) {
    this.notifyActivity();
    const id = input._id ?? `text_document:${crypto.randomUUID()}`;
    const existing = (await this.db.getById(id)) as TextDoc | null;

    const doc: TextDoc & BaseDocument = {
      ...existing,
      ...input,
      _id: id,
      type: "text_document",
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
