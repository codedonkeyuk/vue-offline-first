import validateDocUpdate, {
  assertValidDoc,
  getCouchDesignDoc,
} from "./validation/validateDocUpdate.ts";
import type {
  BaseDoc,
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
  AppDocument,
} from "./types.ts";
import JobDb, { type JobDbOptions } from "./client/JobDB.ts";

export { JobDb, validateDocUpdate, assertValidDoc, getCouchDesignDoc };

export type {
  BaseDoc,
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
  AppDocument,
  JobDbOptions,
};
