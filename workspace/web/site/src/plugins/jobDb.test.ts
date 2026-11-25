import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";
import {
  createJobDbPlugin,
  useJobDb,
  type JobDbContext,
  type WorkerDbOptions,
} from "./jobDb.js";

const STORAGE_KEY = "job_search_sync_session";

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  url: string | URL;
  options?: WorkerOptions;

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    MockWorker.instances.push(this);
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe("jobDb plugin & useJobDb", () => {
  let storageMap: Map<string, string>;

  beforeEach(() => {
    MockWorker.instances = [];
    vi.stubGlobal("Worker", MockWorker);

    storageMap = new Map();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
      setItem: vi.fn((key: string, val: string) => {
        storageMap.set(key, val);
      }),
      removeItem: vi.fn((key: string) => {
        storageMap.delete(key);
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mountWithPlugin(
    dbName = "test-db",
    initialOptions?: WorkerDbOptions,
  ): { ctx: JobDbContext; worker: MockWorker } {
    let ctx!: JobDbContext;

    const Consumer = defineComponent({
      setup() {
        ctx = useJobDb();
        return () => null;
      },
    });

    mount(Consumer, {
      global: {
        plugins: [createJobDbPlugin(dbName, initialOptions)],
      },
    });

    const worker = MockWorker.instances[0]!;
    return { ctx, worker };
  }

  it("throws when useJobDb() is called without installing the plugin", () => {
    const BadConsumer = defineComponent({
      setup() {
        useJobDb();
        return () => null;
      },
    });

    expect(() => mount(BadConsumer)).toThrow(
      "useJobDb() must be used inside a Vue app with createJobDbPlugin installed.",
    );
  });

  describe("Boot & Initialisation", () => {
    it("boots in local-only unauthenticated state when no session or initialOptions exist", async () => {
      const { ctx, worker } = mountWithPlugin("jobs-db");

      expect(ctx.isSyncEnabled.value).toBe(false);
      expect(ctx.syncState.value).toBe("idle");
      expect(ctx.sessionState.value).toBe("unauthenticated");

      expect(worker.postMessage).toHaveBeenCalledWith({
        id: 1,
        type: "INIT",
        payload: { dbName: "jobs-db", options: {} },
      });

      worker.emitMessage({ id: 1, result: true });
      await flushPromises();

      expect(ctx.isSyncEnabled.value).toBe(false);
      expect(ctx.syncState.value).toBe("idle");
    });

    it("restores saved session from localStorage, merges initialOptions, and starts syncing", async () => {
      storageMap.set(
        STORAGE_KEY,
        JSON.stringify({
          remoteBaseUrl: "https://saved.com",
          remoteDbName: "user_db",
          token: "saved-jwt",
        }),
      );

      const { ctx, worker } = mountWithPlugin("jobs-db", {
        renewThrottleMs: 5000,
      });

      expect(ctx.isSyncEnabled.value).toBe(true);
      expect(ctx.sessionState.value).toBe("authenticated");

      expect(worker.postMessage).toHaveBeenCalledWith({
        id: 1,
        type: "INIT",
        payload: {
          dbName: "jobs-db",
          options: {
            remoteBaseUrl: "https://saved.com",
            remoteDbName: "user_db",
            token: "saved-jwt",
            renewThrottleMs: 5000,
          },
        },
      });

      worker.emitMessage({ id: 1, result: true });
      await flushPromises();

      expect(ctx.syncState.value).toBe("syncing");
      expect(ctx.sessionState.value).toBe("authenticated");
    });

    it("resets to local-only expired session when worker INIT returns false", async () => {
      storageMap.set(
        STORAGE_KEY,
        JSON.stringify({
          remoteBaseUrl: "https://saved.com",
          remoteDbName: "user_db",
          token: "expired-jwt",
        }),
      );

      const { ctx, worker } = mountWithPlugin("jobs-db");

      // Worker rejects expired token on startup INIT
      worker.emitMessage({ id: 1, result: false });
      await flushPromises();

      expect(storageMap.has(STORAGE_KEY)).toBe(false);
      expect(ctx.isSyncEnabled.value).toBe(false);
      expect(ctx.syncState.value).toBe("idle");
      expect(ctx.sessionState.value).toBe("expired");

      // Re-initialises clean local-only DB
      expect(worker.postMessage).toHaveBeenNthCalledWith(2, {
        id: 2,
        type: "INIT",
        payload: { dbName: "jobs-db", options: {} },
      });
    });
  });

  describe("Sync & Session Lifecycle Actions", () => {
    it("connectSync saves session and updates reactive state on success", async () => {
      const { ctx, worker } = mountWithPlugin("jobs-db");
      worker.emitMessage({ id: 1, result: true });
      await flushPromises();

      const newOptions: WorkerDbOptions = {
        remoteBaseUrl: "https://new.com",
        remoteDbName: "db_1",
        token: "new-token",
      };

      const connectPromise = ctx.connectSync(newOptions);
      expect(worker.postMessage).toHaveBeenNthCalledWith(2, {
        id: 2,
        type: "INIT",
        payload: { dbName: "jobs-db", options: newOptions },
      });

      worker.emitMessage({ id: 2, result: true });
      await connectPromise;

      expect(JSON.parse(storageMap.get(STORAGE_KEY)!)).toEqual(newOptions);
      expect(ctx.isSyncEnabled.value).toBe(true);
      expect(ctx.syncState.value).toBe("syncing");
      expect(ctx.sessionState.value).toBe("authenticated");
    });

    it("disconnectSync sends STOP_SYNC and sets syncState to idle", async () => {
      const { ctx, worker } = mountWithPlugin("jobs-db", {
        remoteBaseUrl: "https://couch.com",
        remoteDbName: "db_1",
        token: "tok",
      });
      worker.emitMessage({ id: 1, result: true });
      await flushPromises();

      const disconnectPromise = ctx.disconnectSync();
      expect(worker.postMessage).toHaveBeenNthCalledWith(2, {
        id: 2,
        type: "STOP_SYNC",
        payload: undefined,
      });

      worker.emitMessage({ id: 2, result: undefined });
      await disconnectPromise;

      expect(ctx.isSyncEnabled.value).toBe(false);
      expect(ctx.syncState.value).toBe("idle");
    });

    it("destroyLocal sends DESTROY, clears storage, and resets state", async () => {
      const { ctx, worker } = mountWithPlugin("jobs-db", {
        remoteBaseUrl: "https://couch.com",
        remoteDbName: "db_1",
        token: "tok",
      });
      worker.emitMessage({ id: 1, result: true });
      await flushPromises();

      const destroyPromise = ctx.destroyLocal();
      expect(worker.postMessage).toHaveBeenNthCalledWith(2, {
        id: 2,
        type: "DESTROY",
        payload: undefined,
      });

      worker.emitMessage({ id: 2, result: undefined });
      await destroyPromise;

      expect(storageMap.has(STORAGE_KEY)).toBe(false);
      expect(ctx.isSyncEnabled.value).toBe(false);
      expect(ctx.syncState.value).toBe("idle");
      expect(ctx.sessionState.value).toBe("unauthenticated");
      expect(ctx.lastDocChange.value).toBeNull();
    });

    it("logout sends LOGOUT command to worker", async () => {
      const { ctx, worker } = mountWithPlugin("jobs-db");
      worker.emitMessage({ id: 1, result: true });
      await flushPromises();

      const logoutPromise = ctx.logout();
      expect(worker.postMessage).toHaveBeenNthCalledWith(2, {
        id: 2,
        type: "LOGOUT",
        payload: undefined,
      });

      worker.emitMessage({ id: 2, result: undefined });
      await logoutPromise;
    });
  });

  describe("Worker Unsolicited Events", () => {
    it("updates lastDocChange on db:change event", () => {
      const { ctx, worker } = mountWithPlugin();
      const change = { id: "doc-1", seq: 5 };

      worker.emitMessage({ event: "db:change", data: change });

      expect(ctx.lastDocChange.value).toEqual(change);
    });

    it.each(["sync:change", "sync:active"])(
      "sets syncState to 'syncing' and clears syncError on %s",
      (eventName) => {
        const { ctx, worker } = mountWithPlugin();
        ctx.syncError.value = new Error("previous error");

        worker.emitMessage({ event: eventName });

        expect(ctx.syncState.value).toBe("syncing");
        expect(ctx.syncError.value).toBeNull();
      },
    );

    it("sets syncState to 'paused' when sync:paused has no real error", () => {
      const { ctx, worker } = mountWithPlugin();

      worker.emitMessage({ event: "sync:paused", error: {} });

      expect(ctx.syncState.value).toBe("paused");
      expect(ctx.syncError.value).toBeNull();
    });

    it("sets syncState to 'error' when sync:paused includes an error payload", () => {
      const { ctx, worker } = mountWithPlugin();
      const err = { status: 503, message: "Service Unavailable" };

      worker.emitMessage({ event: "sync:paused", error: err });

      expect(ctx.syncState.value).toBe("error");
      expect(ctx.syncError.value).toEqual(err);
    });

    it("handles sync:denied and sync:error events", () => {
      const { ctx, worker } = mountWithPlugin();

      worker.emitMessage({ event: "sync:denied", error: "403 Forbidden" });
      expect(ctx.syncState.value).toBe("denied");
      expect(ctx.syncError.value).toBe("403 Forbidden");

      worker.emitMessage({ event: "sync:error", error: "Network failure" });
      expect(ctx.syncState.value).toBe("error");
      expect(ctx.syncError.value).toBe("Network failure");
    });

    it("updates stored token on session:renewed", () => {
      storageMap.set(
        STORAGE_KEY,
        JSON.stringify({
          remoteBaseUrl: "https://couch.com",
          remoteDbName: "db_1",
          token: "old-token",
        }),
      );

      const { worker } = mountWithPlugin();
      worker.emitMessage({
        event: "session:renewed",
        token: "refreshed-token",
      });

      expect(JSON.parse(storageMap.get(STORAGE_KEY)!)).toEqual({
        remoteBaseUrl: "https://couch.com",
        remoteDbName: "db_1",
        token: "refreshed-token",
      });
    });

    it("resets to local-only expired state on session:expired", async () => {
      storageMap.set(STORAGE_KEY, JSON.stringify({ token: "tok" }));
      const { ctx, worker } = mountWithPlugin("jobs-db");

      worker.emitMessage({ event: "session:expired" });
      await flushPromises();

      expect(storageMap.has(STORAGE_KEY)).toBe(false);
      expect(ctx.sessionState.value).toBe("expired");
      expect(ctx.isSyncEnabled.value).toBe(false);
      expect(worker.postMessage).toHaveBeenLastCalledWith({
        id: 2,
        type: "INIT",
        payload: { dbName: "jobs-db", options: {} },
      });
    });

    it("resets to local-only unauthenticated state on session:logged_out", async () => {
      storageMap.set(STORAGE_KEY, JSON.stringify({ token: "tok" }));
      const { ctx, worker } = mountWithPlugin("jobs-db");

      worker.emitMessage({ event: "session:logged_out" });
      await flushPromises();

      expect(storageMap.has(STORAGE_KEY)).toBe(false);
      expect(ctx.sessionState.value).toBe("unauthenticated");
      expect(ctx.isSyncEnabled.value).toBe(false);
      expect(worker.postMessage).toHaveBeenLastCalledWith({
        id: 2,
        type: "INIT",
        payload: { dbName: "jobs-db", options: {} },
      });
    });
  });

  describe("CRUD RPC Methods & Error Handling", () => {
    it("forwards saveTextDoc, getById, getAllByType, and remove via CALL messages", async () => {
      const { ctx, worker } = mountWithPlugin();
      worker.emitMessage({ id: 1, result: true });
      await flushPromises();

      const savePromise = ctx.saveTextDoc({ title: "Doc", content: "Body" });
      expect(worker.postMessage).toHaveBeenNthCalledWith(2, {
        id: 2,
        type: "CALL",
        payload: {
          method: "saveTextDocument",
          args: [{ title: "Doc", content: "Body" }],
        },
      });
      worker.emitMessage({ id: 2, result: { ok: true, id: "1", rev: "1-a" } });
      await expect(savePromise).resolves.toEqual({
        ok: true,
        id: "1",
        rev: "1-a",
      });

      const getPromise = ctx.getById("1");
      expect(worker.postMessage).toHaveBeenNthCalledWith(3, {
        id: 3,
        type: "CALL",
        payload: { method: "getById", args: ["1"] },
      });
      worker.emitMessage({ id: 3, result: { _id: "1", title: "Doc" } });
      await expect(getPromise).resolves.toEqual({ _id: "1", title: "Doc" });

      const getAllPromise = ctx.getAllByType("text_document");
      expect(worker.postMessage).toHaveBeenNthCalledWith(4, {
        id: 4,
        type: "CALL",
        payload: { method: "getAllByType", args: ["text_document"] },
      });
      worker.emitMessage({ id: 4, result: [{ _id: "1" }] });
      await expect(getAllPromise).resolves.toEqual([{ _id: "1" }]);

      const removePromise = ctx.remove("1");
      expect(worker.postMessage).toHaveBeenNthCalledWith(5, {
        id: 5,
        type: "CALL",
        payload: { method: "remove", args: ["1"] },
      });
      worker.emitMessage({ id: 5, result: { ok: true, id: "1", rev: "2-b" } });
      await expect(removePromise).resolves.toEqual({
        ok: true,
        id: "1",
        rev: "2-b",
      });
    });

    it("rejects the pending promise when worker responds with an error", async () => {
      const { ctx, worker } = mountWithPlugin();
      worker.emitMessage({ id: 1, result: true });
      await flushPromises();

      const getPromise = ctx.getById("missing-id");
      worker.emitMessage({ id: 2, error: "Document not found" });

      await expect(getPromise).rejects.toThrow("Document not found");
    });
  });
});
