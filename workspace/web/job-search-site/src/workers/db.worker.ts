import { JobSearchLocalDb, type DbClientOptions } from "@job-search/local-db";

let db: JobSearchLocalDb | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  try {
    if (type === "INIT") {
      db?.close();
      db = new JobSearchLocalDb(
        payload.dbName,
        payload.options as DbClientOptions,
      );

      void db.watchChanges((change) => {
        self.postMessage({ event: "db:change", data: change });
      });

      if (payload.options?.remoteBaseUrl) {
        db.startSync({
          onChange: (info) =>
            self.postMessage({ event: "sync:change", data: info }),
          onPaused: (err) =>
            self.postMessage({ event: "sync:paused", error: err }),
          onActive: () => self.postMessage({ event: "sync:active" }),
          onDenied: (err) => {
            console.error("[db.worker] sync:denied:", err);
            self.postMessage({
              event: "sync:denied",
              error: err?.doc?.reason ?? err?.message ?? "Document sync denied",
            });
          },
          onError: (err) => {
            const details = JSON.stringify(
              err,
              Object.getOwnPropertyNames(err ?? {}),
            );
            console.error("[db.worker] sync:error:", details);
            self.postMessage({
              event: "sync:error",
              error: err?.message ?? details,
            });
          },
        });
      }

      self.postMessage({ id, result: true });
      return;
    }

    if (type === "STOP_SYNC") {
      db?.stopSync();
      self.postMessage({ id, result: true });
      return;
    }

    if (type === "DESTROY") {
      if (db) {
        await db.destroyLocal();
        db = null;
      }
      self.postMessage({ id, result: true });
      return;
    }

    if (type === "CALL") {
      if (!db) throw new Error("Database not initialized in worker.");
      const method = (db as Record<string, any>)[payload.method];
      if (typeof method !== "function") {
        throw new Error(`Unknown method: ${payload.method}`);
      }
      const result = await method.apply(db, payload.args ?? []);
      self.postMessage({ id, result });
    }
  } catch (err: any) {
    self.postMessage({ id, error: err?.message ?? String(err) });
  }
};
