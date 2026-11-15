import express, { type Request, type Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { getCouchDesignDoc } from "@job-search/db-validator";

export const app = express();
app.use(cors());
app.use(express.json());

const COUCH_URL = process.env.COUCHDB_URL ?? "http://localhost:5984";
const COUCH_AUTH = `Basic ${Buffer.from("admin:password").toString("base64")}`;
const JWT_SECRET = process.env.JWT_SECRET ?? "local-dev-secret";

interface DevUser {
  id: string;
  password: string;
}

const DEV_USERS: Record<string, DevUser> = {
  alice: { id: "user-alice-001", password: "password123" },
  bob: { id: "user-bob-002", password: "password123" },
};

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
          body: JSON.stringify({
            validate_doc_update: getCouchDesignDoc(),
          }),
        },
      );

      if (!designRes.ok) {
        console.error(
          "Design doc failed:",
          designRes.status,
          await designRes.text(),
        );
      }
    }

    const token = jwt.sign({ sub: user.id, username }, JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "2h",
    });

    res.json({ token, dbName });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to provision user database" });
  }
});

if (import.meta.main) {
  app.listen(4000, () => {
    console.log("Express auth server listening on port 4000");
  });
}
