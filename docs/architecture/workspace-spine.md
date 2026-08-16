# Workspace spine

This repository uses pnpm as its package/install layer and Turborepo as its
task orchestrator. The root package is private; all application and shared
packages are internal until a later release decision makes a package
publishable.

## Supported toolchain

- Node.js `24.18.0` (Krypton LTS; [official release
  page](https://nodejs.org/en/download/archive/v24.18.0)) is the supported
  runtime. The exact version is pinned in `.node-version` and the root
  `package.json` declares the Node 24 range.
- pnpm `11.21.0` is pinned by the root `packageManager` field. Use a frozen
  lockfile for clean installs:

  ```text
  pnpm install --frozen-lockfile
  ```

The existing pnpm workspace security policies remain authoritative. In
particular, minimum release age, exotic-subdependency blocking, strict build
approval, and the no-downgrade trust policy must not be relaxed to make an
install pass.

## Initial graph

```text
apps/web                 deployable web application boundary (shell later)
apps/docs                deployable static documentation boundary (shell later)
packages/config-*        shared TypeScript/ESLint/Prettier/Vitest boundaries
packages/design-tokens   platform-neutral visual vocabulary boundary
packages/auth            identity/session interface boundary
packages/authorization   application-owned policy boundary
packages/contracts       versioned API/domain contract boundary
packages/generated-api   generated client/types boundary
packages/data-access     server-only persistence boundary
packages/application     shared server-side application-service boundary
packages/telemetry       provider-neutral diagnostic/analytics boundary
```

Each workspace exposes the shared `typecheck`, `lint`, `format:check`, and
`test` tasks. Turborepo runs each task after the same task in its declared
workspace dependencies, so changing shared configuration includes dependent
checks in an affected run. The root commands make the graph authoritative
without requiring framework packages, provider credentials, or local
application state:

```text
pnpm run workspaces
pnpm run task
pnpm run verify
pnpm run verify:affected
```

`verify` also runs the root TypeScript, ESLint, Prettier, and Vitest checks plus
the provider-free environment and secret-safety checks. GitHub Actions runs
the same full command and the affected command for pull requests after a
full-history checkout.

The web, documentation, framework, provider, and finance-domain implementations
belong to later tickets. These manifests establish package ownership and
dependency locations without defining financial schemas, endpoints, or runtime
behavior.

## Future Expo/mobile boundary

`apps/mobile` is intentionally documented but does not exist yet. When native
work begins, it will be an Expo/React Native application owned by its own app
directory and EAS configuration. It may consume platform-neutral packages such
as design tokens and contracts, plus explicitly native adapters; it must not
depend on `apps/web`, `apps/docs`, or server-only `data-access` code. Native
authentication will use the later Authorization Code + PKCE and secure,
rotating-refresh-credential boundary.

The Expo workspace, native dependencies, Metro configuration, native tests, and
EAS credentials are deliberately deferred. No native application or credential
is required by the workspace spine.

## Environment safety

`.env.example` contains names and local placeholders only. `.env`, `.env.*`
(except the committed example/template exceptions), credentials, private keys,
provider exports, generated build output, and local state remain ignored. The
workspace graph and its placeholder task do not load environment variables or
require real financial data.
