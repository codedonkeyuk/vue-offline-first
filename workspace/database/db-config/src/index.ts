import validateDocUpdate, {
  assertValidDoc,
  getCouchDesignDoc,
} from "./validation/validateDocUpdate.ts";
import type { TextDoc, AppDocument } from "./types.ts";
import ClientDB, { type ClientDbOptions } from "./client/ClientDB.ts";

export { ClientDB, validateDocUpdate, getCouchDesignDoc, assertValidDoc };

export type { TextDoc, AppDocument, ClientDbOptions };
