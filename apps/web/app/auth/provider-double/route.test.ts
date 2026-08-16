import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const secret = "a provider-free session secret with enough entropy for tests";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /auth/provider-double", () => {
  it("sets an HttpOnly encrypted session cookie and redirects to the protected placeholder", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_PROVIDER", "double");
    vi.stubEnv("AUTH0_SECRET", secret);

    const response = GET(new Request("http://localhost:3000/auth/provider-double"));
    const cookie = response.headers.get("set-cookie");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/workspace");
    expect(cookie).toContain("wayfinder_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie?.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("double|demo-user");
  });

  it("returns a safe response when provider configuration is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_PROVIDER", "auth0");
    vi.stubEnv("AUTH0_DOMAIN", "tenant.example.test");

    const response = GET(new Request("http://localhost:3000/auth/provider-double"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "authentication-unavailable",
      reason: "missing-provider-configuration",
    });
  });

  it("does not expose the provider double in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_PROVIDER", "double");
    vi.stubEnv("AUTH0_SECRET", secret);

    const response = GET(new Request("http://localhost:3000/auth/provider-double"));

    expect(response.status).toBe(404);
  });

  it("does not let a production test flag mint a provider-double session", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WAYFINDER_AUTH_DOUBLE_TEST", "true");
    vi.stubEnv("AUTH_PROVIDER", "double");
    vi.stubEnv("AUTH0_SECRET", secret);

    const response = GET(
      new Request("http://localhost:3000/auth/provider-double?subject=double%7Cattacker"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
