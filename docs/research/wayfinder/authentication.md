# Authentication provider and session strategy for web and mobile

**Wayfinder issue:** [#9 — Authentication Provider and Session Strategy for Web and Mobile](https://github.com/ralonsodeniz/personal-finance/issues/9)  
**Date checked:** 2026-08-15  
**Scope:** managed authentication only; no custom password, OAuth, session, or MFA implementation

## Question

Which managed authentication solution and session model should serve the Next.js web/PWA now and a future React Native/Expo app? The decision must cover email authentication, Google and Apple sign-in, account recovery, refresh and revocation, web and mobile token handling, deep links, MFA/passkeys, account deletion, identity portability, authorization integration, cost, and vendor lock-in.

## Assumptions

- The first client is a mobile-first Next.js web app that may be installed as a PWA. A PWA is still a browser client; it does not get native-app token storage merely because it is installable.
- A future Expo app will call the same backend/data system as the web app. The backend and database are still being decided in [issue #14](https://github.com/ralonsodeniz/personal-finance/issues/14).
- The product stores sensitive financial data. A stolen refresh token, an authorization mistake, or an identity merge by email is more serious than a small amount of login friction.
- Authentication identity must remain distinct from a Financial Account. Household/workspace membership, roles, and resource-level sharing belong to the application authorization model in [issue #10](https://github.com/ralonsodeniz/personal-finance/issues/10), not to a provider's user metadata.
- The initial user population is expected to be small, but the design should not make a later provider or backend migration needlessly difficult.
- Google and Apple are planned social sign-in methods. Password recovery for an account whose credential is owned by Google or Apple remains a recovery operation at that identity provider; a local password-reset flow applies only to the provider's own database connection.

## Decision

Use **Auth0** as the initial managed identity provider, with a standards-based split between the web client, native client, and API:

1. Create a Regular Web Application for Next.js and use the current Auth0 Next.js SDK. Keep the web login as an authorization-code flow handled by the server-side SDK and represent the application session with a secure, encrypted cookie. Do not put long-lived Auth0 refresh tokens in `localStorage` or expose them to ordinary browser JavaScript. Auth0's current Next.js quickstart uses an `AUTH0_SECRET` to encrypt the session cookie and exposes server-side `getSession()` access; the SDK also has a custom session-store option if the cookie grows too large ([Next.js quickstart](https://auth0.com/docs/quickstart/webapp/nextjs), [cookie/session-store guidance](https://support.auth0.com/center/s/article/Next-js-SDK-cookie-size-is-too-high)).
2. Create a separate Native Application for Expo. Use Authorization Code + PKCE through the system browser or a secure browser tab, with a claimed HTTPS app link where practical and a reverse-domain custom scheme as the fallback. Auth0 has a first-party Expo quickstart that configures the native plugin, bundle/package identifiers, callback URLs, and logout URLs ([Auth0 Expo quickstart](https://auth0.com/docs/quickstart/native/react-native-expo)). This follows the native-app best practice in [RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252), which requires an external user-agent and requires public native clients to use PKCE.
3. Enable rotating refresh tokens with reuse detection for the native client, set a bounded absolute/idle lifetime, and store the SDK-managed credential only in platform secure storage. Access tokens should be short-lived and sent to the API as `Authorization: Bearer ...`; the mobile app must never contain a client secret. Auth0 documents rotation, automatic reuse detection, and React Native SDK support ([refresh-token rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation), [native Expo token renewal](https://auth0.com/docs/quickstart/native/react-native-expo)). This matches the current OAuth security BCP's requirement that public clients use sender-constrained refresh tokens or rotation ([RFC 9700 §4.14](https://datatracker.ietf.org/doc/html/rfc9700#section-4.14)).
4. Register one Auth0 API/resource server for the backend. The backend must validate the access-token issuer, audience, signature, expiry, and scopes/claims using RS256 and published keys; it must not accept an ID token as an API access token. Auth0 recommends RS256 and key rotation-friendly JWKS validation ([token best practices](https://auth0.com/docs/secure/tokens/token-best-practices)). The application should identify a person by the pair `(iss, sub)`, not by email: OpenID Connect defines `iss` + `sub` as the only guaranteed stable identifier for an end user ([OIDC Core §5.7](https://openid.net/specs/openid-connect-core-1_0.html#ClaimStability)).
5. Enable Auth0's database connection for email/password, email verification, and password reset; enable Google and Apple social connections in Universal Login. Add passkeys and MFA after the base flow is proven, with a policy for TOTP/WebAuthn/recovery codes and step-up authentication for sensitive actions. Auth0 supports password reset for its database connection, social connections, passkeys for web and native apps, and configurable MFA factors ([password reset](https://auth0.com/docs/authenticate/database-connections/password-change), [passkeys](https://auth0.com/docs/authenticate/passwordless), [MFA](https://auth0.com/docs/secure/multi-factor-authentication/enable-mfa)).
6. Treat logout and deletion as coordinated lifecycle operations. Normal logout clears the local web cookie or mobile credentials and calls the provider logout/revocation path. Security actions can revoke a specific Auth0 session and its refresh tokens through the Management API ([revoke a session](https://auth0.com/docs/api/management/v2/sessions/revoke-session)); global logout can terminate Auth0 sessions and revoke Auth0 refresh tokens ([Universal Logout](https://auth0.com/docs/authenticate/login/logout/universal-logout)). The application must still enforce its own disabled/deleted-user state, because an already-issued access token can remain usable until it expires. Account deletion should require recent authentication/step-up, delete or retain application financial data according to the product's retention policy, then delete the Auth0 user through the Management API ([manage users](https://auth0.com/docs/manage-users/user-accounts/manage-users-using-the-management-api)).

This is a provider choice, not a decision to put authorization in Auth0. The application should keep an internal `User` record and an identity mapping keyed by `(issuer, subject)`, then model Household/Workspace, Membership, role, and resource shares in its own database. Provider claims may carry coarse context, but every financial read and write must be authorized against current application data. Do not put a household's full sharing graph in a session token: token claims can be stale, are size-constrained, and are not a substitute for a database authorization check.

## Protocol and security baseline

- Native authorization uses the external browser/system user-agent, Authorization Code, and PKCE (`S256`), never an embedded WebView or the implicit flow ([RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252), [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636), [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700)).
- The web app uses a server-managed cookie session. Browser JavaScript receives user state and short-lived API results through the app's server boundary, not a persistent refresh token. The service worker must not cache authenticated HTML, RSC/data responses, API responses, or session endpoints.
- The mobile app uses the provider SDK's secure credential manager and an OS-protected store. A refresh token is a high-value credential; rotation and reuse detection are required, and logout must revoke it where the provider supports it ([RFC 9700 §4.14](https://datatracker.ietf.org/doc/html/rfc9700#section-4.14), [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009)).
- Deep links must be exact, environment-specific, and allowlisted at the provider. Prefer app-claimed HTTPS links for production; if Expo starts with a custom scheme, use a reverse-domain scheme controlled by the project and separate development, preview, and production redirect URLs.
- The API accepts only access tokens issued for its own audience. It validates `iss`, `aud`, signature, `exp`, and the minimum scopes/claims before loading any financial record. Authentication success alone never grants access to another user's data.
- The internal identity key is `(issuer, subject)`. Email is a mutable contact attribute and must not be used as a primary key or as proof that two accounts may be merged. Account linking requires an authenticated session for both identities; Auth0 explicitly warns that insecure linking can give an attacker access to a legitimate account ([account linking](https://auth0.com/docs/manage-users/user-accounts/user-account-linking)).

## Compared options

### Auth0 — selected

Auth0 is the best fit when the provider should remain independent from the future database/backend. It has current first-party paths for both Next.js and Expo, OIDC/OAuth APIs, Universal Login, email/password recovery, Google and Apple connections, PKCE, rotating refresh tokens, MFA, passkeys, session revocation, account deletion, and user import/export. Auth0's current pricing page shows a Free tier up to 25,000 monthly active users; Essentials is listed at $35/month for up to 500 MAU and includes Pro MFA. Passkeys and social connections are listed in the Free tier, while Pro MFA begins on Essentials ([pricing](https://auth0.com/pricing)).

The tradeoff is configuration and price. The team must manage application/API clients, callback URLs, custom domains, tenant environments, Management API credentials, and the boundary between Auth0 sessions and application authorization. The Free tier has one tenant and short log retention; separate production and non-production tenants or richer MFA/security controls may require a paid plan. Auth0's user profile export is useful for migration, but password hashes and MFA secrets are a separate support-mediated export, so a future provider migration may still require password resets ([import/export](https://auth0.com/docs/manage-users/user-migration), [password-hash/MFA export](https://auth0.com/docs/manage-users/user-migration/export-password-hashes-and-mfa-secrets)).

### Clerk — strongest alternative for Expo developer experience

Clerk has first-class Next.js and Expo SDKs, prebuilt sign-in/user-management UI, Google and Apple connections, password recovery, session/device revocation, organization/RBAC primitives, and a token-cache integration backed by `expo-secure-store` for Expo ([Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart), [Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart), [Expo AuthView](https://clerk.com/docs/reference/expo/native-components/auth-view), [revoke session](https://clerk.com/docs/reference/backend/sessions/revoke-session)). It is attractive if the primary optimization is shipping a polished native Expo flow quickly. Its pricing page shows 50,000 monthly retained users on Hobby; Pro is $20/month billed annually ($25 monthly) and adds MFA, custom session lifetime, and other production features ([pricing](https://clerk.com/pricing)).

The tradeoff is deeper provider coupling: the application consumes Clerk sessions/JWTs and Clerk-specific user/organization APIs rather than a neutral database or auth schema. Clerk advertises full user-data exports, but a migration still needs a planned treatment for credential material, linked providers, custom claims, and current sessions. Expo passkeys are currently exposed through Clerk's `__experimental_passkeys` integration, so passkeys should be treated as a compatibility spike rather than the only reason to select Clerk ([Expo passkeys](https://clerk.com/docs/reference/expo/passkeys)). Clerk becomes the preferred choice if the team values Expo-native UX and a lower paid-auth floor more than standards/migration independence.

### Supabase Auth — conditional on choosing Supabase as the data plane

Supabase Auth combines email/password, magic links/OTP, social login, JWTs, PostgreSQL-backed users, and Row Level Security. It has explicit Next.js SSR cookie guidance, Expo/React Native quickstarts, Google and Apple guides, native deep-link guidance, rotating refresh tokens, TOTP/phone MFA, user deletion, identity linking, and user export ([Auth overview](https://supabase.com/docs/guides/auth), [Next.js SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [Expo social auth](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth), [sessions](https://supabase.com/docs/guides/auth/sessions), [MFA](https://supabase.com/docs/guides/auth/auth-mfa)). Pricing is attractive: Free includes 50,000 MAU and Pro starts at $25/month with 100,000 MAU included ([pricing](https://supabase.com/pricing)).

The tradeoff is architectural coupling. Auth users live in the project's Postgres `auth` schema and the strongest authorization story is Supabase RLS; that is excellent if issue #14 chooses Supabase, but it is an unnecessary constraint if the platform uses a detached TypeScript backend and Drizzle/PostgreSQL. Supabase's SSR guidance also says the browser needs access to the refresh token and that the cookie is not required to be `HttpOnly`, which is a larger browser-exposure surface than a server-only web session ([SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)). Session timeouts and single-session controls are Pro features. Supabase Auth is the fallback if the backend decision selects Supabase, not the default independent provider.

### Firebase Authentication — strong if Firebase is the backend

Firebase supports email and social authentication, Google and Apple, web/iOS/Android SDKs, configurable web/native persistence, account deletion, provider linking, and server-side refresh-token revocation ([Firebase Auth](https://firebase.google.com/docs/auth), [web persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence), [Google](https://firebase.google.com/docs/auth/web/google-signin), [Apple](https://firebase.google.com/docs/auth/web/apple), [session management](https://firebase.google.com/docs/auth/admin/manage-sessions), [account deletion](https://firebase.google.com/docs/auth/web/manage-users)). Authentication is no-cost for many small deployments; Firebase's current pricing page lists 50,000 MAU without charge for Authentication with Identity Platform, then Google Cloud pricing ([Firebase pricing](https://firebase.google.com/pricing)).

The tradeoff is higher Firebase/Google coupling and less direct alignment with the planned Next.js-plus-Expo architecture. Firebase's default browser/React Native persistence is local, and its long-lived refresh-token model requires explicit server-side revocation policy. MFA and OIDC/SAML integrations are part of the optional Identity Platform upgrade, whose free-plan limits differ from base Firebase Authentication ([Identity Platform details](https://firebase.google.com/docs/auth)). No first-party Expo-specific authentication quickstart comparable to the Auth0, Clerk, or Supabase Expo guides was found in the checked Firebase documentation; this would need a native-module/build spike before adoption.

### Amazon Cognito — viable AWS-first option

Amazon Cognito User Pools are an OIDC provider for web and mobile apps. Managed login supports email/password flows, recovery, MFA, Google, Apple, OIDC/SAML federation, and passkeys; public clients can use OAuth/PKCE, and refresh-token lifetime is configurable ([User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html), [authentication flows](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html), [managed login](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html), [token/session quotas](https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html)). Disabling a user invalidates sessions and revokes access/refresh tokens; users can delete their own accounts and administrators can delete them ([account management](https://docs.aws.amazon.com/cognito/latest/developerguide/how-to-manage-user-accounts.html)).

The tradeoff is AWS-specific configuration, a less cohesive Next.js/Expo developer experience, and pricing that varies by user-pool feature plan and MAU. Cognito is the right alternative only if the rest of the platform is already AWS-first and the team accepts owning more hosted-login configuration and integration code. It does not beat Auth0 on this project's current portability and implementation-risk criteria.

## Recommendation details and boundaries

### Provider-owned responsibilities

- Credential collection, password hashing, verification and reset email, social OAuth, Apple relay behavior, passkeys, MFA challenges, recovery codes, provider sessions, refresh-token rotation, and provider-side account linking.
- Issuing tokens for the web and native clients, publishing signing keys, and recording provider audit events.

### Application-owned responsibilities

- The internal `User` row and `(issuer, subject)` identity mapping.
- Household/workspace membership, roles, resource-level shares, authorization checks, and revocation of access to financial data. This remains the subject of issue #10.
- Financial data export, deletion/retention workflow, audit events, and backups. Auth0 user deletion must be one step in a larger application-owned deletion transaction; this remains connected to issue #13.
- API token validation middleware and an application-level disabled/deleted-user check. Keep access-token lifetimes short enough that provider logout/revocation does not leave a long window of access.
- A small auth adapter boundary in the shared TypeScript packages. Provider-specific SDK calls and Management API calls stay behind the web/mobile/backend adapters so a later provider migration does not leak through the domain model.

### What not to do

- Do not implement password storage, email verification, password reset, social OAuth, passkey ceremony, refresh-token rotation, or MFA in application code.
- Do not use email as the identity primary key or silently merge two accounts because their email strings match.
- Do not store financial records or authorization graphs in Auth0 user metadata or session claims.
- Do not give the browser a long-lived mobile refresh token, and do not use a client secret in the Expo bundle.
- Do not use Auth0 roles/Organizations as a substitute for the domain's future Household/Workspace and scoped-sharing model.

## Tradeoffs

- **Security and portability over lowest cost:** Auth0's standards support and import/export story reduce migration risk, but MFA, tenant separation, richer logs, and higher MAU tiers can cost more than Clerk or Supabase.
- **Web simplicity vs. provider reachability:** a server-side web cookie is safer and simpler for the PWA, but the backend must obtain/forward an API access token when the data API is a separate service.
- **Mobile continuity vs. revocation window:** mobile refresh tokens provide a good offline/relaunch experience, but the app must use secure storage and rotation; short access-token lifetimes limit the impact of a revoked session.
- **Hosted UI vs. custom UX:** Universal Login keeps credential and recovery code out of application code, but deep visual customization is less flexible than a fully embedded form.
- **Identity migration is not data migration:** Auth0 can export user profiles and import many database users, but linked social accounts, password hashes, MFA secrets, active sessions, and provider-specific claims need a separately tested migration plan.

## Unresolved follow-ups

1. Confirm Auth0 plan and regional/data-processing requirements, including whether a separate production tenant, custom domain, Pro MFA, log retention, or a DPA is required. Recheck pricing before budgeting because vendor plans change.
2. Build a small Expo development-build spike on iOS and Android covering Google, Sign in with Apple, email verification, password-reset deep links, logout, app relaunch, device loss, and refresh-token rotation/reuse detection. Verify claimed HTTPS links as well as the custom-scheme fallback.
3. Coordinate with issue #14 to set the API audience, deployment boundary, JWKS cache/rotation behavior, and whether the Next.js app is the BFF for the detached backend.
4. Resolve issue #10's domain authorization model and specify the exact database constraints and request-time checks that map a validated Auth0 subject to a user, household/workspace membership, and a financial resource.
5. Coordinate with issue #13 on user-visible data export, deletion/retention, audit logging, incident response, and the provider-to-application deletion order.
6. Decide the v1 authentication policy: whether email/password plus Google/Apple is enough initially, when MFA becomes mandatory for sensitive actions, and whether passkeys are a v1 convenience or a later rollout. Test re-authentication/step-up behavior for account deletion and financial exports.
7. Define development, preview, and production callback/logout URL allowlists and secret-management rules before the first implementation. Never share a client secret with the mobile bundle.

## Sources checked

All sources below are first-party documentation or standards, checked on 2026-08-15. The links are also attached near the claims they support above.

- [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)
- [RFC 7636 — Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 9700 — OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/rfc9700)
- [RFC 7009 — OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [W3C Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/)
- [Auth0 documentation and pricing](https://auth0.com/docs), [Next.js quickstart](https://auth0.com/docs/quickstart/webapp/nextjs), [Expo quickstart](https://auth0.com/docs/quickstart/native/react-native-expo), [pricing](https://auth0.com/pricing)
- [Clerk documentation and pricing](https://clerk.com/docs), [Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart), [Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart), [pricing](https://clerk.com/pricing)
- [Supabase Auth documentation and pricing](https://supabase.com/docs/guides/auth), [sessions](https://supabase.com/docs/guides/auth/sessions), [Expo social-auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth), [pricing](https://supabase.com/pricing)
- [Firebase Authentication documentation and pricing](https://firebase.google.com/docs/auth), [session management](https://firebase.google.com/docs/auth/admin/manage-sessions), [pricing](https://firebase.google.com/pricing)
- [Amazon Cognito documentation and pricing](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html), [managed login](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html), [pricing](https://aws.amazon.com/cognito/pricing/)
