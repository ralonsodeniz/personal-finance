# Delivery boundary

Issue #28 owns the executable delivery seam for the web/PWA, documentation,
API, session, and telemetry foundations. It does not provision a provider,
create finance-domain behavior, or make production credentials available to a
preview.

## Reproducible preview path

From a clean checkout, the delivery path is:

```text
pnpm install --frozen-lockfile
pnpm run preview:build:web
pnpm run preview:build:docs
pnpm run preview:smoke
```

The web and docs workspaces are independent Vercel projects with these project
roots and commands:

| Project       | Root        | Install command                  | Build command            | Output                 |
| ------------- | ----------- | -------------------------------- | ------------------------ | ---------------------- |
| web/PWA + API | `apps/web`  | `pnpm install --frozen-lockfile` | `pnpm run build:preview` | Next.js `.next` output |
| documentation | `apps/docs` | `pnpm install --frozen-lockfile` | `pnpm run build:preview` | `build/`               |

The committed `vercel.json` files keep the project commands reproducible. The
preview build script supplies only a provider-double session, provider-doubled
system-health data, and disabled product analytics. It sanitizes inherited
process variables before starting a child build and never reads generic or
production-scoped credentials while `APP_ENV=preview`. The local smoke path is
the credential-free preview-like proof; a hosted Vercel URL smoke and
deployment record remain a follow-up after Vercel project provisioning.

## Environment boundaries

`APP_ENV` is the application boundary; `NODE_ENV=production` alone is not
enough because Vercel also uses it while building a preview. `VERCEL_ENV` must
agree with `APP_ENV` when it is `preview` or `production`.

| Environment | Data                                                          | Identity                                  | Telemetry                      | Credential namespace             |
| ----------- | ------------------------------------------------------------- | ----------------------------------------- | ------------------------------ | -------------------------------- |
| development | provider double or disposable local PostgreSQL                | provider double by default                | disabled or local doubles      | generic local names are accepted |
| preview     | provider double or explicitly approved sanitized preview data | provider double until explicitly approved | disabled by default            | `WAYFINDER_PREVIEW_*` only       |
| production  | protected managed PostgreSQL                                  | Auth0 or another approved provider        | configured, redacted providers | `WAYFINDER_PRODUCTION_*` only    |

Preview runtime configuration removes generic `AUTH0_*` and `DATABASE_URL`
values instead of falling back to them. Production-scoped values are never
selected by the preview resolver. The environment validator rejects generic
preview credentials, production-data markers, and unapproved Auth0/PostgreSQL
preview modes. Preview PostHog telemetry remains disabled unless both the
preview telemetry mode and an explicit approval flag enable it. A preview job
has read-only repository permissions and does not reference production
secrets.

Provider integrations remain configuration-gated. The provider double is
available only in development or in a preview that explicitly selects the
preview provider-double namespace; it is rejected in production. The current
preview path does not require Auth0, Supabase, Sentry, or PostHog credentials.

## Free-tier-first asynchronous work

The first bounded asynchronous path is represented by the provider-neutral
`JobQueue` and `Scheduler` interfaces in `@personal-finance/jobs`. The initial
policy is Supabase Queues (`pgmq`) with Supabase Cron triggering short Edge
Function batches. There is no always-on worker in the free-tier phase.

The queue contract carries an idempotency key, attempt/retry state, lease
visibility, dead-letter-capable failures, and the release version. If a job
outgrows the bounded consumer, needs continuous consumption, or exceeds the
free-tier queue's operational limits, only the `JobQueueAdapter` changes. A
paid Render background worker, Cloudflare Queues, Amazon SQS, or another
durable queue can implement the same contract without moving queue semantics
into web routes or finance-domain packages.

Production promotion, database migrations, provider provisioning, rollback
runbooks, and real financial data remain protected follow-up work. This gate
proves the preview-like delivery path without pretending that a provider-free
build is a production deployment.
