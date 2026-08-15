# Backend and Database Architecture for Shared Web and Mobile

**Status:** research resolution for [Wayfinder issue 14](https://github.com/ralonsodeniz/personal-finance/issues/14)  
**Date checked:** 2026-08-15  
**Scope:** architecture decision only; no application implementation

## Question

Which backend and database shape should serve both the Next.js web/PWA and a future React Native/Expo app? The comparison must cover a Next.js-owned backend/API, a detached TypeScript backend, Convex, Supabase, and other worthwhile managed alternatives, with PostgreSQL as the relational baseline where appropriate. It must also account for RSC boundaries, mobile compatibility, financial reporting and exports, realtime, authentication and authorization, validation, migrations, testing, deployment, offline evolution, observability, portability, and cost.

## Assumptions and decision criteria

The repository map establishes these working assumptions:

- The repository is a TypeScript monorepo. The first product is a mobile-first installable Next.js web/PWA; React Native/Expo is a later client of the same backend.
- The product is multi-user. Its domain includes transactions, savings, investments, financial accounts, and future household/workspace membership and scoped sharing. An authentication User/Identity must remain distinct from a Financial Account.
- Authentication is required from the start. Managed authentication is preferred, with Google and Apple as planned providers where supported.
- The initial write paths are manual entry and CSV import. Bank and brokerage integrations are later adapters, not part of the first implementation.
- Managed cloud infrastructure and an online-first PWA are preferred. Privacy, authorization, backups, exports, observability, and vendor portability are explicit requirements.
- The system should keep a single authoritative financial data model. The mobile client should not become a second database with an undocumented merge protocol.
- Pricing and feature statements below are snapshots checked on 2026-08-15, not quotes. Recheck them before provisioning.

The architecture is judged primarily on: correctness of financial invariants; a clean web/native API boundary; safe multi-tenant authorization; relational reporting and exportability; low initial operational load; a credible path to background jobs, realtime, and offline synchronization; and the ability to move providers without rewriting the domain model.

## Recommendation

Adopt a **modular monolith with a portable PostgreSQL source of truth**:

1. **Own the application API in Next.js initially.** Use public, versioned Route Handlers (for example, `/api/v1/...`) as the cross-client HTTP boundary. Keep authentication, authorization, validation, and domain commands behind those handlers. Do not make Server Actions or RSC internals the only API consumed by the future native app.
2. **Keep the domain independent of Next.js.** Put financial rules, commands, query models, runtime schemas, and API-client types in shared packages. The Next.js app owns UI, RSC composition, and the initial transport adapter; a future `apps/api` or worker can reuse the same domain and contract packages without a data-model rewrite.
3. **Use managed PostgreSQL, with Supabase as the recommended initial platform.** Supabase provides a full PostgreSQL database plus managed Auth, RLS, Realtime, Storage, local tooling, and migration workflows. Keep financial writes behind the application API; treat database constraints and deliberately tested RLS policies as defense in depth. Never expose an administrative/service key to a browser or native client.
4. **Make standard PostgreSQL the portability boundary.** Store schema changes as reviewed SQL migrations in the repository. Use relational tables, foreign keys, unique/check constraints, explicit transaction boundaries, and normal SQL views/queries for reports. Keep Supabase-specific Auth, Realtime, Storage, and Edge Function usage behind adapters so the core financial data remains movable to another PostgreSQL host such as Neon.
5. **Start online-first and design for later sync.** Add stable IDs, idempotency keys for commands/imports, server timestamps, and a change/sync cursor to the model now. Defer a durable offline outbox, conflict policy, and bidirectional sync protocol until the web semantics and import behavior are proven.
6. **Use HTTP/JSON plus shared runtime schemas as the durable contract.** tRPC is a viable TypeScript client adapter and can be mounted on Next.js or a detached server, but it should not own the domain model or be the only shape exposed to future integrations, exports, webhooks, or non-TypeScript consumers. Decide REST/OpenAPI versus tRPC in a small follow-up spike.

The target shape is:

```text
Next.js RSC/UI and PWA  --\
                           --> versioned HTTP API --> auth/session --> domain services
React Native/Expo       --/                                  |            |
                                                            |            +--> PostgreSQL adapter
                                                            |                 --> managed PostgreSQL
                                                            +--> jobs/events later
```

RSC can call server-side domain/read functions directly when rendering. Browser client code and React Native cross the public API boundary. This avoids an unnecessary server-to-self HTTP round trip for RSC while preserving one real API for mobile and future integrations.

### Minimum data shape

The first relational model should leave room for:

- `identities` or an equivalent local user mapping keyed by the authentication provider subject; this is not the same object as a financial account.
- `workspaces`/households and `memberships` with explicit roles and invitation/revocation state.
- `financial_accounts`, `transactions`, categories, currencies, and investment/savings extensions scoped through the workspace or owner.
- `import_batches`, source rows, normalized rows, external/provider identifiers, and an idempotency key so a repeated CSV or future bank sync cannot silently duplicate transactions.
- `audit_events` and export records where privacy/audit requirements justify them.

Use integer minor units or a precisely specified numeric representation for monetary amounts, always with an explicit currency. Enforce non-negotiable invariants in PostgreSQL as well as in TypeScript. A transaction that creates or updates related financial rows should commit atomically; a report should read a coherent committed state.

### API and RSC boundary

Next.js documents Route Handlers as public HTTP endpoints and explicitly warns that they need authentication and authorization like any other public API. Its Backend-for-Frontend guidance also says Next.js backend features are an API layer rather than a full replacement for every backend concern. Server Functions/Actions are network-reachable POST entry points designed for server-side mutations, but they are coupled to the React/Next.js application model. Therefore:

- RSC-only reads may use the domain/data layer directly; do not fetch the app's own Route Handler from an on-demand Server Component merely to reuse code.
- Route Handlers should parse and validate the request, resolve the caller, authorize the workspace/resource, call a domain service, and serialize a stable response.
- Server Actions may be a convenient web-only adapter for forms, but the same command must also be reachable through the versioned API for native clients.
- CSV import/export and webhooks should use ordinary Route Handlers with explicit size/time limits. Large or slow work should enqueue a job rather than depend on a serverless request remaining alive.
- A future detached service should be able to mount the same transport contract and call the same domain package. That extraction seam is more valuable than choosing a second server on day one.

Sources: [Next.js Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Server and Client Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components), [Mutating data with Server Functions](https://nextjs.org/docs/app/getting-started/mutating-data), and [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication).

## Compared options

| Option | What it gives this product | Main costs/risks | Decision |
| --- | --- | --- | --- |
| **Next.js-owned API + PostgreSQL** | One deployment and one TypeScript codebase; excellent RSC integration; Route Handlers can serve web and native HTTP clients; low initial operations | Serverless/runtime limits for long jobs and WebSockets; temptation to couple business logic to RSC/Server Actions; a later extraction needs disciplined package boundaries | **Recommended v1 backend shape** |
| **Detached TypeScript API + PostgreSQL** | Explicit mobile-first boundary; independent scaling/runtime; easier long-running jobs, queues, WebSockets, and non-web deployments | Second app, deployment, auth integration, local service, observability surface, and network hop; slower initial delivery; RSC either calls it over HTTP or duplicates a server-side adapter | **Keep as the extraction path; do not pay the cost initially** |
| **Supabase behind the Next.js API** | Full PostgreSQL, Auth, RLS, Realtime, Storage, backups, local stack, and checked-in SQL migrations; Google/Apple and Expo/native Auth documentation | Supabase-specific Auth schema, APIs, RLS conventions, Realtime, and Storage increase platform coupling; direct client CRUD can bypass domain workflows if not constrained; service keys bypass RLS | **Recommended initial managed data plane** |
| **Neon + PostgreSQL** | Standard PostgreSQL, serverless/edge driver, branching, scale-to-zero, autoscaling, and usage-based billing; strong portability and preview-database story | Does not remove the need to design the application API, auth/session integration, realtime, storage, or jobs; ancillary Neon features still need their own evaluation | **Strong alternative if lower platform coupling or usage pricing wins** |
| **Convex** | TypeScript backend functions, runtime argument/return validation, serializable transactional mutations, automatic reactive queries, client libraries, and preview deployments | Document-relational model with no SQL; reports and exports use a provider-specific query/data shape; migration to PostgreSQL would be an application/data rewrite; realtime is built in even though v1 does not require it | **Not selected for the financial source of truth** |
| **Firebase/Cloud Firestore** | Built-in realtime listeners, client offline persistence, mobile/web SDKs, autoscaling, and a simple document model | NoSQL collections/documents are a poor default for multi-table financial reporting, reconciliation, and relational constraints; transaction behavior differs offline; document read/write/index billing can make report-shaped access expensive or awkward | **Not selected; revisit only if offline-first becomes the dominant requirement** |

### Next.js-owned backend/API

This is the best initial fit because the first client is Next.js and the required API is not yet a high-throughput independent service. Route Handlers use the Web `Request`/`Response` model and support the normal HTTP verbs, so React Native can call them with the Fetch API. Next.js also documents a useful split: server components fetch their data source directly, while public endpoints are appropriate for client-side and external callers.

The important constraint is not to let `app/` become the domain layer. A reasonable package graph is:

```text
packages/domain       pure financial rules and use cases
packages/contracts    runtime input/output schemas and stable DTOs
packages/data         server-only PostgreSQL adapter and transaction helpers
packages/auth         provider-neutral caller/session and authorization primitives
packages/api-client   typed HTTP client for web client components and native later
apps/web               Next.js RSC/UI plus Route Handler adapters
```

The web app may use a server-side adapter to avoid an RSC self-request. The PWA client and future Expo app use `packages/api-client` over HTTPS. This keeps RSC a rendering optimization rather than a portability requirement.

Next.js warns that some hosts deploy handlers as lambdas: handlers cannot share data between requests, may not be able to write files, may time out during long work, and WebSockets may not work after the response or timeout. That is acceptable for ordinary CRUD and reports with bounded execution, but CSV processing, large exports, bank sync, notifications, and realtime should have a worker/event seam from the start.

### Detached TypeScript backend

A separate Hono, Fastify, NestJS, or similar TypeScript service is a good second phase when one of these becomes true:

- long-running or retryable import/export jobs need a worker/runtime independent of the web deployment;
- realtime connections or background consumers need a process that is not request-scoped;
- native traffic and third-party integrations become large enough to justify independent scaling;
- the API needs a separate release cadence or deployment perimeter.

It should reuse `packages/domain`, `packages/contracts`, `packages/auth`, and `packages/data`; otherwise the split creates two definitions of financial behavior. Until those pressures exist, it adds an API deployment, CORS/CSRF and cookie decisions, cross-service tracing, local orchestration, and failure modes without improving the product's first user journey.

### Supabase

Supabase is the closest managed match to the requirements. Its database documentation describes each project as a full PostgreSQL database, not a PostgreSQL abstraction, with Realtime, backups, and extensions. Its Auth service issues JWT-based sessions and supports social login; the first-party Google and Apple guides include web and native/Expo paths. The platform also documents a local development/migration workflow that keeps SQL changes in `supabase/migrations` and applies them through the CLI.

For authorization, Supabase maps requests to `anon` or `authenticated` Postgres roles and supports table policies with `using`/`with check`. This is useful for workspace-scoped defense in depth and for future carefully controlled direct reads or Realtime subscriptions. The same documentation warns that service keys bypass RLS and must never be exposed to customers. The recommended v1 posture is therefore:

- application/domain authorization is the canonical check for financial commands;
- RLS is enabled and tested for any Supabase Data API, Storage, or Realtime path that is exposed;
- the browser and native apps receive only publishable/client credentials, never an administrative key;
- direct client table writes are not the default path for financial mutations; use API commands that enforce invariants and idempotency;
- Auth, Storage, Realtime, and provider-specific SQL live behind adapters and are not allowed to leak into `packages/domain`.

Supabase Realtime supports Broadcast, Presence, and Postgres Changes. Its current guidance recommends Broadcast for most scalable/security-sensitive cases and describes Postgres Changes as simpler but less scalable. That is enough for future household notifications or cache invalidation, but it is not a reason to make v1 financial correctness depend on eventual push delivery.

Sources: [Supabase database overview](https://supabase.com/docs/guides/database/overview), [Auth](https://supabase.com/docs/guides/auth), [server package selection](https://supabase.com/docs/guides/auth/choosing-a-server-package), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Realtime](https://supabase.com/docs/guides/realtime), [Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple login](https://supabase.com/docs/guides/auth/social-login/auth-apple), and [React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native).

### Neon + PostgreSQL

Neon is the best alternative when the team wants a database-first managed PostgreSQL provider with fewer required application-platform assumptions. Neon documents a serverless PostgreSQL platform with separated compute/storage, branching, autoscaling, scale-to-zero, and a JavaScript/TypeScript driver that can use HTTP or WebSockets. Branching is particularly attractive for isolated migration/integration test databases and preview deployments. The database remains standard PostgreSQL, so the data layer can be moved to another host with normal SQL tools.

Neon does not eliminate the need to choose and integrate an application Auth provider, API/realtime layer, file storage, and job system. Neon now documents optional Auth and related platform features, but those should be evaluated separately from the non-negotiable PostgreSQL boundary. Choose Neon over Supabase if provider-neutral data hosting, serverless database ergonomics, and usage-based cost are more important than Supabase's integrated Auth/RLS/Realtime workflow.

Sources: [Neon introduction](https://neon.com/docs/introduction), [architecture](https://neon.com/docs/introduction/architecture-overview), [branching](https://neon.com/docs/introduction/branching), [serverless driver](https://neon.com/docs/serverless/serverless-driver), [scale to zero](https://neon.com/docs/introduction/scale-to-zero), and [pricing](https://neon.com/pricing).

### Convex

Convex is compelling for a collaborative, realtime TypeScript product. Its official docs describe a document-relational database, TypeScript query/mutation/action functions, automatically cached/reactive queries, transactional mutations, runtime argument/return validators, and HTTP actions for custom clients. It also provides per-developer development deployments and preview deployment workflows.

The tradeoff is fundamental for this domain: Convex's database interface is JSON-like documents and a JavaScript API, not portable PostgreSQL/SQL. It can represent relations and has import/export facilities, but reporting, reconciliation, and future bank/brokerage adapters would be written against Convex's query model. Moving to PostgreSQL later would require translating data, queries, indexes, authorization, and migration history. Convex is a reasonable choice if seamless realtime and rapid TypeScript iteration outweigh standard relational portability; that is not the current map's priority.

Sources: [Convex overview](https://docs.convex.dev/understanding/overview), [database](https://docs.convex.dev/database/overview), [schemas](https://docs.convex.dev/database/schemas), [functions](https://docs.convex.dev/functions/overview), [validation](https://docs.convex.dev/functions/validation), [realtime](https://docs.convex.dev/realtime), [production deployments](https://docs.convex.dev/production/overview), and [pricing](https://www.convex.dev/pricing).

### Firebase/Cloud Firestore

Firestore is the strongest option for built-in offline persistence and realtime client synchronization. Firebase documents a hierarchical NoSQL document/collection data model, offline reads/writes/listeners, atomic transactions/batched writes, and last-write-wins behavior for multiple offline changes to the same document. Firestore transactions fail while the client is offline, while batched writes can execute offline.

That offline behavior is attractive for a future native experience, but it makes the client sync/conflict semantics part of the source-of-truth design. The product's core queries are relational: transactions join to financial accounts, workspaces, categories, currencies, imports, and reporting periods. Firestore can model those relationships, but the shape is less natural and its billing counts document reads, writes, deletes, index entries, storage, and bandwidth. It is therefore rejected as the initial financial store; an offline-first decision would need to be explicit and would justify re-opening this comparison.

Sources: [Firestore core operations](https://firebase.google.com/docs/firestore/standard-edition), [offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions), and [Firestore billing](https://firebase.google.com/docs/firestore/pricing).

## PostgreSQL fit for financial data

PostgreSQL is the right baseline because it gives the model relational integrity and a portable reporting surface:

- `NOT NULL`, `CHECK`, `UNIQUE`, primary-key, and foreign-key constraints provide database-enforced invariants and referential integrity. Use them for currency/amount validity, uniqueness of external identifiers, workspace scoping keys, and relationship existence.
- Explicit transactions give all-or-nothing behavior for multi-row commands such as an import batch, transfer, or a transaction plus its audit event. Reports should read committed state rather than a sequence of partially applied writes.
- SQL views, carefully indexed queries, and materialized/reporting tables can support monthly totals, account balances, investment summaries, and exports without moving the source of truth into a document projection.
- PostgreSQL `COPY` can move table or query results to/from files or standard streams and supports CSV, which is useful for controlled export and import pipelines. CSV still needs application-level header mapping, validation, deduplication, and error reporting.
- PostgreSQL documents SQL dumps, file-system backups, and continuous archiving/PITR as distinct backup approaches. The managed host's backup window, restore process, retention, and restore drills remain deployment decisions rather than assumptions.

Sources: [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html), [COPY](https://www.postgresql.org/docs/current/sql-copy.html), and [backup and restore](https://www.postgresql.org/docs/current/backup.html).

## Evaluation against the required concerns

### Relational data, reporting, and exports

PostgreSQL wins. Financial accounts, transactions, workspaces, memberships, import batches, securities, prices, and reporting periods have real relationships and invariants. A document database would make denormalized projections and reconciliation logic first-class too early. Keep reporting queries in a read/query module and stream large exports from a bounded server job; do not expose SQL or provider admin APIs to clients.

### Realtime

Realtime is a later capability, not the primary storage decision. Next.js serverless handlers may not support durable WebSockets. Supabase Realtime or a later dedicated event layer can deliver household notifications and cache invalidation. For financial writes, the API response and database transaction are authoritative; realtime messages are hints to refetch, not an accounting ledger.

### Authentication and authorization

Use a managed Auth provider and normalize the provider subject into a local identity mapping. The domain authorization function should answer `can(actor, action, resource)` using workspace membership, role, ownership, and resource scope. Every API command must derive the actor from a verified session/token and query through an authorized scope; never trust a client-supplied `userId` or workspace ID alone.

Supabase Auth is the leading candidate because its official docs cover JWT sessions, Next.js cookie/SSR handling, bearer-token server APIs, Google, Apple, and Expo/native flows. Keep the auth provider behind `packages/auth` so the later provider decision does not redefine financial identities. If Supabase Data API, Storage, or Realtime is exposed to clients, add RLS policies and policy tests; service/admin credentials remain server-only.

### Validation and contracts

TypeScript types alone disappear at runtime. Define shared input/output schemas in `packages/contracts`, validate at the API boundary, return stable error codes, and repeat invariants in PostgreSQL. The same schemas should power the web client, future native client, CSV row normalization, and contract tests. tRPC provides strong inferred types and input validation for all-TypeScript clients and has first-party Next.js integration; a conventional HTTP/JSON contract remains easier to document, version, inspect, and consume from future integrations.

### Migrations and portability

Treat the database schema as a reviewed, versioned artifact. Prefer SQL migrations in git (or a TypeScript tool that emits reviewed SQL) over dashboard-only changes. Supabase's CLI explicitly supports local migration files and warns against changing the remote database outside migration history. Drizzle documents both database-first and codebase-first migration modes and can generate/apply SQL; Prisma Migrate likewise keeps customizable SQL migration history. Pick one tool after a schema spike, but do not let its model hide PostgreSQL features required by the domain.

The portability rule is: standard tables, constraints, indexes, views, SQL migrations, and `pg_dump`/restore must remain usable outside the chosen host. Supabase Auth's `auth` schema, RLS helpers, Realtime publications, Storage objects, and Edge Functions are provider-specific and must be isolated or documented as migration work.

Sources: [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Drizzle migration modes](https://orm.drizzle.team/docs/migrations), [Prisma Migrate](https://docs.prisma.io/docs/orm/prisma-migrate), and [PostgreSQL backup/restore](https://www.postgresql.org/docs/current/backup.html).

### Testing

Use three layers:

1. Pure domain tests for money arithmetic, categorization, import normalization, authorization decisions, and idempotency.
2. PostgreSQL integration tests against a real disposable database, exercising constraints, transactions, RLS (where used), indexes, migrations, and report queries. Supabase local development or Neon branches can provide isolated environments; do not make SQLite the only integration database.
3. API contract and end-to-end tests from the web client and a native-style HTTP client. Verify authentication expiry, workspace isolation, duplicate imports, retries, CSV errors, exports, and large-report behavior.

Preview database branches are useful but must be sanitized. Never copy live financial data into developer or CI environments without an explicit masking/retention policy.

### Deployment and observability

Deploy the Next.js app and API together initially, but deploy the database independently with migrations as an explicit release step. Add a worker/queue only when import/export/integration jobs need it. Record structured request IDs, actor IDs, workspace IDs, route/procedure names, duration, database timing, and outcome; exclude transaction descriptions, account numbers, tokens, and raw CSV rows from normal logs. Add error reporting and traces across API, domain command, database transaction, and asynchronous job. Keep an append-only audit trail for security-relevant events rather than relying on application logs.

Supabase provides dashboard logs, backups, Realtime, and paid-plan log-drain/retention options; Neon provides usage/performance visibility and higher-plan metrics/log export; Convex provides health/insights and higher-plan log/exception features. These reduce initial operations but do not replace application-level auditability or restore drills. Confirm data region, retention, deletion, export, and incident-response requirements before production.

### Offline evolution

The recommended online-first PWA should tolerate transient network failure but should not pretend to support offline financial writes until conflict semantics are designed. Add now:

- client-generated command/import IDs and server-side idempotency records;
- immutable event or audit metadata sufficient to explain a retry;
- server timestamps/version numbers and a scoped change cursor;
- clear conflict responses for stale updates.

Later, a native/offline feature can add a durable local outbox, retry policy, per-command merge rules, and a sync endpoint. Do not expose the primary Postgres connection or implement ad hoc client-side replication. Convex and Firestore are stronger out of the box for reactive/offline client behavior, but selecting them solely to avoid designing sync would trade away the relational/portability requirement.

### Cost

At the 2026-08-15 check:

- Supabase lists a free tier with 500 MB database storage and a Pro plan from $25/month; Pro includes daily backups and seven-day log retention, with usage charges beyond included quotas.
- Neon lists a free tier and usage-based paid plans; its Launch example says typical spend is $15/month for an intermittent 1 GB workload, but actual compute, storage, history, egress, and branches vary.
- Convex lists Free/Starter and a Professional plan at $25 per developer/month, with usage-based function/action/storage/network resources.
- Firebase documents usage billing for Firestore reads, writes, deletes, index entries, storage, and bandwidth.

The first-year cost difference is likely smaller than the cost of reworking a financial schema or authorization model. Recheck provider pricing, region, backups/PITR, quotas, support, and egress before commitment; keep usage dashboards and spend caps enabled.

Sources: [Supabase pricing](https://supabase.com/pricing), [Neon pricing](https://neon.com/pricing), [Convex pricing](https://www.convex.dev/pricing), and [Firestore billing](https://firebase.google.com/docs/firestore/pricing).

## Tradeoffs accepted by this recommendation

- **Operational simplicity now vs. independent scaling later:** keeping the API in Next.js is cheaper and faster initially, but a worker or detached service will be added when request/runtime limits become real.
- **Supabase convenience vs. full provider neutrality:** integrated Auth/RLS/Realtime/Storage reduce setup, but they create migration work. The mitigation is a provider-neutral domain, contract, auth interface, and SQL-first schema.
- **HTTP portability vs. TypeScript ergonomics:** standard HTTP/JSON is more durable for integrations and native clients; tRPC can still improve internal TypeScript ergonomics as an adapter.
- **Online correctness vs. immediate offline UX:** no offline write queue in v1. The model will include idempotency/version hooks so offline evolution is possible without a second source of truth.
- **Defense-in-depth authorization vs. complexity:** application authorization is required for business commands; RLS is used where data is exposed through Supabase services. Both layers must have tests and clear ownership.

## Unresolved follow-ups

These are deliberately later decisions, not blockers to the architecture resolution:

1. Select the Auth provider and exact session model for web cookies, native secure storage, Google/Apple linking, recovery, logout, session revocation, and provider-subject migration. Supabase Auth is the leading candidate, but the local `identities` contract should be finalized first.
2. Confirm Supabase versus Neon using data-region availability, backup/PITR/restore drills, RLS needs, Realtime needs, support/SLA, egress, and a representative workload. The recommendation is Supabase for v1; Neon is the credible fallback.
3. Choose SQL-first, Drizzle, Kysely, Prisma, or another data-access tool after modeling transactions, reports, migrations, serverless connection behavior, and Postgres-specific features. The tool must emit/review SQL and run against real Postgres in CI.
4. Choose the API contract implementation: conventional REST/HTTP with OpenAPI, tRPC over the HTTP boundary, or a hybrid. Keep runtime schemas and domain commands independent of this choice.
5. Specify workspace/membership/role semantics, RLS policy ownership, audit retention, deletion/export guarantees, and the threat model for shared households.
6. Define the job/queue and object-storage path for large CSV imports, exports, future bank adapters, and notifications; test the runtime limits of the selected hosting platform.
7. Define the offline sync protocol only after the online data model and CSV idempotency behavior are implemented and tested.

## Direct sources checked

All sources used for ecosystem/vendor claims are first-party documentation or official pricing pages:

- **Next.js:** [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Server and Client Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components), [Server Functions/Actions](https://nextjs.org/docs/app/getting-started/mutating-data), [authentication](https://nextjs.org/docs/app/guides/authentication).
- **React Native:** [Networking](https://reactnative.dev/docs/network).
- **PostgreSQL:** [constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html), [COPY](https://www.postgresql.org/docs/current/sql-copy.html), [backup and restore](https://www.postgresql.org/docs/current/backup.html).
- **Supabase:** [database overview](https://supabase.com/docs/guides/database/overview), [Auth](https://supabase.com/docs/guides/auth), [server packages](https://supabase.com/docs/guides/auth/choosing-a-server-package), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Realtime](https://supabase.com/docs/guides/realtime), [Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple login](https://supabase.com/docs/guides/auth/social-login/auth-apple), [React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native), [pricing](https://supabase.com/pricing).
- **Neon:** [introduction](https://neon.com/docs/introduction), [architecture](https://neon.com/docs/introduction/architecture-overview), [branching](https://neon.com/docs/introduction/branching), [serverless driver](https://neon.com/docs/serverless/serverless-driver), [scale to zero](https://neon.com/docs/introduction/scale-to-zero), [pricing](https://neon.com/pricing).
- **Convex:** [overview](https://docs.convex.dev/understanding/overview), [database](https://docs.convex.dev/database/overview), [schemas](https://docs.convex.dev/database/schemas), [functions](https://docs.convex.dev/functions/overview), [validation](https://docs.convex.dev/functions/validation), [realtime](https://docs.convex.dev/realtime), [production deployments](https://docs.convex.dev/production/overview), [pricing](https://www.convex.dev/pricing).
- **Firebase:** [Firestore core operations](https://firebase.google.com/docs/firestore/standard-edition), [offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions), [pricing](https://firebase.google.com/docs/firestore/pricing).
- **API/data tooling:** [tRPC Next.js integration](https://trpc.io/docs/client/nextjs), [tRPC overview/adapters](https://trpc.io/), [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [Prisma Migrate](https://docs.prisma.io/docs/orm/prisma-migrate), and [Kysely](https://www.kysely.dev/).
