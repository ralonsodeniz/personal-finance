import { describe, expect, it } from "vitest";

import {
  createProviderDoubledPostgresConnection,
  createSystemHealthDataSource,
} from "@personal-finance/data-access";

import { createSystemHealthService } from "./index.js";

describe("shared system health application service", () => {
  it("returns a versioned service result from the server-side data boundary", async () => {
    const service = createSystemHealthService({
      dataSource: createSystemHealthDataSource({
        connection: createProviderDoubledPostgresConnection(),
      }),
    });

    const health = await service.getSystemHealth();

    expect(health).toMatchObject({
      contractVersion: "v1",
      data: { database: "ready", migrations: "ready", provider: "provider-double" },
      service: "wayfinder",
      status: "ok",
    });
  });
});
