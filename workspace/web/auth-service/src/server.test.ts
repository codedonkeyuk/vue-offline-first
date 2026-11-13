import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "./server.ts";

describe("POST /login", () => {
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
  });

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
      couchCalls.push({ url, method, body: init?.body as string | undefined });

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
    const decoded = jwt.verify(
      data.token,
      "local-dev-secret",
    ) as jwt.JwtPayload;
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
