import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import PouchDB from "pouchdb-core";
import memoryAdapter from "pouchdb-adapter-memory";
import { JobSearchLocalDb } from "./index.ts";

PouchDB.plugin(memoryAdapter);

describe("JobSearchLocalDb", () => {
  let db: JobSearchLocalDb;
  let dbName: string;

  beforeEach(() => {
    dbName = `test_db_${crypto.randomUUID()}`;
    db = new JobSearchLocalDb(dbName, { adapter: "memory" });
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
});
