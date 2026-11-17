import validateDocUpdate, {
  assertValidDoc,
  getCouchDesignDoc,
} from "./validation/validateDocUpdate.ts";
import type {
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
  TextDoc,
  AppDocument,
} from "./types.ts";
import ClientDb, { type ClientDbOptions } from "./client/ClientDB.ts";

export { ClientDb, validateDocUpdate, getCouchDesignDoc, assertValidDoc };

export type {
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
  TextDoc,
  AppDocument,
  ClientDbOptions,
};
