import { JobDb, type JobDbOptions } from "@job-search/db-config";

export interface WorkerDbOptions extends JobDbOptions {
  authBaseUrl?: string;
  renewThrottleMs?: number;
}

let db: JobDb | null = null;
let currentToken: string | undefined;
let authBaseUrl: string | undefined;
let lastRenewedAt = 0;
let renewInFlight: Promise<void> | null = null;
let renewThrottleMs = 5 * 60 * 1000;

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    if (typeof payload.exp !== "number") return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

async function teardownSession(reason: "expired" | "logged_out") {
  currentToken = undefined;
  lastRenewedAt = 0;

  if (db) {
    await db.destroyLocal();
    db = null;
  }

  self.postMessage({
    event: reason === "expired" ? "session:expired" : "session:logged_out",
  });
}

async function handleActivity() {
  if (!currentToken || !authBaseUrl || !db) return;

  // If the token expired while the tab was backgrounded/sleeping, tear down immediately
  if (isTokenExpired(currentToken)) {
    await teardownSession("expired");
    return;
  }

  const now = Date.now();
  if (now - lastRenewedAt < renewThrottleMs) {
    return;
  }

  if (renewInFlight) return;

  const cleanAuthUrl = authBaseUrl.replace(/\/$/, "");
  const tokenToRenew = currentToken;

  renewInFlight = (async () => {
    try {
      const res = await fetch(`${cleanAuthUrl}/renew`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenToRenew}`,
        },
      });

      if (res.ok) {
        const data = (await res.json()) as { token?: string };
        if (data.token && db && currentToken === tokenToRenew) {
          currentToken = data.token;
          lastRenewedAt = Date.now();
          db.setToken(data.token);
          self.postMessage({ event: "session:renewed", token: data.token });
        }
      } else if (res.status === 401) {
        await teardownSession("expired");
      }
    } catch {
    } finally {
      renewInFlight = null;
    }
  })();

  await renewInFlight;
}

self.onmessage = async (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  try {
    if (type === "INIT") {
      db?.close();

      const options = (payload.options ?? {}) as WorkerDbOptions;
      currentToken = options.token;
      authBaseUrl = options.authBaseUrl;
      renewThrottleMs = options.renewThrottleMs ?? 5 * 60 * 1000;
      lastRenewedAt = Date.now();

      db = new JobDb(payload.dbName, {
        ...options,
        onActivity: () => {
          void handleActivity();
        },
      });

      if (currentToken && isTokenExpired(currentToken)) {
        await teardownSession("expired");
        self.postMessage({ id, result: false });
        return;
      }

      void db.watchChanges((change) => {
        self.postMessage({ event: "db:change", data: change });
      });

      if (options.remoteBaseUrl) {
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
            if (err?.status === 401) {
              void teardownSession("expired");
              return;
            }

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

    if (type === "LOGOUT") {
      const tokenToRevoke = currentToken;
      const cleanAuthUrl = authBaseUrl?.replace(/\/$/, "");

      db?.stopSync();

      if (tokenToRevoke && cleanAuthUrl) {
        try {
          await fetch(`${cleanAuthUrl}/logout`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenToRevoke}`,
            },
          });
        } catch {
          // Offline during logout: proceed with local wipe regardless
        }
      }

      await teardownSession("logged_out");
      self.postMessage({ id, result: true });
      return;
    }

    if (type === "DESTROY") {
      currentToken = undefined;
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
