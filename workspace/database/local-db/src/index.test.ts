import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import PouchDB from "pouchdb-core";
import memoryAdapter from "pouchdb-adapter-memory";
import LocalDb, { type BaseDocument } from "./index.ts";

PouchDB.plugin(memoryAdapter);

interface NoteDoc extends BaseDocument {
  type: "note";
  title: string;
}

interface TaskDoc extends BaseDocument {
  type: "task";
  done: boolean;
}

type TestDoc = NoteDoc | TaskDoc;

describe("LocalDb", () => {
  let db: LocalDb<TestDoc>;
  let dbName: string;

  beforeEach(() => {
    dbName = `test_local_db_${crypto.randomUUID()}`;
    db = new LocalDb<TestDoc>(dbName, { adapter: "memory" });
  });

  afterEach(async () => {
    await db.destroyLocal();
  });

  describe("CRUD Operations", () => {
    it("puts, retrieves, updates, and removes a document", async () => {
      const doc: NoteDoc = {
        _id: "note:1",
        type: "note",
        title: "First Note",
        updatedAt: new Date().toISOString(),
      };

      // 1. Create
      const created = await db.put(doc);
      assert.ok(created.ok);
      assert.equal(created.id, "note:1");

      // 2. Read
      const fetched = await db.getById<NoteDoc>("note:1");
      assert.ok(fetched);
      assert.equal(fetched.title, "First Note");

      // 3. Update
      const updated = await db.put({
        ...fetched,
        title: "Updated Note",
        updatedAt: new Date().toISOString(),
      });
      assert.ok(updated.ok);
      assert.notEqual(updated.rev, created.rev);

      const refetched = await db.getById<NoteDoc>("note:1");
      assert.equal(refetched?.title, "Updated Note");

      // 4. Delete
      assert.ok(refetched);
      await db.remove(refetched);
      const afterDelete = await db.getById("note:1");
      assert.equal(afterDelete, null);
    });

    it("returns null when getById does not find a document", async () => {
      const result = await db.getById("note:does-not-exist");
      assert.equal(result, null);
    });

    it("filters documents cleanly by type prefix using getAllByType", async () => {
      await db.put({
        _id: "note:1",
        type: "note",
        title: "Note A",
        updatedAt: new Date().toISOString(),
      });

      await db.put({
        _id: "note:2",
        type: "note",
        title: "Note B",
        updatedAt: new Date().toISOString(),
      });

      await db.put({
        _id: "task:1",
        type: "task",
        done: false,
        updatedAt: new Date().toISOString(),
      });

      const notes = await db.getAllByType<NoteDoc>("note");
      assert.equal(notes.length, 2);
      assert.deepEqual(notes.map((n) => n.title).sort(), ["Note A", "Note B"]);

      const tasks = await db.getAllByType<TaskDoc>("task");
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].done, false);
    });
  });

  describe("Live Changes", () => {
    it("emits document changes via watchChanges", async () => {
      const receivedIds: string[] = [];

      const changePromise = new Promise<void>((resolve) => {
        void db.watchChanges((change) => {
          receivedIds.push(change.id);
          if (change.id === "note:watch-1") {
            resolve();
          }
        });
      });

      await db.put({
        _id: "note:watch-1",
        type: "note",
        title: "Watched",
        updatedAt: new Date().toISOString(),
      });

      await changePromise;
      assert.ok(receivedIds.includes("note:watch-1"));
    });
  });

  describe("Sync & Auth Token", () => {
    it("throws when startSync is called without remoteBaseUrl", () => {
      assert.throws(() => db.startSync(), {
        message: "Cannot start sync: remoteBaseUrl was not provided.",
      });
    });

    it("sends and updates the Authorization header via setToken()", async () => {
      const originalFetch = globalThis.fetch;
      let lastAuthHeader: string | undefined;

      globalThis.fetch = (async (
        _input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const headers = init?.headers as Record<string, string> | undefined;
        lastAuthHeader = headers?.["Authorization"];

        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const syncDbName = `test_sync_${crypto.randomUUID()}`;
      const syncDb = new LocalDb<TestDoc>(syncDbName, {
        adapter: "memory",
        remoteBaseUrl: "http://localhost:5984/",
        token: "initial-token",
      });

      try {
        await new Promise<void>((resolve) => {
          void syncDb.startSync({
            onError: () => {
              syncDb.stopSync();
              resolve();
            },
          });
        });

        assert.equal(lastAuthHeader, "Bearer initial-token");

        syncDb.setToken("rotated-token");

        await new Promise<void>((resolve) => {
          void syncDb.startSync({
            onError: () => {
              syncDb.stopSync();
              resolve();
            },
          });
        });

        assert.equal(lastAuthHeader, "Bearer rotated-token");
      } finally {
        globalThis.fetch = originalFetch;
        await syncDb.destroyLocal();
      }
    });
  });
});
