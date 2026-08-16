---
id: workspace
title: Workspace architecture
sidebar_label: Workspace boundaries
---

The repository is a pnpm workspace orchestrated by Turborepo. The current
applications and packages are boundaries for ownership; they are not a claim
that each product capability has been implemented.

## Applications

| Boundary      | Responsibility now               | Boundary to preserve                                                            |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `apps/web`    | Next.js App Router web/PWA shell | Web UI and browser-only behavior must not become a dependency of native code.   |
| `apps/docs`   | This static Docusaurus site      | Documentation builds without application runtime state or provider credentials. |
| `apps/mobile` | Future Expo/React Native app     | This directory does not exist yet; native implementation is deferred.           |

## Shared packages

| Package boundary         | Intended use                                                  | Important limit                                                                   |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/design-tokens` | Platform-neutral visual vocabulary and semantic roles         | UI components and platform styling remain owned by each app.                      |
| `packages/auth`          | Provider-neutral identity and session interfaces              | Platform-specific web-cookie and native-credential adapters remain in their apps. |
| `packages/authorization` | Application-owned authorization policy seam                   | Provider claims are not the source of truth for access decisions.                 |
| `packages/contracts`     | Versioned wire-contract location                              | No finance-domain resources are defined in the bootstrap.                         |
| `packages/generated-api` | Future generated client/types for browser and native callers  | It must not import server or persistence implementation types.                    |
| `packages/data-access`   | Server-only persistence boundary                              | Native and browser bundles must never receive database credentials or code.       |
| `packages/telemetry`     | Provider-neutral, redacted operational and analytics adapters | Security/audit records remain application-owned and separate from SaaS telemetry. |
| `packages/config-*`      | Shared tool configuration                                     | Configuration sharing must not turn into application-runtime coupling.            |

The durable client seam is the versioned API contract. Server-rendered web
paths may call shared server-side application services directly; browser client
code and the future Expo app use generated clients. Neither client should
depend on `data-access` or database models.

## Current quality boundary

The root `pnpm run verify` command validates environment safety, builds the
static documentation, and runs the repository quality checks. It is designed to
work with the committed `.env.example` and no real Auth0, database, telemetry,
analytics, or financial-data credentials.
