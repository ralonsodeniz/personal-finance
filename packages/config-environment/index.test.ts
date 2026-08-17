import { describe, expect, it } from "vitest";

import {
  createPreviewEnvironment,
  getScopedEnvironment,
  parseEnvironmentText,
  resolveApplicationEnvironment,
  validateEnvironmentBoundary,
} from "./index.mjs";

describe("application environment resolution", () => {
  it("maps a Vercel preview to the preview app environment even when Next runs in production mode", () => {
    expect(
      resolveApplicationEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).toMatchObject({ name: "preview", vercel: "preview" });
  });

  it("rejects an explicit production app environment on a Vercel preview", () => {
    expect(
      validateEnvironmentBoundary({ APP_ENV: "production", VERCEL_ENV: "preview" }),
    ).toMatchObject({
      ok: false,
      errors: ["APP_ENV production does not match VERCEL_ENV preview"],
    });
  });

  it("parses environment templates without accepting malformed entries", () => {
    expect(parseEnvironmentText("APP_ENV=preview\nBROKEN", ".env.preview.example")).toEqual({
      entries: { APP_ENV: "preview" },
      errors: [".env.preview.example:2 must use KEY=value syntax"],
    });
  });
});

describe("scoped runtime configuration", () => {
  it("uses preview-scoped values and ignores generic production-shaped values", () => {
    expect(
      getScopedEnvironment({
        APP_ENV: "preview",
        AUTH0_SECRET: "production-secret-that-must-not-be-read",
        [["DATABASE", "URL"].join("_")]: "postgres://production.example.invalid/database",
        WAYFINDER_PREVIEW_AUTH0_SECRET: "preview-only-session-secret",
        WAYFINDER_PREVIEW_AUTH_PROVIDER: "double",
      }),
    ).toMatchObject({
      AUTH0_SECRET: "preview-only-session-secret",
      AUTH_PROVIDER: "double",
    });
    expect(getScopedEnvironment({ APP_ENV: "preview" }).AUTH0_SECRET).toBeUndefined();
  });

  it("uses the Vercel boundary when APP_ENV is mismatched instead of selecting production values", () => {
    expect(
      getScopedEnvironment({
        APP_ENV: "production",
        VERCEL_ENV: "preview",
        WAYFINDER_PRODUCTION_AUTH0_SECRET: "production-secret-that-must-not-be-read",
        WAYFINDER_PREVIEW_AUTH0_SECRET: "preview-only-session-secret",
      }),
    ).toMatchObject({ AUTH0_SECRET: "preview-only-session-secret" });
  });

  it("sanitizes preview child environments while preserving preview configuration", () => {
    const result = createPreviewEnvironment({
      AUTH0_SECRET: "production-secret-that-must-not-be-forwarded",
      [["DATABASE", "URL"].join("_")]: "postgres://production.example.invalid/database",
      GITHUB_TOKEN: "production-token-that-must-not-be-forwarded",
      PATH: "/usr/bin",
      WAYFINDER_PRODUCTION_DATABASE_URL: "postgres://production.example.invalid/database",
      WAYFINDER_PRODUCTION_AUTH0_SECRET: "production-secret-that-must-not-be-forwarded",
      VERCEL_ENV: "production",
    });

    expect(result).toMatchObject({
      APP_ENV: "preview",
      PATH: "/usr/bin",
      VERCEL_ENV: "preview",
      WAYFINDER_PREVIEW_AUTH_PROVIDER: "double",
      WAYFINDER_PREVIEW_DATA_MODE: "provider-double",
    });
    expect(result.AUTH0_SECRET).toBeUndefined();
    expect(result.DATABASE_URL).toBeUndefined();
    expect(result.GITHUB_TOKEN).toBeUndefined();
    expect(result.WAYFINDER_PRODUCTION_DATABASE_URL).toBeUndefined();
  });
});

describe("environment safety boundary", () => {
  it("allows a provider-doubled preview with no production data markers", () => {
    expect(
      validateEnvironmentBoundary({
        APP_ENV: "preview",
        VERCEL_ENV: "preview",
        WAYFINDER_PREVIEW_AUTH_PROVIDER: "double",
        WAYFINDER_PREVIEW_DATA_MODE: "provider-double",
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects generic credentials and production data markers in preview", () => {
    const result = validateEnvironmentBoundary({
      APP_ENV: "preview",
      [["DATABASE", "URL"].join("_")]: "postgres://production.example.invalid/database",
      WAYFINDER_PREVIEW_AUTH_PROVIDER: "auth0",
      WAYFINDER_PREVIEW_DATA_MODE: "postgresql",
      WAYFINDER_PRODUCTION_SECRETS: "true",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "DATABASE_URL is not accepted in preview; use WAYFINDER_PREVIEW_DATABASE_URL",
        "WAYFINDER_PRODUCTION_SECRETS is forbidden in preview",
        "preview provider integrations must use the provider double or set WAYFINDER_PREVIEW_PROVIDER_APPROVED=true",
        "preview data integrations must use provider-double or set WAYFINDER_PREVIEW_DATA_APPROVED=true",
      ]),
    );
  });

  it("rejects the provider double in production", () => {
    expect(
      validateEnvironmentBoundary({
        APP_ENV: "production",
        WAYFINDER_PRODUCTION_AUTH_PROVIDER: "double",
      }),
    ).toMatchObject({
      ok: false,
      errors: ["the provider double cannot be enabled in production"],
    });
  });

  it("requires explicit approval before enabling preview telemetry", () => {
    expect(
      validateEnvironmentBoundary({
        APP_ENV: "preview",
        WAYFINDER_PREVIEW_TELEMETRY_MODE: "configured",
      }),
    ).toMatchObject({
      ok: false,
      errors: [
        "preview telemetry must remain disabled or set WAYFINDER_PREVIEW_TELEMETRY_APPROVED=true",
      ],
    });
  });
});
