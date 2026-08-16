import { describe, expect, it } from "vitest";

import {
  problemDetailsSchema,
  systemHealthOpenApiPath,
  systemHealthQuerySchema,
  systemHealthResponseSchema,
} from "./index.js";
import { systemHealthOpenApi } from "./openapi.js";

describe("system health contract", () => {
  it("describes the versioned health operation and its problem response in OpenAPI", () => {
    expect(systemHealthOpenApi.openapi).toBe("3.1.0");
    expect(systemHealthOpenApi.servers).toEqual([{ url: "/api/v1" }]);
    expect(systemHealthOpenApi.paths[systemHealthOpenApiPath]).toMatchObject({
      get: expect.objectContaining({
        operationId: "getSystemHealth",
        responses: expect.objectContaining({
          "200": expect.objectContaining({
            content: expect.objectContaining({
              "application/json": expect.any(Object),
            }),
          }),
          "400": expect.objectContaining({
            content: expect.objectContaining({
              "application/problem+json": expect.any(Object),
            }),
          }),
        }),
      }),
    });
  });

  it("accepts the agreed query and response shapes at runtime", () => {
    expect(systemHealthQuerySchema.parse({ scope: "system" })).toEqual({ scope: "system" });
    expect(
      systemHealthResponseSchema.parse({
        contractVersion: "v1",
        data: {
          database: "ready",
          migrations: "ready",
          provider: "provider-double",
        },
        service: "wayfinder",
        status: "ok",
        checkedAt: "2026-08-16T12:00:00.000Z",
      }),
    ).toMatchObject({ contractVersion: "v1", status: "ok" });
  });

  it("rejects an unsupported query scope and malformed problem details", () => {
    expect(systemHealthQuerySchema.safeParse({ scope: "finance" }).success).toBe(false);
    expect(
      problemDetailsSchema.safeParse({
        detail: "Invalid request.",
        status: 400,
        title: "Invalid request",
        type: "https://wayfinder.dev/problems/invalid-request",
      }).success,
    ).toBe(true);
    expect(
      problemDetailsSchema.safeParse({
        detail: "Invalid request.",
        status: 200,
        title: "Invalid request",
        type: "https://wayfinder.dev/problems/invalid-request",
      }).success,
    ).toBe(false);
  });
});
