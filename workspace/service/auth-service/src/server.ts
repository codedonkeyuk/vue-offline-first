import express, { type Request, type Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { getCouchDesignDoc } from "@job-search/db-config";

export const app = express();
app.use(cors());
app.use(express.json());

const COUCH_URL = process.env.COUCHDB_URL ?? "http://localhost:5984";
const COUCH_AUTH = `Basic ${Buffer.from("admin:password").toString("base64")}`;
const JWT_SECRET = process.env.JWT_SECRET ?? "local-dev-secret";
const SESSION_TTL = "30m";

interface DevUser {
  id: string;
  password: string;
}

const DEV_USERS: Record<string, DevUser> = {
  alice: { id: "user-alice-001", password: "password123" },
  bob: { id: "user-bob-002", password: "password123" },
};

interface JwtClaims {
  sub: string;
  username: string;
  exp?: number;
}

// Stores revoked tokens -> their expiration timestamp (ms)
const revokedTokens = new Map<string, number>();

// Clean up naturally expired tokens every 10 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [token, expiresAt] of revokedTokens.entries()) {
      if (now >= expiresAt) {
        revokedTokens.delete(token);
      }
    }
  },
  10 * 60 * 1000,
).unref();

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function signSessionToken(userId: string, username: string): string {
  return jwt.sign({ sub: userId, username }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: SESSION_TTL,
  });
}

interface LoginBody {
  username?: string;
  password?: string;
}

app.post("/login", async (req: Request<{}, {}, LoginBody>, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const user = DEV_USERS[username.toLowerCase()];

  if (!user || user.password !== password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const dbName = `userdb-${user.id.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  try {
    const checkRes = await fetch(`${COUCH_URL}/${dbName}`, {
      method: "HEAD",
      headers: { Authorization: COUCH_AUTH },
    });

    if (!checkRes.ok) {
      await fetch(`${COUCH_URL}/${dbName}`, {
        method: "PUT",
        headers: { Authorization: COUCH_AUTH },
      });

      await fetch(`${COUCH_URL}/${dbName}/_security`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: COUCH_AUTH,
        },
        body: JSON.stringify({
          admins: { names: [], roles: ["_admin"] },
          members: { names: [user.id], roles: [] },
        }),
      });

      const designRes = await fetch(
        `${COUCH_URL}/${dbName}/_design/validation`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: COUCH_AUTH,
          },
          body: JSON.stringify(getCouchDesignDoc()),
        },
      );

      if (!designRes.ok) {
        console.error(
          "Design doc rejected:",
          designRes.status,
          await designRes.text(),
        );
      }
    }

    const token = signSessionToken(user.id, username);
    res.json({ token, dbName });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to provision user database" });
  }
});

app.post("/renew", (req: Request, res: Response) => {
  const token = extractBearerToken(req);

  if (!token || revokedTokens.has(token)) {
    res.status(401).json({ error: "Missing or revoked token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtClaims;
    const newToken = signSessionToken(decoded.sub, decoded.username);
    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: "Session expired or invalid" });
  }
});

app.post("/logout", (req: Request, res: Response) => {
  const token = extractBearerToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtClaims;
      const expiresAt = decoded.exp
        ? decoded.exp * 1000
        : Date.now() + 30 * 60 * 1000;
      revokedTokens.set(token, expiresAt);
    } catch {
      // Token is already invalid or expired; no need to store it
    }
  }

  res.json({ success: true });
});

if (import.meta.main) {
  app.listen(4000, () => {
    console.log("Express auth server listening on port 4000");
  });
}
