# Server, API, and data boundary

Issue #25 proves the first complete non-financial request path without defining
finance-domain resources.

## Observable paths

- `GET /api/v1/system/health` returns a versioned system-health response.
- `GET /api/v1/openapi.json` returns the OpenAPI 3.1 description for the
  versioned system surface.
- `GET /system-health` is a Server Component proof route. It calls the shared
  application service directly and does not call the Route Handler over HTTP.

Invalid query values use `application/problem+json` with the stable problem
type `https://wayfinder.dev/problems/invalid-request`. Unsupported methods use
the same shape with an `Allow: GET` header.

## Package ownership

```text
apps/web
  -> @personal-finance/application
       -> @personal-finance/data-access (server-only)
  -> @personal-finance/contracts (Route Handler validation)

browser / future Expo
  -> @personal-finance/generated-api
       -> versioned HTTP contract only
```

The generated client is produced from `packages/contracts/openapi.json` with
`pnpm --filter @personal-finance/generated-api generate`; its test task checks
that the committed output is reproducible. It intentionally has no dependency
on the application or data-access package. Drizzle and the PostgreSQL driver
are confined to `@personal-finance/data-access`, which imports the `server-only`
marker. The application service validates its result against the shared runtime
contract before the Route Handler serializes it.

## Provider-free data check

The data package uses Drizzle's PostgreSQL adapter for the health query and
committed migration runner. Readiness checks both the non-financial marker
table and Drizzle's migration-history table. Local verification does not require PostgreSQL:
the default path uses a provider-doubled PostgreSQL connection with the same
Drizzle execution seam. A real `DATABASE_URL` selects a PostgreSQL pool for
runtime use. The only committed migration creates the non-financial
`wayfinder_system_health` readiness table; no Financial Account, Resource,
Workspace, or finance endpoint exists in this boundary.
