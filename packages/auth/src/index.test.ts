import { describe, expect, it } from "vitest";

import { IdentityDirectory, ProviderDouble, parseAuthConfiguration } from "./index.js";

const sessionSecret = "a provider-free session secret with enough entropy for tests";

describe("provider-neutral identity establishment", () => {
  it("keys one internal Identity by the provider issuer and subject", () => {
    const provider = new ProviderDouble({ issuer: "https://double.example.test/" });
    const directory = new IdentityDirectory({
      createId: (() => {
        let nextId = 0;
        return () => `internal-${++nextId}`;
      })(),
    });

    const first = directory.establish(
      provider.authenticate({ subject: "double|alice", email: "alice@old.example" }),
    );
    const repeat = directory.establish(
      provider.authenticate({ subject: "double|alice", email: "alice@new.example" }),
    );
    const otherSubject = directory.establish(
      provider.authenticate({ subject: "double|bob", email: "alice@new.example" }),
    );
    const otherIssuer = directory.establish({
      issuer: "https://another-provider.example.test/",
      provider: "auth0",
      subject: "double|alice",
    });

    expect(repeat).toEqual(first);
    expect(first.userId).toBe("internal-1");
    expect(otherSubject.userId).toBe("internal-3");
    expect(otherIssuer.userId).toBe("internal-5");
    expect(first.email).toBe("alice@old.example");
  });
});

describe("provider configuration", () => {
  it("supports a provider double without live Auth0 credentials", () => {
    expect(
      parseAuthConfiguration({
        AUTH0_SECRET: sessionSecret,
        AUTH_PROVIDER: "double",
      }),
    ).toMatchObject({
      issuer: "https://provider-double.local/",
      provider: "double",
      sessionSecret,
      status: "configured",
    });
  });

  it("returns a safe unavailable result for missing or invalid configuration", () => {
    expect(parseAuthConfiguration({})).toEqual({
      reason: "missing-provider-configuration",
      status: "unavailable",
    });
    expect(
      parseAuthConfiguration({
        AUTH0_CLIENT_ID: "client-id",
        AUTH0_CLIENT_SECRET: "client-secret",
        AUTH0_DOMAIN: "tenant.example.test",
      }),
    ).toEqual({
      reason: "missing-session-secret",
      status: "unavailable",
    });
    expect(
      parseAuthConfiguration({
        AUTH0_SECRET: sessionSecret,
        AUTH_PROVIDER: "unknown",
      }),
    ).toEqual({
      reason: "invalid-provider-configuration",
      status: "unavailable",
    });
  });

  it("validates Auth0 settings without contacting Auth0", () => {
    expect(
      parseAuthConfiguration({
        AUTH0_CLIENT_ID: "client-id",
        AUTH0_CLIENT_SECRET: "client-secret",
        AUTH0_DOMAIN: "tenant.example.test",
        AUTH0_SECRET: sessionSecret,
        AUTH_PROVIDER: "auth0",
      }),
    ).toMatchObject({
      clientId: "client-id",
      clientSecret: "client-secret",
      issuer: "https://tenant.example.test/",
      provider: "auth0",
      status: "configured",
    });
  });
});
