# Serwist + Next.js/Turbopack Compatibility Spike

**Date checked:** 2026-08-16
**Wayfinder ticket:** [PWA Installability and Online-First Runtime Strategy](https://github.com/ralonsodeniz/personal-finance/issues/2)
**Status:** passed for the production build path; preview deployment remains follow-up

## Question

Can the recommended custom-worker PWA approach use Serwist's Next.js/Turbopack
integration for the project, while preserving the online-first and
privacy-first cache policy in `pwa-installability.md`?

## Disposable fixture

The test used an isolated temporary Next.js App Router project. No application
source, dependency manifest, lockfile, or generated output from the fixture was
copied into the repository.

| Component | Version or configuration |
| --- | --- |
| Next.js | `16.2.0` |
| Bundler | Turbopack (the Next.js 16 default) |
| `@serwist/turbopack` | `9.5.12` |
| `serwist` | `9.5.12` |
| `esbuild` | `0.28.2`, native build enabled in the disposable fixture |
| React / React DOM | `19.2.4` |
| Worker entry | `app/sw.ts` |
| Route handler | `app/serwist/[path]/route.ts` using `createSerwistRoute` |
| Offline route | `app/~offline/page.tsx` |

The repository's existing pnpm supply-chain policies were retained. The
fixture's first dependency attempt was rejected by the existing trust policy
because of an `undici-types` trust downgrade, and a newer mature Node types
version was selected. A newer Next.js version was also rejected by the
repository's minimum-release-age policy, so the test used the mature
`16.2.0` release rather than weakening either protection.

## Results

### Type checking and production build

- `pnpm install` completed after explicitly approving the fixture's native
  build scripts for `@swc/core`, `esbuild`, and `sharp`.
- `pnpm run typecheck` passed.
- `pnpm run build` passed with `Next.js 16.2.0 (Turbopack)`.
- Serwist bundled the worker with native esbuild and generated 11 precache
  entries (`618.23 KiB` in the fixture).
- The build emitted the worker route, source map, manifest, and offline route.

### Production-server smoke test

The built application was served with the production Next.js server. All of
these responses returned HTTP 200:

| URL | Result |
| --- | --- |
| `/` | served |
| `/manifest.webmanifest` | served |
| `/serwist/sw.js` | served |
| `/serwist/sw.js.map` | served |
| `/~offline` | served |

The worker response included `Content-Type: application/javascript`,
`Service-Worker-Allowed: /`, and a long-lived immutable-build cache directive.
The generated worker contained the expected precache entry for the generic
offline route and no unresolved precache placeholder.

### Development-server caveat

The same temporary directory repeatedly produced `EMFILE: too many open
files, watch` errors from the local file-watcher environment. With Turbopack,
the development server did not provide a reliable `/serwist/sw.js` response
in that environment. With webpack development mode, the same route returned
HTTP 200 after on-demand compilation.

This does not fail the production compatibility gate, but it establishes an
implementation rule: do not require a service worker during ordinary local
development. Disable Serwist registration in development and validate the PWA
against `next build`/`next start` and deployed preview builds. This also avoids
local service-worker state making development behavior difficult to reproduce.

## Decision

Accept the PWA recommendation with this qualification:

1. Use the Serwist Turbopack integration for the Next.js web app's production
   build and the preview deployments produced from that build path.
2. Keep the custom-worker and cache policy from
   `pwa-installability.md`: precache only safe immutable assets and the
   generic offline document; keep authenticated HTML, RSC/data, sessions,
   financial APIs, and mutations network-only.
3. Disable service-worker registration in development. A local dev server is
   not a PWA acceptance environment.
4. Make the production build/preview smoke test part of the future web app
   verification workflow.
5. Keep framework-agnostic Workbox `injectManifest` as the documented fallback
   if a future Next.js/Turbopack upgrade breaks the Serwist build.

This spike does not decide the final icons, browser matrix, update prompt,
hosting atomicity, authentication behavior, or push/offline-write features.
Those remain implementation or later product decisions listed in the PWA
research note.

## Sources

- [Serwist Next.js/Turbopack guide](https://serwist.pages.dev/docs/next/turbo)
- [Serwist Next.js integration](https://serwist.pages.dev/docs/next)
- [Next.js Turbopack documentation](https://nextjs.org/docs/app/api-reference/turbopack)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
