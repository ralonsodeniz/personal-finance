# PostgreSQL data access for the TypeScript monorepo

## 1. Question

If PostgreSQL is selected or retained, which TypeScript ORM or data-access approach best fits this monorepo and its future web and React Native clients? This note compares Drizzle ORM, Prisma ORM, Kysely, and TypeORM across schema ownership, migrations, relational queries, transactions, type safety, generated clients, serverless/edge compatibility, testing, seed data, raw SQL, performance, and portability.

Checked against official documentation and first-party repositories on **2026-08-15**.

## 2. Scope and assumptions

- The repository currently has no application packages, database package, selected backend, or architecture ADR. The recommendation therefore targets the stated future shape: a server-side TypeScript backend that may be deployed as a detached/shared service, with web and React Native clients consuming a transport-neutral API.
- The mobile and web applications should not receive PostgreSQL credentials or import the database package. “Shared” means shared server/domain/API contracts inside the monorepo, not direct client-to-database access.
- PostgreSQL is treated as the runtime authority for constraints, transactions, indexes, extensions, row-level security, and other database behavior. PostgreSQL documents these as database-level DDL and transaction features ([DDL](https://www.postgresql.org/docs/current/ddl.html), [`BEGIN`](https://www.postgresql.org/docs/current/sql-begin.html)).
- For production, choose one migration owner and commit its migration history. Generated schemas and ORM metadata are not a substitute for reviewing the SQL that changes a live PostgreSQL database.

## 3. Concepts / evaluation criteria

An **ORM** presents a model/entity-oriented abstraction over relational data, commonly including relation metadata, persistence operations, and a generated or runtime client. A **query builder** primarily composes SQL and infers the shape of its results; it does not imply entity identity, relation loading, or domain modeling. Kysely explicitly says it “is not an ORM,” has no relation concept, and builds the SQL requested ([Kysely relations recipe](https://www.kysely.dev/docs/recipes/relations)). Drizzle calls itself a headless TypeScript ORM/data framework but deliberately exposes both SQL-like and relational APIs ([Drizzle overview](https://orm.drizzle.team/docs/overview)).

The decision criteria are:

1. **Schema ownership and migrations:** Can PostgreSQL-native DDL, extensions, RLS, indexes, views, and data backfills be reviewed and deployed without an opaque sync operation? Are migrations immutable, reproducible, and safe in CI/CD?
2. **Relational work and invariants:** Can the backend express joins, nested reads, aggregates, locks, isolation levels, and multi-step financial writes without hiding transaction boundaries?
3. **Type safety and escape hatches:** Are table/column/result types checked at compile time, and can carefully reviewed SQL be used for PostgreSQL-specific or performance-critical queries?
4. **Runtime fit:** Can the same server package run with a normal PostgreSQL driver, a serverless driver, or an edge-compatible HTTP/WebSocket driver? What connection and transaction limitations follow?
5. **Team operations:** Can tests build a database from zero, run fixtures deterministically, detect schema drift, and explain generated SQL? What additional generation/build steps must a monorepo coordinate?
6. **Portability and cost:** Which abstractions are PostgreSQL-specific, and what code must be rewritten if hosting, dialect, or a local mobile database changes?

## 4. Compared options

### Drizzle ORM

**Classification and schema.** Drizzle is the closest fit to a typed SQL-first ORM: its documented workflow declares PostgreSQL tables in TypeScript, infers types from those declarations, and offers both a SQL-like query builder and a relational query API. It is not a traditional entity/data-mapper ORM; it is intentionally a thin typed layer over SQL ([overview](https://orm.drizzle.team/docs/overview), [PostgreSQL schema and connection](https://orm.drizzle.team/docs/get-started-postgresql)).

Drizzle supports both database-first and codebase-first migration strategies. `drizzle-kit` can pull a database schema, generate SQL migrations, apply migrations, push a schema directly, check migration history, and export SQL ([migration fundamentals](https://orm.drizzle.team/docs/migrations), [Drizzle Kit commands](https://orm.drizzle.team/docs/kit-overview)). For this repository, use the codebase-first TypeScript schema for application typing, but commit and review the generated SQL migration as the deployment artifact. Hand-maintain PostgreSQL-only DDL in that migration when needed. Do not use direct schema push against production.

**Queries, relations, and transactions.** The SQL-like API gives explicit joins and expressions. The relational query builder supports nested reads and is documented as producing one SQL query for a relational query ([relational queries](https://orm.drizzle.team/docs/rqb), [overview](https://orm.drizzle.team/docs/overview)). Transactions use a callback-bound transaction object, support nested savepoints, and expose PostgreSQL isolation/access-mode/deferrable configuration ([transactions](https://orm.drizzle.team/docs/transactions)). This is a good balance for finance-domain code: domain services can keep the transaction boundary visible while using nested reads where they improve API shaping.

**Types, raw SQL, and generated clients.** The normal workflow imports the TypeScript schema and uses inferred table/result types; there is no separate generated runtime client in the documented Drizzle workflow. The `sql` template can be embedded in structured queries and parameterizes interpolated values; `sql.raw()` deliberately bypasses escaping and must be reserved for trusted, reviewed SQL ([SQL operator](https://orm.drizzle.team/docs/sql)).

**Serverless/edge, testing, and seeds.** Drizzle uses native drivers and documents PostgreSQL support through `node-postgres`, `postgres.js`, Neon HTTP, and Neon WebSockets. Neon HTTP is suitable for single non-interactive requests; WebSockets are the option when session or interactive transaction support is required ([Neon connection](https://orm.drizzle.team/docs/connect-neon)). Its edge guide requires an edge-compatible driver rather than assuming Node APIs ([Vercel Edge Functions](https://orm.drizzle.team/docs/tutorials/drizzle-with-vercel-edge-functions)). `drizzle-seed` provides deterministic fake data and reset support, including PostgreSQL `TRUNCATE ... CASCADE` behavior ([seed overview](https://orm.drizzle.team/docs/seed-overview)). Database integration tests should still run against PostgreSQL because TypeScript inference cannot prove server constraints, RLS, locking, or query plans.

**Performance and portability.** Drizzle’s official posture is dialect-specific and lightweight, and its relational query API emphasizes one round trip; these are useful properties but not a benchmark for this workload. PostgreSQL-specific schema declarations and SQL make a PostgreSQL-first design productive while making a later dialect switch a real migration, not a configuration change. The main operational risk is drift between TypeScript declarations, hand-edited SQL migrations, and any database-first changes.

### Prisma ORM

**Classification and schema.** Prisma is a generated-client ORM. The current official overview describes Prisma ORM as providing Prisma Client, Prisma Migrate, and Prisma Studio; Prisma Client is generated and type-safe ([Prisma ORM overview](https://docs.prisma.io/docs/orm), [Prisma Client overview](https://www.prisma.io/docs/orm/prisma-client)). The declarative Prisma schema is a clear model for the team, while relation fields and foreign-key scalar fields are represented separately in the Prisma model ([relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations)).

Prisma Migrate has a strong operational model: the `prisma/migrations` history is committed and is the source of truth for migration history; production deployment runs migration files, not the Prisma schema. The migration lock file also detects provider changes ([migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)). Development migration generation uses a shadow database to detect drift and potential data loss, which adds a database provisioning requirement in development/CI ([shadow database](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database)). Customized migration SQL remains possible, but PostgreSQL extensions, RLS, unusual indexes, and data migrations need explicit review outside the generated model abstraction.

**Queries, relations, and transactions.** The generated Client supports nested reads, relation filters, nested writes, batch operations, sequential `$transaction`, interactive transactions, and isolation-level configuration ([relation queries](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries), [transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)). This is the strongest high-level domain API of the candidates, but the generated API can make SQL shape and round trips less obvious; query logging and database plans remain necessary for important paths.

**Types and raw SQL.** Prisma Client types adapt to partial selections and included relations ([type safety](https://docs.prisma.io/docs/orm/prisma-client/type-safety)). TypedSQL is the preferred current escape hatch for SQL that needs compile-time typing; `$queryRaw`/`$executeRaw` are available, while unsafe variants carry SQL-injection risk ([TypedSQL](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/typedsql), [raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries)). PostgreSQL features not represented by Prisma can require `Unsupported` fields and raw SQL; the official PostGIS example documents that such fields can be typed as `any` and may remove normal write operations ([SafeQL/PostGIS](https://docs.prisma.io/docs/orm/prisma-client/using-raw-sql/safeql)).

**Serverless/edge, testing, and seeds.** As checked on 2026-08-15, the current Prisma overview says Prisma 7 is generally available, Prisma Next is early access, and direct database connections in Prisma 7 require a driver adapter. The adapter-based architecture supports Node.js, serverless, and edge-oriented deployments; the official edge guide describes `engineType = "client"` with a native JavaScript driver to avoid shipping Rust engine binaries ([current overview](https://docs.prisma.io/docs/orm), [database drivers](https://www.prisma.io/docs/orm/core-concepts/supported-databases/database-drivers), [edge deployment guide](https://docs.prisma.io/docs/orm/v6/prisma-client/deployment/edge)). This is viable, but it introduces generated-client output, adapter, ESM, driver, and runtime-version coordination in the monorepo.

Prisma documents both client mocking for unit tests ([unit testing](https://docs.prisma.io/docs/orm/prisma-client/testing/unit-testing)) and integrated seed commands. In Prisma 7, seeding is explicitly invoked with `prisma db seed`; it is no longer automatically triggered by `migrate dev` or `migrate reset` ([seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)). That explicitness is good for repeatability, but it is a version-sensitive workflow that should be pinned and tested in CI.

**Performance and portability.** Prisma provides a productive abstraction over several database families, but portability is limited by provider-specific types and SQL behavior. The generated query engine/client, migration CLI, driver adapters, and build output are more operational components than Drizzle or Kysely. Prisma is the strongest alternative if generated client ergonomics, relation APIs, and a declarative schema are more important than SQL transparency and a minimal edge bundle.

### Kysely

**Classification and schema.** Kysely is a type-safe TypeScript SQL query builder, not an ORM. Its introduction documents compile-time checking of visible tables/columns and selected result types ([introduction](https://www.kysely.dev/docs/intro)). It requires a `Database` TypeScript interface; production type definitions can be generated by third-party tools such as `kysely-codegen` by introspecting the database ([type generation](https://www.kysely.dev/docs/generating-types)). Kysely therefore does not establish a model/entity source of truth or generate a domain client.

Kysely includes optional `up`/`down` migration primitives. Migration files are meant to be frozen in time, can use schema builders or normal data queries, run in alphanumeric order, and use a database lock so concurrent runners serialize safely ([migrations](https://www.kysely.dev/docs/migrations)). The official CLI is optional and separate from the core package. This is attractive for a PostgreSQL-first team that wants migration code and SQL control, but it shifts schema modeling, relation conventions, seed scripts, and generated type coordination to the application team.

**Queries, relations, transactions, and raw SQL.** Kysely composes explicit SQL and has a callback transaction API with isolation-level configuration ([Kysely transaction API](https://kysely-org.github.io/kysely-apidoc/classes/Kysely.html)). It has no relation metadata or automatic relation loading; nested results must be built with joins, subqueries, JSON functions, and helpers ([relations recipe](https://www.kysely.dev/docs/recipes/relations)). Raw SQL is a first-class `sql` template escape hatch ([raw SQL](https://www.kysely.dev/docs/recipes/raw-sql)). This maximizes SQL transparency and can minimize accidental ORM work, but it requires more repository/query code and more careful result mapping.

**Runtime, testing, seeds, performance, and portability.** The official project describes Kysely as lightweight, zero-dependency, and usable in JavaScript environments including Node.js, Deno, Bun, AWS Lambda, Cloudflare Workers, and browsers; its built-in dialects include PostgreSQL, MySQL, MSSQL, SQLite, and PGlite ([official project site](https://www.kysely.dev/), [dialects](https://www.kysely.dev/docs/dialects)). Edge compatibility still depends on the selected dialect/driver, and the PostgreSQL dialect normally uses `pg` ([getting started](https://www.kysely.dev/docs/getting-started)). Kysely’s thin, predictable SQL compilation is a performance-friendly posture, not a substitute for query-plan measurement. The core docs provide migration and query primitives rather than a first-party seed/fixture system, so the repository would need explicit fixture tooling and an ephemeral PostgreSQL test strategy.

Kysely is the best alternative when the team deliberately chooses a SQL/query-builder approach and accepts that relation mapping, domain persistence patterns, and schema type generation are repository responsibilities. It is not the right answer if the requirement specifically means “an ORM with generated domain clients.”

### TypeORM

TypeORM is a traditional entity ORM with repositories, relation metadata, a query builder, raw-query APIs, and transaction managers. Its documentation covers one-to-one, one-to-many, and many-to-many relations ([relations](https://typeorm.io/docs/relations/relations/)), query builders that return entities or raw rows ([select query builder](https://typeorm.io/docs/query-builder/select-query-builder/)), and callback transactions that require all work to use the provided transactional manager ([transactions](https://typeorm.io/docs/transactions/)).

TypeORM supports both generated and hand-written migrations, but its own documentation warns that `synchronize: true` is unsafe in production; production schema changes belong in migrations ([why migrations](https://typeorm.io/docs/migrations/why/), [creating migrations](https://typeorm.io/docs/migrations/creating/)). Raw SQL and query-builder expressions are available, with the expected parameterization and injection hazards ([DataSource API](https://typeorm.io/docs/data-source/data-source-api/)).

The supported-platforms page documents Node.js, browser, Expo, NativeScript, and React Native drivers ([supported platforms](https://typeorm.io/docs/help/supported-platforms/)). That can matter for a future local/offline mobile database, but it is not a reason for the React Native client to share the server’s PostgreSQL entity layer. For this repository, TypeORM adds entity/decorator and relation-loading conventions without improving the detached API boundary or the edge-first requirement. Keep it as a viable fallback only if the architecture later chooses a conventional entity ORM or client-local database support as a first-class concern.

## 5. Recommendation

**Choose Drizzle ORM for the shared server-side PostgreSQL package, with an explicit PostgreSQL-first migration policy.** It best balances:

- SQL visibility for financial invariants and PostgreSQL-native features;
- typed schema and query results without a generated-client build dependency;
- both explicit joins and convenient nested relational reads;
- callback transactions with PostgreSQL isolation options;
- normal Node.js drivers plus documented Neon/serverless and edge-compatible drivers;
- deterministic seed/reset support for integration tests; and
- a small, transport-neutral backend package that web and React Native clients can consume only through an API.

Recommended monorepo boundary:

```text
apps/web                 -> transport client -> API
apps/mobile              -> transport client -> API
packages/api-contract    -> request/response and validation contracts
packages/backend         -> transport adapters + domain services
packages/db              -> Drizzle schema, repositories, migrations, seeds
```

Recommended schema policy:

1. Define the application-facing PostgreSQL tables and inferred types in `packages/db`.
2. Generate migrations with Drizzle Kit, review and commit the SQL, and hand-author PostgreSQL-only DDL where necessary. Treat the committed migration history as the deployment source of truth; keep the Drizzle schema synchronized with it.
3. Run exactly one migration runner in CI/CD. Do not run `drizzle-kit push` in production, and do not let an ORM auto-synchronize a live database.
4. Keep `packages/db` server-only. Export domain repositories/services or API contracts, not a database client, to web or React Native packages.
5. Use a normal Node/serverless backend by default. Select an edge driver only after confirming the provider’s connection, pooling, WebSocket, and interactive-transaction behavior. For a transaction-heavy finance operation, prefer a runtime/driver combination with a real session transaction rather than assuming HTTP query batching is equivalent.
6. Build integration tests that apply all migrations to a disposable PostgreSQL database, run deterministic seeds, exercise rollback/isolation/concurrency cases, and inspect SQL plans for high-volume paths.

**Second choice:** choose Prisma if the team values its generated client, declarative model, and high-level relation/nested-write API more than SQL transparency and minimal runtime/build complexity. **Choose Kysely instead of Drizzle** only when the team intentionally wants a query builder and is prepared to own relation mapping, schema type generation, fixture conventions, and more SQL-centric repository code. TypeORM is a fallback for a conventional entity-ORM architecture, not the default for this detached backend.

## 6. Tradeoffs and risks

- **Schema drift:** Drizzle’s flexibility permits database-first, code-first, direct push, generated SQL, and external migration tools. That flexibility is a risk unless this repository documents one policy and enforces it in CI.
- **PostgreSQL features:** RLS, extensions, partial/concurrent indexes, exclusion constraints, views, triggers, and data backfills may require hand-reviewed SQL even when the TypeScript schema covers ordinary tables. Portability should not be promised for code that intentionally uses those features.
- **Edge transactions:** Neon HTTP is convenient for single non-interactive requests; interactive/session transactions need a compatible WebSocket or serverful driver. A finance write must be tested under the actual deployment runtime.
- **Performance:** “Thin,” “one query,” or “generated client” are design properties, not workload benchmarks. Measure query plans, lock waits, connection saturation, serialization failures, and cold-start behavior using representative financial data.
- **Prisma operational cost:** Prisma’s generated client, migration CLI, adapter, ESM configuration, and version-sensitive Prisma 7 seed/driver behavior are manageable but add build and upgrade coordination. Prisma’s `Unsupported` fields and raw SQL paths need explicit typing and review.
- **Kysely responsibility shift:** Kysely gives the most direct SQL control, but it is not an ORM and does not supply relation metadata or a first-party fixture model. More local code can be the right tradeoff, but it is still a cost.
- **Transaction correctness:** PostgreSQL’s isolation and locking semantics remain the authority. Every candidate requires short transaction scopes, explicit retry handling for serialization/deadlock failures where appropriate, and tests that use the transaction-bound client/manager.
- **Client coupling:** Sharing ORM models with web/mobile would couple public clients to storage details and expose an unsafe credential boundary. Keep the transport-neutral API contract separate from database schemas and generated database types.

## 7. Unresolved follow-ups

1. Which PostgreSQL host and deployment runtimes are actually planned: long-running Node, serverless functions, Vercel Edge, Cloudflare Workers, or a mix?
2. Are RLS, multi-tenancy, audit trails, PostgreSQL extensions, materialized views, or PostGIS in scope? These affect how much SQL must remain outside the ORM schema DSL.
3. Is the mobile product online-only, or must it support offline-first/local SQLite? Offline persistence could justify a separate client-local data layer, but not sharing the server PostgreSQL package.
4. Which transport and validation stack will define `packages/api-contract` (REST, GraphQL, RPC, or another protocol), and how will authorization context reach repositories and transactions?
5. What migration policy will CI enforce: disposable database from zero, expand/contract changes, backward-compatible deploy order, index-concurrently rules, and rollback expectations?
6. Run a small proof of concept with representative account/transaction/ledger queries in Drizzle and Prisma, plus one Kysely implementation, measuring generated SQL, query plans, transaction retries, bundle size, cold starts, and connection behavior in the chosen host.
7. Pin the selected library versions and re-check the Prisma 7/Drizzle release notes before implementation because driver, edge, seed, and CLI behavior is version-sensitive.

## 8. Sources

All sources below are first-party documentation or first-party API/repository sites, checked 2026-08-15.

- [PostgreSQL data definition](https://www.postgresql.org/docs/current/ddl.html) and [`BEGIN`/transaction modes](https://www.postgresql.org/docs/current/sql-begin.html)
- [Drizzle overview](https://orm.drizzle.team/docs/overview), [migrations](https://orm.drizzle.team/docs/migrations), and [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview)
- [Drizzle relational queries](https://orm.drizzle.team/docs/rqb), [transactions](https://orm.drizzle.team/docs/transactions), and [SQL escape hatches](https://orm.drizzle.team/docs/sql)
- [Drizzle PostgreSQL/Neon connections](https://orm.drizzle.team/docs/connect-neon), [Vercel Edge guide](https://orm.drizzle.team/docs/tutorials/drizzle-with-vercel-edge-functions), and [seeding](https://orm.drizzle.team/docs/seed-overview)
- [Prisma ORM overview](https://docs.prisma.io/docs/orm), [Prisma Client](https://www.prisma.io/docs/orm/prisma-client), and [database drivers](https://www.prisma.io/docs/orm/core-concepts/supported-databases/database-drivers)
- [Prisma migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories) and [shadow database](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database)
- [Prisma relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations), [transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions), and [type safety](https://docs.prisma.io/docs/orm/prisma-client/type-safety)
- [Prisma TypedSQL/raw SQL](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/typedsql), [unit testing](https://docs.prisma.io/docs/orm/prisma-client/testing/unit-testing), and [seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)
- [Kysely introduction](https://www.kysely.dev/docs/intro), [relations recipe](https://www.kysely.dev/docs/recipes/relations), [migrations](https://www.kysely.dev/docs/migrations), and [raw SQL](https://www.kysely.dev/docs/recipes/raw-sql)
- [Kysely type generation](https://www.kysely.dev/docs/generating-types), [dialects](https://www.kysely.dev/docs/dialects), [getting started](https://www.kysely.dev/docs/getting-started), and [transaction API](https://kysely-org.github.io/kysely-apidoc/classes/Kysely.html)
- [TypeORM relations](https://typeorm.io/docs/relations/relations), [transactions](https://typeorm.io/docs/transactions), [migrations](https://typeorm.io/docs/migrations/why/), [DataSource/raw SQL](https://typeorm.io/docs/data-source/data-source-api/), and [supported platforms](https://typeorm.io/docs/help/supported-platforms/)
