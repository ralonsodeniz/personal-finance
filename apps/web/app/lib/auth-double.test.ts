import { describe, expect, it } from "vitest";

import { decryptWebSession } from "./web-session";

import { createProviderDoubleSessionValue, isProviderDoubleEnabled } from "./auth-double";

const secret = "a provider-free session secret with enough entropy for tests";

describe("provider-double web session adapter", () => {
  it("establishes a provider-doubled identity and returns an encrypted session value", () => {
    const result = createProviderDoubleSessionValue({
      environment: {
        AUTH0_SECRET: secret,
        AUTH_PROVIDER: "double",
        NODE_ENV: "development",
      },
      now: 1_700_000_000_000,
      subject: "double|browser-user",
    });

    expect(result.status).toBe("configured");

    if (result.status === "configured") {
      expect(decryptWebSession(result.value, secret, 1_700_000_000_000)).toMatchObject({
        identityId: expect.any(String),
        userId: expect.any(String),
      });
    }
  });

  it("does not create a provider-double session for unavailable or Auth0 configuration", () => {
    expect(createProviderDoubleSessionValue({ environment: {} })).toEqual({
      reason: "missing-provider-configuration",
      status: "unavailable",
    });
    expect(
      createProviderDoubleSessionValue({
        environment: {
          AUTH0_CLIENT_ID: "client-id",
          AUTH0_CLIENT_SECRET: "client-secret",
          AUTH0_DOMAIN: "tenant.example.test",
          AUTH0_SECRET: secret,
          AUTH_PROVIDER: "auth0",
          NODE_ENV: "development",
        },
      }),
    ).toEqual({
      reason: "provider-double-disabled",
      status: "unavailable",
    });
  });

  it("does not mint a provider-double session in production even with a test flag", () => {
    expect(
      createProviderDoubleSessionValue({
        environment: {
          AUTH0_SECRET: secret,
          AUTH_PROVIDER: "double",
          NODE_ENV: "production",
          WAYFINDER_AUTH_DOUBLE_TEST: "true",
        },
      }),
    ).toEqual({
      reason: "provider-double-disabled",
      status: "unavailable",
    });
  });

  it.each([undefined, "test", "staging", "preview", "production"])(
    "keeps the provider double disabled when NODE_ENV is %s",
    (nodeEnv) => {
      expect(
        isProviderDoubleEnabled({
          AUTH_PROVIDER: "double",
          ...(nodeEnv === undefined ? {} : { NODE_ENV: nodeEnv }),
        }),
      ).toBe(false);
    },
  );

  it("enables the provider double only in development", () => {
    expect(isProviderDoubleEnabled({ AUTH_PROVIDER: "double", NODE_ENV: "development" })).toBe(
      true,
    );
  });
});
