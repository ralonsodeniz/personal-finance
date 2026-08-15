# Authentication provider comparison for web and Expo

**Status:** research complete; recommendation is provisional and is not a user-approved architecture decision.

**Checked:** 2026-08-15

## Requirements

- Managed/provider-built authentication; do not implement password storage, OAuth, recovery, MFA, or token issuance in application code.
- Email/password, Google, and Apple sign-in where supported.
- A server-rendered Next.js web/PWA session model and a future Expo/React Native model.
- A shared custom HTTP API for web and mobile.
- Application-owned authorization for users, personal/household workspaces, roles, and resource-level sharing.
- A credible portability boundary around the identity provider and PostgreSQL data plane.
- Suitable security controls for sensitive financial data: recovery, revocation, MFA/passkeys later, account deletion, auditability, and export.

## Candidate comparison

| Candidate | Web and Expo fit | Custom API fit | PostgreSQL/RLS fit | Main trade-off for this project |
| --- | --- | --- | --- | --- |
| [Auth0](https://auth0.com/docs/quickstart/webapp/nextjs) | Strong first-party Next.js and [Expo](https://auth0.com/docs/quickstart/native/react-native-expo) paths; Universal Login, browser-based native login, and secure credential storage | Strong OIDC/OAuth boundary with access tokens issued for a registered API | Works with Supabase third-party auth, but RLS integration is an additional boundary rather than the core model | More configuration and provider cost for advanced production features, but strongest separation from the database/backend |
| [Supabase Auth](https://supabase.com/docs/guides/auth) | Strong Next.js SSR and [React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native) paths; Google and Apple are documented | Usable for a custom API, but the largest benefit comes when Supabase APIs and JWT/RLS are part of the request path | Best integrated option: Auth, Postgres, Data API, and RLS are designed to work together | Couples identity and data-plane decisions more tightly to Supabase; direct-client/RLS paths need careful policy design |
| [Clerk](https://clerk.com/docs/expo/getting-started/quickstart) | Excellent Next.js/Expo developer experience, prebuilt UI, and native Google/Apple options; some native components are currently documented as beta | Good backend/API support through provider sessions and tokens | Can be used with Supabase as third-party auth, but does not remove the need for application-owned financial authorization | Fastest polished auth UX, but more dependence on Clerk-specific SDKs, user APIs, and organization features |
| [WorkOS AuthKit](https://workos.com/docs/authkit/landing) | Strong hosted web flow and separate application configuration for web/mobile; public-client PKCE is documented, but the official Expo guide is a generic browser/deep-link integration rather than a dedicated Expo AuthKit SDK | Strong OAuth/OIDC boundary and backend SDKs; Next.js SDK handles encrypted cookie/session plumbing | Can sit above any PostgreSQL provider; AuthKit organizations/RBAC plus WorkOS [FGA](https://workos.com/docs/fga) can model resource-scoped access | Best built-in path to organization membership, expiring invitations, and resource-scoped authorization, but more B2B-oriented identity semantics and more native Expo glue than the leading consumer-focused options |
| [Firebase Authentication](https://firebase.google.com/docs/auth) | Strong web and mobile platform support, including email/password, Google, and Apple | Custom backends can verify Firebase ID tokens; server session cookies and refresh-token revocation are documented | Weakest fit for a PostgreSQL-first architecture unless Firebase services are also adopted | Mature and economical at small scale, but introduces Google/Firebase ecosystem coupling and a less natural Expo/Postgres boundary |
| [Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-integrate-apps.html) | Managed Login supports web flows, password/social authentication, MFA, and passkeys; native clients can use public app clients | OIDC/JWT API boundary is strong and AWS provides token verification guidance | No meaningful PostgreSQL/RLS advantage without additional AWS/data-plane design | Credible AWS-first choice, but operational configuration and ecosystem coupling are heavier than this project's current Vercel/Render direction |

## WorkOS analysis

WorkOS should be included in the authentication spike. It is not disqualified by our user, household, sharing, or role requirements.

### What fits well

- AuthKit is a managed hosted flow with email/password, Magic Auth, social login, MFA, and passkeys. WorkOS explicitly documents Google and Apple as supported social providers, subject to configuring them in the dashboard. It also offers a custom-UI API when the hosted UI is not sufficient.
- WorkOS supports multiple applications sharing one user base. That maps cleanly to a Next.js web application and a future Expo application with separate redirect URIs and session policies.
- WorkOS sessions use short-lived access tokens and refresh tokens, with refresh-token rotation documented. Its Next.js SDK handles token validation and refresh and uses an encrypted session cookie. For a public mobile client, WorkOS documents PKCE and instructs applications to keep the verifier and refresh credentials in platform secure storage.
- Organizations and memberships can represent household workspaces. A user can belong to multiple organizations, and roles/permissions can be assigned per organization membership. This is a viable provider-side coarse boundary for `household_id` and broad capabilities.

### Important differentiator: WorkOS FGA

The current WorkOS platform also documents Fine-Grained Authorization (FGA), which materially strengthens its fit for our future sharing model. FGA supports resource types, hierarchical resources, resource-scoped role assignments, access checks, and discovery of which users can access a resource. A possible model would be:

```text
organization: household
└── resource: investment-area
    └── database data: portfolios, accounts, holdings, transactions
```

An advisor could receive a `investment-area-viewer` assignment on only one investment-area resource. FGA can keep the stable authorization boundary in its resource hierarchy while the high-volume financial rows remain in our database; WorkOS documents this exact parent-resource pattern for high-cardinality data. ([FGA API](https://workos.com/docs/reference/fga), [high-cardinality data](https://workos.com/docs/fga/model-your-app-high-cardinality-data))

This is the main benefit of WorkOS for the advisor scenario. It is not merely that WorkOS has enterprise SSO. It could combine authentication, household membership, invitations, resource-scoped roles, and access checks in one managed authorization layer. The trade-off is an additional network dependency and an authorization model that we would need to synchronize with our financial data lifecycle.

### Where our application must remain authoritative

WorkOS AuthKit organization RBAC alone does not replace the finance domain policy. If WorkOS FGA is selected, it could become the source of truth for coarse/resource-level authorization assignments, but we would still keep the following in PostgreSQL and enforce the final decision in the application API:

- the internal user and identity mapping;
- household ownership and invitations;
- the financial resources and their parent relationships;
- the share lifecycle: recipient binding, one-time-use state, expiration, revocation, and audit events;
- field- or account-specific visibility, revocation, export, and audit rules.

WorkOS permissions are carried in session claims, and WorkOS documents a 4 KB browser-cookie limit for those claims. FGA resource-specific permissions are checked through its authorization API rather than represented as a complete session claim. The application must still check share expiry, consent, account state, and any finance-specific rules for every protected operation.

### Advisor sharing: what the link should mean

We should distinguish an **invitation link** from an **anonymous data link**:

1. The owner selects only the investment area or portfolio to share and chooses `view-only`, an expiry, and optionally a maximum access window.
2. The application creates a pending share record and sends a random, single-use invitation token. The token identifies no financial data and is stored hashed in our database.
3. The advisor follows the link and authenticates with the selected provider. The application verifies the invited identity, atomically consumes the token, and creates the scoped grant.
4. Every API request checks the current user, resource scope, expiry, revocation, and role. The owner can revoke access immediately, and all access is audited.

This means the link is used once to establish an authenticated relationship; it is not a permanent bearer URL to live financial data. A directly viewable anonymous link would be materially riskier and should not be the default for financial information.

All three remaining providers can support this architecture:

- **WorkOS:** invitations can target an organization, carry a role, expire, and be revoked; FGA can then assign a view-only role to the specific investment resource after the advisor becomes an organization member. ([invitations](https://workos.com/docs/authkit/invitations), [invitation API](https://workos.com/docs/reference/authkit/invitation), [FGA assignments](https://workos.com/docs/fga/assignments))
- **Clerk:** organization invitations, roles, and revocation are managed by Clerk; Clerk also documents expiring sign-in tokens that can activate a selected organization. The investment-area grant and its expiry would still be application-owned. ([organization invitations](https://clerk.com/docs/guides/organizations/add-members/invitations), [sign-in tokens](https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token))
- **Auth0:** organization invitations can include roles, a TTL, and either an Auth0-delivered email or a generated invitation URL. The investment-area grant and its expiry would still be application-owned. ([organization invitations](https://auth0.com/docs/manage-users/organizations/configure-organizations/send-membership-invitations))

Therefore, yes: the advisor scenario is possible with Clerk and Auth0. WorkOS has a stronger built-in authorization story for the resource-scoped part, but it is not required; with Clerk or Auth0 we can implement the same product behavior with our own `resource_grants`/`share_links` model.

### Risks and questions for the spike

1. **Native Expo integration:** WorkOS’s official mobile material currently describes browser-based SSO using Expo AuthSession/WebBrowser, while its SDK catalog lists iOS but not a dedicated React Native/Expo AuthKit SDK. WorkOS does document public-client PKCE, so this is technically plausible, but we need to validate the complete AuthKit flow—not only SSO—with email/password, Google, Apple, deep links, logout, refresh rotation, and iOS/Android secure storage.
2. **Email-centered identity linking:** WorkOS intentionally treats email as the unique identifier for a user and automatically links credentials across providers. We can still map the WorkOS `sub` to our internal user record, but we must explicitly accept WorkOS’s email-based account-linking and email-change behavior for account recovery, migration, deletion, and possible future provider changes.
3. **Provider organization semantics:** WorkOS organizations are designed strongly around B2B workspaces and enterprise administration. The documentation also supports simple B2C and multi-workspace models, so this is not a blocker; the spike should confirm that a personal workspace plus optional household workspaces feels natural without forcing every user through enterprise-style organization selection.
4. **Cost fit:** AuthKit user management is currently free up to 1 million monthly active users. Enterprise SSO and Directory Sync are separately priced per connection, and a custom AuthKit domain is an additional paid feature. That is attractive for basic auth but means the enterprise features should not drive the v1 architecture or budget assumptions.

### Current assessment

WorkOS is now a strong candidate alongside Auth0 and Clerk. Its differentiator is the combination of AuthKit, organization invitations, and FGA resource-scoped authorization. That matters if advisor sharing becomes a first-class collaboration feature or if the product later supports professional organizations. For a simple v1 with a small number of shared resources, Clerk or Auth0 can provide the same user experience with less provider-side authorization machinery. That is an assessment from the documented product shape, not a vendor limitation or a final decision.

### Options not shortlisted

Auth.js, Better Auth, and Keycloak are not primary candidates for this decision because the requirement is managed/provider-built authentication. They are libraries or self-hosted approaches that would leave more identity lifecycle, hosting, or provider integration responsibility in this project. They can be reconsidered only if self-hosting or application-controlled authentication becomes an explicit requirement.

## Provisional recommendation

Keep the provider decision open until a small, disposable spike compares **Auth0, Clerk, and WorkOS** against the same web/mobile/API acceptance tests. Supabase Auth remains documented as background research but is intentionally **out of this spike**. The earlier Auth0 recommendation remains a candidate recommendation, not a project decision.

Recommended boundary:

```text
Next.js web/PWA  -> server-managed provider session -> application API/domain
Expo mobile      -> provider Authorization Code + PKCE -> application API/domain
Provider         -> verified issuer/subject -> internal User/Identity
Application      -> authorization policy and PostgreSQL data
```

The architecture-independent boundary remains:

- Web: a server-managed encrypted, HttpOnly session cookie.
- Mobile: Authorization Code + PKCE with rotating/revocable refresh credentials in OS secure storage.
- API: access tokens issued for the application API; ID tokens are never accepted as API credentials.
- Identity: an internal user record linked to provider identity; email is profile data, not our authorization key.
- Authorization: household/workspace membership, roles, and resource sharing remain in the application database.
- Data path: financial reads and writes go through the application API initially; direct provider data access is not required for v1.

Current conditional lean:

- **Auth0** if provider neutrality, explicit API audiences, and mature native OAuth patterns win.
- **Clerk** if polished web/Expo account UX and speed win.
- **WorkOS** if resource-scoped advisor/household sharing and future organization administration justify its FGA and native integration work.

Cognito remains conditional on an AWS-first platform decision, and Firebase remains conditional on a Firebase/Google data-plane decision.

## Decision still required from the user

Confirm the provider and these provider-independent boundaries:

- Web session: server-managed, encrypted, HttpOnly cookie rather than a browser refresh token.
- Mobile session: Authorization Code + PKCE with rotating/revocable refresh credentials in OS secure storage.
- API: access tokens are issued for the application's API; ID tokens are never accepted as API credentials.
- Identity: internal records use a stable `(issuer, subject)` mapping, not email as the primary key.
- Authorization: household/workspace membership, roles, and resource sharing remain in the application database.
- Data path: financial reads and writes go through the application API initially; direct Supabase access is not required for v1.

Once the provider is selected, update the authentication ticket and map, then re-evaluate the Auth0/Supabase/RLS portions of the backend and authorization work.

## Sources checked

- [Auth0 Next.js quickstart](https://auth0.com/docs/quickstart/webapp/nextjs), [Auth0 Expo quickstart](https://auth0.com/docs/quickstart/native/react-native-expo), [Auth0 access tokens](https://auth0.com/docs/secure/tokens/access-tokens/get-access-tokens), and [Auth0 pricing](https://auth0.com/pricing).
- [Supabase Auth](https://supabase.com/docs/guides/auth), [Supabase React Native quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native), [Supabase third-party auth](https://supabase.com/docs/guides/auth/third-party/overview), and [Supabase pricing](https://supabase.com/pricing).
- [Clerk Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart) and [Clerk pricing](https://clerk.com/pricing).
- [WorkOS AuthKit overview](https://workos.com/docs/authkit/landing), [WorkOS applications](https://workos.com/docs/authkit/applications), [WorkOS users and organizations](https://workos.com/docs/authkit/users-organizations), [WorkOS sessions](https://workos.com/docs/authkit/sessions), [WorkOS roles and permissions](https://workos.com/docs/authkit/roles-and-permissions), [WorkOS social login](https://workos.com/docs/authkit/social-login), [WorkOS React Native/Expo integration](https://workos.com/docs/integrations/react-native-expo), [WorkOS OAuth/PKCE for public applications](https://workos.com/docs/authkit/connect/oauth), [WorkOS SDK catalog](https://workos.com/docs/sdks), [WorkOS invitations](https://workos.com/docs/authkit/invitations), [WorkOS FGA](https://workos.com/docs/fga), and [WorkOS pricing](https://workos.com/pricing).
- [Clerk organization invitations](https://clerk.com/docs/guides/organizations/add-members/invitations), [Clerk sign-in tokens](https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token), and [Auth0 organization invitations](https://auth0.com/docs/manage-users/organizations/configure-organizations/send-membership-invitations).
- [Firebase Authentication](https://firebase.google.com/docs/auth), [Firebase server session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies), [Firebase ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), and [Firebase pricing](https://firebase.google.com/pricing).
- [Amazon Cognito app integration](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-integrate-apps.html), [Cognito token verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html), and [Cognito pricing](https://aws.amazon.com/cognito/pricing/).
