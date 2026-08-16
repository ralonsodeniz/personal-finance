# Wayfinder recommendation audit

**Status:** complete recommendation audit; implementation follow-up remains
**Date:** 2026-08-16
**Canonical map:** [Personal Finance Platform: Stack and Initial Architecture](https://github.com/ralonsodeniz/personal-finance/issues/1)

## Purpose

The research tickets were closed after their top-level recommendations were
recorded. This audit records the final review status and the implementation
follow-up that remains. The completed review ledger is
[recommendation-review.md](recommendation-review.md); implementation proceeds
through separate implementation issues.

## Status vocabulary

- **Accepted** — the architecture recommendation is part of the current route.
- **Accepted; implementation follow-up** — the boundary is decided, but code,
  configuration, or operational detail remains for the implementation phase.
- **Parked** — intentionally postponed until a later product or platform phase.
- **Domain-dependent** — cannot be finalized until the finance-domain session
  defines the relevant resources and behavior.
- **Pending decision** — still requires an explicit architecture or product
  decision before implementation can safely proceed.
- **Out of scope** — no longer belongs on this Wayfinder route.

## Ticket audit

| Ticket | Recommendation status | What remains |
| --- | --- | --- |
| [PWA Installability and Online-First Runtime Strategy](https://github.com/ralonsodeniz/personal-finance/issues/2) | Accepted; implementation follow-up | The Serwist compatibility spike passed for the production build path. Validate deployed previews, service-worker update UX, and the browser matrix. Durable offline writes, sync, and push are parked. |
| [Testing Strategy for Web, Backend, PWA, and React Native](https://github.com/ralonsodeniz/personal-finance/issues/3) | Accepted; implementation follow-up | Choose the PostgreSQL integration harness and auth/data fixtures. Keep Maestro as the native E2E candidate and run the Detox comparison only when native work begins. |
| [PostgreSQL ORM and Data-Access Strategy](https://github.com/ralonsodeniz/personal-finance/issues/4) | Accepted; implementation follow-up | Define the initial schema, migration conventions, seed/reset strategy, and transaction test helpers after the domain session. |
| [Static Documentation Platform and Information Architecture](https://github.com/ralonsodeniz/personal-finance/issues/5) | Accepted; implementation follow-up | Docusaurus Classic with developer/help spaces is the default. Search hosting, accessibility validation, deployment details, and versioning policy remain implementation choices. |
| [TypeScript Quality Toolchain for Next.js and Expo](https://github.com/ralonsodeniz/personal-finance/issues/6) | Accepted; implementation follow-up | Pin versions and compose shared, Next.js, and Expo configs. Decide typed-lint scope, generated-code policy, and accessibility checks during bootstrap. |
| [Monorepo Orchestration and Package Layout](https://github.com/ralonsodeniz/personal-finance/issues/7) | Accepted; implementation follow-up | Bootstrap pnpm workspaces plus Turborepo, define package exports/scripts, and encode the affected graph in CI. The future mobile app remains documented but unbuilt. |
| [Cross-Platform Design System and Component Strategy](https://github.com/ralonsodeniz/personal-finance/issues/8) | Accepted for web; native parked | Use shadcn/ui and shared vendor-neutral tokens for web. Revisit React Native Reusables, native styling, token adapters, and the accessibility/parity matrix when mobile begins. |
| [Authentication Provider and Session Strategy for Web and Mobile](https://github.com/ralonsodeniz/personal-finance/issues/9) | Accepted; native and production implementation parked | Auth0, server-managed web sessions, and native PKCE are the boundary. Tenant/plan, callback allowlists, MFA/passkeys, and native deep-link/token-rotation validation belong to implementation. |
| [Authorization Model for Users, Households, Roles, and Scoped Sharing](https://github.com/ralonsodeniz/personal-finance/issues/10) | Accepted; domain-dependent | The policy, roles, grants, revocation, step-up actions, and API authority are decided. Exact resource hierarchy and field visibility depend on the finance-domain session; concrete RLS policies follow the data model. |
| [Deployment and CI/CD Strategy for Web, Backend, Docs, and Mobile](https://github.com/ralonsodeniz/personal-finance/issues/11) | Accepted with free-tier refinement; implementation follow-up | GitHub Actions, Vercel, three environments, Supabase Free preview, and the later worker boundary are decided. Provider quotas, production recovery, secrets/OIDC, preview auth/data, EAS signing, and rollback runbooks remain. |
| [API Contract Strategy: tRPC, REST, OpenAPI, or GraphQL](https://github.com/ralonsodeniz/personal-finance/issues/12) | Accepted; domain-dependent | REST/HTTP with versioned OpenAPI and generated clients is the durable boundary; RSC reads call services directly. Choose the generator/runtime validator, compatibility window, cache/redaction policy, and exact `/v1` resources after the finance-domain session. |
| [Observability, Security, Backups, and Data Export Baseline](https://github.com/ralonsodeniz/personal-finance/issues/13) | Accepted baseline; implementation follow-up | OpenTelemetry, ASVS Level 2, redaction, audit separation, encrypted backups, restore drills, versioned exports, and Sentry as the initial operational provider are accepted. Data inventory, threat model, jurisdiction, RPO/RTO, retention, and export schema remain. |
| [Backend and Database Architecture for Shared Web and Mobile](https://github.com/ralonsodeniz/personal-finance/issues/14) | Accepted with free-tier refinement; implementation follow-up | Modular monolith, PostgreSQL, Supabase Free for non-production, Drizzle, application authorization, RLS defense in depth, and the bounded queue path are decided. Production plan/region/recovery, exact RLS projections, and queue implementation remain. |
| [Authentication Provider Spike: Auth0, Clerk, and WorkOS](https://github.com/ralonsodeniz/personal-finance/issues/15) | Accepted; native validation parked | Auth0 is selected. The spike evidence is carried forward through the implementation handoff; no further provider comparison is required. |
| [Provision isolated Auth0, Clerk, and WorkOS spike environments](https://github.com/ralonsodeniz/personal-finance/issues/16) | Out of scope | Closed as superseded: the comparison selected Auth0, so parallel Clerk/WorkOS provisioning is no longer needed. |
| [Finance Domain Vocabulary and CSV Import Semantics](https://github.com/ralonsodeniz/personal-finance/issues/17) | Out of scope for this map | Closed because finance functionality, APIs, schemas, CSV behavior, and domain-specific authorization belong to a future Wayfinder session. |
| [Observability Platform for Operational Events and Errors](https://github.com/ralonsodeniz/personal-finance/issues/18) | Accepted; implementation follow-up | Use Sentry initially for frontend/backend errors, crashes, performance, and diagnostic context; keep OpenTelemetry as the portability boundary. Grafana Cloud remains the deeper OTel-first alternative; Datadog is a later enterprise option. |
| [Product Analytics and Usage Events Platform](https://github.com/ralonsodeniz/personal-finance/issues/19) | Accepted; implementation follow-up | Use PostHog for sanitized product usage analytics in an EU Frankfurt project, behind a provider-neutral adapter, with replay disabled initially. Umami remains the self-hosted/permanent-free alternative. |

## Audit conclusion

All 16 in-scope recommendations have now been reviewed in dependency-aware
order. Their accepted decisions, qualifications, parked work, and remaining
implementation follow-up are recorded above; the Wayfinder decision review is
complete and implementation may proceed through its dedicated issues.

The review covers the 16 in-scope research recommendations in
[recommendation-review.md](recommendation-review.md). Issue 16 (parallel auth
provider provisioning) and issue 17 (finance-domain and CSV semantics) remain
out of scope for this map. The latter belongs to a future Wayfinder session
with its own destination.

## Sources

- [Architecture map](https://github.com/ralonsodeniz/personal-finance/issues/1)
- [Wayfinder research notes](.)
