import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { sql } from "drizzle-orm";
import { drizzle, type NodePgClient, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type QueryConfig, type QueryResult, type QueryResultRow } from "pg";

export type SystemHealthProvider = "postgresql" | "provider-double";

export interface SystemHealthData {
  database: "ready" | "unavailable";
  migrations: "ready" | "pending" | "unavailable";
  provider: SystemHealthProvider;
}

export interface SystemHealthDataSource {
  check(): Promise<SystemHealthData>;
  close(): Promise<void>;
}

export interface ProviderDoubledPostgresConnection {
  queries: string[];
  query(config: QueryConfig | string): Promise<QueryResult<QueryResultRow>>;
}

interface SystemHealthQueryRow extends QueryResultRow {
  database_ok: number;
  migration_ready: boolean;
}

function resolveDefaultMigrationsFolder(): string {
  const packageMigrationsFolder = resolve(process.cwd(), "migrations");

  if (existsSync(resolve(packageMigrationsFolder, "meta/_journal.json"))) {
    return packageMigrationsFolder;
  }

  return resolve(process.cwd(), "packages/data-access/migrations");
}

function queryResult(rows: QueryResultRow[]): QueryResult<QueryResultRow> {
  return {
    command: "SELECT",
    fields: [],
    oid: 0,
    rowCount: rows.length,
    rows,
  };
}

function queryText(config: QueryConfig | string): string {
  return typeof config === "string" ? config : config.text;
}

export function createProviderDoubledPostgresConnection(): ProviderDoubledPostgresConnection {
  const connection: ProviderDoubledPostgresConnection = {
    queries: [],
    async query(config) {
      const text = queryText(config);
      connection.queries.push(text);

      if (/select\s+1\s+as\s+database_ok/i.test(text)) {
        return queryResult([{ database_ok: 1, migration_ready: true }]);
      }

      if (/select id, hash, created_at/i.test(text)) {
        return queryResult([]);
      }

      return queryResult([]);
    },
  };

  return connection;
}

function asNodePgClient(
  connection: NodePgClient | ProviderDoubledPostgresConnection,
): NodePgClient {
  return connection as unknown as NodePgClient;
}

async function checkThroughDrizzle(
  database: NodePgDatabase,
  provider: SystemHealthProvider,
): Promise<SystemHealthData> {
  try {
    const result = await database.execute<SystemHealthQueryRow>(sql`
      SELECT
        1 AS database_ok,
        to_regclass('public.wayfinder_system_health') IS NOT NULL AS migration_ready
    `);
    const row = result.rows[0];

    if (!row || row.database_ok !== 1) {
      return { database: "unavailable", migrations: "unavailable", provider };
    }

    return {
      database: "ready",
      migrations: row.migration_ready ? "ready" : "pending",
      provider,
    };
  } catch {
    return { database: "unavailable", migrations: "unavailable", provider };
  }
}

function createDataSource(
  database: NodePgDatabase,
  provider: SystemHealthProvider,
  close: () => Promise<void>,
): SystemHealthDataSource {
  return {
    check: () => checkThroughDrizzle(database, provider),
    close,
  };
}

export interface SystemHealthDataSourceOptions {
  connection?: NodePgClient | ProviderDoubledPostgresConnection;
  databaseUrl?: string;
}

export function createSystemHealthDataSource({
  connection,
  databaseUrl = process.env.DATABASE_URL,
}: SystemHealthDataSourceOptions = {}): SystemHealthDataSource {
  if (connection) {
    const database = drizzle(asNodePgClient(connection));
    return createDataSource(database, "provider-double", async () => undefined);
  }

  if (databaseUrl) {
    const pool = new Pool({ connectionString: databaseUrl });
    const database = drizzle(pool);
    return createDataSource(database, "postgresql", () => pool.end());
  }

  const providerDouble = createProviderDoubledPostgresConnection();
  const database = drizzle(asNodePgClient(providerDouble));
  return createDataSource(database, "provider-double", async () => undefined);
}

export interface MigrateSystemDatabaseOptions {
  connection: NodePgClient | ProviderDoubledPostgresConnection;
  migrationsFolder?: string;
}

export async function migrateSystemDatabase({
  connection,
  migrationsFolder = resolveDefaultMigrationsFolder(),
}: MigrateSystemDatabaseOptions): Promise<void> {
  const database = drizzle(asNodePgClient(connection));
  await migrate(database, { migrationsFolder });
}
