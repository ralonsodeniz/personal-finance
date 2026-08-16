---
id: mobile
title: Future Expo/mobile workspace
sidebar_label: Expo/mobile boundary
---

`apps/mobile` is a planned Expo/React Native application, not a current
workspace. Native dependencies, Metro configuration, EAS configuration,
development builds, and native credentials are intentionally deferred.

## Intended dependency direction

```text
apps/mobile
  ├─ packages/design-tokens
  ├─ packages/auth          (native adapter at the app boundary)
  ├─ packages/contracts
  ├─ packages/generated-api
  └─ packages/telemetry     (redacted native adapter)
```

The native app may consume platform-neutral contracts, generated client types,
semantic design tokens, and interfaces. It must not depend on `apps/web`,
`apps/docs`, or the server-only `packages/data-access` boundary. Native UI
components should be platform-owned even when they implement the same semantic
tokens as the web system.

`packages/authorization` remains an application-owned policy boundary. A
future API/server implementation must enforce authorization against current
application data; a mobile bundle or provider token must not be treated as the
authority for a User's Workspace or Resource access.

## Release and offline expectations

The native client should be treated as independently released even though it
lives in this monorepo. API compatibility, client version reporting, retries,
and an explicit support window need decisions before the first mobile release.
An over-the-air JavaScript update cannot replace a new binary when native code
or a native dependency changes.

Durable offline writes, synchronization, push notifications, and conflict
resolution are also future design work. The first native implementation should
prove authenticated online reads and safe mutation boundaries before promising
offline financial behavior.

## Native implementation status

There is no Expo project, native screen, native token adapter, deep-link
configuration, or EAS credential in this repository yet. This guide is a
boundary contract for the later implementation ticket, not a request to
scaffold native code in the documentation work.
