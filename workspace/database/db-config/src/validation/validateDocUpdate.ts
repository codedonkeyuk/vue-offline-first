import type { AppDocument } from "../types.ts";

function validateDocUpdate(
  newDoc: any,
  oldDoc: any,
  userCtx: { roles: string[] },
): void {
  var SCHEMA_CONFIGS: Record<string, any> = {
    cover_letter: {
      mutable: false,
      linkField: "coverLetterId",
      allowedFields: [
        "_id",
        "_rev",
        "_revisions",
        "type",
        "title",
        "content",
        "updatedAt",
        "coverLetterId",
      ],
      maxContent: 5000,
    },
    cv: {
      mutable: false,
      linkField: "cvId",
      allowedFields: [
        "_id",
        "_rev",
        "_revisions",
        "type",
        "title",
        "content",
        "updatedAt",
        "cvId",
      ],
      maxContent: 5000,
    },
    job_application: {
      mutable: true,
      allowedFields: [
        "_id",
        "_rev",
        "_revisions",
        "type",
        "title",
        "content",
        "updatedAt",
      ],
      maxContent: 5000,
    },
    text_document: {
      mutable: true,
      allowedFields: [
        "_id",
        "_rev",
        "_revisions",
        "type",
        "title",
        "content",
        "updatedAt",
      ],
      maxContent: 5000,
    },
  };

  if (
    newDoc._id &&
    newDoc._id.indexOf("_design/") === 0 &&
    userCtx.roles.indexOf("_admin") === -1
  ) {
    throw { forbidden: "Only admins can modify design documents." };
  }

  if (newDoc._deleted) {
    if (oldDoc && oldDoc.type) {
      var oldConfig = SCHEMA_CONFIGS[oldDoc.type];
      if (oldConfig && !oldConfig.mutable) {
        throw {
          forbidden:
            "Immutable records of type " + oldDoc.type + " cannot be deleted.",
        };
      }
    }
    return;
  }

  if (oldDoc && oldDoc.type !== newDoc.type) {
    throw { forbidden: "Document type cannot be changed after creation." };
  }

  var config = SCHEMA_CONFIGS[newDoc.type];
  if (!config) {
    throw { forbidden: "Unknown document type: " + newDoc.type };
  }

  for (var key in newDoc) {
    if (
      Object.prototype.hasOwnProperty.call(newDoc, key) &&
      config.allowedFields.indexOf(key) === -1
    ) {
      throw { forbidden: "Field not allowed for " + newDoc.type + ": " + key };
    }
  }

  if (newDoc.content !== undefined) {
    if (
      typeof newDoc.content !== "string" ||
      newDoc.content.length > config.maxContent
    ) {
      throw {
        forbidden:
          "Content for " +
          newDoc.type +
          " must be under " +
          config.maxContent +
          " characters.",
      };
    }
  }

  if (!newDoc.updatedAt || isNaN(new Date(newDoc.updatedAt).getTime())) {
    throw { forbidden: "A valid timestamp (updatedAt) is required." };
  }

  if (!config.mutable) {
    if (oldDoc) {
      throw {
        forbidden:
          "Records of type " +
          newDoc.type +
          " are immutable and cannot be modified.",
      };
    }

    var linkField = config.linkField;
    if (
      linkField &&
      (!newDoc[linkField] || typeof newDoc[linkField] !== "string")
    ) {
      throw {
        forbidden:
          "Non-mutable records of type " +
          newDoc.type +
          " must have a " +
          linkField +
          " reference.",
      };
    }
  }
}

export function assertValidDoc(
  newDoc: Partial<AppDocument> & { _deleted?: boolean },
  oldDoc: Partial<AppDocument> | null = null,
  userCtx: { roles: string[] } = { roles: [] },
): void {
  try {
    validateDocUpdate(newDoc, oldDoc, userCtx);
  } catch (err: any) {
    if (err && err.forbidden) {
      const error = new Error(err.forbidden) as Error & { status?: number };
      error.status = 403;
      throw error;
    }
    throw err;
  }
}

export function getCouchDesignDoc() {
  const anonymousFn = validateDocUpdate
    .toString()
    .replace(/^function\s+validateDocUpdate/, "function");

  return {
    _id: "_design/validation",
    validate_doc_update: anonymousFn,
  };
}

export default validateDocUpdate;
