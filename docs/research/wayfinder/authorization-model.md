# Authorization model for users, households, roles, and scoped sharing

**Wayfinder issue:** [#10 — Authorization Model for Users, Households, Roles, and Scoped Sharing](https://github.com/ralonsodeniz/personal-finance/issues/10)  
**Date checked:** 2026-08-15  
**Scope:** architecture and v1 authorization semantics; no application-code changes

## Recommendation

Use Auth0 only to authenticate the principal. On every API request, validate the Auth0 access token, resolve the `(issuer, subject)` pair to an internal `User`, and authorize against current application-owned membership and grant records. Treat a logged-in user with no applicable membership or grant as unauthorized.

Keep the policy implementation as a small, pure, hand-rolled TypeScript domain module for v1. Store the authorization graph in PostgreSQL and make the API the mandatory enforcement point. If Supabase is used, enable PostgreSQL RLS on exposed tables as defense in depth, but keep its policies limited to a database-enforceable projection of the application rules. Do not put the complete household/resource graph in Auth0 claims or require a token refresh for revocation to take effect.

This is proportionate to the current scope: one product, one TypeScript backend, a small fixed role set, and a relational sharing graph. CASL, Oso, or OpenFGA should be reconsidered only when policy duplication, policy complexity, or multi-service scale justifies their additional dependency and operational boundary.

## 1. Mapping Auth0 to internal `User` and `Identity`

### Stable key and first-login provisioning

The durable external identity key should be the pair:

```text
Identity.issuer  = verified token `iss`
Identity.subject = verified token `sub`
```

OpenID Connect defines `sub` as locally unique and never reassigned within an issuer, and says that `(iss, sub)` is the only guaranteed unique stable identifier for an end user ([OIDC Core §5.7](https://openid.net/specs/openid-connect-core-1_0.html#ClaimStability)). Auth0's profile documentation likewise distinguishes the provider-specific identity records and their `user_id` values from mutable profile attributes ([Auth0 user profile structure](https://auth0.com/docs/manage-users/user-accounts/user-profiles/user-profile-structure)).

At the API boundary:

1. Verify signature, issuer, audience, expiry, and required scopes using a maintained JWT/OIDC library. Auth0 recommends middleware or an existing library for JWT validation and recommends RS256 for asymmetric verification and key rotation ([Auth0 token best practices](https://auth0.com/docs/secure/tokens/token-best-practices)). Auth0's access-token guidance also requires checking that the audience matches the API and that the required `scope` values are present ([Auth0 validate access tokens](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens)).
2. Look up `Identity` by the exact `(iss, sub)` pair. Never use an email address, display name, or provider connection as the account key.
3. If the identity exists, load its internal `User` and check the application's status (`active`, `suspended`, or `deleted`). A valid Auth0 token is not sufficient for an active application session.
4. If it does not exist, create the internal `User` and `Identity` in one transaction, then create that user's default personal `Workspace` and owner `Membership` according to the decision in §3. Make this operation idempotent under concurrent first requests.
5. Treat `email`, `email_verified`, name, and picture as profile/contact attributes or snapshots. They can be refreshed from Auth0, but they must not merge two internal users or grant access.

Recommended relational shape:

```text
User
  id (internal UUID, primary key)
  status, created_at, updated_at, deleted_at

Identity
  id, user_id -> User.id
  issuer, subject, provider, connection
  email_snapshot, profile_snapshot (optional, non-authoritative)
  last_seen_at, created_at, revoked_at
  UNIQUE (issuer, subject)
```

Keep Auth0 metadata out of the source of truth for sharing. Auth0 documents `user_metadata` as user-editable and unsuitable as a secure store, while `app_metadata` is intended for access-related information ([Auth0 metadata](https://auth0.com/docs/manage-users/user-accounts/metadata)). Even `app_metadata` remains provider-side, tokenized state: it is not the right place for a relational, revocable household graph owned by this product.

### Account linking and lifecycle

If Auth0 links multiple provider identities into one Auth0 profile, the application still sees one verified Auth0 subject and should retain one internal `User` with one or more `Identity` rows only when the application intentionally supports more than one issuer/provider mapping. Linking must require an authenticated, deliberate flow; matching email strings is not proof of identity ownership.

On provider logout, blocked account, or token expiry, normal token validation applies. On application suspension, membership removal, or grant revocation, the application database is authoritative and must deny access immediately on the next authorization check, even if the Auth0 token remains valid.

## 2. Application authorization versus Supabase/PostgreSQL RLS

### API/application policy is the primary enforcement layer

The API should own the complete decision because it understands actions, resource hierarchy, workspace membership, ownership, sharing, revocation, audit events, and command invariants. Each command should derive the actor from the verified token and call one central policy/query-scope boundary such as:

```text
authorize(actor, action, resourceContext) -> allow | deny
authorizedScope(actor, action, resourceType) -> database predicate/query scope
```

Authorization must happen before returning a collection, not only after loading individual rows. A client-supplied `userId`, `workspaceId`, or resource ID is a selector, never proof of access. Denied resources should not leak through list counts, search, aggregate reports, error details, or predictable alternate endpoints.

### RLS is valuable defense in depth, with important bypass boundaries

PostgreSQL RLS can restrict rows per command and policy, including separate visibility (`USING`) and write (`WITH CHECK`) expressions. With RLS enabled, a table with no applicable policy is default-deny; however, table owners normally bypass RLS, and superusers or roles with `BYPASSRLS` always bypass it. `FORCE ROW LEVEL SECURITY` can make the owner subject to policies ([PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)). Supabase describes RLS as a PostgreSQL primitive that can provide defense in depth and warns that service keys bypass RLS and must never reach a browser ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).

Use RLS when a Supabase Data API, Storage, Realtime, SQL view, or other database-facing path could expose data without going through the application policy. At minimum, policies should enforce:

- authenticated principal to internal tenant/workspace boundary;
- active membership or an explicit resource grant for row visibility;
- `WITH CHECK` protection against moving or creating a row under an unauthorized workspace/resource;
- no access for suspended/deleted users;
- no accidental exposure through views, functions, or service-role paths.

The API still enforces the complete action policy, including whether an editor may delete or share a particular financial resource. Keep privileged/service credentials server-only and test every access path that bypasses or invokes RLS.

### The Auth0—not Supabase Auth—compatibility boundary

Supabase now has first-class third-party-auth support for Auth0. The documented integration can use Auth0 without migrating users to Supabase Auth, but it requires asymmetric JWTs exposed through OIDC discovery and periodic key configuration updates ([Supabase third-party auth overview](https://supabase.com/docs/guides/auth/third-party/overview), [Supabase Auth0 integration](https://supabase.com/docs/guides/auth/third-party/auth0)).

The integration is not a drop-in equivalence between Auth0 and Supabase Auth:

- Supabase assigns the Postgres role from the JWT `role` claim. Its Auth0 guide says Auth0 JWTs do not contain the literal `role: authenticated` claim by default, and documents an Auth0 Action plus an ID-token-based Supabase client setup for this integration ([Supabase Auth0 integration](https://supabase.com/docs/guides/auth/third-party/auth0)). This is a Supabase-specific integration requirement; it must not be generalized into sending an ID token to the product API, which should accept an access token minted for its own audience.
- Supabase's `auth.uid()` and `auth.jwt()` helpers operate on the JWT context available to Supabase/PostgreSQL. An Auth0 `sub` is not automatically the internal `User.id`. The design must choose either a stable external subject as the RLS principal or a server-controlled mapping from verified `(iss, sub)` to internal `User.id` before the database policy runs. Do not let clients choose that mapping.
- If the API uses a Supabase service key or a database role that bypasses RLS, RLS cannot be the primary protection. The API must enforce the domain policy itself.
- Claims are not a complete sharing graph. Supabase explicitly warns that user-controlled metadata is unsafe for authorization and that JWT-based team data is not fresh until the token is refreshed; it also cautions about JWT size ([Supabase RLS helper functions](https://supabase.com/docs/guides/database/postgres/row-level-security#helper-functions)). Therefore, use a token claim only to establish the principal and coarse request context. Query current `Membership` and `ResourceGrant` rows for the authoritative decision.

Recommended boundary for v1: Auth0 access token -> API verification -> internal `User` lookup -> application authorization -> parameterized database query. Add RLS beneath this path if Supabase is selected. If direct browser-to-Supabase access is later required, design and test a narrowly scoped RLS projection separately rather than copying the whole policy graph into Auth0 claims.

## 3. Recommended domain model

### Workspace/Household and membership

Use one common `Workspace` concept with a `kind` such as `personal` or `household`. A personal workspace is private by default and normally has one owner. A household workspace is a collaborative container with explicit memberships.

```text
Workspace
  id, kind, name, created_by_user_id, created_at, archived_at

Membership
  workspace_id -> Workspace.id
  user_id -> User.id
  role: owner | editor | viewer
  status: invited | active | revoked
  invited_at, accepted_at, revoked_at
  UNIQUE (workspace_id, user_id) for the current membership record
```

Prefer the owner role in `Membership` over a second, competing ownership mechanism. Enforce the v1 invariant that every workspace has at least one active owner and that an owner cannot remove or demote the final owner. Whether v1 permits multiple owners, ownership transfer, or only one owner is an unresolved product decision, not something to infer from Auth0.

### Resources and grants

Every financial resource belongs to exactly one workspace. Keep a typed resource hierarchy rather than a generic unrestricted object graph. For example, if the domain decides that transactions are children of financial accounts, a grant on an account may inherit `view` to its transactions; a grant on a savings goal must not expose an unrelated account.

```text
ResourceGrant
  id
  resource_type, resource_id
  grantee_type: user | workspace
  grantee_id
  permission: view                 (v1)
  granted_by_user_id
  created_at, expires_at, revoked_at
```

For v1, use additive grants: absence of an applicable grant is deny, and there is no public/link-sharing mode or explicit deny row. A `user` grant can expose one selected resource without granting workspace listing. A `workspace` grant makes the resource available to active members of that workspace. This supports a household receiving selected accounts while keeping unrelated resources private. If the product instead requires every grantee to be a workspace member, make that a database invariant before implementation.

Effective access is the union of these paths, evaluated against current, non-revoked records:

1. An active `owner` or `editor` membership grants the workspace's defined read/write actions over resources in that workspace.
2. An active `viewer` membership grants read-only access over resources in that workspace.
3. An active `ResourceGrant` grants only its declared permission to its target user, or to active members of its target workspace.
4. A resource's declared parent grant may be inherited only along approved resource edges and only for actions explicitly listed by that edge.

Never let a resource grant confer workspace administration, membership management, sharing authority, or access to sibling resources. Treat revocation, expiry, inactive membership, suspended/deleted user, archived workspace, and missing parent as hard deny conditions. Delete or retain revoked rows according to audit/retention policy, but do not reuse them as active state.

### Inheritance and revocation rules

- Workspace membership is the broad baseline; resource grants are narrower exceptions or additions.
- `owner` inherits `editor` and `viewer`; `editor` inherits `viewer`; `viewer` never inherits write or share authority.
- A resource grant does not upgrade a workspace role. A selected-resource viewer remains a viewer even if the target resource is normally editable by its owner.
- Resource inheritance is explicit and one-way. Do not infer access from common ownership, matching email, Auth0 organization claims, or a client-provided parent ID.
- Revocation is database state, not a token-claim change. A revoked membership or grant must stop new reads and writes immediately at the API. In-flight transactions should commit or reject atomically under the chosen transaction isolation; already exported/downloaded data cannot be recalled and needs a separate product policy.
- Cache authorization decisions only with a short, explicit invalidation strategy. A cache hit must not outlive the revocation guarantee promised to users.

## 4. Minimal v1 permission matrix and tests

Actions are intentionally coarse for v1. Split them later if financial workflows require more precise permissions.

| Actor / scope | Read resources | Create/update resources | Delete resources | Manage members/roles | Create/revoke grants |
| --- | ---: | ---: | ---: | ---: | ---: |
| Personal workspace owner | yes | yes | yes, subject to retention rules | yes for own workspace | yes, if direct selected sharing is enabled |
| Household owner | yes for household resources | yes | yes, subject to retention rules | yes | yes |
| Household editor | yes for household resources | yes | no in v1 unless explicitly approved | no | no |
| Household viewer | yes for household resources | no | no | no | no |
| Selected-resource viewer grant | granted resource and declared descendants only | no | no | no | no |
| Non-member with no grant | no | no | no | no | no |
| Revoked user, membership, or grant | no | no | no | no | no |

Minimum authorization scenarios:

1. **Personal isolation:** Alice's new personal workspace and resources are readable and writable by Alice. Bob's valid Auth0 login cannot read them, even if Bob guesses Alice's workspace or resource IDs.
2. **Household roles:** Alice creates a household and invites Bob as `editor` and Carol as `viewer`. Bob can read and update household resources but cannot manage memberships or grants. Carol can read but any write, delete, or share attempt is denied.
3. **Selected resource:** Alice grants Bob `view` on one savings goal, or grants a selected account to a household workspace. Bob can read only that resource and the explicitly declared descendants. He cannot enumerate the source workspace, read sibling accounts/goals, update the resource, or see unrelated aggregate totals.
4. **Grant target semantics:** If direct user grants are allowed, a grantee who is not a workspace member can read only the granted resource, not the workspace roster, name, counts, or other resources. If this is not acceptable, reject the grant unless the grantee first becomes a workspace member; this is a decision to settle before implementation.
5. **Revocation:** Remove Bob's membership or revoke the selected grant. The same still-valid Auth0 access token must fail the next API read/write and disappear from authorized list/query results without waiting for a token refresh. An RLS-backed path must show the same result.
6. **Tenant and query bypass:** A logged-in user changes path/query/body IDs to another workspace or resource. The API and, where enabled, RLS return no data and do not permit writes. Test direct row fetches, list endpoints, search, aggregates, exports, nested resources, and views.
7. **Lifecycle denial:** A suspended/deleted internal `User`, revoked `Identity`, archived workspace, or expired grant cannot access data even when the Auth0 signature, issuer, audience, and expiry are valid.
8. **Concurrency:** A revoke and a read/write race must have a documented transaction outcome; no committed write may succeed after the revocation boundary selected by the product.

Test both positive and negative cases at the pure policy layer, API layer, and real PostgreSQL integration layer. If Supabase direct access is enabled, also test the exact Auth0 third-party JWT setup, `role` mapping, RLS policies, views, service-role paths, and key-rotation behavior.

## 5. Hand-rolled policy versus authorization products

### Hand-rolled domain policy: recommended for v1

Use a single shared policy module with typed actions, roles, resource types, and a small set of decision functions. Keep it free of HTTP, Auth0 SDK calls, UI state, and ORM-specific query construction. Have repositories expose authorized scopes or call the policy with a transaction-loaded authorization context. Add table constraints and integration tests so the model is not enforced only by convention.

This gives v1 one authoritative domain model, immediate database-backed revocation, no network hop, and no second persistence system. “Hand-rolled” should mean centralized and tested, not scattered conditionals in routes and components.

### CASL

CASL is an isomorphic TypeScript/JavaScript library for resource permissions, with conditions and field restrictions, and its official project documentation describes incremental adoption across UI, API, and database-query integrations ([CASL project documentation](https://github.com/stalniy/casl)). It could help when the same ability descriptions must drive server and UI affordances. It does not own the membership/grant database, revocation, transaction boundaries, or PostgreSQL RLS, so adopting it now would still leave the core model to design and could create a second representation of it.

### Oso

Oso is an application authorization library with a declarative Polar policy language and primitives for resources, roles, permissions, and collection authorization ([Oso Node.js documentation](https://docs.oso.dev/node/getting-started.html)). It becomes attractive if rules acquire many cross-cutting conditions and a declarative policy language would improve review. It adds a policy runtime and another language without removing the need for current membership/grant data or database query scoping.

### OpenFGA

OpenFGA is a relationship-based authorization service. Its model uses typed objects, relations, and relationship tuples, and supports implied relationships such as a workspace/parent granting access to a child resource ([OpenFGA concepts](https://openfga.dev/docs/concepts), [OpenFGA configuration language](https://openfga.dev/docs/configuration-language)). It is a strong later option if the graph becomes large, many independent services need the same checks, or centralized policy/versioning/audit becomes a requirement. For this v1 it would add a service, consistency/availability considerations, tuple synchronization, and duplicated authority alongside PostgreSQL.

Do not choose a product because the feature is called “fine-grained.” First preserve the relational model and policy contract. Re-evaluate a library or service when a concrete pressure appears: multiple APIs, custom roles, deep resource hierarchies, policy authors outside the TypeScript team, or measured policy duplication/latency problems.

## 6. Decisions to resolve with the user before closing issue #10

1. Is there exactly one personal workspace per user, may a user create more, and can a personal workspace be converted into or merged with a household workspace?
2. Can a household have multiple owners, how is ownership transferred, and what happens when the final owner leaves or deletes their account?
3. Is a selected-resource grant allowed to a non-member user, or must every grantee be a member of the containing household/workspace? If allowed, which workspace metadata is visible to that user?
4. In v1, can resource grants be `view` only, or may they also be `edit`? Is there ever public/link sharing? The recommendation is no public sharing and `view` only initially.
5. Which resources exist now, which are parents/children for inheritance, and exactly which data is included in “read” (descriptions, account identifiers, balances, transaction details, reports, exports, and attachments)?
6. What can `editor` create, update, delete, import, export, or categorize? Can an editor delete a resource, or is delete owner-only? The matrix recommends owner-only deletion until decided.
7. Must revocation be immediate for every API and Supabase path, and what is the policy for already downloaded/exported data and in-flight writes?
8. Will clients access Supabase Data API/Storage/Realtime directly, or will all financial data go through the application API? This determines whether Auth0 third-party JWT integration and an RLS projection are required.
9. If RLS is used with Auth0, will PostgreSQL policies identify principals by Auth0 `(iss, sub)` or by an internal `User.id` mapping, and how will the server-controlled mapping be established for each database request?
10. Which administrative/service operations may bypass RLS, how are those credentials isolated, and which audit events are required for membership, grant, and revocation changes?
11. Are step-up MFA or recent-authentication requirements needed for sharing, ownership transfer, export, or other high-impact financial actions? This is adjacent to the base authorization model but should be named before implementation.

Until these are answered, the safe closure statement is “authorization architecture selected; product semantics for workspace multiplicity, grant targets, resource inheritance, field visibility, and direct Supabase access remain open.”

## Sources and limitations

Sources are limited to primary documentation/specifications: [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html), [Auth0 user profiles](https://auth0.com/docs/manage-users/user-accounts/user-profiles/user-profile-structure), [Auth0 metadata](https://auth0.com/docs/manage-users/user-accounts/metadata), [Auth0 access-token validation](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens), [Auth0 token best practices](https://auth0.com/docs/secure/tokens/token-best-practices), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase third-party auth](https://supabase.com/docs/guides/auth/third-party/overview), [Supabase Auth0 integration](https://supabase.com/docs/guides/auth/third-party/auth0), [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [CASL](https://github.com/stalniy/casl), [Oso](https://docs.oso.dev/node/getting-started.html), and [OpenFGA](https://openfga.dev/docs/concepts).

The note is an architecture recommendation, not a security audit or implementation. Supabase's Auth0 integration has provider-specific claim and signing-key requirements, and RLS cannot protect paths that use owner, superuser, `BYPASSRLS`, or service credentials unless those paths are separately controlled. The current issue body defines the requested scenarios but does not settle the unresolved product choices in §6; those require explicit user decisions before implementation.
