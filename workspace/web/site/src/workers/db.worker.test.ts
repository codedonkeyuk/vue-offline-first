const { mockDbInstance, ClientDBMock } = vi.hoisted(() => {
  const mockDbInstance = {
    close: vi.fn(),
    destroyLocal: vi.fn().mockResolvedValue(undefined),
    watchChanges: vi.fn(),
    startSync: vi.fn(),
    stopSync: vi.fn(),
    setToken: vi.fn(),
    saveTextDocument: vi.fn(),
    getById: vi.fn(),
  };

  return {
    mockDbInstance,
    ClientDBMock: vi.fn(function (
      _dbName: string,
      _options: { onActivity: () => void },
    ) {
      return mockDbInstance;
    }),
  };
});

vi.mock("@vue-offline-first/db-config", () => ({
  ClientDB: ClientDBMock,
}));

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe("db.worker", () => {
  const postMessageSpy = vi.fn();
  const fetchSpy = vi.fn();
  const nowSeconds = 1_700_000_000;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.spyOn(Date, "now").mockReturnValue(nowSeconds * 1000);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("postMessage", postMessageSpy);
    vi.stubGlobal("fetch", fetchSpy);

    await import("./db.worker.js");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function sendToWorker(data: unknown) {
    await self.onmessage?.({ data } as MessageEvent);
  }

  describe("INIT command", () => {
    it("initializes local-only ClientDB, watches changes, and replies with result: true", async () => {
      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: { dbName: "local-jobs", options: {} },
      });

      expect(ClientDBMock).toHaveBeenCalledWith(
        "local-jobs",
        expect.objectContaining({
          onActivity: expect.any(Function),
        }),
      );
      expect(mockDbInstance.watchChanges).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.startSync).not.toHaveBeenCalled();
      expect(postMessageSpy).toHaveBeenCalledWith({ id: 1, result: true });

      const changeCallback = mockDbInstance.watchChanges.mock.calls[0]![0];
      changeCallback({ id: "doc-1", seq: 2 });
      expect(postMessageSpy).toHaveBeenCalledWith({
        event: "db:change",
        data: { id: "doc-1", seq: 2 },
      });
    });

    it("closes any previously open db before initializing a new one", async () => {
      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: { dbName: "db-1", options: {} },
      });
      await sendToWorker({
        id: 2,
        type: "INIT",
        payload: { dbName: "db-2", options: {} },
      });

      expect(mockDbInstance.close).toHaveBeenCalledTimes(1);
    });

    it("tears down session and returns result: false if initial token is already expired", async () => {
      const expiredToken = makeJwt({ exp: nowSeconds - 10 });

      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: {
          dbName: "jobs",
          options: {
            remoteBaseUrl: "https://example.com",
            token: expiredToken,
          },
        },
      });

      expect(mockDbInstance.destroyLocal).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.startSync).not.toHaveBeenCalled();
      expect(postMessageSpy).toHaveBeenNthCalledWith(1, {
        event: "session:expired",
      });
      expect(postMessageSpy).toHaveBeenNthCalledWith(2, {
        id: 1,
        result: false,
      });
    });

    it("starts sync and forwards sync lifecycle callbacks when remoteBaseUrl is provided", async () => {
      const validToken = makeJwt({ exp: nowSeconds + 3600 });

      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: {
          dbName: "jobs",
          options: {
            remoteBaseUrl: "https://example.com",
            token: validToken,
          },
        },
      });

      expect(mockDbInstance.startSync).toHaveBeenCalledTimes(1);
      const handlers = mockDbInstance.startSync.mock.calls[0]![0];

      handlers.onChange({ docs_written: 1 });
      expect(postMessageSpy).toHaveBeenCalledWith({
        event: "sync:change",
        data: { docs_written: 1 },
      });

      handlers.onPaused({ status: 0 });
      expect(postMessageSpy).toHaveBeenCalledWith({
        event: "sync:paused",
        error: { status: 0 },
      });

      handlers.onActive();
      expect(postMessageSpy).toHaveBeenCalledWith({ event: "sync:active" });

      handlers.onDenied({ doc: { reason: "Forbidden" } });
      expect(postMessageSpy).toHaveBeenCalledWith({
        event: "sync:denied",
        error: "Forbidden",
      });

      handlers.onError({ status: 500, message: "Server Error" });
      expect(postMessageSpy).toHaveBeenCalledWith({
        event: "sync:error",
        error: "Server Error",
      });
    });

    it("tears down session as expired when startSync onError receives status 401", async () => {
      const validToken = makeJwt({ exp: nowSeconds + 3600 });

      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: {
          dbName: "jobs",
          options: {
            remoteBaseUrl: "https://example.com",
            token: validToken,
          },
        },
      });

      const handlers = mockDbInstance.startSync.mock.calls[0]![0];
      handlers.onError({ status: 401 });
      await Promise.resolve();

      expect(mockDbInstance.destroyLocal).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith({ event: "session:expired" });
    });
  });

  describe("Activity Token Renewal & Expiration", () => {
    it("throttles /renew requests within renewThrottleMs and renews once throttle window passes", async () => {
      const validToken = makeJwt({ exp: nowSeconds + 3600 });
      const renewedToken = makeJwt({ exp: nowSeconds + 7200 });

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ token: renewedToken }),
      });

      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: {
          dbName: "jobs",
          options: {
            remoteBaseUrl: "https://example.com",
            authBaseUrl: "https://example.com",
            token: validToken,
            renewThrottleMs: 60_000,
          },
        },
      });

      const onActivity = ClientDBMock.mock.calls[0]![1].onActivity;

      // Within 60s throttle window -> does not call fetch
      vi.spyOn(Date, "now").mockReturnValue((nowSeconds + 30) * 1000);
      onActivity();
      await Promise.resolve();
      expect(fetchSpy).not.toHaveBeenCalled();

      // Past 60s throttle window -> calls POST /renew and updates token
      vi.spyOn(Date, "now").mockReturnValue((nowSeconds + 61) * 1000);
      onActivity();
      await vi.waitFor(() => {
        expect(postMessageSpy).toHaveBeenCalledWith({
          event: "session:renewed",
          token: renewedToken,
        });
      });

      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/renew", {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
      });
      expect(mockDbInstance.setToken).toHaveBeenCalledWith(renewedToken);
    });

    it("tears down session if token expired before activity or /renew returns 401", async () => {
      const validToken = makeJwt({ exp: nowSeconds + 100 });

      fetchSpy.mockResolvedValue({ ok: false, status: 401 });

      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: {
          dbName: "jobs",
          options: {
            remoteBaseUrl: "https://example.com",
            authBaseUrl: "https://example.com",
            token: validToken,
            renewThrottleMs: 1000,
          },
        },
      });

      const onActivity = ClientDBMock.mock.calls[0]![1].onActivity;

      // Advance past throttle window (still before exp), server rejects with 401
      vi.spyOn(Date, "now").mockReturnValue((nowSeconds + 10) * 1000);
      onActivity();

      await vi.waitFor(() => {
        expect(postMessageSpy).toHaveBeenCalledWith({
          event: "session:expired",
        });
      });
      expect(mockDbInstance.destroyLocal).toHaveBeenCalledTimes(1);
    });
  });

  describe("STOP_SYNC, LOGOUT, DESTROY, and CALL commands", () => {
    it("STOP_SYNC stops sync and replies with result: true", async () => {
      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: { dbName: "jobs", options: {} },
      });
      await sendToWorker({ id: 2, type: "STOP_SYNC" });

      expect(mockDbInstance.stopSync).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenLastCalledWith({ id: 2, result: true });
    });

    it("LOGOUT stops sync, posts to /logout, wipes local db, and emits session:logged_out", async () => {
      const validToken = makeJwt({ exp: nowSeconds + 3600 });
      fetchSpy.mockResolvedValue({ ok: true });

      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: {
          dbName: "jobs",
          options: {
            authBaseUrl: "https://example.com",
            token: validToken,
          },
        },
      });

      await sendToWorker({ id: 2, type: "LOGOUT" });

      expect(mockDbInstance.stopSync).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
      });
      expect(mockDbInstance.destroyLocal).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith({
        event: "session:logged_out",
      });
      expect(postMessageSpy).toHaveBeenLastCalledWith({ id: 2, result: true });
    });

    it("DESTROY destroys local db without emitting session events", async () => {
      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: { dbName: "jobs", options: {} },
      });
      postMessageSpy.mockClear();

      await sendToWorker({ id: 2, type: "DESTROY" });

      expect(mockDbInstance.destroyLocal).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith({ id: 2, result: true });
    });

    it("CALL invokes method on ClientDB and returns its result", async () => {
      mockDbInstance.getById.mockResolvedValue({ _id: "123", title: "Note" });

      await sendToWorker({
        id: 1,
        type: "INIT",
        payload: { dbName: "jobs", options: {} },
      });

      await sendToWorker({
        id: 2,
        type: "CALL",
        payload: { method: "getById", args: ["123"] },
      });

      expect(mockDbInstance.getById).toHaveBeenCalledWith("123");
      expect(postMessageSpy).toHaveBeenLastCalledWith({
        id: 2,
        result: { _id: "123", title: "Note" },
      });
    });

    it("CALL posts an error response if db is uninitialized or method does not exist", async () => {
      await sendToWorker({
        id: 1,
        type: "CALL",
        payload: { method: "getById", args: ["123"] },
      });

      expect(postMessageSpy).toHaveBeenLastCalledWith({
        id: 1,
        error: "Database not initialized in worker.",
      });

      await sendToWorker({
        id: 2,
        type: "INIT",
        payload: { dbName: "jobs", options: {} },
      });

      await sendToWorker({
        id: 3,
        type: "CALL",
        payload: { method: "nonExistentMethod", args: [] },
      });

      expect(postMessageSpy).toHaveBeenLastCalledWith({
        id: 3,
        error: "Unknown method: nonExistentMethod",
      });
    });
  });
});
