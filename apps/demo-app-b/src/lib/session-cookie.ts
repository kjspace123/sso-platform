import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * The session itself, encrypted (AES-256-GCM) directly into the cookie
 * value — no server-side session store.
 *
 * This isn't just a demo shortcut: a plain in-memory Map (the more obvious
 * "quick" option) turned out to be unreliable even in a single `next dev`
 * process — Turbopack compiles Route Handlers and Server Components as
 * fairly separate units in dev, and there's no guarantee they share the
 * same module-level singleton, so a Map populated in one doesn't reliably
 * show up as populated in the other. An encrypted cookie carries its own
 * state and doesn't depend on that assumption at all — it works the same
 * way in dev, in a `next start` prod server, and if this were ever deployed
 * behind multiple instances.
 */

export interface DemoSession {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  claims: { sub: string; email?: string; email_verified?: boolean };
  expiresAt: number; // epoch ms, access token expiry
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing required env var SESSION_SECRET — see .env.example");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) throw new Error("SESSION_SECRET must be base64 for exactly 32 bytes (openssl rand -base64 32)");
  return key;
}

export function encodeSession(session: DemoSession): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64url")).join(".");
}

export function decodeSession(cookieValue: string | undefined): DemoSession | undefined {
  if (!cookieValue) return undefined;
  try {
    const [ivPart, authTagPart, ciphertextPart] = cookieValue.split(".");
    if (!ivPart || !authTagPart || !ciphertextPart) return undefined;

    const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(plaintext) as DemoSession;
  } catch {
    // Tampered, expired-key-rotated, or otherwise invalid — treat as signed out.
    return undefined;
  }
}
