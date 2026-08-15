# Testing strategy for web, backend, PWA, and React Native

Checked: 2026-08-15

## Question

What testing stack and test-boundary strategy should cover shared packages, backend behavior, Next.js web, the installable PWA, and future React Native/Expo?

The investigation compares Vitest and Jest, Testing Library variants, integration tests with a real or isolated database, API/contract tests, Playwright and alternatives for web E2E, and Detox, Maestro, or alternatives for native E2E. It evaluates speed, reliability, fixtures, authentication flows, mobile deep links, CI, coverage, and how to test shared business logic once rather than duplicating it.

## Scope and assumptions

- The repository is a TypeScript monorepo. The first product is a Next.js web application that is also an installable, mobile-first PWA. A React Native/Expo application is a future consumer, not an app to implement in this decision.
- The product has multiple authenticated users and sensitive user-owned financial data. Authorization and user isolation are therefore test requirements, not only implementation details.
- The backend transport and persistence choice are not yet final. The comparison must remain valid for a detached TypeScript backend, a Next.js backend, tRPC, PostgreSQL, or Convex.
- No application code or package manifests currently exist in this checkout. Tool versions, CI minutes, device matrix, and exact framework configuration remain to be selected during implementation.
- “Unit” means a small deterministic function or module. “Integration” means multiple real application modules working together, including database or network I/O. “E2E” means a user-visible flow through the deployed or production-like system.
- The recommendations below are an architectural inference from the cited first-party capabilities and the project constraints; they are not a claim that one tool is universally best.

## Compared options

### Test runners: Vitest and Jest

#### Vitest

