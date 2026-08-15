# Deployment and CI/CD strategy for web, backend, docs, and mobile

## Question

What deployment and delivery architecture should support the web/PWA first, a shared backend, static documentation, and future React Native/Expo releases? The comparison must cover low-operations options such as Vercel, Cloudflare, AWS, Fly.io, and other worthwhile choices, without assuming a provider. It must address previews, environment separation, secrets, database migrations, rollback, background jobs, observability, monorepo affected builds, docs deployment, and Expo/EAS releases. The result should recommend a portable boundary and identify provider-specific commitments.

**Date checked:** 2026-08-15

## Scope and assumptions

The local checkout contains only a `README.md`; there is no application code, package manager, CI configuration, deployment manifest, or provider configuration to preserve. The assumptions below therefore come from the Wayfinder map and issue rather than an existing implementation:

- GitHub remains the source repository and GitHub Actions is available.
- The repository will become a TypeScript monorepo with a mobile-first Next.js/PWA web application, a future React Native/Expo application, shared TypeScript packages, a static docs site, and one backend/data system serving web and mobile.
- Authentication starts on day one. Financial data is user-scoped and may later be scoped to households/workspaces and roles, so preview and production data must be isolated.
- PostgreSQL is the recommended database boundary, but the managed PostgreSQL provider is not selected.
- The first meaningful asynchronous workload is likely CSV/import processing; later work may include bank/brokerage adapters, notifications, scheduled reconciliation, and exports.
- “Low operations” means managed deployment, TLS, health checks, logs, and routine scaling are provided by the host. It does not mean that backups, migrations, access control, incident response, or restore testing can be delegated away.
- The recommendation is an initial operating model, not a commitment to the cheapest or most feature-rich vendor. Pricing, regional availability, account plans, quotas, and data-processing terms must be checked before provisioning.

