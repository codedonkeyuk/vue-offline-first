import validateDocUpdate, {
  assertValidDoc,
  getCouchDesignDoc,
} from "./validation/validateDocUpdate.ts";
import type {
  CoverLetterDoc,
  CvDoc,
  JobApplicationDoc,
  AppDocument,
} from "./types.ts";
import JobDb from "./client/JobDB.ts";

export { JobDb, validateDocUpdate, getCouchDesignDoc, assertValidDoc };

export type { CoverLetterDoc, CvDoc, JobApplicationDoc, AppDocument };
