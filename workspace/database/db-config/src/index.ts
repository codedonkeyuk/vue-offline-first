import validateDocUpdate, {
  assertValidDoc,
  getCouchDesignDoc,
} from "./validateDocUpdate.ts";
import type {
  BaseDoc,
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
  AppDocument,
} from "./types.ts";
import JobDb, { type JobDbOptions } from "./JobDB.ts";

export { JobDb, validateDocUpdate, assertValidDoc, getCouchDesignDoc };

export type {
  BaseDoc,
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
  AppDocument,
  JobDbOptions,
};
