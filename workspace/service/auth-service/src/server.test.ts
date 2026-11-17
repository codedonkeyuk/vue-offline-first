import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "./server.ts";

const JWT_SECRET = process.env.JWT_SECRET ?? "local-dev-secret";

describe("Auth server endpoints", () => {
  let server: Server;
  let baseUrl: string;
  const originalFetch = globalThis.fetch;

  before(() => {
    return new Promise<void>((resolve) => {
      // Port 0 assigns a random free OS port
      server = app.listen(0, () => {
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    globalThis.fetch = originalFetch;
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    mock.restoreAll();
    globalThis.fetch = originalFetch;
  });

  describe("POST /login", () => {
    it("returns 400 when username or password is missing", async () => {
      const res = await originalFetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice" }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, "Username and password are required");
    });

    it("returns 401 for invalid credentials", async () => {
      const res = await originalFetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "wrongpassword" }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "Invalid credentials");
    });

    it("provisions a new CouchDB database and returns a valid JWT on first login", async () => {
      const couchCalls: Array<{ url: string; method: string; body?: string }> =
        [];

      // Mock only outgoing CouchDB requests; pass local Express test requests through
      globalThis.fetch = (async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.startsWith(baseUrl)) {
          return originalFetch(input, init);
        }

        const method = init?.method ?? "GET";
        couchCalls.push({
          url,
          method,
          body: init?.body as string | undefined,
        });

        // Simulate database not existing on HEAD check
        if (method === "HEAD") {
          return new Response(null, { status: 404 });
        }

        // Simulate successful PUT for db creation and _security
        return new Response(JSON.stringify({ ok: true }), { status: 201 });
      }) as typeof fetch;

      const res = await originalFetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "password123" }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.dbName, "userdb-useralice001");
      assert.ok(data.token);

      // Verify JWT payload matches expected claims
      const decoded = jwt.verify(data.token, JWT_SECRET) as jwt.JwtPayload;
      assert.equal(decoded.sub, "user-alice-001");
      assert.equal(decoded.username, "alice");

      assert.equal(couchCalls.length, 4);
      assert.equal(couchCalls[0].method, "HEAD");
      assert.equal(couchCalls[1].method, "PUT");
      assert.ok(couchCalls[1].url.endsWith("/userdb-useralice001"));
      assert.equal(couchCalls[2].method, "PUT");
      assert.ok(couchCalls[2].url.endsWith("/userdb-useralice001/_security"));
      assert.equal(couchCalls[3].method, "PUT");
      assert.ok(
        couchCalls[3].url.endsWith("/userdb-useralice001/_design/validation"),
      );

      const validationBody = JSON.parse(couchCalls[3].body!);
      assert.equal(typeof validationBody.validate_doc_update, "string");
      assert.ok(validationBody.validate_doc_update.includes("forbidden"));
    });

    it("skips database creation when user database already exists", async () => {
      const couchCalls: string[] = [];

      globalThis.fetch = (async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.startsWith(baseUrl)) {
          return originalFetch(input, init);
        }

        couchCalls.push(`${init?.method ?? "GET"} ${url}`);
        // Simulate database already existing (200 OK on HEAD)
        return new Response(null, { status: 200 });
      }) as typeof fetch;

      const res = await originalFetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bob", password: "password123" }),
      });

      assert.equal(res.status, 200);
      assert.equal(couchCalls.length, 1);
      assert.ok(couchCalls[0].startsWith("HEAD "));
    });

    it("returns 500 if CouchDB is unreachable", async () => {
      globalThis.fetch = (async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.startsWith(baseUrl)) {
          return originalFetch(input, init);
        }
        throw new Error("ECONNREFUSED");
      }) as typeof fetch;

      const res = await originalFetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "password123" }),
      });

      assert.equal(res.status, 500);
      const data = await res.json();
      assert.equal(data.error, "Failed to provision user database");
    });
  });

  describe("POST /renew", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await originalFetch(`${baseUrl}/renew`, {
        method: "POST",
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "Missing or revoked token");
    });

    it("returns 401 for an expired or invalid token", async () => {
      const expiredToken = jwt.sign(
        { sub: "user-alice-001", username: "alice" },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "-10s" },
      );

      const res = await originalFetch(`${baseUrl}/renew`, {
        method: "POST",
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "Session expired or invalid");
    });

    it("issues a fresh JWT with a later expiration for a valid token", async () => {
      // Create a token issued 60 seconds ago so the renewed exp will be noticeably later
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const initialToken = jwt.sign(
        {
          sub: "user-alice-001",
          username: "alice",
          iat: nowInSeconds - 60,
          exp: nowInSeconds + 1740,
        },
        JWT_SECRET,
        { algorithm: "HS256" },
      );

      const res = await originalFetch(`${baseUrl}/renew`, {
        method: "POST",
        headers: { Authorization: `Bearer ${initialToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.token);
      assert.notEqual(data.token, initialToken);

      const originalDecoded = jwt.decode(initialToken) as jwt.JwtPayload;
      const renewedDecoded = jwt.verify(
        data.token,
        JWT_SECRET,
      ) as jwt.JwtPayload;

      assert.equal(renewedDecoded.sub, "user-alice-001");
      assert.equal(renewedDecoded.username, "alice");
      assert.ok(renewedDecoded.exp! > originalDecoded.exp!);
    });
  });

  describe("POST /logout", () => {
    it("revokes an active token so subsequent /renew calls return 401", async () => {
      const token = jwt.sign(
        { sub: "user-alice-001", username: "alice" },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "30m" },
      );

      // 1. Logout with the active token
      const logoutRes = await originalFetch(`${baseUrl}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(logoutRes.status, 200);
      const logoutData = await logoutRes.json();
      assert.equal(logoutData.success, true);

      // 2. Attempt to renew the revoked token
      const renewRes = await originalFetch(`${baseUrl}/renew`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(renewRes.status, 401);
      const renewData = await renewRes.json();
      assert.equal(renewData.error, "Missing or revoked token");
    });

    it("succeeds gracefully even when called without a token or with an expired token", async () => {
      const noTokenRes = await originalFetch(`${baseUrl}/logout`, {
        method: "POST",
      });
      assert.equal(noTokenRes.status, 200);
      assert.deepEqual(await noTokenRes.json(), { success: true });

      const expiredToken = jwt.sign(
        { sub: "user-bob-002", username: "bob" },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "-5s" },
      );

      const expiredRes = await originalFetch(`${baseUrl}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.equal(expiredRes.status, 200);
      assert.deepEqual(await expiredRes.json(), { success: true });
    });
  });
});
