import { describe, it } from "node:test";
import assert from "node:assert/strict";
import validateDocUpdate from "./validateDocUpdate.js";

describe("validateDocUpdate", () => {
  const regularUser = { name: "alice", roles: [] };
  const adminUser = { name: "admin", roles: ["_admin"] };
  const validTimestamp = "2026-11-13T11:00:00.000Z";

  describe("1. Admin & Design Security", () => {
    it("blocks non-admins from modifying design docs", () => {
      const doc = { _id: "_design/auth" };
      assert.throws(() => validateDocUpdate(doc, null, regularUser), {
        forbidden: "Only admins can modify design documents.",
      });
    });

    it("allows admins to modify design docs", () => {
      const doc = {
        _id: "_design/auth",
        type: "job_application",
        updatedAt: validTimestamp,
      };
      assert.doesNotThrow(() => validateDocUpdate(doc, null, adminUser));
    });
  });

  describe("2. Deletion & Immutability Rules", () => {
    it("blocks deleting an immutable document (cv)", () => {
      const oldDoc = { _id: "cv-1", type: "cv" };
      assert.throws(
        () =>
          validateDocUpdate(
            { _id: "cv-1", _deleted: true },
            oldDoc,
            regularUser,
          ),
        { forbidden: "Immutable records of type cv cannot be deleted." },
      );
    });

    it("allows deleting a mutable document (job_application)", () => {
      const oldDoc = { _id: "app-1", type: "job_application" };
      assert.doesNotThrow(() =>
        validateDocUpdate(
          { _id: "app-1", _deleted: true },
          oldDoc,
          regularUser,
        ),
      );
    });

    it("blocks modifying an existing immutable document", () => {
      const existingCv = {
        _id: "cv-1",
        type: "cv",
        cvId: "ref-123",
        title: "Old Title",
        updatedAt: validTimestamp,
      };
      const updatedCv = { ...existingCv, title: "New Title" };

      assert.throws(
        () => validateDocUpdate(updatedCv, existingCv, regularUser),
        {
          forbidden: "Records of type cv are immutable and cannot be modified.",
        },
      );
    });

    it("requires linkField when creating an immutable document", () => {
      const invalidCv = {
        _id: "cv-1",
        type: "cv",
        title: "My CV",
        updatedAt: validTimestamp,
      };

      assert.throws(() => validateDocUpdate(invalidCv, null, regularUser), {
        forbidden: "Non-mutable records of type cv must have a cvId reference.",
      });
    });
  });

  describe("3. Schema, Content & Timestamp Validation", () => {
    it("allows creating a valid job_application", () => {
      const validApp = {
        _id: "app-1",
        type: "job_application",
        title: "Software Engineer",
        content: "Application notes",
        updatedAt: validTimestamp,
      };

      assert.doesNotThrow(() => validateDocUpdate(validApp, null, regularUser));
    });

    it("blocks unapproved fields", () => {
      const docWithExtraField = {
        _id: "app-1",
        type: "job_application",
        updatedAt: validTimestamp,
        hackerField: true,
      };

      assert.throws(
        () => validateDocUpdate(docWithExtraField, null, regularUser),
        { forbidden: "Field not allowed for job_application: hackerField" },
      );
    });

    it("blocks content exceeding maxContent (5000 chars)", () => {
      const longDoc = {
        _id: "app-1",
        type: "job_application",
        content: "a".repeat(5001),
        updatedAt: validTimestamp,
      };

      assert.throws(() => validateDocUpdate(longDoc, null, regularUser), {
        forbidden: "Content for job_application must be under 5000 characters.",
      });
    });

    it("blocks missing or invalid updatedAt timestamps", () => {
      const badDateDoc = {
        _id: "app-1",
        type: "job_application",
        updatedAt: "not-a-date",
      };

      assert.throws(() => validateDocUpdate(badDateDoc, null, regularUser), {
        forbidden: "A valid timestamp (updatedAt) is required.",
      });
    });
  });
});
