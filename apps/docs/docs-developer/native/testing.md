---
id: testing
title: Native testing candidates
sidebar_label: Testing candidates
---

Native testing is a planned workstream. The candidates below describe the
seams to evaluate when `apps/mobile` exists; they are not dependencies of the
current documentation build.

## Candidate layers

| Layer                 | Candidate                                              | What it should prove                                                                                                                        |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared logic          | Vitest for platform-neutral packages                   | Contract decoding, redaction, authorization interfaces, and other pure logic can be tested once.                                            |
| Native unit/component | Jest with `jest-expo` and React Native Testing Library | Native hooks, screens, loading/error states, accessibility labels, and secure-storage adapters with provider doubles.                       |
| Contract/integration  | HTTP contract tests against a disposable or mocked API | Generated client compatibility, auth headers, Problem Details errors, retries, and version policy without live credentials.                 |
| Device-flow E2E       | Maestro                                                | A pragmatic candidate for authentication redirects, deep links, credential renewal, sign-out, and critical user journeys on built binaries. |
| Device-flow E2E       | Detox                                                  | A candidate when the app needs tighter synchronization and deeper native integration than a black-box flow runner provides.                 |
| Build/release smoke   | Expo development builds and EAS preview artifacts      | Native module configuration, redirect registration, runtime compatibility, and release/OTA boundaries.                                      |

Playwright remains the web/PWA E2E tool. It should not be presented as a
substitute for testing native secure storage, system-browser callbacks, OS
back behavior, safe areas, or platform accessibility trees.

## Authentication cases to cover

The first native spike should exercise successful and cancelled PKCE redirects,
an invalid or mismatched state, expired access-token renewal, refresh-credential
reuse detection, sign-out, revoked application access, and a blocked API request.
All provider interactions should use doubles or dedicated non-production test
configuration; no real credentials belong in fixtures or CI logs.

## Deferred status

No native test runner, simulator project, Maestro flow, Detox setup, EAS
workflow, or native implementation is included yet. The candidate list exists
so the future workspace can choose a test pyramid deliberately rather than
inheriting the web test stack by accident.
