import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const WEB_SESSION_COOKIE_NAME = "wayfinder_session";
export const WEB_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const SESSION_ALGORITHM = "aes-256-gcm";
const SESSION_AAD = Buffer.from("wayfinder-web-session:v1");
const SESSION_VERSION = "v1";

export interface WebSession {
  expiresAt: number;
  issuedAt: number;
  identityId: string;
  userId: string;
}

export interface CreateWebSessionInput {
  identityId: string;
  now?: number;
  ttlSeconds?: number;
  userId: string;
}

export function createWebSession({
  identityId,
  now = Date.now(),
  ttlSeconds = WEB_SESSION_MAX_AGE_SECONDS,
  userId,
}: CreateWebSessionInput): WebSession {
  if (!Number.isFinite(now) || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("Web session timing values must be finite and positive");
  }

  return {
    expiresAt: now + ttlSeconds * 1_000,
    identityId: requireValue(identityId, "identityId"),
    issuedAt: now,
    userId: requireValue(userId, "userId"),
  };
}

export function encryptWebSession(session: WebSession, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(SESSION_ALGORITHM, key, iv);

  cipher.setAAD(SESSION_AAD);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);

  return [
    SESSION_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptWebSession(
  encoded: string,
  secret: string,
  now = Date.now(),
): WebSession | null {
  try {
    const [version, ivEncoded, tagEncoded, ciphertextEncoded] = encoded.split(".");

    if (version !== SESSION_VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
      return null;
    }

    const decipher = createDecipheriv(
      SESSION_ALGORITHM,
      deriveKey(secret),
      Buffer.from(ivEncoded, "base64url"),
    );

    decipher.setAAD(SESSION_AAD);
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as unknown;

    if (!isWebSession(parsed) || now < parsed.issuedAt || now >= parsed.expiresAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function webSessionCookieOptions({ secure = process.env.NODE_ENV === "production" } = {}) {
  return {
    httpOnly: true,
    maxAge: WEB_SESSION_MAX_AGE_SECONDS,
    path: "/" as const,
    sameSite: "lax" as const,
    secure,
  };
}

function deriveKey(secret: string) {
  return createHash("sha256").update(requireValue(secret, "session secret"), "utf8").digest();
}

function isWebSession(value: unknown): value is WebSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<WebSession>;

  return (
    typeof session.identityId === "string" &&
    session.identityId.length > 0 &&
    typeof session.userId === "string" &&
    session.userId.length > 0 &&
    typeof session.issuedAt === "number" &&
    Number.isFinite(session.issuedAt) &&
    typeof session.expiresAt === "number" &&
    Number.isFinite(session.expiresAt) &&
    session.expiresAt > session.issuedAt
  );
}

function requireValue(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Web session ${name} is required`);
  }

  return trimmed;
}
