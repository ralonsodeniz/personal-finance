import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/v1/openapi.json", () => {
  it("serves the versioned system contract", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/system/health": {
          get: { operationId: "getSystemHealth" },
        },
      },
    });
  });
});
