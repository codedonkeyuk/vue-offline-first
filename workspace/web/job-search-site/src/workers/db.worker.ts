import {
  JobSearchLocalDb,
  type DbClientOptions,
  type RemoteSyncOptions,
} from "@job-search/local-db";

let db: JobSearchLocalDb | null = null;

function attachSync() {
  if (!db) return;

  void db.startSync({
    onChange: (info) => self.postMessage({ event: "sync:change", data: info }),
    onPaused: (err) => self.postMessage({ event: "sync:paused", error: err }),
    onActive: () => self.postMessage({ event: "sync:active" }),
    onDenied: (err) => self.postMessage({ event: "sync:denied", error: err }),
    onError: (err) => self.postMessage({ event: "sync:error", error: err }),
  });
}

self.onmessage = async (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  try {
    if (type === "INIT") {
      db?.stopSync();
      db = new JobSearchLocalDb(
        payload?.dbName ?? "job-search-local",
        payload?.options as DbClientOptions,
      );

      void db.watchChanges((change) => {
        self.postMessage({ event: "db:change", data: change });
      });

      if (payload?.options?.sync) {
        attachSync();
      }

      self.postMessage({ id, result: true });
      return;
    }

    if (type === "ENABLE_SYNC") {
      if (!db) throw new Error("Database not initialized in worker.");
      db.configureRemote(payload as RemoteSyncOptions);
      attachSync();
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
