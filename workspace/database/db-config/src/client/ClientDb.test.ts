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

  describe("Cover Letters (Immutable)", () => {
    it("creates cover letter versions and sorts them newest first", async () => {
      const groupId = "cl_group_1";

      await db.createCoverLetter({
        coverLetterId: groupId,
        title: "Draft 1",
        content: "Initial cover letter",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await db.createCoverLetter({
        coverLetterId: groupId,
        title: "Draft 2",
        content: "Final cover letter",
      });

      const versions = await db.getCoverLetterVersions(groupId);
      assert.equal(versions.length, 2);
      assert.equal(versions[0].title, "Draft 2");
      assert.equal(versions[1].title, "Draft 1");
      assert.ok(versions[0]._id?.startsWith("cover_letter:"));
    });

    it("blocks deleting an immutable cover letter", async () => {
      const res = await db.createCoverLetter({
        coverLetterId: "cl_group_2",
        title: "Immutable Letter",
        content: "Cannot delete me",
      });

      await assert.rejects(
        () => db.remove(res.id),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(
            err.message,
            "Immutable records of type cover_letter cannot be deleted.",
          );
          return true;
        },
      );
    });
  });

  describe("CVs (Immutable)", () => {
    it("creates CV versions and filters by cvId", async () => {
      await db.createCv({
        cvId: "cv_alpha",
        title: "Alpha CV v1",
        content: "Experience...",
      });

      await db.createCv({
        cvId: "cv_beta",
        title: "Beta CV v1",
        content: "Other experience...",
      });

      const alphaVersions = await db.getCvVersions("cv_alpha");
      assert.equal(alphaVersions.length, 1);
      assert.equal(alphaVersions[0].title, "Alpha CV v1");
      assert.ok(alphaVersions[0]._id?.startsWith("cv:"));
    });

    it("rejects CV content exceeding 5000 characters", async () => {
      await assert.rejects(
        () =>
          db.createCv({
            cvId: "cv_long",
            title: "Too Long",
            content: "x".repeat(5001),
          }),
        { message: "Content for cv must be under 5000 characters." },
      );
    });
  });

  describe("Job Applications (Mutable)", () => {
    it("creates, updates, retrieves, and deletes a job application", async () => {
      // 1. Create
      const created = await db.saveJobApplication({
        title: "Senior Frontend Engineer",
        content: "Status: Applied",
      });
      assert.ok(created.ok);
      assert.ok(created.id.startsWith("job_application:"));

      // 2. Read
      const fetched = await db.getById(created.id);
      assert.ok(fetched);
      assert.equal(fetched.title, "Senior Frontend Engineer");

      // 3. Update
      const updated = await db.saveJobApplication({
        _id: created.id,
        title: "Senior Frontend Engineer",
        content: "Status: Interviewing",
      });
      assert.ok(updated.ok);
      assert.notEqual(updated.rev, created.rev);

      const allApps = await db.getAllByType("job_application");
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
        const created = await trackedDb.saveJobApplication({
          title: "Backend Engineer",
          content: "Applied",
        });
        assert.equal(activityCount, 1);

        await trackedDb.getById(created.id);
        assert.equal(activityCount, 2);

        await trackedDb.getAllByType("job_application");
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
