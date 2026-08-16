import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

describe("GET /api/v1/system/health", () => {
  it("returns a validated health response", async () => {
    const response = await GET(new Request("http://localhost/api/v1/system/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({
      contractVersion: "v1",
      data: { database: "ready", migrations: "ready", provider: "provider-double" },
      service: "wayfinder",
      status: "ok",
    });
  });

  it("returns RFC 9457-style problem details for an invalid query", async () => {
    const response = await GET(new Request("http://localhost/api/v1/system/health?scope=finance"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(body).toMatchObject({
      status: 400,
      title: "Invalid request",
      type: "https://wayfinder.dev/problems/invalid-request",
    });
    expect(body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "scope" })]),
    );
  });

  it("uses the same problem shape for unsupported methods", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(response.headers.get("allow")).toBe("GET");
    expect(body).toMatchObject({
      status: 405,
      title: "Method not allowed",
      type: "https://wayfinder.dev/problems/method-not-allowed",
    });
  });
});
