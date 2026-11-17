import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as entryPoint from "./index.ts";
import expectedValidateDocUpdate, {
  assertValidDoc as expectedAssertValidDoc,
  getCouchDesignDoc as expectedGetCouchDesignDoc,
} from "./validation/validateDocUpdate.ts";
import expectedJobDb from "./client/ClientDB.ts";

describe("index.ts entry point", () => {
  it("re-exports the exact runtime values", () => {
    assert.strictEqual(entryPoint.ClientDb, expectedJobDb);
    assert.strictEqual(entryPoint.validateDocUpdate, expectedValidateDocUpdate);
    assert.strictEqual(entryPoint.assertValidDoc, expectedAssertValidDoc);
    assert.strictEqual(entryPoint.getCouchDesignDoc, expectedGetCouchDesignDoc);
  });

  it("does not expose unexpected runtime exports", () => {
    const exportedKeys = Object.keys(entryPoint).sort();
    assert.deepStrictEqual(exportedKeys, [
      "ClientDb",
      "assertValidDoc",
      "getCouchDesignDoc",
      "validateDocUpdate",
    ]);
  });
});