The map issue that establishes the product constraints is [Wayfinder issue 1](https://github.com/ralonsodeniz/personal-finance/issues/1); the research request is [issue 11](https://github.com/ralonsodeniz/personal-finance/issues/11).

## Executive recommendation

Adopt a **portable release boundary with a low-operations split deployment**:

1. **GitHub Actions is the control plane.** It runs affected checks, builds immutable artifacts, runs migration and smoke-test jobs, records deployments, gates production with a protected environment, and exposes a manual promotion/rollback workflow. Use GitHub OIDC for providers that support it rather than storing long-lived cloud credentials. GitHub Environments provide branch restrictions, approval gates, environment-scoped secrets, deployment history, URLs, and concurrency control. See [deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments), [OIDC with cloud providers](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers), [concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency), and [workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts).
2. **Vercel hosts the Next.js web/PWA and static docs initially.** Use separate projects rooted at `apps/web` and `apps/docs`, with automatic PR previews and production promotion controlled by the release workflow. Vercel’s Git integration, environment variables, monorepo project roots, affected-project skipping, and instant rollback fit the web/docs surfaces well. Keep the docs build as a static artifact so it can move to Cloudflare Pages, object storage/CDN, or another static host later. See [Git deployments and previews](https://vercel.com/docs/git), [monorepos](https://vercel.com/docs/monorepos), [environment variables](https://vercel.com/docs/environment-variables), and [production rollback](https://vercel.com/docs/deployments/rollback-production-deployment).
3. **A standard OCI image hosts the backend and worker.** Start with Render for the API, a separate background-worker process, and scheduled jobs if the account plan and region meet the requirements. Render has first-class Blueprint monorepo filters, pull-request preview environments, background workers, cron jobs, environment groups, and artifact-based rollback. Keep the application runnable with a normal Dockerfile and a platform-neutral `PORT`/health-check contract so the same image can move to Fly.io or AWS ECS/Fargate. See [Render monorepo support](https://render.com/docs/monorepo-support), [preview environments](https://render.com/docs/preview-environments), [cron jobs](https://render.com/docs/cronjobs), [environment variables](https://render.com/docs/configure-environment-variables), and [rollbacks](https://render.com/docs/rollbacks).
4. **Managed PostgreSQL is an independent boundary.** Use one database per persistent environment (`preview` where needed, `staging`, `production`), keep SQL/ORM migrations in source control, and run a single forward-only migration job from the protected deployment workflow. Do not make the database a Vercel, Cloudflare, or Fly volume dependency. A tool such as Prisma or Drizzle can implement the migration command, but the application contract should be only a versioned migration directory plus an idempotent `db:migrate` command. Prisma’s [production migration guidance](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate) explicitly recommends running pending migrations in CI/CD rather than from a developer laptop; PostgreSQL’s [backup and restore documentation](https://www.postgresql.org/docs/current/backup.html) makes regular backups and recovery planning an application responsibility.
5. **Durable jobs use a worker and a queue adapter, not request tail work.** Start with a small worker and an outbox/job table in PostgreSQL if the initial volume is low, with idempotency keys, leases, retry counts, and a dead-letter state. Keep a `JobQueue` interface so the adapter can later use Amazon SQS, Cloudflare Queues, or another managed queue. Vercel `after()`/`waitUntil()` and cron are useful for bounded side effects and schedules, but they are not the durable job system: Vercel documents function duration limits and that failed cron invocations are not retried. See [Vercel runtimes](https://vercel.com/docs/functions/runtimes) and [Vercel cron error handling](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
6. **Expo EAS is a deliberately separate mobile release lane.** Keep mobile source, `app.json`/`app.config`, `eas.json`, runtime-version policy, and release channel names in the monorepo. Trigger EAS workflows from GitHub labels, branches, tags, or a manual dispatch: development builds for devices, preview updates/builds for QA, and production build/submit only from a release tag or approved workflow. EAS provides mobile-specific build, update, submit, signing, and workflow primitives; GitHub Actions remains the cross-repository gate and can trigger EAS. See [EAS Workflows](https://docs.expo.dev/eas/workflows/introduction/), [automating EAS CLI commands](https://docs.expo.dev/eas/workflows/automating-eas-cli/), and [EAS environment variables](https://docs.expo.dev/eas/environment-variables/usage/).
7. **Instrument application code with OpenTelemetry.** Export structured logs, metrics, and traces through OTLP, include `service.name`, environment, release SHA, and correlation IDs, and never put raw balances, transaction descriptions, access tokens, or other financial PII into telemetry. Use host-native logs/metrics as an operational baseline, but keep the application signal format portable. OpenTelemetry describes itself as vendor/tool-agnostic and defines OTLP exporters for traces, metrics, and logs; see [OpenTelemetry overview](https://opentelemetry.io/docs/what-is-opentelemetry/) and [OTLP exporters](https://opentelemetry.io/docs/specs/otel/protocol/exporter/).

This is a **split by workload**, not a split by domain logic: the web, API, worker, mobile app, and docs consume the same versioned contracts and domain packages, while only the deployment adapters know about Vercel, Render, Fly.io, AWS, or EAS.

## Recommended release shape

Suggested monorepo layout (architecture only; not implemented by this research task):

```text
apps/
  web/       # Next.js/PWA
  api/       # HTTP backend, same domain contract as mobile
  worker/    # queue consumers and scheduled work
  docs/      # static documentation
  mobile/    # React Native/Expo, later

packages/
  domain/    # financial domain rules, no provider SDKs
  contracts/ # API/event schemas shared by web, API, worker, mobile
  db/        # PostgreSQL access and migration runner
  jobs/      # job types, idempotency, queue abstraction
  config/    # environment parsing and validation
  ui-tokens/ # cross-platform design tokens, not platform UI components
```

The release unit should be explicit:

| Unit | Build output | Initial target | Promotion/rollback unit |
| --- | --- | --- | --- |
| Web/PWA | Vercel build output or equivalent immutable static/server artifact | Vercel project `web` | Promote a known-good deployment; no rebuild required |
| Docs | Static directory | Vercel project `docs` or Cloudflare Pages | Promote a known-good static deployment |
| API | OCI image tagged by Git SHA and referenced by digest | Render web/private service | Redeploy the previous image digest |
| Worker | Same OCI image, different command/process | Render background worker | Redeploy the previous image digest; drain/cancel jobs deliberately |
| Database | Versioned migration files | Independent managed PostgreSQL | Forward fix or restore; do not assume code rollback reverses schema/data |
| Mobile | EAS build/update artifact tied to a runtime version/channel | EAS Build/Update/Submit | Roll back compatible OTA update or ship a new store build; native store rollback is a separate process |

The key release invariant is: **build once, promote the same artifact, and record the Git SHA, image digest, migration version, web deployment IDs, and mobile runtime/channel in a release manifest.** Rebuilding during production promotion weakens rollback and provenance.

## CI/CD workflow

### Pull request path

1. Check out enough Git history for the monorepo affected calculation. Turborepo documents `turbo run ... --affected` and warns that a shallow checkout can make every package appear changed; see [Turborepo CI](https://turborepo.dev/docs/crafting-your-repository/constructing-ci) and [`--affected`](https://turborepo.dev/docs/reference/run).
2. Install from the committed lockfile and run `lint`, `typecheck`, unit tests, contract tests, and builds for affected packages. Use explicit package dependency edges. Remote caching is optional; if enabled, use a signed cache and treat it as an accelerator, not as the source of release truth. Turborepo’s [remote caching documentation](https://turborepo.dev/docs/core-concepts/remote-caching) states that the remote cache protocol can be implemented by a managed or self-hosted service.
3. If `apps/web` or `apps/docs` is affected, create a Vercel preview. If the API contract or backend is affected, create a backend preview only when needed; otherwise test against a persistent sanitized staging API. Do not connect previews to production data or production credentials.
4. If migrations changed, apply them to a disposable or dedicated preview database, run compatibility/contract tests, and record the migration plan. A preview migration must never point at staging or production.
5. Run browser smoke tests against the preview URL. Expose the URL in the GitHub deployment record and pull request.
6. Do not build or submit a mobile store artifact on every PR. A labelled/manual EAS preview update or development build is enough for changes that affect mobile. Any EAS preview must use a preview channel and a preview API base URL.
7. Do not deploy untrusted fork code with production-capable secrets. Required checks and deployment permissions should be separate from preview convenience.

### Main-to-staging path

On merge to `main`, the workflow should:

1. Resolve the affected graph and build the release units once.
2. Produce the web/docs outputs and the API/worker OCI image. Attach the Git SHA, SBOM/provenance where the repository plan supports GitHub artifact attestations, and the image digest. GitHub documents attestations for binaries and container images in [artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations).
3. Deploy to the protected `staging` environment. Run the migration command once, then deploy the API and worker, then promote web/docs. Keep migrations expand/contract compatible with both the old and new application version.
4. Run health, contract, import, authentication, and smoke tests. Verify queue lag, worker heartbeats, database connectivity, and telemetry before production approval.

### Production path

Production must be a promotion of the already-built release, not an ad-hoc branch deploy:

1. A protected GitHub `production` environment permits only `main`/release tags, has required reviewers, and exposes production secrets only after approval. Use environment-level concurrency so two production releases cannot race.
2. Authenticate to the selected cloud using OIDC where supported. GitHub’s OIDC guidance says the provider trust policy must constrain the repository, ref/environment, or equivalent claims; `id-token: write` grants token retrieval, not arbitrary cloud write access. See [OIDC security hardening](https://docs.github.com/en/actions/how-tos/secure-your-work/security-hardening-your-deployments/oidc-in-cloud-providers).
3. Run a pre-deploy migration safety check, then the versioned migration job against production. Stop if it fails. Never run development “reset” or schema-push commands against production.
4. Deploy the API and worker image, wait for readiness/health checks, then promote the web/docs artifacts. If a web change depends on a backend contract, deploy a backward-compatible backend first; remove compatibility only in a later release.
5. Publish a deployment record with URLs, release SHA, image digest, migration version, environment, operator/approver, and links to logs/traces.
6. Trigger mobile EAS production only from a deliberate release workflow/tag. Store release notes and the API/runtime compatibility decision alongside the release metadata.

### Rollback path

Rollback is different for code, infrastructure, and data:

- **Web/docs:** promote the previous immutable Vercel/Pages deployment. Vercel documents routing-level rollback without rebuilding; Cloudflare Pages likewise allows a previous successful production deployment as a rollback target, but not a preview deployment. See [Vercel rollback](https://vercel.com/docs/deployments/rollback-production-deployment) and [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).
- **API/worker:** redeploy the previous OCI image digest, pause new worker releases if a job schema is incompatible, and keep the previous image available until the release is proven. Render can reuse a previous build artifact for a rollback; ECS service revisions are immutable and can roll back to the last successful revision; Fly.io exposes releases and deploys Docker images/Machines. See [Render rollbacks](https://render.com/docs/rollbacks), [ECS service revisions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-revision.html), and [Fly releases](https://fly.io/docs/flyctl/releases/).
- **Database schema:** do not make “rollback code” imply “rollback database.” Use expand/contract migrations, forward fixes, and backups/PITR for data corruption or an unsafe migration. A destructive migration requires an explicit backup/restore plan and an approved maintenance procedure.
- **Jobs:** make every handler idempotent, include a job version, and decide what happens to in-flight work when the worker image changes. A failed migration or deploy should not silently discard a financial import.
- **Mobile:** an EAS Update can only safely target compatible native runtime versions. If native code or the runtime changes, ship a new build; do not use OTA as a generic rollback for incompatible binaries. EAS channels and environments must map to development, preview, and production API endpoints.

## Option comparison

The matrix evaluates the platform as the primary home for all relevant workloads. A hybrid deployment can use the strongest column for each workload; the recommendation does exactly that.

| Option | Low-ops web/docs | API and durable jobs | Previews and environments | Monorepo/affected builds | Portability and commitments | Assessment |
| --- | --- | --- | --- | --- | --- | --- |
| **Vercel-first** (web, docs, Next.js backend/functions) | Excellent for Next.js, branch previews, environment variables, and deployment rollback | Good for request/streaming work and bounded cron/after work; poor fit as the only durable worker/queue for financial imports | Excellent branch previews and Production/Preview/Development/custom environments | Strong: multiple projects can point at monorepo roots and Vercel can skip unaffected projects; Turborepo cache is optional | High commitment to Vercel’s project/build/runtime model if the backend uses Functions, `after()`, Vercel cron, or Vercel-only integrations | **Use for web/docs; do not make it the durable backend boundary.** |
| **Cloudflare-first** (Pages, Workers, Queues, Hyperdrive) | Excellent for static docs, edge delivery, branch controls, rollback, and global routing | Queues and retries are strong, but Workers is a web-interoperable runtime with a subset/polyfills of Node.js and explicit CPU/invocation limits | Strong Pages previews; Workers environments/secrets are managed through Wrangler/configuration | Good with separate projects and build commands; affected selection remains a CI concern | Highest commitment to Wrangler bindings, Workers compatibility dates, Hyperdrive, Queues, and Cloudflare runtime behavior | **Good conditional choice for an edge-oriented backend; not the default for a conventional Node/ORM worker.** |
| **AWS-native** (Amplify + ECS/Fargate or Lambda + RDS + SQS) | Strong, with Amplify monorepo roots, branch/PR previews, and static/SSR hosting | Strongest breadth for durable queues, worker services, private networking, backups, IAM, and progressive/rollback deployments | Strong but composed from multiple services, roles, environments, and quotas | Amplify supports generic, npm/Yarn/pnpm/Nx/Turborepo monorepos; affected decisions still belong in Actions | Highest operational and IAM/VPC/service commitment, although OCI, Postgres, SQS, and OIDC give a sound boundary | **Reserve for compliance, private-networking, scale, or organizational AWS requirements.** |
| **Fly.io-first** (Machines, process groups, Docker) | Good for containerized web/docs, but preview and promotion workflows are more explicitly built in GitHub Actions | Strong fit for separate API/worker/cron process groups and region control; database operations/backups remain your responsibility if self-hosted | Review apps and multi-environment deployments are available through Actions; secrets and tokens need deliberate management | Strong Docker/monorepo support; `fly deploy` can target paths/configs/build stages | Better runtime portability than Functions, but `fly.toml`, Machines, regions, secrets, networking, and release controls are Fly-specific | **Best fallback for the same backend image when Render’s model or geography is insufficient.** |
| **Render-first** (Blueprint + web/private service + worker + cron) | Good for static and Node services; not as Next.js-specialized as Vercel | Very good low-ops fit for API, worker, cron, env groups, zero-downtime deploys, and artifact rollback | Strong pull-request preview environments, including service/datastore copies; plan/cost and data seeding must be controlled | Strong root directory and build filters; separate services can avoid unrelated deploys | Dockerfile keeps runtime portable, while `render.yaml`, preview semantics, env groups, and API are Render-specific | **Recommended initial backend/worker target.** |

### Vercel

Vercel’s Git integration automatically creates a deployment for branch pushes and PRs, gives every preview a URL, deploys the production branch, and supports instant rollback. Its environment model separates Production, Preview, Development, and custom environments. Multiple Vercel projects can point at different monorepo roots; Vercel can skip projects it determines are unaffected when package names and dependency edges are explicit. These capabilities directly cover the web/PWA and docs requirements.

The important boundary is the backend. Vercel Functions have a maximum duration; `waitUntil`/Next.js `after()` keep work attached to a request lifecycle, and Vercel cron invokes a Function. Vercel’s own cron documentation says failed invocations are not retried. That is acceptable for telemetry, cache invalidation, or a bounded notification trigger, but not sufficient as the only execution system for a financial import or reconciliation job that must be retried, observed, and recovered.

Vercel’s [GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) is useful for the recommended control-plane design: `vercel build` can run in GitHub Actions and `vercel deploy --prebuilt` can upload the already-built output. That keeps build and provenance policy in GitHub even while Vercel provides the hosting and preview experience.

**Provider-specific commitment:** Vercel project IDs, deployment APIs/CLI, preview domains, build-output conventions, and any Vercel Function/cron/after usage. Keep those confined to `infra/vercel` or workflow files and keep the API runnable as a normal Node/OCI service.

### Cloudflare

Cloudflare Pages provides production and preview branch controls and instant rollback to a previous successful production deployment. Workers add environment variables/secrets through Wrangler and a queue consumer model with batching, retries, delays, and dead-letter queues. Workers observability supports logs, metrics, traces, and OTLP export. Hyperdrive can connect Workers to an existing PostgreSQL database and manages the underlying connection pool.

The cost is runtime coupling. Cloudflare describes Workers as web-interoperable with only a subset of Node.js APIs; unsupported APIs may be partial or non-functional shims. CPU, memory, request, cron, queue-consumer, and environment limits are explicit and plan-dependent. The backend would need to pass a Workers compatibility audit, avoid assumptions about a long-lived Node process, and make database/migration tooling work in a separate release environment. That may be a good design for an edge-first product, but it should be an intentional decision rather than an accidental consequence of hosting the frontend there.

**Provider-specific commitment:** Wrangler configuration, bindings (`Queues`, `Hyperdrive`, KV/R2/Durable Objects if added), compatibility dates/flags, Workers request model, and Cloudflare observability/export settings. Keep business logic in standard TypeScript packages and put binding access behind adapters.

### AWS

Amplify Hosting supports multiple monorepo applications, application roots, and Turborepo/pnpm configurations; it also supports branch and pull-request previews, including temporary backend environments in some Amplify full-stack configurations. For a complete backend, AWS offers a broad set of composable primitives: an OCI service on ECS/Fargate, SQS for at-least-once queue delivery and DLQs, RDS for PostgreSQL with snapshots and point-in-time recovery, and CloudWatch/ADOT/Container Insights for logs and metrics. ECS service revisions are immutable and can roll back to the last successful revision; ECS also documents explicit rollback of a service deployment.

AWS is the strongest option if the product needs private VPC networking, organization-wide IAM, compliance controls, high-volume worker orchestration, or a larger operational team. It is not the lowest-operations starting point: the team must own a coherent set of accounts, IAM roles, OIDC trust policies, networking, task definitions, secrets, alarms, database access, and cost controls. Amplify, ECS, RDS, SQS, and CloudWatch can each be portable at an interface level, but the assembled architecture is still deeply AWS-shaped.

**Provider-specific commitment:** Amplify app/branch configuration, IAM and OIDC roles, VPC/security groups, ECS task/service revisions, SQS queues/DLQs, RDS parameter/backup policy, CloudWatch alarms, and possibly CDK/Terraform state. Choose AWS deliberately when those capabilities justify the operational surface.

### Fly.io

Fly deploys Docker images to Machines and supports separate process groups, so the same image can run an HTTP API, a worker, and a scheduled/administrative process with different commands and scaling. It documents monorepo and multi-environment deployments by working directory, config file, Dockerfile, and multi-stage build target. It also provides GitHub Actions recipes, PR review apps, app secrets, releases, canary/smoke checks, and Prometheus-compatible custom metrics.

Fly is a strong portable-runtime choice because the deployable unit is an OCI image and process boundaries remain explicit. The tradeoff is that review apps, environment naming, secrets, network placement, and scaling policies are more directly managed through `fly.toml` and Actions. A production financial database should not be placed on an unmanaged volume merely because it is convenient; if an external managed PostgreSQL provider is used, the portability story remains good, but some low-ops advantage is lost.

**Provider-specific commitment:** Fly Apps/Machines, `fly.toml`, regions/Flycast, secrets, release commands, health checks, and Fly API credentials. Keep the image, process commands, health endpoints, and database outside those constructs.

### Render

Render is the closest match for the initial backend/worker requirement. A Blueprint can describe separate web, private, background-worker, cron, and static services. Root directories and build filters avoid redeploying unrelated monorepo services and also affect whether a PR preview is created. Preview environments can create disposable copies of services and datastores for a PR, keep them synchronized, and delete them when the PR closes; Render documents an explicit Pro-plan requirement and billing/expiry concerns. Environment groups centralize shared configuration, and rollbacks can reuse a previous build artifact rather than rebuilding it.

These features reduce the amount of custom platform code needed for the API and worker while leaving the runtime as a normal Node/Docker service. The main risks are plan/region availability, the cost of creating per-PR datastores, preview data seeding, and the provider-specific `render.yaml`/environment-group model. Render’s native cron and worker primitives are suitable for the first low-volume jobs, but a queue interface is still needed so a later SQS/Cloudflare Queue/other queue migration does not affect the domain layer.

**Provider-specific commitment:** Render Blueprint/service IDs, `render.yaml`, environment groups, preview-environment lifecycle, deploy hooks/API, and any Render-managed database choice. Do not make Render Postgres required by the application; use a standard PostgreSQL connection and backup contract.

## Portability boundary

The portable boundary should be an executable contract, not a promise that infrastructure configuration has no vendor details.

### Keep portable

- Source and release identity: Git SHA, lockfile, package graph, semantic version, release manifest.
- Build inputs: deterministic package-manager install, `turbo` task names, test commands, docs output directory, and a standard multi-stage Dockerfile.
- Runtime contract: `PORT`, `APP_ENV`, `DATABASE_URL`, `OTEL_*`, health endpoints (`/health/live`, `/health/ready`), graceful shutdown, structured stdout logs, and a non-root container.
- Data contract: PostgreSQL over a normal connection string, migrations in source control, forward-only `db:migrate`, backup/restore runbook, and no provider-specific SQL extensions in the domain model unless isolated behind an adapter.
- Asynchronous contract: typed job payloads, idempotency key, attempt number, lease/visibility timeout, retry policy, dead-letter state, and a `JobQueue` adapter.
- Observability contract: OpenTelemetry resource attributes, trace propagation, redaction rules, event names, SLOs, and OTLP endpoint configuration. OpenTelemetry’s [JavaScript documentation](https://opentelemetry.io/docs/languages/js/) supports Node.js/TypeScript instrumentation, while the provider becomes only an exporter destination.
- Delivery contract: build once, attest/store the artifact, deploy by digest or immutable deployment ID, run smoke checks, record the deployment, and expose a manual rollback/promotion command.
- Mobile contract: API contract version, runtime version, EAS channel names, app environment mapping, and store signing ownership. EAS workflow YAML may call provider actions, but business logic should not live in it.

### Allow to be provider-specific

| Concern | Vercel | Render | Fly.io | Cloudflare | AWS | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| Web/docs deploy | Project/root/deployment API | Static service/Blueprint | App/config | Pages project/Wrangler | Amplify app/branch | Consume a static or standard web build output |
| Backend deploy | Optional prebuilt Next.js output | Service/image | Machine/image/process group | Worker/binding | ECS task/service or Lambda | Keep API as a normal OCI/Node service unless Workers is a deliberate choice |
| Jobs | Function/cron only for bounded work | Worker/cron | Process group/release command | Queues/consumer | SQS + ECS/Lambda | Hide queue/scheduler behind `JobQueue` and `Scheduler` interfaces |
| Secrets | Project/environment variables | Environment groups | App secrets | Wrangler secrets/env files | IAM/Secrets Manager/parameter store | App reads validated env/config; workflow uses OIDC where possible |
| Observability | Vercel logs/metrics/traces | Service logs/metrics | logs/Prometheus | Workers logs/metrics/OTLP | CloudWatch/ADOT/X-Ray | Emit OTel and redact financial data before export |
| Rollback | Promote/rollback deployment | Reuse prior artifact | Redeploy prior release/image | Roll back production Pages deployment | ECS revision rollback | Database rollback is a separate backup/forward-fix process |

The application should not import a Vercel, Render, Fly, Cloudflare, or AWS SDK from `packages/domain`, `packages/contracts`, or shared UI packages. Provider SDKs belong in deployment adapters or an infrastructure package with a narrow interface.

## Environment and secret model

Use four logical environments, with a deliberate cost/data policy:

| Environment | Purpose | Data | Deploy authority | Secrets |
| --- | --- | --- | --- | --- |
| `development` | Local development and unit/integration tests | Local PostgreSQL or disposable test DB | Developer | `.env.example` documents names; real secrets from local secret tooling, never committed |
| `preview` | PR review | Disposable/sanitized data; no production export | PR workflow, limited permissions | Preview-only auth callbacks, API keys, and DB; fork code cannot read production secrets |
| `staging` | Release candidate, migration and smoke tests | Persistent sanitized seed or resettable test data | Merge-to-main workflow | Protected GitHub environment or provider secret group |
| `production` | Real users and financial data | Managed PostgreSQL with backup/PITR and restore drills | Protected/tagged workflow with reviewer approval | Production environment, OIDC/short-lived cloud access, least privilege |

Do not solve environment separation by changing only a frontend `NEXT_PUBLIC_*` value. The API base URL, authentication issuer/audience, redirect/callback allow-list, database, queue, object store, telemetry project, and mobile EAS channel must all agree. A release manifest should list the complete environment mapping.

For GitHub Actions, use environment protections and concurrency groups. For Vercel and Render, keep preview variables distinct from production variables. For Cloudflare, use named Wrangler environments and per-environment `.dev.vars`/secrets. For AWS, use separate roles/accounts or tightly scoped environments. For Fly, use separate Apps/configs and do not reuse a production token for PR review apps.

## Database migrations and backups

The migration sequence should be:

1. Generate and review a migration in development; commit it with the code that needs it.
2. Run SQL/static safety checks in CI and apply it to a disposable or staging database.
3. Apply migrations once in the protected production release job, with an advisory/lock mechanism or an equivalent single-flight guarantee.
4. Deploy code that is compatible with both the pre-migration and post-migration shape when zero-downtime rollout is required.
5. Remove old columns/indexes in a later release after all readers/writers have moved.

Prisma is only an example of the operational shape: its official guidance uses `migrate deploy` in CI/CD, warns against running production migration commands from a local workstation, and distinguishes production deployment from development reset/push commands. Drizzle provides a similar SQL migration CLI. The final ORM decision belongs to the architecture work in issue 1; this deployment decision requires only a stable migration command and a committed migration history.

Rollback of an application image must not automatically attempt a down migration. A down migration can destroy data needed by the previous or current application. For data corruption, restore a copy/point-in-time backup into a controlled instance, validate it, and execute a documented cutover. Confirm that the selected managed PostgreSQL service provides the required backup retention, point-in-time recovery, export path, region, encryption, and restore testability before production launch.

## Background jobs

The job design should satisfy these invariants independent of queue vendor:

- The API transaction writes an outbox/job record with an idempotency key; a worker claims it with a lease.
- Handlers are safe to retry and can detect duplicate imports or notifications.
- Every attempt records start/end/status, error class, retry count, and release version.
- Failures move to a bounded retry schedule and then a dead-letter state that an operator can inspect/replay.
- User-visible progress is stored in the database, not inferred from a transient request.
- Scheduled work is a trigger that enqueues a job; it is not the work itself.

For initial low volume, a PostgreSQL outbox plus one Render worker is a reasonable low-operations starting point. If job volume or latency requires a dedicated queue, use the same interface with AWS SQS (at-least-once delivery and DLQs) or Cloudflare Queues (batching, retries, delays, and DLQs). Do not select a queue solely because it is next to the frontend host; select it based on delivery semantics, visibility timeout, retry/DLQ operations, region, cost, and exportability.

## Observability and privacy

The minimum signal set should include:

- request/trace correlation from web/mobile through API, database, and worker;
- API latency/error rate, authentication failures, import throughput, queue depth/age, worker heartbeats, migration duration, and backup/restore status;
- structured audit events for authentication, authorization, data export, import start/finish, and financial-record mutations;
- release SHA, deployment ID, service, environment, and job version on every server-side event;
- redaction of balances, transaction descriptions, account numbers, tokens, email addresses where not required, and raw provider responses.

Vercel, Cloudflare, AWS, and Fly each provide native logs/metrics/traces at different layers. Use them for platform troubleshooting, but emit application telemetry through OpenTelemetry/OTLP so moving the API from Render to Fly or AWS does not require rewriting business instrumentation. A final observability vendor, retention period, alert ownership, and data-processing agreement remain unresolved.

## Tradeoffs of the recommendation

### Benefits

- Best fit for the first user-facing surface: Vercel handles Next.js previews, environment variables, monorepo roots, and rollback with little custom code.
- Durable work is not forced into a serverless request lifecycle; the API and worker share a normal container boundary and can move to Fly or ECS.
- GitHub Actions keeps the quality gates, migration policy, environment approvals, provenance, and promotion semantics in one place.
- PostgreSQL, queue contracts, OpenTelemetry, and EAS channel/runtime boundaries reduce accidental coupling to the initial host.
- Docs can deploy independently and can move to a static host without changing the application or backend.

### Costs and risks

- Two application hosts (Vercel and Render) create more accounts, domains, environment variables, deploy statuses, and incident surfaces than a single-vendor stack.
- Previewing an end-to-end API/database for every PR may be expensive; a shared sanitized staging API is cheaper but less isolated.
- Render preview environments require an eligible plan and need a seed/data policy. Vercel and EAS also have plan/usage constraints that must be verified.
- A PostgreSQL outbox is simple but is not a substitute for a high-volume queue with mature visibility/DLQ controls; the adapter must be designed early.
- GitHub Actions becomes critical infrastructure. Protect workflow changes, pin actions, minimize token permissions, use environments, and provide a manual deploy/rollback path.
- Provider-native observability and deployment UX are less uniform across Vercel/Render/EAS. OpenTelemetry helps with signals but does not remove the need to learn each provider’s logs and incident controls.

## Unresolved follow-ups

The research resolves the deployment direction but not the following implementation choices:

1. Confirm the GitHub plan and repository policies needed for private-repository environment secrets, required reviewers, OIDC, artifact retention, and attestations.
2. Confirm Vercel and Render plans, regions, quotas, preview costs, data-processing terms, custom-domain/TLS behavior, and whether a second provider is acceptable for the project.
3. Select the managed PostgreSQL provider and region. Record RPO/RTO, backup retention, PITR, encryption, connection pooling, network allow-listing, export procedure, and a recurring restore drill.
4. Choose the monorepo package manager and orchestrator (Turborepo is the leading fit in this research, but issue 1 still leaves it open), Node/Expo versions, and the exact affected graph rules.
5. Select the API framework, ORM, migration tool, and migration safety checks. Define expand/contract conventions and the production migration lock/single-flight behavior.
6. Decide whether the first queue is a PostgreSQL outbox or a managed queue. Document job SLAs, maximum retry duration, deduplication, replay permissions, and dead-letter ownership.
7. Decide the observability backend, alert routes, retention, sampling, PII redaction tests, audit-log retention, and whether a separate security/audit product is needed.
8. Define preview data and auth policy: database seeding, OAuth callback domains, email delivery suppression, rate limits, and whether the API preview is per PR or shared staging.
9. Create the mobile release policy: Expo account ownership, Apple/Google organization ownership, signing credential custody, EAS environments/channels, runtime-version policy, OTA eligibility, and store release approvals.
10. Write and rehearse the production runbooks for migration failure, web rollback, API/image rollback, worker/job recovery, database restore, secret rotation, and provider outage.

These are follow-ups for implementation and the broader architecture map, not blockers to closing the research issue.

## Sources checked

Only first-party documentation was used:

- GitHub: [deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments), [OIDC with cloud providers](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers), [OIDC and reusable workflows](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows), [concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency), [deployment history](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/view-deployment-history), [workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts), and [artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations).
- Vercel: [Git deployments](https://vercel.com/docs/git), [monorepos](https://vercel.com/docs/monorepos), [environment variables](https://vercel.com/docs/environment-variables), [observability](https://vercel.com/docs/observability), [function runtimes](https://vercel.com/docs/functions/runtimes), [cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [rollback](https://vercel.com/docs/deployments/rollback-production-deployment), and [GitHub Actions/prebuilt deployments](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel).
- Cloudflare: [Pages branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/), [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/), [Workers environment variables/secrets](https://developers.cloudflare.com/workers/configuration/environment-variables/), [Workers runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/), [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [limits](https://developers.cloudflare.com/workers/platform/limits/), [Queues batching/retries/delays](https://developers.cloudflare.com/queues/configuration/batching-retries/), [PostgreSQL via Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/), and [Workers observability](https://developers.cloudflare.com/workers/observability/).
- AWS: [Amplify monorepo configuration](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html), [Amplify PR previews](https://docs.aws.amazon.com/amplify/latest/userguide/pr-previews.html), [Amplify environment variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html), [ECS blue/green](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-bluegreen.html), [ECS service revisions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-revision.html), [ECS rollback](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/stop-service-deployment.html), [SQS at-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html), [SQS dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html), [RDS for PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html), [RDS point-in-time recovery](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html), and [CloudWatch Container Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html).
- Fly.io: [continuous deployment with GitHub Actions](https://fly.io/docs/launch/continuous-deployment-with-github-actions/), [PR review apps](https://fly.io/docs/blueprints/review-apps-guide/), [monorepo/multi-environment deployments](https://fly.io/docs/launch/monorepo/), [process groups](https://fly.io/docs/launch/processes/), [app configuration](https://fly.io/docs/reference/configuration/), [secrets](https://fly.io/docs/apps/secrets/), [deployment](https://fly.io/docs/launch/deploy/), and [releases](https://fly.io/docs/flyctl/releases/).
- Render: [monorepo support](https://render.com/docs/monorepo-support), [preview environments](https://render.com/docs/preview-environments), [environment variables](https://render.com/docs/configure-environment-variables), [cron jobs](https://render.com/docs/cronjobs), [deploys](https://render.com/docs/deploys), and [rollbacks](https://render.com/docs/rollbacks).
- Turborepo: [constructing CI](https://turborepo.dev/docs/crafting-your-repository/constructing-ci), [`--affected`](https://turborepo.dev/docs/reference/run), [running tasks and filters](https://turborepo.dev/docs/crafting-your-repository/running-tasks), and [remote caching](https://turborepo.dev/docs/core-concepts/remote-caching).
- Expo: [EAS Workflows](https://docs.expo.dev/eas/workflows/introduction/), [getting started](https://docs.expo.dev/eas/workflows/get-started/), [automating EAS CLI](https://docs.expo.dev/eas/workflows/automating-eas-cli/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/usage/), and [EAS Update](https://docs.expo.dev/build/updates/).
- Data/observability: [Prisma production migrations](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate), [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [PostgreSQL backup and restore](https://www.postgresql.org/docs/current/backup.html), [OpenTelemetry overview](https://opentelemetry.io/docs/what-is-opentelemetry/), [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/), and [OTLP exporter specification](https://opentelemetry.io/docs/specs/otel/protocol/exporter/).
