function validateDocUpdate(newDoc, oldDoc, userCtx) {
  var SCHEMA_CONFIGS = {
    cover_letter: {
      mutable: false,
      linkField: "coverLetterId",
      allowedFields: [
        "_id",
        "_rev",
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
      allowedFields: ["_id", "_rev", "type", "title", "content", "updatedAt"],
      maxContent: 5000,
    },
  };

  // 1. ADMIN / DESIGN SECURITY
  if (
    newDoc._id &&
    newDoc._id.indexOf("_design/") === 0 &&
    userCtx.roles.indexOf("_admin") === -1
  ) {
    throw { forbidden: "Only admins can modify design documents." };
  }

  // 2. DELETION CHECK
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

  // 3. IDENTIFY DOCUMENT TYPE & PREVENT TYPE SWITCHING
  if (oldDoc && oldDoc.type !== newDoc.type) {
    throw { forbidden: "Document type cannot be changed after creation." };
  }

  var config = SCHEMA_CONFIGS[newDoc.type];
  if (!config) {
    throw { forbidden: "Unknown document type: " + newDoc.type };
  }

  // 4. FIELD WHITELIST
  for (var key in newDoc) {
    if (
      newDoc.hasOwnProperty(key) &&
      config.allowedFields.indexOf(key) === -1
    ) {
      throw { forbidden: "Field not allowed for " + newDoc.type + ": " + key };
    }
  }

  // 5. CONTENT VALIDATION
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

  // 6. TIMESTAMP VALIDATION
  if (!newDoc.updatedAt || isNaN(new Date(newDoc.updatedAt).getTime())) {
    throw { forbidden: "A valid timestamp (updatedAt) is required." };
  }

  // 7. MUTABLE VS IMMUTABLE LOGIC
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

export default validateDocUpdate;
