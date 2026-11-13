declare function validateDocUpdate(
  newDoc: Record<string, any>,
  oldDoc: Record<string, any> | null,
  userCtx: { name: string | null; roles: string[] },
): void;

export = validateDocUpdate;
