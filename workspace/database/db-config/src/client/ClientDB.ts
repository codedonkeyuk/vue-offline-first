import type {} from "pouchdb-core";
import LocalDb, {
  type BaseDocument,
  type DbClientOptions,
  type SyncCallbacks,
} from "@vue-offline-first/local-db";
import { type AppDocument, type TextDoc } from "../types.ts";
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
