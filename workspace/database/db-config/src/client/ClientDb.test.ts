import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import PouchDB from "pouchdb-core";
import memoryAdapter from "pouchdb-adapter-memory";
import ClientDb from "./ClientDB.ts";

PouchDB.plugin(memoryAdapter);

describe("ClientDb", () => {
  let db: ClientDb;
  let dbName: string;

  beforeEach(() => {
    dbName = `test_db_${crypto.randomUUID()}`;
    db = new ClientDb(dbName, { adapter: "memory" });
  });

  afterEach(async () => {
    await db.destroyLocal();
  });

  describe("Text Document (Mutable)", () => {
    it("creates, updates, retrieves, and deletes a text document", async () => {
      // 1. Create
      const created = await db.saveTextDocument({
        title: "My Diary",
        content: "Status: Applied",
      });
      assert.ok(created.ok);
      assert.ok(created.id.startsWith("text_document:"));

      // 2. Read
      const fetched = await db.getById(created.id);
      assert.ok(fetched);
      assert.equal(fetched.title, "My Diary");

      // 3. Update
      const updated = await db.saveTextDocument({
        _id: created.id,
        title: "My Diary",
        content: "Status: Interviewing",
      });
      assert.ok(updated.ok);
      assert.notEqual(updated.rev, created.rev);

      const allApps = await db.getAllByType("text_document");
      assert.equal(allApps.length, 1);
      assert.equal(allApps[0].content, "Status: Interviewing");

      // 4. Delete
      await db.remove(created.id);
      const afterDelete = await db.getById(created.id);
      assert.equal(afterDelete, null);
    });
  });

  describe("Session & Activity Lifecycle", () => {
    it("invokes onActivity when data operations are performed", async () => {
      let activityCount = 0;
      const trackedDbName = `test_activity_${crypto.randomUUID()}`;
      const trackedDb = new ClientDb(trackedDbName, {
        adapter: "memory",
        onActivity: () => {
          activityCount += 1;
        },
      });

      try {
        const created = await trackedDb.saveTextDocument({
          title: "Backend Engineer",
          content: "Applied",
        });
        assert.equal(activityCount, 1);

        await trackedDb.getById(created.id);
        assert.equal(activityCount, 2);

        await trackedDb.getAllByType("text_document");
        assert.equal(activityCount, 3);

        await trackedDb.remove(created.id);
        assert.equal(activityCount, 4);
      } finally {
        await trackedDb.destroyLocal();
      }
    });

    it("dynamically updates the Authorization header via setToken()", async () => {
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

      const syncDbName = `test_token_${crypto.randomUUID()}`;
      const syncDb = new ClientDb(syncDbName, {
        adapter: "memory",
        remoteBaseUrl: "http://localhost:5984",
        token: "initial-jwt-token",
      });

      try {
        // 1. Trigger initial sync and wait for the replication error event
        await new Promise<void>((resolve) => {
          void syncDb.startSync({
            onError: () => {
              syncDb.stopSync();
              resolve();
            },
          });
        });

        assert.equal(lastAuthHeader, "Bearer initial-jwt-token");

        // 2. Rotate token via setToken() and verify the next request uses the new token
        syncDb.setToken("renewed-jwt-token");

        await new Promise<void>((resolve) => {
          void syncDb.startSync({
            onError: () => {
              syncDb.stopSync();
              resolve();
            },
          });
        });

        assert.equal(lastAuthHeader, "Bearer renewed-jwt-token");
      } finally {
        globalThis.fetch = originalFetch;
        await syncDb.destroyLocal();
      }
    });
  });
});
