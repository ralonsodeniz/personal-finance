import { describe, expect, it } from "vitest";

import {
  createWebSession,
  decryptWebSession,
  encryptWebSession,
  webSessionCookieOptions,
} from "./web-session";

const secret = "a provider-free session secret with enough entropy for tests";

describe("web application session adapter", () => {
  it("round-trips an internal actor without placing identity data in plaintext", () => {
    const session = createWebSession({
      identityId: "identity-123",
      now: 1_700_000_000_000,
      userId: "user-123",
    });

    const encoded = encryptWebSession(session, secret);

    expect(encoded).not.toContain("identity-123");
    expect(encoded).not.toContain("user-123");
    expect(decryptWebSession(encoded, secret, session.issuedAt)).toEqual(session);
  });

  it("rejects tampered and expired values", () => {
    const session = createWebSession({
      identityId: "identity-123",
      now: 1_700_000_000_000,
      ttlSeconds: 60,
      userId: "user-123",
    });
    const encoded = encryptWebSession(session, secret);
    const [version, iv, authTag, ciphertext] = encoded.split(".");
    const tampered = [
      version,
      iv,
      authTag,
      `${ciphertext?.at(0) === "A" ? "B" : "A"}${ciphertext?.slice(1) ?? ""}`,
    ].join(".");

    expect(decryptWebSession(tampered, secret, session.issuedAt)).toBeNull();
    expect(decryptWebSession(encoded, secret, session.expiresAt)).toBeNull();
  });

  it("requires a browser-inaccessible session cookie", () => {
    expect(webSessionCookieOptions({ secure: true })).toMatchObject({
      httpOnly: true,
      maxAge: 28_800,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });
});