Vitest provides test projects, allowing several configurations—such as Node and browser-oriented projects—to run from one configuration. Its coverage support offers V8 and Istanbul providers, with V8 as the default. Its browser mode can run tests in a real browser through Playwright or WebdriverIO providers. Sources: [Vitest getting started and test projects](https://vitest.dev/guide/), [Vitest coverage](https://vitest.dev/guide/coverage), and [Vitest browser mode](https://vitest.dev/guide/browser/).

This is a strong fit for shared TypeScript packages and a TypeScript backend: pure domain tests can stay fast, package-specific environments can be separated, and a later browser test project can be added without introducing another unit-test runner. The main caveat is that a browser-mode/component test is still not a replacement for full user-flow E2E, and Next.js/React Server Component behavior can require framework-specific setup.

#### Jest

Jest has a mature configuration and CLI model, including coverage collection, multiple named projects, sharding, watch mode, and explicit test environments. Sources: [Jest getting started](https://jestjs.io/docs/getting-started) and [Jest CLI options](https://jestjs.io/docs/cli).

Jest is the safer platform-specific choice for a future Expo app. React Native documents Jest as the default template test framework, and Expo’s current unit-testing guide uses the `jest-expo` preset to mock Expo/native pieces and configure the project. Sources: [React Native testing overview](https://reactnative.dev/docs/testing-overview) and [Expo unit testing with Jest](https://docs.expo.dev/develop/unit-testing/).

Jest’s tradeoff for this repo is an additional runner/configuration path if it is also used for web and backend packages. That duplication is justified only where Expo/native compatibility requires it; it should not force shared business logic to be tested twice.

#### Recommendation

Use **Vitest as the default runner for shared packages and backend/web JavaScript/TypeScript tests**. Use **Jest with `jest-expo` only inside the future Expo app** unless a proof of concept demonstrates that Vitest has become a first-class, low-friction Expo option for the selected SDK. Shared packages must remain runner-agnostic and be imported by both suites; their business-logic tests live once in the shared package.

This deliberately accepts two runners at the platform edges in order to avoid making the future native app fight Expo’s documented path. It still keeps one coherent default for most of the monorepo.

### Component and UI testing: Testing Library variants

React Testing Library is a UI testing library, not a test runner. Its guiding principle is to test through behavior and user-facing DOM queries rather than implementation details. Source: [React Testing Library introduction](https://testing-library.com/docs/react-testing-library/intro/).

React Native Testing Library provides the analogous user-facing queries and interactions for React Native. Expo’s guide installs it alongside Jest and `jest-expo`; Expo Router also provides `expo-router/testing-library` for in-memory router integration tests. Sources: [React Native Testing Library setup](https://testing-library.com/docs/react-native-testing-library/setup/), [Expo unit testing](https://docs.expo.dev/develop/unit-testing/), and [Expo Router testing](https://docs.expo.dev/router/reference/testing/).

Use:

- `@testing-library/react` for web client components and accessible interactions.
- `@testing-library/react-native` for future native components and navigation-adjacent integration tests.
- A small custom render utility per app for providers, authenticated test context, theme, query client, and router setup.
- Shared semantic test data and accessibility labels where the web and native experiences represent the same user action; do not force the DOM component API and native component API to be identical.

Avoid large snapshot suites. Expo explicitly recommends E2E tests over snapshot unit tests for UI. Use targeted snapshots only where a stable, shared visual contract is genuinely useful. Source: [Expo unit testing](https://docs.expo.dev/develop/unit-testing/).

### Database and backend integration tests

Pure domain rules—money arithmetic, categorization, import normalization, portfolio calculations, ownership policy decisions—should run as deterministic Vitest tests with no database or framework. This is the principal way to test business logic once.

Repository and application-service tests should use the actual persistence behavior at a smaller scale:

- If PostgreSQL is selected, run integration tests against a real PostgreSQL instance rather than an in-memory substitute. Testcontainers’ Node guide demonstrates starting a PostgreSQL container from a test, connecting with the normal client, and cleaning it up after the suite. Its stated benefit is exercising the same service type used in production and catching SQL/type behavior that mocks or alternate in-memory databases miss. Sources: [Testcontainers Node.js PostgreSQL guide](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/) and [Testcontainers PostgreSQL module](https://testcontainers.com/modules/postgresql/).
- Apply migrations to the test database before tests and use deterministic factories. Isolation must be explicit: separate database/schema or isolated data per worker, with cleanup that is safe under parallel execution. The exact reset strategy depends on the ORM and migration tool, so it remains a follow-up after the PostgreSQL/ORM decision.
- Keep the number of real-database tests focused on repository queries, constraints, migrations, authorization filters, import persistence, and transaction boundaries. Do not repeat every domain permutation through the database.

If Convex is selected, Convex documents two distinct layers: `convex-test`, a JavaScript test library used with Vitest and a mocked backend, and a local open-source Convex backend for higher-fidelity tests. The local backend runs the production backend code and enforces limits, but is more involved and has less control over time, randomness, environment variables, and external fetch mocking. Sources: [Convex testing overview](https://docs.convex.dev/testing/overview), [`convex-test`](https://docs.convex.dev/testing/convex-test), and [testing the local Convex backend](https://docs.convex.dev/testing/convex-backend).

Therefore:

- PostgreSQL path: Vitest + real PostgreSQL integration environment.
- Convex path: Vitest + `convex-test` for fast function-level tests, plus a smaller local-backend suite for behavior that depends on the real Convex runtime.
- In both paths: explicit negative authorization tests must prove that user A cannot read or mutate user B’s data, and later household/role tests must prove the permission matrix.

### API and contract tests

The test strategy should not rely only on TypeScript compilation. Type inference can prevent some client/server mismatches, but it does not prove the deployed adapter, serialization, authentication, authorization, status codes, or database effects work.

Use three layers:

1. **Shared runtime schemas and domain types.** Validate inputs and outputs at the application boundary. Keep schemas in a shared contracts package where both the server and clients can consume the safe, platform-neutral definitions.
2. **Transport-level integration tests.** Start the actual backend adapter and issue HTTP requests. Assert status, error shape, authentication, authorization, validation, pagination/import behavior, and persistence side effects. Playwright’s `APIRequestContext` is suitable for this layer and can also prepare server state for browser tests. Sources: [Playwright API testing](https://playwright.dev/docs/api-testing) and [APIRequestContext](https://playwright.dev/docs/api/class-apirequestcontext).
3. **Consumer flow tests.** Use the same API against web and, later, native clients in a small number of critical flows. Do not duplicate every backend case in every UI.

If the backend uses tRPC, its documented pattern exports only the `AppRouter` type to clients, has a vanilla client for frameworks without an official integration or a separate TypeScript backend, and has a first-class Next.js App Router integration. Sources: [tRPC routers](https://trpc.io/docs/server/routers), [tRPC Next.js integration](https://trpc.io/docs/client/nextjs), and [tRPC vanilla client](https://trpc.io/docs/client/vanilla). tRPC is a viable candidate for a TypeScript web/mobile system, but the transport-level tests must still call its HTTP adapter; inferred types are not a substitute for runtime tests. A future React Native client can use the vanilla client or a shared client package, but this should be confirmed in the backend decision ticket.

If the project needs a language-agnostic, independently documented API boundary, OpenAPI is the stronger contract artifact. The OpenAPI specification is explicitly language-agnostic and describes use cases including documentation, code generation, and testing. Source: [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/latest.html). The choice between tRPC and OpenAPI remains a backend-architecture follow-up, not a testing-stack blocker.

For frontend edge cases, use Mock Service Worker (MSW) rather than hand-mocking each HTTP client. Its first-party documentation describes client-agnostic request interception for browser and Node.js, with reusable handlers across Vitest, Playwright, and React Native-compatible environments. Source: [MSW](https://mswjs.io/). Mocks should cover latency, malformed data, authorization failures, empty states, and upstream failures; at least one real-backend path must remain in the suite so mocks cannot silently drift.

### Web and PWA E2E: Playwright, Cypress, and alternatives

Next.js documents Playwright, Cypress, Vitest, and Jest as supported testing choices. Its current App Router testing guide also says that some tools do not fully support `async` Server Components and recommends E2E testing over unit testing for those components. Therefore, test the underlying server/application functions directly where possible, and use Playwright for the behavior visible through an `async` Server Component. Source: [Next.js testing guide](https://nextjs.org/docs/app/guides/testing).

#### Playwright

Playwright Test provides isolated page/browser-context fixtures, API request fixtures, reusable and composable fixtures, and projects for browsers, device emulation, auth states, or different environments. Sources: [Playwright fixtures](https://playwright.dev/docs/test-fixtures), [projects](https://playwright.dev/docs/test-projects), and [authentication](https://playwright.dev/docs/auth).

It is the recommended web E2E tool for this project because it covers the highest-value requirements in one runner:

- Chromium, Firefox, and WebKit projects, plus mobile device emulation.
- Auth setup through API or UI and reusable `storageState`; auth files must remain ignored because they contain sensitive cookies/headers.
- API calls for seeding and postcondition checks without forcing every test through the UI.
- Fixtures for deterministic test users, seeded data, and cleanup.
- Traces and project dependencies for diagnosing CI failures.

#### Cypress

Cypress runs in the browser’s application loop and offers strong interactive debugging, component testing in a real browser, and network interception. Its own documentation also calls out the tradeoff: E2E tests need backend infrastructure, while stubbing is fast but cannot guarantee that stub payloads match the real server. Sources: [Cypress overview](https://docs.cypress.io/app/get-started/why-cypress) and [Cypress trade-offs](https://docs.cypress.io/app/references/trade-offs).

Cypress is a credible alternative if interactive component testing and its development experience become the highest priority. Its own trade-off documentation notes that Cypress tests run inside the browser, cannot control two browsers at once, and require explicit `cy.task`, `cy.exec`, or `cy.request` bridges for server/database setup. It would be a second web-specific tool if paired with Vitest and does not help with future native E2E, so it is not the default recommendation here. Sources: [Cypress overview](https://docs.cypress.io/app/get-started/why-cypress) and [Cypress trade-offs](https://docs.cypress.io/app/references/trade-offs).

#### PWA-specific coverage

Treat PWA behavior as a web concern with a few additional smoke checks:

- Fetch the manifest and assert required product-specific fields, icons, `start_url`, scope, and display mode. The Web App Manifest specification defines those metadata and launch/deep-link concepts; browser install behavior remains user-agent controlled. Source: [W3C Web App Manifest](https://www.w3.org/TR/appmanifest/).
- Run a production-like Playwright smoke test that verifies service-worker registration, cache/bootstrap behavior, and the online-first shell after a reload. Playwright can observe service-worker behavior, but its service-worker APIs are Chromium-only; run equivalent user-visible smoke checks in other browser projects without relying on Chromium internals. Source: [Playwright service workers](https://playwright.dev/docs/service-workers).
- Test installability metadata and the install UI where supported, but do not make an OS install prompt a universal deterministic CI assertion. Installation criteria and prompt behavior vary by user agent; Chrome documents that a valid manifest is necessary but not sufficient and that other browsers have different criteria. Source: [Chrome installability guidance](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest).
- Because v1 is online-first, test cached shell/assets and graceful offline read behavior separately from financial-data writes. Do not introduce offline-write synchronization tests until offline mutation is an explicit product decision.

### Future React Native/Expo tests

For Expo unit/component/integration tests, use **Jest + `jest-expo` + React Native Testing Library**, matching Expo’s current documented setup. Keep shared package tests in Vitest; import the shared code into the Expo tests only where a native integration needs to prove wiring. Expo Router’s testing library can cover in-memory navigation without building a device binary. Sources: [Expo unit testing](https://docs.expo.dev/develop/unit-testing/) and [Expo Router testing](https://docs.expo.dev/router/reference/testing/).

For native E2E:

| Option | Evidence-backed strengths | Costs / fit |
| --- | --- | --- |
| Detox | React Native-focused gray-box E2E; synchronizes with app internals to improve predictability; works with devices/simulators, has Jest integration, and documents deep-link launch/open URL APIs. Sources: [Detox getting started](https://wix.github.io/Detox/docs/introduction/getting-started/), [Detox overview](https://wix.github.io/Detox/), and [Detox deep links](https://wix.github.io/Detox/docs/19.x/api/mocking-open-with-url). | Native build/instrumentation and configuration are more involved. Validate the current Expo SDK and build workflow in a prototype before committing. |
| Maestro | YAML user-flow tests; supports opening HTTP/custom-scheme deep links; Expo documents a first-party EAS Workflows job that builds an APK/iOS simulator app and runs Maestro flows on pull requests. Sources: [Maestro flows](https://docs.maestro.dev/maestro-flows), [Maestro `openLink`](https://docs.maestro.dev/api-reference/commands/openlink), and [Expo EAS Maestro E2E](https://docs.expo.dev/eas/workflows/examples/e2e-tests/). | Black-box flow abstraction is approachable and CI-friendly, but it does not give Detox’s React Native gray-box synchronization or JS-level access. Validate debugging, fixture reset, and flake behavior for this app. |
| Appium | Broad UI automation ecosystem across mobile, browser, desktop, and other platforms; uses a WebDriver-based, language-accessible architecture. Sources: [Appium documentation](https://appium.io/) and [Appium introduction](https://appium.io/docs/en/2.2/intro/). | Broad scope and separate server/driver/client layers add setup and debugging surface. It is a fallback if cross-platform automation beyond React Native becomes important, not the first choice for this Expo app. |

The current recommendation is **Maestro as the first native E2E candidate when the Expo app exists**, because Expo provides a direct EAS workflow path and Maestro directly covers mobile user journeys and deep links. Keep **Detox as the competing prototype option** if gray-box synchronization and JavaScript integration materially improve reliability for the selected app. Do not select either permanently before a small iOS/Android proof of concept with login, authenticated data loading, one mutation, logout, and a deep link.

## Recommended test boundaries

| Boundary | Primary test style | Recommended tool/path | What must be proved |
| --- | --- | --- | --- |
| Shared domain/application packages | Fast unit and property/invariant tests | Vitest | Money/date rules, import normalization, calculations, ownership and permission decisions without React, Next.js, Expo, network, or database |
| Shared contracts | Runtime schema and type tests | Vitest; generated/type checks as appropriate | Valid/invalid payloads, serialized errors, backwards-compatible contract changes |
| Persistence/data access | Focused integration tests | Vitest + real PostgreSQL/Testcontainers, or `convex-test` plus selected local Convex tests | Queries, constraints, migrations, transactions, indexes, persistence semantics, tenant isolation |
| Backend application/API | HTTP/API integration tests | Vitest for service modules; Playwright `APIRequestContext` for the running adapter | Authentication, authorization, validation, status/error contracts, user isolation, side effects |
| Web client components | Component/integration tests | Vitest + React Testing Library + MSW | Accessible behavior, loading/error/empty states, forms, cache invalidation, mocked network edge cases |
| Next.js route/server boundary | Route/API tests and critical integration | Vitest where the runtime is practical; Playwright API/browser tests for the running app | Server/client boundary, auth cookies, redirects, serialization, RSC-visible behavior |
| Web/PWA user journeys | E2E | Playwright | Login, logout, core financial flows, cross-user denial, CSV import, responsive/mobile viewport, manifest/service worker smoke, deep links |
| Future Expo UI | Component/navigation integration | Jest + `jest-expo` + React Native Testing Library | Native rendering, interaction, providers, router states, native-module mocks |
| Future native app | Device/simulator E2E | Maestro first candidate; Detox proof-of-concept alternative | Login, data loading/mutation, logout, permissions, app relaunch, deep links, release-like builds |

The same business rule should not be re-tested at every boundary. A calculation gets exhaustive shared-package tests; the API suite verifies it is wired to persistence; one or two web/native E2E flows verify the user can reach the outcome. UI tests should assert visible behavior, not internal state or implementation details, consistent with the React Native testing guidance. Source: [React Native testing overview](https://reactnative.dev/docs/testing-overview).

## CI, fixtures, auth, and coverage policy

Recommended execution tiers:

1. **Every change:** typecheck/lint commands, Vitest shared/backend unit suites, and web component tests.
2. **Backend/database changes:** real PostgreSQL/Convex integration suites and transport/API tests.
3. **Web application changes:** Playwright smoke and critical authenticated flows; shard or use projects only when suite size justifies it.
4. **PWA/release checks:** production build, manifest/service-worker smoke, and a small browser/device matrix.
5. **Future mobile changes:** Jest/RNTL on every relevant change; Maestro or Detox E2E on mobile-specific PRs and scheduled/release workflows, subject to CI cost.

Fixtures should create isolated test users and data through a test-only setup API or direct database factories. Playwright’s documented auth-state reuse is useful, but state files must be generated in CI output or an ignored directory and never committed. Use a separate account per parallel worker whenever tests mutate server-side state; a single shared account is safe only for non-mutating tests. Source: [Playwright authentication](https://playwright.dev/docs/auth).

Coverage should be a signal, not the only quality gate:

- Set explicit thresholds first for shared domain/application code and authorization policy, where line/branch coverage is actionable.
- Track backend and contract coverage separately from UI coverage.
- Do not impose one global percentage across generated code, framework glue, route files, and platform-specific adapters.
- Require at least one real-backend critical path; do not let a high MSW-stubbed percentage hide an API contract failure.
- Record and investigate flaky E2E retries rather than treating retries as proof of reliability. Playwright and Cypress both provide retry/configuration capabilities, but retrying should surface instability, not normalize it. Sources: [Playwright projects](https://playwright.dev/docs/test-projects) and [Cypress retries](https://docs.cypress.io/app/guides/test-retries).

## Recommendation

Adopt this baseline:

- **Vitest** for shared TypeScript packages and backend/web non-E2E tests, using separate Node/browser projects only when needed.
- **React Testing Library** for web component behavior, with **React Native Testing Library** later for Expo.
- **Jest + `jest-expo`** only at the Expo application boundary unless an implementation proof of concept proves a better supported alternative.
- **MSW** for reusable network behavior and edge-case mocks; keep real transport tests as a separate layer.
- **Real PostgreSQL via Testcontainers** for persistence integration if PostgreSQL is selected; **`convex-test` plus selected local-backend tests** if Convex is selected.
- **Playwright** for web E2E, API setup/assertions, authentication-state fixtures, browser/device projects, and PWA smoke coverage.
- **Maestro** as the first native E2E candidate once the Expo app exists, with a small **Detox** comparison prototype before locking the choice. Appium remains an alternative only if broader platform automation is required.
- Keep all business rules in platform-neutral packages and test them once there. Platform suites test adapters and user-visible behavior, not duplicate domain permutations.

## Tradeoffs

- Two unit-test runners add configuration and contributor knowledge, but the split isolates Expo’s documented native toolchain from the default TypeScript toolchain and avoids duplicating shared logic tests.
- Playwright adds browser binaries and E2E infrastructure, but its browser projects, fixtures, auth state, API context, and trace-oriented workflow align well with a multi-user PWA.
- Real database tests are slower and require Docker/CI services, but they catch migration, SQL, constraint, and transaction errors that mocks cannot.
- MSW improves speed and deterministic edge-case coverage, but it can drift from the real API; the running-adapter suite is mandatory.
- Maestro is operationally attractive for Expo/EAS and user journeys, while Detox may offer better React Native-specific synchronization; the choice needs an app-level proof rather than a static preference.
- Coverage thresholds and E2E retries can create false confidence if treated as goals by themselves. Focus thresholds on risk boundaries and use flake reports to fix causes.

## Unresolved follow-ups

1. Decide PostgreSQL versus Convex and, if PostgreSQL, choose the ORM, migration tool, and test-database reset strategy.
2. Decide the backend transport: tRPC with a shared TypeScript router type, OpenAPI/HTTP, or another contract. Then define the contract-testing and client-generation policy.
3. Select the authentication provider and define deterministic test-user provisioning, email/social-login bypasses, cookie/token handling, and authorization fixtures.
4. Decide GitHub Actions versus a managed mobile CI/EAS workflow and the browser/device matrix, including macOS/iOS availability and budget.
5. Prototype the PWA service-worker strategy and specify whether offline reads, queued writes, or conflict resolution are in scope; this changes the PWA test plan materially.
6. When `apps/mobile` begins, run a small Maestro-versus-Detox proof of concept on both Android and iOS with login, authenticated data, one mutation, logout, and deep links.
7. Set initial coverage thresholds and a policy for quarantining, measuring, and fixing flaky tests.
8. Decide whether contract schemas, test factories, MSW handlers, and auth fixtures belong in dedicated shared packages or remain owned by the backend/web test contexts.

## Sources checked

All sources below are first-party documentation or specifications and were checked on 2026-08-15:

- [Vitest](https://vitest.dev/guide/), [coverage](https://vitest.dev/guide/coverage), and [browser mode](https://vitest.dev/guide/browser/)
- [Jest getting started](https://jestjs.io/docs/getting-started) and [CLI options](https://jestjs.io/docs/cli)
- [Next.js testing guide](https://nextjs.org/docs/app/guides/testing)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) and [React Native Testing Library setup](https://testing-library.com/docs/react-native-testing-library/setup/)
- [React Native testing overview](https://reactnative.dev/docs/testing-overview)
- [Expo unit testing](https://docs.expo.dev/develop/unit-testing/), [Expo Router testing](https://docs.expo.dev/router/reference/testing/), and [Expo EAS Maestro E2E](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [Playwright fixtures](https://playwright.dev/docs/test-fixtures), [projects](https://playwright.dev/docs/test-projects), [authentication](https://playwright.dev/docs/auth), [API testing](https://playwright.dev/docs/api-testing), and [service workers](https://playwright.dev/docs/service-workers)
- [Cypress overview](https://docs.cypress.io/app/get-started/why-cypress) and [trade-offs](https://docs.cypress.io/app/references/trade-offs)
- [Testcontainers Node.js PostgreSQL guide](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/) and [PostgreSQL module](https://testcontainers.com/modules/postgresql/)
- [Convex testing overview](https://docs.convex.dev/testing/overview), [`convex-test`](https://docs.convex.dev/testing/convex-test), and [local backend testing](https://docs.convex.dev/testing/convex-backend)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [tRPC routers](https://trpc.io/docs/server/routers), [Next.js integration](https://trpc.io/docs/client/nextjs), and [vanilla client](https://trpc.io/docs/client/vanilla)
- [MSW](https://mswjs.io/)
- [W3C Web App Manifest](https://www.w3.org/TR/appmanifest/) and [Chrome installability guidance](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest)
- [Detox](https://wix.github.io/Detox/), [Detox getting started](https://wix.github.io/Detox/docs/introduction/getting-started/), and [Detox deep links](https://wix.github.io/Detox/docs/19.x/api/mocking-open-with-url)
- [Maestro flows](https://docs.maestro.dev/maestro-flows) and [`openLink`](https://docs.maestro.dev/api-reference/commands/openlink)
- [Appium](https://appium.io/) and [Appium introduction](https://appium.io/docs/en/latest/intro/)
