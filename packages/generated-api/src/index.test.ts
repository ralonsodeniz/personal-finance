import { describe, expect, it } from "vitest";

import { ApiError, createWayfinderClient } from "./index.js";

describe("generated system API client", () => {
  it("calls the versioned contract without server or ORM dependencies", async () => {
    const requests: Request[] = [];
    const client = createWayfinderClient({
      baseUrl: "https://wayfinder.test",
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(
          JSON.stringify({
            contractVersion: "v1",
            data: { database: "ready", migrations: "ready", provider: "provider-double" },
            service: "wayfinder",
            status: "ok",
            checkedAt: "2026-08-16T12:00:00.000Z",
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        );
      },
    });

    const response = await client.getSystemHealth({ scope: "system" });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://wayfinder.test/api/v1/system/health?scope=system");
    expect(response.data.migrations).toBe("ready");
  });

  it("surfaces the contract problem shape for an unsuccessful response", async () => {
    const client = createWayfinderClient({
      baseUrl: "https://wayfinder.test/",
      fetch: async () =>
        new Response(
          JSON.stringify({
            detail: "The query parameter is not supported.",
            errors: [{ code: "invalid_value", message: "Invalid input", path: "scope" }],
            status: 400,
            title: "Invalid request",
            type: "https://wayfinder.dev/problems/invalid-request",
          }),
          { headers: { "content-type": "application/problem+json" }, status: 400 },
        ),
    });

    await expect(client.getSystemHealth({ scope: "system" })).rejects.toBeInstanceOf(ApiError);
  });
});
