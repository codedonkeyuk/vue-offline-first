import vm from "node:vm";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import validateDocUpdate, {
  assertValidDoc,
  getCouchDesignDoc,
} from "./validateDocUpdate.ts";
import type { TextDoc } from "../types.ts";

const validTimestamp = new Date().toISOString();
const standardUser = { roles: [] };
const adminUser = { roles: ["_admin"] };

describe("CouchDB & Shared Document Validation", () => {
  describe("1. Admin & Design Document Security", () => {
    it("blocks non-admin users from creating or modifying _design/ documents", () => {
      assert.throws(
        () => validateDocUpdate({ _id: "_design/views" }, null, standardUser),
        { forbidden: "Only admins can modify design documents." },
      );
    });

    it("allows _admin users to modify _design/ documents", () => {
      assert.doesNotThrow(() =>
        validateDocUpdate(
          {
            _id: "_design/views",
            type: "text_document",
            updatedAt: validTimestamp,
          },
          null,
          adminUser,
        ),
      );
    });
  });

  describe("2. Deletion Rules", () => {
    it("allows deleting documents (text_document)", () => {
      const existingApp: TextDoc = {
        _id: "job_1",
        type: "text_document",
        title: "Frontend Dev",
        updatedAt: validTimestamp,
      };

      assert.doesNotThrow(() =>
        validateDocUpdate(
          { _id: "job_1", _deleted: true },
          existingApp,
          standardUser,
        ),
      );
    });
  });

  describe("3. Document Type & Field Whitelist", () => {
    it("rejects unknown document types", () => {
      assert.throws(
        () =>
          validateDocUpdate(
            { type: "invoice", updatedAt: validTimestamp },
            null,
            standardUser,
          ),
        { forbidden: "Unknown document type: invoice" },
      );
    });

    it("prevents changing document type on update", () => {
      const oldDoc: TextDoc = {
        type: "text_document",
        title: "Role",
        updatedAt: validTimestamp,
      };
      const newDoc = {
        type: "cv",
        cvId: "123",
        title: "Role",
        updatedAt: validTimestamp,
      };

      assert.throws(() => validateDocUpdate(newDoc, oldDoc, standardUser), {
        forbidden: "Document type cannot be changed after creation.",
      });
    });

    it("rejects fields not in the schema whitelist", () => {
      const badDoc = {
        type: "text_document",
        title: "Engineer",
        updatedAt: validTimestamp,
        unexpectedField: "hack",
      };

      assert.throws(() => validateDocUpdate(badDoc, null, standardUser), {
        forbidden: "Field not allowed for text_document: unexpectedField",
      });
    });
  });

  describe("4. Content & Timestamp Validation", () => {
    it("rejects content exceeding 5000 characters", () => {
      const longContent = "a".repeat(5001);
      const doc: TextDoc = {
        type: "text_document",
        title: "Long App",
        content: longContent,
        updatedAt: validTimestamp,
      };

      assert.throws(() => validateDocUpdate(doc, null, standardUser), {
        forbidden: "Content for text_document must be under 5000 characters.",
      });
    });

    it("rejects missing or invalid updatedAt timestamps", () => {
      assert.throws(
        () =>
          validateDocUpdate(
            { type: "text_document", title: "No Date" },
            null,
            standardUser,
          ),
        { forbidden: "A valid timestamp (updatedAt) is required." },
      );

      assert.throws(
        () =>
          validateDocUpdate(
            {
              type: "text_document",
              title: "Bad Date",
              updatedAt: "not-a-date",
            },
            null,
            standardUser,
          ),
        { forbidden: "A valid timestamp (updatedAt) is required." },
      );
    });
  });

  describe("5. Creating & Updating Documents", () => {
    it("allows creating and updating a text_document", () => {
      const initial: TextDoc = {
        type: "text_document",
        title: "Acme Corp",
        content: "Applied today",
        updatedAt: validTimestamp,
      };
      const updated: TextDoc = {
        ...initial,
        content: "Interview scheduled",
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => validateDocUpdate(initial, null, standardUser));
      assert.doesNotThrow(() =>
        validateDocUpdate(updated, initial, standardUser),
      );
    });
  });

  describe("6. Express/PouchDB Helper (assertValidDoc) & CouchDB Serialization", () => {
    it("converts CouchDB { forbidden } throws into standard Error with status 403", () => {
      assert.throws(
        () => assertValidDoc({ type: "text_document", title: "Missing date" }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal((err as Error & { status?: number }).status, 403);
          assert.equal(
            err.message,
            "A valid timestamp (updatedAt) is required.",
          );
          return true;
        },
      );
    });

    it("serializes getCouchDesignDoc() into a valid executable CouchDB function string", () => {
      const designDoc = getCouchDesignDoc();
      assert.equal(designDoc._id, "_design/validation");
      assert.equal(typeof designDoc.validate_doc_update, "string");

      // Simulate CouchDB evaluating the stringified function inside an isolated VM sandbox
      const compiledFn = vm.runInNewContext(
        `(${designDoc.validate_doc_update})`,
      );
      assert.throws(
        () =>
          compiledFn(
            { type: "unknown", updatedAt: validTimestamp },
            null,
            standardUser,
          ),
        { forbidden: "Unknown document type: unknown" },
      );
    });
  });
});
