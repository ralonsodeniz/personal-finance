import { describe, expect, it } from "vitest";

import {
  createProviderDoubledPostgresConnection,
  createSystemHealthDataSource,
  migrateSystemDatabase,
} from "./index.js";

describe("server-only system health data access", () => {
  it("checks PostgreSQL connectivity and migration readiness through Drizzle", async () => {
    const connection = createProviderDoubledPostgresConnection();
    const dataSource = createSystemHealthDataSource({ connection });

    await expect(dataSource.check()).resolves.toEqual({
      database: "ready",
      migrations: "ready",
      provider: "provider-double",
    });
    expect(connection.queries.join("\n")).toContain("to_regclass");
  });

  it("runs the committed migration through Drizzle against the provider double", async () => {
    const connection = createProviderDoubledPostgresConnection();

    await expect(migrateSystemDatabase({ connection })).resolves.toBeUndefined();

    expect(connection.queries.join("\n")).toContain("wayfinder_system_health");
    expect(connection.queries.join("\n")).toContain("__drizzle_migrations");
  });
});
