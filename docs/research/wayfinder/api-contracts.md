# API contract strategy: tRPC, REST/OpenAPI, GraphQL, or Connect

- Status: Resolved
- Date checked: 2026-08-15
- GitHub issue: [#12 API Contract Strategy](https://github.com/ralonsodeniz/personal-finance/issues/12)
- Repository context: [Wayfinder map issue #1](https://github.com/ralonsodeniz/personal-finance/issues/1)

## Question

What API contract strategy should connect the mobile-first Next.js web/PWA, Next.js server boundaries, and a future React Native/Expo client? The comparison must cover tRPC, REST with OpenAPI and generated clients, GraphQL, and other worthwhile options, including type sharing, runtime validation, versioning, mobile release cadence, error semantics, authentication and authorization, caching, observability, public API evolution, React Server Components (RSC) integration, and coupling to a TypeScript server.

## Assumptions and decision boundary

The Wayfinder map describes a TypeScript monorepo with a Next.js web/PWA first, a future React Native/Expo application, one backend/data system, authentication from the beginning, and financial data that may later be shared by household/workspace membership and roles. The initial product is online-first, but imports, exports, backups, privacy, and vendor portability are explicit concerns.

This is an architecture decision, not an implementation prescription for the still-undecided backend. The API contract must remain usable whether the first server is Next.js Route Handlers or a detached TypeScript service. The first-party web and mobile clients are expected to be TypeScript, but a future public API or integration may not be.

The important boundary is the network boundary used by browser code, mobile code, and future external consumers. Server Components are a separate server-only call path: Next.js recommends fetching directly from the source in Server Components instead of making an extra request to a Route Handler. That does not remove the need for a stable HTTP contract for client-side web code and mobile clients.

## Recommendation

Adopt **contract-first REST over HTTP with an OpenAPI description and generated clients** as the only client-facing API strategy for the initial platform.

1. Keep a versioned OpenAPI description in a shared contracts package. Use a pinned OpenAPI version and a pinned generator/validator toolchain; the OpenAPI Initiative's current latest published specification is 3.2.0, but the implementation should choose the concrete version that the selected tooling supports and test it in CI.
2. Generate a TypeScript client and DTO types for the web client and React Native/Expo client. Do not import the server router, database models, or server-only TypeScript into either client. Generated output should be reproducible and either checked in deliberately or produced as a verified build artifact.
3. Validate untrusted request data at the HTTP adapter and validate important response shapes in contract/integration tests. Generated TypeScript types are compile-time help, not runtime validation. Treat the OpenAPI/JSON Schema description as the wire contract and the domain/application layer as the source of authorization and business invariants.
4. Use `/v1` (or an equally explicit major-version policy) for the first public-facing surface. Make additive changes by default, never silently repurpose fields, mark operations/fields deprecated, and retain old behavior for a documented mobile compatibility window. The OpenAPI `info.version` field is the version of the description, not automatically the wire/API version, so the two policies must be documented separately.
5. Standardize errors on HTTP status codes plus `application/problem+json` based on RFC 9457. Define stable problem-type URIs and machine-readable extensions for domain and field errors; never put sensitive financial values or tokens in error details.
6. Use HTTP semantics deliberately: cache only explicitly safe `GET` representations, keep authenticated financial responses private or `no-store` unless a reviewed policy says otherwise, and use validators such as ETags/conditional requests where optimistic concurrency matters. Client-side query caching is still useful, but it is not a substitute for HTTP cache policy.
7. Instrument the HTTP boundary with OpenTelemetry HTTP semantic conventions, a stable OpenAPI operation identifier, client/app version, and platform metadata. Redact request bodies and identifiers that could reveal financial data; correlate with traces without logging secrets.
8. In Next.js Server Components, call the shared application/domain service directly. Use the OpenAPI HTTP client from Client Components, the PWA runtime, and React Native/Expo. This avoids a server-to-itself HTTP round trip while preserving one explicit contract for all independently released clients.

This recommendation is intentionally not “tRPC is bad.” tRPC is an excellent fit for a closed, TypeScript-only application whose server and clients are deployed together. It is not the safest default for this platform's durable boundary because the roadmap explicitly includes a separately released mobile client, public/API evolution, and future portability. tRPC's own OpenAPI bridge is currently documented as alpha, which makes “start with tRPC and export a public contract later” a riskier dependency than starting with the explicit contract.

## Compared options

| Option | Contract and type sharing | Evolution and mobile fit | Errors, auth, cache, operations | RSC and server coupling | Assessment for this platform |
| --- | --- | --- | --- | --- | --- |
| **tRPC** | Excellent TypeScript inference from the server router; input/output validators can provide runtime checks. No normal code-generation step. | Same-repository type checking catches changes in clients built together, but deployed old clients still require an explicit compatibility/versioning policy. The OpenAPI escape hatch is alpha and has transformer/query-serialization constraints. | Structured tRPC/JSON-RPC-style error shape with HTTP mappings and custom formatting; context/middleware support authz. Cache behavior is primarily a client/protocol policy rather than a resource-oriented public contract. | Strong Next.js/App Router and RSC integration, including server-side callers; the docs warn that RSC solves some of the same problems and has no single tRPC integration pattern. High coupling to a TypeScript router and its package graph. | **Strong local/internal fit; not chosen as the durable client-facing contract.** |
| **REST + OpenAPI** | Explicit, language-agnostic HTTP contract. Can drive documentation, validation, testing, and generated clients in multiple languages. Requires deliberate DTO/schema design and a runtime validation tool. | Best fit for asynchronous web/mobile releases and a future public API when paired with additive-change rules, `/v1`, deprecation, and contract-diff CI. | Uses standard HTTP status, headers, caching, conditional requests, and `application/problem+json`; OpenAPI documents security schemes but does not enforce business authorization. HTTP/OTel tools are broadly interoperable. | Server Components should call domain/application code directly; Route Handlers or a detached service implement the same HTTP contract. The client depends on generated DTOs, not server implementation types. | **Recommended.** It has the clearest seam between server implementation and independently released clients. |
| **GraphQL** | Strong, language-agnostic schema and introspection; clients specify field selections and can generate client types. Requires schema governance and resolver/business-layer discipline. | GraphQL favors additive, versionless schema evolution and `@deprecated`, which is attractive for many clients. It does not remove the need to support old mobile operations. | Standard response has `data` plus top-level `errors` and may be partial; domain errors are commonly modeled as typed data. Authz belongs in the business layer. Caching needs object identifiers because there is no URL-like resource key; demand/depth/complexity controls are additional security work. | Can serve web/mobile clients, but RSC still benefits from direct server-side application calls. Introduces a graph/query execution layer that is not needed for the initial resource/command surface. | **Conditional later option.** Reconsider if many clients need radically different aggregates, many backends must be composed, or field-level query flexibility outweighs governance and cache complexity. |
| **Connect RPC + Protocol Buffers** | Strong schema-first, generated, language-neutral contract with binary and JSON encodings. Connect supports TypeScript/JavaScript plus mobile languages and gRPC compatibility. | Protobuf has strong wire-evolution rules and tooling such as Buf can detect breaking changes. It is a good fit for polyglot services, native clients, streaming, or high-volume RPC. | Has defined RPC error/metadata semantics and can use HTTP; side-effect-free GET RPCs can be cached. It adds a `.proto`/code-generation/toolchain boundary and is less naturally resource-oriented and human-readable than the proposed JSON HTTP API. | Works over browser-compatible HTTP and can integrate with SSR, but it is a second substantial platform choice for a project currently centered on TypeScript and JSON APIs. | **Worth keeping as a trigger-based alternative**, not the initial choice. Reconsider if the backend becomes polyglot/detached, streaming becomes central, or native Swift/Kotlin clients become first-class. |

## Evidence and option analysis

### tRPC

tRPC's official positioning is end-to-end TypeScript type safety without a code-generation step: the client receives the exported `AppRouter` type, and the server/client can share inferred procedure types. It is framework-agnostic and has Next.js adapters. See [tRPC's overview](https://trpc.io/) and [Next.js integration](https://trpc.io/docs/client/nextjs).

Its runtime story is better than plain TypeScript alone. Procedures may define input and output validators; validators both check values and infer input/output types. See [Input & Output Validators](https://trpc.io/docs/server/validators). Authentication context and authorization middleware are explicit extension points: [Context](https://trpc.io/docs/server/context), [Authorization](https://trpc.io/docs/server/authorization), and [Middlewares](https://trpc.io/docs/server/middlewares).

Its error model is usable but application-specific. tRPC returns an `error` object with JSON-RPC-style numeric codes, tRPC error codes, HTTP status information, and a procedure path; the formatter can add typed details. See [Error Handling](https://trpc.io/docs/server/error-handling) and [Error Formatting](https://trpc.io/docs/server/error-formatting). That is convenient for a TypeScript client, but it is a less universal public contract than HTTP status plus a standard problem format.

tRPC is particularly attractive for the Next.js server path. It supports server-side callers without an HTTP round trip, and its RSC guide supports App Router patterns. The same RSC guide explicitly cautions that RSC already solves many of the problems tRPC was designed to solve and that there is no one-size-fits-all integration. See [Server-Side Calls](https://trpc.io/docs/server/server-side-calls) and [tRPC with React Server Components](https://trpc.io/docs/client/tanstack-react-query/server-components).

The decisive concern is escape and evolution. tRPC now has an [OpenAPI integration](https://trpc.io/docs/openapi), but its documentation marks the package **alpha**, says APIs may change without notice, and documents that clients using a transformer must share the transformer while GET inputs use tRPC-specific `?input=<JSON>` serialization. It also excludes subscriptions from the generated specification. This is a useful bridge or migration aid, not a reason to make a private inferred router the primary long-lived public contract.

### REST with OpenAPI and generated clients

The [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) defines a standard, language-agnostic interface to HTTP APIs. It explicitly supports documentation generation, code generation for servers and clients in various languages, testing, and related tooling. Its Schema Object is based on JSON Schema, which provides a credible common vocabulary for request/response shapes and validation.

OpenAPI provides useful contract metadata: paths and operations, responses, security requirements, examples, and a `deprecated` marker. It also makes an important distinction: `info.version` is the version of the OpenAPI document and is distinct from the version of the API being described. Therefore the project must choose and document its own wire-version policy (`/v1`, media types, or another explicit approach) rather than assuming the document version is enough.

The contract can generate client types and SDK methods for the browser and React Native/Expo, and can later generate Swift/Kotlin or other language clients if the product needs them. Tool choice remains an engineering decision: the [OpenAPI Generator TypeScript generator](https://openapi-generator.tech/docs/generators/typescript/) is documented as experimental and its Fetch client as beta, so the repository should pin the generator and run generated-client contract tests before committing to it. A different maintained generator may be preferable. The important architectural decision is the explicit OAS boundary, not a particular generator brand.

OpenAPI does not enforce authorization or runtime behavior by itself. The specification describes security schemes and is processed by many tools, but the server must still authenticate requests, apply household/workspace scope rules, validate payloads, and enforce business invariants. Runtime validation and response-contract tests are therefore required at the adapter, even when TypeScript types are generated.

REST's main cost is design work: resource names, command endpoints, pagination, filtering, idempotency, concurrency, and representations must be decided rather than inferred from functions. That cost is beneficial here because it forces a stable boundary around sensitive financial data and gives mobile clients a protocol they can retain across server releases.

### GraphQL

GraphQL's [schema and type system](https://graphql.org/learn/schema/) is language-agnostic, introspectable, and client-selected: clients request exactly the fields they consume. This can reduce overfetching and make tailored web/mobile screens easier when the graph is genuinely rich.

GraphQL's official guidance favors continuous schema evolution rather than URL versions: new fields/types can be added without breaking clients, and old fields can be marked `@deprecated`. See [Schema Design](https://graphql.org/learn/schema-design/). That is a real advantage for multiple clients, but it creates a deprecation inventory and schema-governance obligation; it is not permission to remove fields while an old mobile binary may still use them.

Caching is more involved than in a resource-oriented HTTP API. GraphQL's own caching guidance notes that there is no URL-like globally unique object identifier, so clients should expose globally unique IDs to support rich caches. See [Caching](https://graphql.org/learn/caching/). This can work well with a normalized client cache, but it is another policy to design for private financial data.

GraphQL also has distinctive error and security semantics. A response can contain partial `data` and an `errors` array; expected domain failures can be modeled as typed errors-as-data. See [Error Handling](https://graphql.org/learn/error-handling/) and the [GraphQL specification response rules](https://spec.graphql.org/draft/#sec-Response). Because clients can submit expressive nested operations, GraphQL's security guidance calls for demand controls such as pagination, depth limits, breadth/batch limits, rate limits, and query-complexity controls. The authorization guidance recommends authenticating before execution and putting authorization in the business-logic layer, not duplicating it in individual resolvers. See [Security](https://graphql.org/learn/security/) and [Authorization](https://graphql.org/learn/authorization/).

The initial personal-finance scope is primarily resource and command oriented, with one backend and two known client families. GraphQL's flexibility is not enough to justify its extra query governance, cache model, and resolver/observability surface now. It becomes more compelling if the platform later aggregates many services or needs a large number of independently shaped screens.

### Connect RPC and Protocol Buffers

[Protocol Buffers](https://protobuf.dev/overview/) are language-neutral and platform-neutral, generate native language bindings, and are designed to evolve structured messages without invalidating existing data. The proto3 guide documents safe additions/removals and warns where wire-compatible changes still require coordinated rollout; this is a strong basis for long-lived mobile compatibility. See [Updating Proto Definitions](https://protobuf.dev/programming-guides/proto3/#updating).

[Connect](https://connectrpc.com/docs/introduction/) builds browser- and gRPC-compatible HTTP APIs from `.proto` schemas and generates typed clients in supported languages. Its protocol supports JSON or binary Protobuf, unary and streaming calls, meaningful HTTP status codes for unary calls, and GET for side-effect-free calls designed to be cacheable. See the [Connect Protocol reference](https://connectrpc.com/docs/protocol/). Connect is a serious alternative if the backend becomes polyglot or detached, if streaming is central, or if native Swift/Kotlin clients become an immediate requirement.

For this first decision it introduces a second schema/toolchain vocabulary and favors RPC method names over the resource-oriented HTTP surface needed for public documentation, exports, and ordinary browser debugging. It should remain a documented trigger-based alternative rather than be added speculatively.

## Cross-cutting decision matrix

### Type sharing and runtime validation

- **Recommended:** keep domain types, wire DTOs, and persistence models separate. OpenAPI schemas describe wire DTOs; generated clients consume those DTOs; domain services map DTOs to domain objects.
- Compile-time types do not validate untrusted JSON. Every HTTP adapter must validate request shape, authorization context, and business invariants. Validate representative responses in integration/contract tests and validate external import data separately.
- Avoid exposing database/ORM models through the contract. Financial amounts, dates, currencies, account identifiers, and import error structures need stable explicit serialization rules.
- tRPC gives the best same-repository inference and a convenient validator path. GraphQL and Protobuf also give schema-driven validation/code generation. OpenAPI gives the most portable description, but the selected runtime validator and generator must be tested and pinned.

### Versioning and public evolution

Use a major wire-version policy from the first externally callable surface, preferably `/v1` for the initial JSON API. Within a major version:

- add optional response fields and new operations;
- do not make an existing request field newly required without a migration;
- do not change the meaning, units, nullability, or enum semantics of an existing field in place;
- tolerate unknown response fields in clients and make enum decoding forward-compatible where the generator allows it;
- mark deprecated operations/fields, document a removal date or client-adoption threshold, and keep compatibility through the mobile support window;
- compare the published OpenAPI document in CI and fail or require an explicit review for breaking changes.

GraphQL's deprecation-first, versionless style and Protobuf's wire-compatibility rules are valid alternatives. They do not remove the need for a support matrix. tRPC's type checker protects clients rebuilt from the same router; it does not automatically protect an old PWA bundle or installed mobile binary.

### Mobile release cadence

The mobile client must be treated as independently released even if it is in the same monorepo. Expo's EAS Update documentation distinguishes JavaScript/styling/image updates that can be delivered over the air from native-code or native-dependency changes that require a new binary and compatible runtime. See [EAS Update](https://docs.expo.dev/eas-update/introduction/) and [Expo Updates runtime versions](https://docs.expo.dev/versions/latest/sdk/updates/).

Therefore:

- the server should support at least the current and previous supported mobile contract/client versions, with an explicitly chosen retirement window;
- the client should identify its app/client version for observability and gradual rollout, but that identifier must not be used as an authorization decision;
- mutating operations should be idempotent where retries are likely, especially CSV imports and manual transaction creation;
- optimistic concurrency needs an explicit strategy (for example, entity version/ETag plus `If-Match` or a domain conflict response);
- OTA updates can shorten client rollout time but cannot be the only compatibility plan for native runtime changes.

### Error semantics

Use one cross-client error vocabulary:

```text
HTTP status
Content-Type: application/problem+json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "The request is invalid",
  "status": 422,
  "detail": "One or more fields are invalid",
  "instance": "urn:request:...",
  "errors": [
    { "pointer": "/amount", "code": "invalid-money", "detail": "..." }
  ]
}
```

RFC 9457 defines the machine-readable problem-detail model, the `application/problem+json` media type, problem-type URIs, and extension members. See [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html). Keep user-facing text localizable and safe; let stable `type`/`code` values drive client behavior. Use 401 for missing/invalid authentication, 403 for authenticated but disallowed scope, 404 where resource-existence disclosure is acceptable, 409/412 for concurrency conflicts, 422 for structurally valid but semantically invalid input, and 429/5xx for rate/service failures as appropriate to the operation.

tRPC's error shape and GraphQL's top-level/partial-data model are coherent within their ecosystems, but adopting either would require every client and operational tool to understand that protocol. REST plus Problem Details provides the simplest shared vocabulary across browser, Expo, future native clients, scripts, and support tooling.

### Authentication and authorization

The transport choice does not decide the authorization model. Implement it once in the application/domain layer and call it from every adapter, including Server Components and background import jobs. The eventual policy should distinguish:

- authentication identity/user from financial account;
- user membership in a household/workspace;
- role and scoped permissions;
- object-level ownership/access to transactions, savings, investments, and imports;
- audit context for sensitive reads and mutations.

The HTTP contract should describe the selected session/bearer security scheme and required scopes, but those declarations are documentation and tooling input, not enforcement. Next.js's server-side guidance also says data access must still be authenticated and authorized. See [OpenAPI security requirements](https://spec.openapis.org/oas/latest.html#security-requirement-object), [tRPC authorization context](https://trpc.io/docs/server/authorization), and [GraphQL authorization guidance](https://graphql.org/learn/authorization/).

### Caching and offline boundaries

HTTP has standard cache semantics based on method, target URI, response headers, freshness, validation, and private/shared cache rules. See [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) and [RFC 9111 HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html).

The initial policy should be conservative:

- personal financial `GET` responses default to `private` or `no-store` unless the cache key and disclosure risk are reviewed;
- writes are not shared-cacheable and must use normal HTTP mutation semantics;
- use ETags or explicit entity versions for conditional writes where stale edits are possible;
- use a client query cache for responsiveness, but invalidate it after mutations using contract-defined resource keys;
- do not promise full offline mutation support until conflict resolution, encryption, retention, and export semantics are designed.

GraphQL normalized caches and tRPC/TanStack Query caches can still be used above this boundary. They do not replace the server's authorization-aware HTTP cache headers.

### Observability and operability

OpenTelemetry publishes semantic conventions for HTTP client/server spans, metrics, and logs. See [HTTP semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/). Apply them at the API adapter regardless of whether the implementation is a Next.js Route Handler or a detached service.

Minimum fields:

- stable route/operation identifier, not a raw user-controlled URL or full GraphQL query;
- HTTP method, normalized route, status, latency, retry count, and payload-size class;
- trace/request correlation ID;
- client family and version (`web`, `pwa`, `expo`, later native clients);
- deployment/environment and backend version;
- authorization outcome category and domain error code, without secrets or financial values.

For tRPC, procedure path/type and middleware timing can be useful dimensions; for GraphQL, operation name/document hash plus query depth/cost are needed to avoid treating every query string as a new metric; for Connect, service/method and protocol are natural dimensions. These are implementation policies, not reasons to make any one protocol primary.

## Proposed initial shape

The eventual monorepo can use a shape like this without committing to a server host:

```text
packages/
  domain/       # entities, authorization policies, use cases, money/date rules
  contracts/    # OpenAPI document, schemas, examples, version policy
  api-client/   # generated TypeScript client plus safe transport/auth wrapper
apps/
  web/          # RSC calls application services; client code uses api-client
  mobile/       # React Native/Expo uses api-client
server/
  http-adapter/ # Route Handlers or detached service implementing contracts
```

The exact directories are illustrative. The non-negotiable seam is that `api-client` depends on the contract, not on `server` or `domain` implementation modules. The HTTP adapter maps requests to application services and maps domain results/errors to the versioned wire DTOs/problem details. A future detached backend can replace the adapter host without forcing a client protocol rewrite.

## Unresolved follow-ups

These are implementation/design follow-ups, not blockers to resolving this research question:

1. Choose the authentication/session provider and exact web-cookie/mobile-token model; coordinate with issues [#9](https://github.com/ralonsodeniz/personal-finance/issues/9) and [#10](https://github.com/ralonsodeniz/personal-finance/issues/10).
2. Choose Next.js Route Handlers versus a detached TypeScript backend and verify hosting/runtime constraints; coordinate with [#14](https://github.com/ralonsodeniz/personal-finance/issues/14).
3. Select and pin the OpenAPI version, TypeScript client generator, runtime validator, formatter, and breaking-change checker. Test browser and Expo builds, auth refresh, multipart CSV upload, dates, money, enums, and error decoding before adopting the generated output.
4. Define the first `/v1` resource/command surface, pagination/filtering, idempotency keys, import job status, export endpoints, and optimistic-concurrency rules.
5. Define the supported mobile compatibility window and API retirement process, including how an installed PWA bundle differs from an Expo binary and OTA update.
6. Set the privacy-safe observability/redaction policy and cache headers for each financial-data representation.
7. Reconsider GraphQL if the product grows into a multi-backend graph with many independently shaped clients. Reconsider Connect/Protobuf if polyglot services, native non-TypeScript clients, streaming, or strict wire-schema governance become first-class requirements.

## Direct primary sources

All sources below are first-party project documentation or standards/specifications, checked on 2026-08-15:

- [tRPC overview](https://trpc.io/), [Next.js integration](https://trpc.io/docs/client/nextjs), [validators](https://trpc.io/docs/server/validators), [context and authorization](https://trpc.io/docs/server/authorization), [errors](https://trpc.io/docs/server/error-handling), [RSC guide](https://trpc.io/docs/client/tanstack-react-query/server-components), and [OpenAPI alpha bridge](https://trpc.io/docs/openapi).
- [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/latest.html), [OpenAPI Generator usage](https://openapi-generator.tech/docs/usage/), and [OpenAPI Generator TypeScript generator](https://openapi-generator.tech/docs/generators/typescript/).
- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html), [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html), and [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html).
- [GraphQL schema and types](https://graphql.org/learn/schema/), [schema design/evolution](https://graphql.org/learn/schema-design/), [caching](https://graphql.org/learn/caching/), [security](https://graphql.org/learn/security/), [authorization](https://graphql.org/learn/authorization/), [error handling](https://graphql.org/learn/error-handling/), and the [GraphQL specification](https://spec.graphql.org/draft/).
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [data fetching](https://nextjs.org/docs/app/getting-started/fetching-data), and [Backend for Frontend guidance](https://nextjs.org/docs/app/guides/backend-for-frontend).
- [OpenTelemetry HTTP semantic conventions](https://opentelemetry.io/docs/specs/semconv/http/).
- [Expo EAS Update](https://docs.expo.dev/eas-update/introduction/) and [Expo Updates runtime versions](https://docs.expo.dev/versions/latest/sdk/updates/).
- [Connect introduction](https://connectrpc.com/docs/introduction/), [Connect protocol](https://connectrpc.com/docs/protocol/), [Protocol Buffers overview](https://protobuf.dev/overview/), [proto3 update rules](https://protobuf.dev/programming-guides/proto3/#updating), and [Buf breaking-change detection](https://buf.build/docs/breaking/).

