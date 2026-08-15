# PWA Installability and Online-First Runtime Strategy

**Date checked:** 2026-08-15  
**Repository:** ralonsodeniz/personal-finance  
**Wayfinder ticket:** [PWA Installability and Online-First Runtime Strategy](https://github.com/ralonsodeniz/personal-finance/issues/2)

## Question

What PWA architecture should make the Next.js web app installable and mobile-first while remaining online-first initially?

The ticket asks the decision to define service-worker ownership, installability criteria, asset and route caching, update and rollback behavior, authentication/session implications, data freshness, failure states, push notifications if relevant, and the boundary for deferring offline writes and conflict resolution. It also asks for a comparison of current Next.js-compatible approaches and an implementation-ready recommendation with primary-source citations.

## Scope and assumptions

This research assumes:

- The first client is a TypeScript Next.js App Router web application in a monorepo.
- A future React Native/Expo application will consume the same backend, contracts, authentication primitives, and domain packages, but will not share the browser service worker or browser-specific UI.
- The product has multiple users and contains private financial data. A browser cache must never be treated as an authorization boundary or as the source of truth for a user's financial records.
- The first PWA release is **online-first**. It should be installable and should have a graceful offline/failure experience, but it does not need durable offline financial writes, background mutation queues, or conflict resolution.
- Production is served over HTTPS. Localhost may be used for development because secure-context specifications permit it for local development.
- The application origin and the documentation application's origin/path have not yet been finalized. The final service-worker scope must be chosen after that decision.
- The desired behavior is progressive enhancement: normal web navigation and authenticated use must continue to work if a browser does not support installation, service workers, or push.

The service-worker requirement is intentionally narrower than “make the whole application offline.” The service worker should improve installability, startup reliability, and static asset delivery without turning sensitive financial data into an implicitly persistent local database.

## Findings that affect the decision

### Installability and offline support are separate capabilities

The Web App Manifest standard defines the metadata used to describe an installable web application, including its name, icons, start URL, scope, display mode, and stable ID. It does not prescribe one universal browser installation prompt or one universal installability test. See the [Web Application Manifest specification](https://www.w3.org/TR/appmanifest/), especially the sections on scope, icons, display, start URL, and ID.

For Chrome's browser-provided install promotion, Google's current installability documentation lists HTTPS and a manifest containing a name or short name, 192px and 512px icons, a start URL, an accepted display mode, and no preference for related native applications. It also describes engagement heuristics for the beforeinstallprompt event. The same document explicitly notes that users may still install a site without meeting that particular promotion criteria. See [What does it take to be installable?](https://web.dev/articles/install-criteria).

The current Next.js PWA guide states that an install prompt does not require offline support. Therefore, the application can satisfy the installability goal before implementing offline writes. See [How to build a Progressive Web Application with Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps).

Safari's behavior is platform-specific. WebKit's Safari 26 documentation says that iOS 26 and iPadOS 26 allow every site to be added to the Home Screen and opened as a web app, with no installability requirements, while continuing to use manifest metadata when it is present. A manifest is still worthwhile because it supplies stable application metadata, icons, scope, display intent, and a future push-compatible setup across browsers. See [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

**Implication:** the acceptance criterion should be “installable and usable across the supported browser matrix,” not “the service worker is present.” The service worker is a reliability and capability layer, not the application's identity or authorization layer.

### A service worker is origin- and scope-bound

The Service Workers specification defines a registration by scope, storage key, and the associated installing, waiting, and active workers. Service workers require secure contexts, and the default scope is constrained by the path of the service-worker script unless the response supplies Service-Worker-Allowed. See the [Service Workers specification](https://www.w3.org/TR/service-workers/), including [secure contexts](https://www.w3.org/TR/service-workers/#secure-context), [registrations](https://www.w3.org/TR/service-workers/#service-worker-registration), and [path restriction](https://www.w3.org/TR/service-workers/#path-restriction).

The same specification warns that path restriction is not a hard security boundary and recommends different origins when segments need secure isolation. This matters if the web app and documentation app are ever served under one origin. A root-scoped worker could intercept both applications, and a path scope should not be used as the only isolation mechanism for private financial data.

**Implication:** the web application should own one service worker per web origin. Shared monorepo packages may expose browser-neutral contracts and utilities, but they should not own or import service-worker globals. Prefer a dedicated application origin or subdomain for the financial app if the docs application is independently deployed.

### The service-worker lifecycle makes update timing a product decision

A new worker installs alongside the current worker. It normally waits until existing clients controlled by the old worker have unloaded before activation. Workbox's lifecycle documentation explains that skipWaiting can activate a new worker sooner but can also make an old page use a new worker for later requests, which may break lazily loaded resources until the next navigation. See [A service worker's life](https://developer.chrome.com/docs/workbox/service-worker-lifecycle) and [Handling service worker updates with immediacy](https://developer.chrome.com/docs/workbox/handling-service-worker-updates).

Workbox's build documentation defaults skipWaiting to false and supports sending an explicit SKIP_WAITING message to a waiting worker. Its workbox-window documentation also exposes waiting, controlling, and activated lifecycle events. See [workbox-build](https://developer.chrome.com/docs/workbox/modules/workbox-build) and [workbox-window](https://developer.chrome.com/docs/workbox/modules/workbox-window).

**Implication:** do not unconditionally call skipWaiting in the first financial-data PWA. Detect a waiting update, tell the user that a new version is ready, and activate/reload after an explicit action at a safe point. This reduces mixed-version behavior and gives the application a place to protect unsaved form state.

## Compared options

### Option A: manifest only, no service worker initially

**Shape:** add the Next.js manifest and icons; do not register a service worker until a later ticket.

**Advantages**

- Smallest implementation and smallest attack surface.
- Meets the installability goal without pretending that financial data is available offline.
- Avoids service-worker update and cache invalidation complexity while the domain and route structure are still changing.
- Works with both the web app and the future mobile architecture because it does not leak browser-specific assumptions into shared packages.

**Disadvantages**

- No cached offline fallback page or static asset warm-up.
- No service-worker-based push handling later.
- Does not provide a useful app shell when the network is unavailable.

**Assessment:** a valid first milestone and a safe fallback if the service-worker build integration is not ready. It is not the final recommendation because the product explicitly wants a PWA and a graceful mobile/offline failure experience.

### Option B: hand-authored public/sw.js using platform APIs

**Shape:** follow the basic Next.js approach: serve a root-level service-worker script from public/sw.js, register it from a client component, and write fetch/install/activate behavior directly with the Cache API.

The current [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) explicitly demonstrates a public/sw.js service worker and a TypeScript-generated manifest. The [CacheStorage documentation](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage) describes the storage surface available to a service worker and notes that it is restricted to secure contexts.

**Advantages**

- No framework plugin.
- Easy to keep the service worker policy visible and explicit.
- Works with Next's default Turbopack because it is a separately served file.
- Suitable for a very small online-first policy: precache one generic offline document and use network-only behavior for the application.

**Disadvantages**

- Manual precache manifests, cache versioning, cleanup, routing, error handling, and update messaging.
- Next build assets are content-addressed and route behavior can change; manually maintaining their complete list is error-prone.
- TypeScript and Workbox modules need a separate worker build if the worker is not kept as plain JavaScript.
- Push, runtime caching, and future offline behavior add more hand-maintained lifecycle code.

**Assessment:** good for the smallest initial worker, especially if the first service-worker policy is deliberately minimal. It is less attractive as the long-term owner of precache and update mechanics.

### Option C: Workbox generateSW

**Shape:** configure Workbox to generate the entire worker from a configuration file.

Workbox's first-party documentation says generateSW is appropriate when precaching and simple runtime caching are enough, and specifically says not to use it when the worker needs other service-worker features or custom caching logic. See [The ways of Workbox](https://developer.chrome.com/docs/workbox/the-ways-of-workbox) and [workbox-build](https://developer.chrome.com/docs/workbox/modules/workbox-build).

**Advantages**

- Lowest configuration burden for a conventional asset cache.
- Handles build-time precache revisioning and standard strategies.
- Can be integrated through workbox-build, the CLI, or the officially supported Webpack plugin.

**Disadvantages**

- The generated worker is a poor place for the application's explicit privacy policy, custom authenticated-route exclusions, push events, and nuanced update messaging.
- It encourages treating navigation and API routes as generic cacheable resources unless the configuration is carefully constrained.
- It is less suitable once push or richer failure behavior is needed.

**Assessment:** reject as the primary shape for this application. A financial-data worker needs an intentionally owned policy, not only generated routing rules.

### Option D: Workbox or Serwist injectManifest with a custom worker

**Shape:** own the worker source; inject a build-generated precache manifest into it; use explicit runtime routes and service-worker events.

Workbox describes injectManifest as the mode for a custom worker that needs custom routing, strategies, or other platform features such as Web Push. It leaves the worker logic under application control and injects the build's precache entries into a placeholder. See [workbox-build](https://developer.chrome.com/docs/workbox/modules/workbox-build), [Precaching with Workbox](https://developer.chrome.com/docs/workbox/precaching-with-workbox), and [The ways of Workbox](https://developer.chrome.com/docs/workbox/the-ways-of-workbox).

Serwist is a first-party project documentation and source option that provides a TypeScript-oriented Workbox-compatible integration. Its [Next.js getting-started guide](https://serwist.pages.dev/docs/next/getting-started) shows app/sw.ts, a generated public/sw.js, an injected precache manifest, and an additional offline entry. The guide separates the Webpack integration from a [Turbopack quick guide](https://serwist.pages.dev/docs/next/turbo). The current Next.js PWA guide also points to Serwist for offline support and notes a Webpack requirement in its example, so the exact integration must be verified against the selected Next.js version and bundler before it is locked.

**Advantages**

- Keeps the critical privacy and routing policy in code owned by this application.
- Retains build-generated revisioning for immutable assets.
- Can add push events, update messaging, offline fallback, and telemetry without replacing the integration.
- The framework-agnostic Workbox build path provides a fallback if a Next-specific plugin is incompatible with the chosen bundler.

**Disadvantages**

- More moving pieces than a raw worker or generateSW.
- Requires an explicit build-output integration and a small compatibility test with the chosen Next.js version, Next bundler, deployment target, and monorepo task graph.
- Requires worker-specific TypeScript/Service Worker types and careful exclusion of generated output from source compilation.
- The default examples in third-party integrations may enable skipWaiting or broad navigation caching; those defaults are not appropriate for this application without review.

**Assessment:** recommended. Use a custom worker with injected precache metadata, preferably through the current Serwist Next integration if the selected Next.js/bundler combination passes the compatibility spike; otherwise use framework-agnostic Workbox injectManifest as a post-build step. Do not allow the tool choice to change the route and privacy policy below.

### Option E: framework-specific legacy PWA plugins

Packages such as older next-pwa integrations can reduce setup work, but they are not needed to establish the architecture and add another compatibility surface across Next.js versions, bundlers, and service-worker defaults. The current Next.js PWA guide points to its own manifest conventions and Serwist for offline support rather than prescribing a legacy plugin. Unless a later compatibility investigation identifies a maintained package with a clear advantage, do not select this option.

## Recommendation

Adopt a **standards-first, online-first PWA with one custom, root-scoped service worker per web origin**:

1. **Manifest:** use Next.js App Router's app/manifest.ts and MetadataRoute.Manifest. Next.js officially supports both static and generated manifests; see [manifest.json metadata files](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest). Include a stable application ID, name/short name, start URL, scope, standalone display mode, theme/background colors, and at least 192px and 512px icons. Add maskable icon variants when the icon design is ready.
2. **Service-worker ownership:** keep the source worker within apps/web and emit it as an un-hashed /sw.js at the root of the web origin. Register it only from browser code, with an explicit root scope and updateViaCache: "none" (the current Next.js PWA guide uses this registration option). Do not place the worker in a shared domain package and do not register a second worker for the same app origin.
3. **Build integration:** use a custom-worker injectManifest flow. Prefer the maintained Serwist Next/Turbopack integration that matches the chosen Next.js release after a minimal build-and-deploy spike; use Workbox's framework-agnostic injectManifest build path if bundler integration is not reliable. The policy is the important decision; the plugin is an implementation detail that must pass the spike.
4. **Caching:** precache only safe, immutable static assets and one generic offline document. Use network-only behavior for authenticated application navigation, Next RSC/data requests, Server Actions, and all financial API requests. Use cache-first only for assets that are content-addressed or otherwise explicitly versioned. Never cache a response merely because it is a successful GET.
5. **Failures:** if a navigation cannot reach the network, return the generic offline document and explain that current financial data is unavailable. Do not render previously cached balances, transactions, or user-specific HTML as if they were current. If the worker fails to install or activate, continue as a normal online web application and report the operational signal.
6. **Updates:** leave the new worker waiting by default. Show an update prompt, protect unsaved form state, activate only after user confirmation, then reload after the new worker controls the page. Version caches and deploy the worker plus the assets it references atomically.
7. **Push:** keep push out of the first PWA runtime ticket. When needed, add it to this same custom worker behind feature detection, explicit user opt-in, and a separate server-side subscription model keyed to the authenticated user and device. Push is not an installability prerequisite.
8. **Offline writes:** explicitly defer durable offline writes, background sync, local financial-data persistence, and conflict resolution. A failed mutation must be reported as not committed; the app must not show a locally queued transaction as saved.

This recommendation gives the web app a useful PWA foundation without coupling the future React Native/Expo application to service-worker semantics. The mobile application will consume the shared backend contract and can later choose its own persistence, sync, push, and native storage strategies.

## Proposed manifest and origin policy

The exact route names will be decided with the application architecture, but the manifest should follow these rules:

| Field or decision | Policy |
| --- | --- |
| name and short_name | Stable product name and concise launcher label. |
| id | Stable URL-based application identity. Do not include a user ID, account ID, timestamp, or tracking query. |
| start_url | A stable anonymous-safe entry point such as the app root or login route. The server decides whether to show login or the authenticated dashboard. |
| scope | The smallest scope covering the web app. If the app has a dedicated origin, / is simplest. |
| display | standalone is the initial target for an app-like mobile experience; test browser-specific behavior. |
| icons | At least 192px and 512px PNG icons for the Chrome install-promotion baseline, plus a maskable variant when the artwork supports it. Keep an Apple-compatible icon path as part of the web metadata strategy. |
| theme_color and background_color | Match the design system and splash/loading experience. |
| shortcuts | Defer until route semantics and authorization are stable. A shortcut must not reveal another user's or a private account's identity. |
| docs app | Prefer a separate origin/subdomain if the docs app is independently deployed. Do not depend on service-worker path scope to isolate it from the financial app. |

The manifest's ID and scope should be treated as compatibility-sensitive once users have installed the app. The W3C manifest specification describes ID as the application's unique identity and scope as its navigation scope; see [the ID member](https://www.w3.org/TR/appmanifest/#id-member) and [the scope member](https://www.w3.org/TR/appmanifest/#scope-member).

## Service-worker route and cache policy

The initial worker should be narrow and deny-by-default:

| Request class | Initial policy | Reason |
| --- | --- | --- |
| Worker script /sw.js | Network-fetched with a no-cache response policy; registration uses updateViaCache: "none" | New worker code must be discoverable without relying on a stale HTTP cache. The Next.js PWA guide demonstrates explicit no-cache headers for the worker. |
| Manifest and app icons | Network or versioned static cache as appropriate | They are application metadata and assets, not user financial data. Keep the manifest easy to update and do not hide identity changes behind an unbounded cache. |
| Content-addressed Next static assets such as /_next/static/... | Precache or cache-first with Workbox revisioning | These assets are safe to reuse when the worker and deployment preserve the referenced build. Workbox precaching handles revisioned entries and cleanup. See [workbox-precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching). |
| Generic offline document | Precache one small document containing no user data | It can explain that the network is unavailable without exposing stale balances or transactions. |
| Authenticated HTML/document navigations | Network-only; on failure, return the generic offline document | Next server-rendered output or RSC payloads may include user-specific data. Serving an old document can misrepresent freshness and complicate logout/account switching. |
| Next RSC/data/prefetch requests | Network-only initially | These responses are tied to the current application version and user/session state. The worker should not guess their cache key or freshness semantics. |
| Financial API reads | Network-only; backend responses should use Cache-Control: private, no-store unless a later decision proves a response safe to cache | Correctness and user isolation outweigh offline latency. HTTP's no-store directive is defined in [RFC 9111, section 5.2.2.5](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5). The service worker must still enforce NetworkOnly because a programmable Cache API route could otherwise store a response intentionally. |
| Auth, session, refresh, logout, and authorization endpoints | Network-only; never put responses in Cache Storage | Authentication and authorization must remain server-controlled and revocable. |
| Mutations: POST, PUT, PATCH, DELETE, Server Actions | Pass through to the network; no background queue | A failed request must not be presented as saved. Durable offline mutations need idempotency, retry, ordering, and conflict semantics that are out of scope for v1. |
| User-specific images, attachments, or exports | Network-only until a data-classification and retention decision exists | These may contain financial or identity information even when they are not JSON API responses. |
| Third-party assets | Avoid in the worker; if needed, review origin, CORS, integrity, retention, and privacy separately | A cross-origin cache entry expands the security and operational surface. |

Workbox documents the distinction between precaching and runtime caching and provides NetworkOnly, NetworkFirst, CacheFirst, and StaleWhileRevalidate strategies. See [service-worker overview](https://developer.chrome.com/docs/workbox/service-worker-overview), [caching strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview), and [workbox-strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies). The financial application should use those mechanisms selectively rather than applying a generic “cache everything” recipe.

### Why authenticated data is excluded even when the browser is single-user

The browser's storage context is not the same thing as the application's authenticated user. The Service Workers specification models registrations with a storage key, while the application has many users who can use the same origin at different times. Cache Storage therefore does not provide the application's user/household/role authorization semantics. This is an architectural inference from the storage model, not a claim that a browser cache is shared across unrelated origins.

Consequently:

- A cache match must never be used to decide whether a user is authorized.
- A logout or account switch must not depend on finding every copy of private data in every browser cache.
- A service worker must not read, persist, or manufacture access tokens.
- Server authorization must run for every financial read and mutation.
- If a future offline feature needs local financial records, it requires a separate threat-modelled storage and synchronization decision rather than expanding the current service-worker cache.

On Apple platforms, standalone web-app storage and browser storage behavior is also platform-specific. Apple's Safari web-app documentation describes separate web-app data behavior and cookie handling across versions; see [WebKit Features in Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/) and [What's new in web apps, WWDC23](https://developer.apple.com/videos/play/wwdc2023/10120/). The login flow must be tested from a freshly installed standalone app and must not assume that a browser session has transferred.

## Authentication and session behavior

The PWA does not change the authorization model:

1. The server validates the session on every protected request.
2. The first standalone launch goes to a safe route. If no valid session exists, it renders the login screen; if the session is valid, it can redirect to the user's dashboard.
3. The application uses the same secure authentication flow in a browser tab and in the installed standalone context.
4. Login, refresh, logout, session introspection, and authorization responses are network-only.
5. Logout revokes or invalidates the server session and clears application memory. Since v1 does not cache private financial responses, there is no private Cache Storage purge to rely on.
6. If an authentication provider uses redirects, its callback URL must be valid for the installed app's origin and standalone context. This belongs in the authentication decision ticket, not in the service-worker code.

The service worker may be installed before login because it is a progressive enhancement for the origin, but it must not turn the login page or an error page into a durable source of session state. A worker fetch handler should allow the browser's normal credential behavior and should not copy credentials into cache keys, IndexedDB, logs, or push payloads.

## Data freshness and user-visible states

The application manages financial data as correctness-sensitive data:

- A successful network response is the only v1 signal that a financial read is current enough to display as current.
- The UI should show a server-provided “last updated” or equivalent freshness timestamp where a delayed response could mislead the user.
- When the API fails, show a clear unavailable/stale state with retry. Do not silently substitute a Cache Storage response.
- If a mutation fails before the server confirms it, show “not saved” and preserve the user's input in memory only if the UX explicitly offers a retry. Do not show a locally persisted “saved” transaction.
- A generic offline page may be cached because it contains no account data; it should direct the user to reconnect rather than render a stale dashboard.
- On reconnection, the first successful navigation or explicit refresh should revalidate current session and authorization before showing financial data.

This is stricter than a generic news or content PWA because the cost of displaying a stale balance or silently losing a transaction is materially higher than the benefit of an offline response.

## Failure states

The first implementation should define these states and telemetry signals:

| Failure | User experience | Operational response |
| --- | --- | --- |
| Browser has no service-worker support | Normal online web app; no install/offline enhancement | Record capability only if useful; do not block the app. |
| Service-worker registration fails | Normal online web app | Record registration error without session tokens or financial payloads. |
| Worker installation fails because an asset is unavailable | Existing worker, or no worker, continues serving the app | Fail the new install rather than activating a partial precache; alert on repeated deploy failures. |
| Network unavailable on app navigation | Generic offline page or browser error page; no financial values | Provide retry/reload and reconnect messaging. |
| Network unavailable on protected API call | Explicit unavailable/stale state; no local commit | Keep mutation semantics “not confirmed” until the server responds. |
| Session expires while the app is open | Clear session-expired state and return to login after preserving only safe transient input | Revalidate server session; never satisfy the check from a cached response. |
| New service worker waiting | Non-blocking “Update available” prompt | Activate after confirmation and reload after the new worker controls the page. |
| Cache storage is evicted or unavailable | Fall back to the network; offline enhancement disappears | Treat cache as disposable acceleration, not canonical storage. |

## Update, rollout, and rollback policy

### Normal update

1. Build a new worker from the custom source and inject the new precache manifest.
2. Deploy the new worker and every immutable asset it references as one atomic release.
3. Serve /sw.js with a response policy that avoids an old HTTP cache; the current Next.js PWA guide shows Cache-Control: no-cache, no-store, must-revalidate for this route, and the client registration uses updateViaCache: "none".
4. Let the browser install the worker beside the active worker.
5. Keep it waiting by default.
6. Notify the user only when a waiting worker is ready. If the user accepts, send the explicit skip-waiting message, wait for the controlling event, and reload.
7. Clean up old versioned precaches only from the new worker's activation path, and retain an allow-list of caches owned by this app.

Workbox precaching uses revisioned entries, installs new entries before activation, and removes entries no longer present during activation; see [workbox-precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching). Its lifecycle guidance warns that old and new workers can coexist and that unprompted skipWaiting can cause mixed-version requests; see [A service worker's life](https://developer.chrome.com/docs/workbox/service-worker-lifecycle).

### Rollback

Service-worker rollback is not a remote cache purge button. The safe operational process is:

1. Stop promotion of the bad release.
2. Redeploy a known-good application build and a new worker script version together. If the active worker itself is broken, the recovery worker should be deliberately minimal and network-oriented.
3. Keep worker and asset URLs available long enough for existing clients and the recovery worker to complete their lifecycle.
4. Avoid deleting all caches indiscriminately. Cache names should be versioned and owned by the app so the recovery worker can prune only known caches.
5. Monitor registration, install, activation, fetch failures, and update-waiting counts.
6. Test the rollback with multiple open tabs and a stale installed worker before the PWA is considered production-ready.

The exact CDN/deployment atomicity mechanism is unresolved because the hosting provider has not been selected. It is a release requirement, not a reason to cache authenticated data.

## Push notifications

Push is relevant to a financial application for reminders or alerts, but it is not required for installation and should not be coupled to the first PWA runtime milestone.

The Push API associates a subscription with a service-worker registration and permits the user agent or push service to refresh or deactivate a subscription. See the [Push API specification](https://www.w3.org/TR/push-api/), especially [subscription refreshes](https://www.w3.org/TR/push-api/#subscription-refreshes), [subscription deactivation](https://www.w3.org/TR/push-api/#subscription-deactivation), and [receiving a push message](https://www.w3.org/TR/push-api/#receiving-a-push-message).

Apple's first-party documentation confirms that web push for iOS is available for Home Screen web apps from iOS/iPadOS 16.4 and describes the required flow: ask permission through a user gesture, persist the subscription on the push server for the user's account, and handle the push in a service worker. It also notes Safari-specific notification requirements. See [Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

When push is added:

- Feature-detect service workers, Push API, Notifications API, and platform support.
- Ask only after a user gesture and after explaining the value.
- Store each subscription as a user/device record on the backend, not in the service-worker cache.
- Handle subscription refresh and deactivation.
- Remove or disable the subscription when the user logs out or revokes notification permission.
- Do not put balances, account numbers, transaction descriptions, or other sensitive financial content into notification payloads. Use a generic notification and require authenticated app navigation for details.
- Use userVisibleOnly and display a user-visible notification for every subscribed push according to browser/platform requirements.
- Treat push delivery as best effort; in-app data remains authoritative.

## Boundary for deferring offline writes and conflict resolution

The v1 boundary is:

### Included now

- Installable manifest and mobile-first standalone presentation.
- A service worker as a progressive enhancement.
- Static asset revisioning and a generic offline/failure document.
- Online-only authenticated reads and mutations.
- Clear loading, stale, offline, retry, session-expired, and update-available states.
- Release-safe service-worker update and rollback procedures.
- Feature detection for unsupported browsers.

### Deferred

- Durable local storage of balances, transactions, or other private financial records.
- Offline transaction creation or editing.
- Background Sync for financial mutations.
- A local outbox or retry queue.
- Idempotency, ordering, deduplication, and reconciliation protocols for offline writes.
- Conflict resolution or multi-device merge semantics.
- Encrypted local database/key management for financial records.
- “Offline mode” that displays old financial data without an explicit stale label and user-controlled refresh.

The deferred work becomes a new decision ticket if product research shows that users need to enter data without connectivity. That ticket must compare IndexedDB/OPFS/native SQLite options, device encryption, logout/device revocation, data retention, server idempotency, sync ordering, conflict UX, and failure recovery. It should not be smuggled into the service-worker cache policy.

## Implementation-ready acceptance criteria

The future implementation ticket should be considered complete only when all of the following are true:

1. The generated manifest is served from the Next.js App Router route and contains a stable ID, start URL, scope, display mode, name, icons, and theme metadata.
2. The app is served over HTTPS and can be installed from the supported Chrome/Edge/Firefox/Safari test matrix. The test records browser/OS-specific instructions instead of assuming one prompt.
3. The app owns one root-scoped worker on its origin. Worker registration is browser-only and does not run during server rendering.
4. The worker's install step succeeds only when its safe precache entries are available.
5. The worker never stores or serves authenticated financial API responses, private HTML, RSC payloads, session responses, or mutation responses from Cache Storage.
6. Network failure produces a generic offline/failure experience without displaying stale financial values as current.
7. A new worker waits by default, produces a user-visible update signal, and reloads only after a controlled activation.
8. The deployment can roll back the worker and its referenced assets atomically, and a test covers a bad active worker with multiple open tabs.
9. Service-worker telemetry records lifecycle and error events without recording tokens, cookies, request bodies, account identifiers, balances, or transaction data.
10. A production build and a deployed preview are tested with service workers enabled. Local development may use HTTPS, but install/update behavior is not considered proven until tested against the production build.

## Tradeoffs

- **Freshness over offline convenience:** Network-only financial reads reduce the risk of stale or cross-account data, but the dashboard is unavailable without connectivity.
- **Custom worker over generated worker:** A custom worker needs more setup and tests, but it makes the privacy boundary, failure behavior, and future push behavior explicit.
- **Deferred activation over instant updates:** Waiting avoids mixed-version pages, but users may run an older version until they accept an update or close all clients.
- **One app-origin worker over many workers:** A single owner is easier to reason about, but docs and future web applications need separate origins or explicit non-overlapping scopes.
- **Build integration over hand-maintained lists:** Injected precache metadata adds build complexity, but it avoids manually tracking Next's hashed assets.
- **Progressive enhancement over hard PWA dependency:** Browsers without service-worker or install support still work online, but they do not receive the enhanced experience.

## Unresolved follow-ups

These follow-ups are now precise enough for later architecture tickets:

1. **Web origin and route boundary:** Decide whether the financial app gets a dedicated origin/subdomain and what stable path is used for the app root, login, and dashboard.
2. **Authentication transport:** Decide cookie/session versus another transport, redirect callback URLs, CSRF policy, and standalone-app behavior. Verify the chosen auth solution on iOS Home Screen web apps.
3. **Next.js and service-worker build spike:** Build the smallest App Router app with the selected Next.js version, default Turbopack, the Serwist Turbopack/Next integration, and the Workbox injectManifest fallback. Verify emitted /sw.js, root scope, precache entries, headers, preview deployment, update prompt, and rollback.
4. **Hosting/deployment atomicity:** Choose the hosting/CDN model and prove that worker and immutable assets are deployed together and that /sw.js is not served stale.
5. **Browser support matrix:** Set minimum supported versions and test install, standalone storage/session behavior, service-worker lifecycle, and push capability separately for Chrome/Edge/Firefox/Safari/iOS.
6. **Backend cache headers:** Define Cache-Control and related headers for login, session, authorization, financial APIs, exports, and static assets. Verify both HTTP caches and service-worker routes.
7. **Observability:** Choose the telemetry provider and define privacy-safe service-worker lifecycle/error events.
8. **Push decision:** Decide which alerts are valuable, whether notification content can be generic, how subscriptions map to users/devices, and how revocation/logout is handled.
9. **Offline feature decision:** Revisit only after user research demonstrates a need for offline entry; then create a separate sync and local-storage map.

## Sources checked

All sources below were checked on 2026-08-15. The source links are direct first-party specifications or documentation:

- [Web Application Manifest — W3C](https://www.w3.org/TR/appmanifest/)
- [Service Workers — W3C](https://www.w3.org/TR/service-workers/)
- [Push API — W3C](https://www.w3.org/TR/push-api/)
- [What does it take to be installable? — web.dev/Chrome Developers](https://web.dev/articles/install-criteria)
- [How to build a Progressive Web Application with Next.js — Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Manifest metadata file convention — Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)
- [Next.js 16 release notes — Next.js](https://nextjs.org/blog/next-16)
- [Version 16 upgrade guide — Next.js](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [The ways of Workbox — Chrome Developers](https://developer.chrome.com/docs/workbox/the-ways-of-workbox)
- [workbox-build — Chrome Developers](https://developer.chrome.com/docs/workbox/modules/workbox-build)
- [Precaching with Workbox — Chrome Developers](https://developer.chrome.com/docs/workbox/precaching-with-workbox)
- [Strategies for service-worker caching — Chrome Developers](https://developer.chrome.com/docs/workbox/caching-strategies-overview)
- [A service worker's life — Chrome Developers](https://developer.chrome.com/docs/workbox/service-worker-lifecycle)
- [Handling service-worker updates with immediacy — Chrome Developers](https://developer.chrome.com/docs/workbox/handling-service-worker-updates)
- [workbox-window — Chrome Developers](https://developer.chrome.com/docs/workbox/modules/workbox-window)
- [Getting started with Serwist Next — Serwist](https://serwist.pages.dev/docs/next/getting-started)
- [Turbopack guide for Serwist — Serwist](https://serwist.pages.dev/docs/next/turbo)
- [WebKit Features in Safari 26.0 — WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [WebKit Features in Safari 17.0 — WebKit](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)
- [What's new in web apps, WWDC23 — Apple Developer](https://developer.apple.com/videos/play/wwdc2023/10120/)
- [Sending web push notifications in web apps and browsers — Apple Developer](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [CacheStorage — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage)
- [HTTP Caching, RFC 9111 — IETF RFC Editor](https://www.rfc-editor.org/rfc/rfc9111.html)
