# Auth0 implementation handoff (deferred)

**Wayfinder status:** decision accepted; production implementation intentionally deferred.
**Decision date:** 2026-08-15
**Provider:** Auth0

This note records what should carry forward from the isolated authentication
comparison without merging the prototype into the product. It is an
implementation reference for a later phase, not an implementation plan that
authorizes code changes now.

## Accepted boundary

- Auth0 is the managed identity provider for the Next.js web/PWA and the future
  Expo application.
- The web app will use a server-managed encrypted, `HttpOnly` session cookie.
  Long-lived refresh tokens must not be exposed to browser JavaScript or stored
  in browser storage.
- The future native app will use Authorization Code + PKCE, rotating refresh
  tokens with reuse detection, and platform secure storage. Native validation is
  parked until mobile work begins.
- The API will accept only access tokens minted for the application's API. It
  will validate issuer, audience, signature, expiry, and required scopes/claims;
  ID tokens are not API credentials.
- The application will map the verified Auth0 identity `(iss, sub)` to its own
  internal `User` and `Identity` records. Email is profile data, not the
  authorization key.
- Households/workspaces, memberships, roles, resource grants, invitation
  consumption, expiry, revocation, and audit state remain application-owned.
  Auth0 Organizations or roles do not replace this domain policy.

The full rationale and source links remain in
[`authentication.md`](authentication.md). The comparison evidence and
trade-offs remain in
[`authentication-comparison.md`](authentication-comparison.md).

## Useful material to carry forward

The isolated spike produced behavior and boundary evidence that should inform
the later implementation:

1. **Web session boundary:** server-side login/callback/logout flow, encrypted
   cookie session, and a clear separation between the web-session endpoint and
   bearer-only API validation.
2. **API validation contract:** RS256/JWKS validation with explicit `iss`, `aud`,
   `exp`, and scope checks; reject ID tokens, cookies, missing tokens, wrong
   issuers, and wrong audiences.
3. **Identity mapping:** derive the actor from the verified `(iss, sub)` pair and
   resolve the internal user before authorization. Never accept a client-owned
   `userId` as identity proof.
4. **Sharing behavior:** one-time invitation tokens are opaque and stored
   hashed; consuming one creates an authenticated, scoped, view-only grant with
   expiry and immediate application-side revocation. The URL never carries
   financial data.
5. **Provider-neutral mobile contract:** the PKCE/deep-link rules, state and
   redirect validation, secure-storage requirement, refresh failure behavior,
   and bearer-header contract are reusable as future tests/specification. They
   are not native acceptance evidence yet.
6. **Negative-path acceptance tests:** cross-user isolation, expired/revoked
   grants, wrong resource scope, invalid token claims, and unauthenticated API
   requests should become shared policy/API tests in the implementation phase.

## What must not be carried forward as production code

- The isolated Next.js comparison application, provider switch, demo routes, and
  prototype UI are throwaway evidence.
- The Expo/Auth0 harness is a parked experiment, not a supported mobile app and
  not evidence that native authentication has passed.
- Provider-specific code should be reimplemented behind the final monorepo
  boundaries after the architecture map is complete; do not copy the spike
  wholesale into an application.
- Local `.env`/`.env.local` files, provider credentials, tokens, screenshots,
  and generated build output must never enter the repository.
- Do not weaken pnpm's trust policy or add a package exception merely to resume
  the parked native experiment. The `semver@6.3.1` review is a dependency
  investigation, not an architecture decision.

## Future implementation seams

These are boundaries to preserve when implementation starts, not packages to
create during Wayfinder:

| Concern | Later implementation responsibility |
| --- | --- |
| Identity contract | Shared types for verified provider identity, internal user mapping, and session context |
| Auth0 adapter | Web SDK session operations, Management API lifecycle operations, and JWKS/token helpers behind a provider-specific boundary |
| API auth | Server-side bearer validation and conversion to an application actor before domain authorization |
| Authorization | Domain policy for household/workspace membership, roles, resource grants, expiry, revocation, and audit events |
| API contract | Versioned OpenAPI access-token boundary shared by web and future mobile clients |
| Native client | Separate Expo adapter for PKCE, deep links, secure storage, refresh, logout, and API calls |

The eventual package and application names remain subject to the monorepo
architecture decision. This handoff intentionally does not create them.

## Parked follow-ups

- Confirm the Auth0 development/production tenant arrangement, plan, region/data
  processing, callback allowlists, secret management, and Apple configuration.
- Coordinate the API audience, JWKS cache/rotation, API deployment boundary, and
  session-to-API token flow with the backend/API decisions.
- Resolve the application authorization semantics in issue #10 before modeling
  memberships, selected investment-area grants, and advisor access.
- Coordinate deletion, export, audit, and incident behavior with issue #13.
- Reopen one focused Auth0 Expo development-build spike when mobile work begins.

No production authentication implementation is part of this handoff.
