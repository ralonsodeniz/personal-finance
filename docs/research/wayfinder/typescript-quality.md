# Research: TypeScript Quality Toolchain for Next.js and Expo

## Question

What linting, formatting, type-checking, import/dependency hygiene, and code-quality toolchain should work now for Next.js and later for React Native/Expo?

The comparison must cover Biome, ESLint plus Prettier, ecosystem-specific plugins and configurations, TypeScript compiler checks, project references or package-level checks, React and React Native rules, accessibility, generated code, editor integration, CI performance, monorepo configuration, and future compatibility. The recommendation should avoid premature complexity without creating an upgrade trap.

GitHub ticket: [TypeScript Quality Toolchain for Next.js and Expo](https://github.com/ralonsodeniz/personal-finance/issues/6)

## Date checked

2026-08-15.

## Scope and assumptions

- The repository is a greenfield TypeScript monorepo. The first application will be a mobile-first Next.js web app/PWA; a React Native app built with Expo is a future application, not an immediate implementation target.
- Shared domain code, contracts, validation, API clients, and other platform-neutral packages should be reusable by web and future mobile apps. Web and native UI remain platform-specific.
- `apps/web`, `apps/mobile`, `apps/docs`, and `packages/*` are architectural targets, not directories that this research creates.
- The repository currently has no application source to benchmark. Performance conclusions below are based on the tools' own documented behavior and are not a substitute for a later repository benchmark.
- This ticket decides the quality-tooling direction. It does not decide the test frameworks, design system, monorepo orchestrator, backend, database, or CI provider.
- TypeScript remains the authoritative type checker. A linter can add useful semantic rules, but lint success is not a replacement for `tsc`.
- Generated output should be explicitly classified later: generated build artifacts should normally be ignored by formatting and linting, while generated public types or API clients may still need a separate type-checking policy.

## Compared options

### Option A: ESLint plus Prettier, with TypeScript checks separate

This is the most ecosystem-aligned option for the planned web-plus-Expo path.

#### ESLint and framework integrations

- ESLint's current configuration direction is the flat config format (`eslint.config.*`). The official ESLint setup documentation shows flat config as the current setup path, and the flat-config migration documentation describes it as the default configuration system from ESLint 9 onward: [ESLint getting started](https://eslint.org/docs/latest/use/getting-started) and [ESLint flat-config migration](https://eslint.org/docs/latest/extend/plugin-migration-flat-config).
- Next.js documents both ESLint and Biome as supported choices, but its ecosystem-specific rules are delivered through ESLint. The current `eslint-config-next` includes the Next, React, and React Hooks rule sets; its `typescript` entry point adds TypeScript-specific rules. Next.js 16 removed `next lint`, so linting should be invoked through the ESLint CLI rather than through a Next build command: [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint), [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), and [Next.js 16 upgrade notes](https://nextjs.org/docs/app/guides/upgrading/version-16).
- Expo's official workflow is also ESLint-based. `npx expo lint` sets up or runs ESLint with Expo-specific settings, and Expo's documentation recommends flat config from SDK 53 onward: [Expo: Using ESLint and Prettier](https://docs.expo.dev/guides/using-eslint/) and [Expo CLI lint](https://docs.expo.dev/more/expo-cli/#lint).
- The current Expo-maintained `eslint-config-expo` is intentionally a composable base. Its README describes support for JSX, TypeScript, platform-specific globals, and platform filename extensions. Its source composes TypeScript, React, React Hooks, import, and Expo rules, including Expo-specific environment-variable checks: [Expo `eslint-config-expo` README](https://github.com/expo/expo/tree/main/packages/eslint-config-expo), [Expo config source](https://raw.githubusercontent.com/expo/expo/main/packages/eslint-config-expo/default.js), [Expo TypeScript rules](https://raw.githubusercontent.com/expo/expo/main/packages/eslint-config-expo/utils/typescript.js), [Expo React rules](https://raw.githubusercontent.com/expo/expo/main/packages/eslint-config-expo/utils/react.js), and [Expo rules](https://raw.githubusercontent.com/expo/expo/main/packages/eslint-config-expo/utils/expo.js).

#### TypeScript-aware linting

`typescript-eslint` provides both syntax-only and type-aware presets. Type-aware rules ask TypeScript to analyze the project, so they are more powerful but slower. The current recommended setup uses `parserOptions.projectService: true`; the maintainers explicitly describe the build/type-information cost and recommend making an informed tradeoff: [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/) and [shared configs](https://typescript-eslint.io/users/configs/).

This makes a useful staged policy possible:

1. Start with the official Next/Expo configs and syntax-level TypeScript rules in every application.
2. Make `tsc` the required type gate immediately.
3. Add type-aware ESLint first to shared domain/server packages and then to app code once the package-specific `tsconfig` graph is stable and the performance cost is measured.

#### Accessibility and React Native rules

- For the web app, add `eslint-plugin-jsx-a11y` to the Next configuration. Its own documentation describes static JSX accessibility checks and also warns that static linting is only one part of accessibility testing: [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y).
- React Native accessibility is modeled through native props and behavior (`accessible`, `accessibilityLabel`, roles, state, hints, and platform-specific behavior), not through DOM/ARIA rules. The React Native documentation shows the API and explains that labels should be supplied for accessible elements: [React Native accessibility](https://reactnative.dev/docs/accessibility).
- `eslint-plugin-react-native` provides useful rules such as `no-raw-text`, `no-unused-styles`, and platform-component checks, but its upstream repository currently says development activity is low and that the maintainer has limited time to assess new features. It should therefore be an optional, reviewed addition rather than the foundation of the future mobile quality gate: [eslint-plugin-react-native](https://github.com/Intellicode/eslint-plugin-react-native).
- Expo's maintained config is a safer baseline for the mobile app. The React Native-specific plugin can be evaluated later against the selected Expo SDK, but it should not be assumed to be a durable first-party contract.

#### Import and dependency hygiene

`eslint-plugin-import` has a current flat-config path and provides rules for unresolved imports, duplicate imports, cycles, relative package imports, restricted paths, and related issues. It also documents a TypeScript resolver and monorepo-related settings: [eslint-plugin-import](https://github.com/import-js/eslint-plugin-import).

The first pass should use only high-signal rules, such as unresolved imports, duplicate imports, and prohibited dependency direction. `import/no-cycle` and broad ordering rules can be expensive or noisy in a growing monorepo, so they should be enabled after the package boundaries are explicit. Unused dependency/file analysis is a separate concern; [Knip](https://github.com/webpro-nl/knip) is a candidate for a later, scheduled or CI check rather than an initial lint requirement.

#### Formatting

Prettier is an opinionated formatter with support for JavaScript, JSX, TypeScript, JSON, Markdown/MDX, CSS, and related formats: [Prettier](https://prettier.io/docs/). Prettier's own guidance is to use Prettier for formatting and linters for code-quality rules, and to disable conflicting ESLint formatting rules with `eslint-config-prettier`. It specifically notes that running Prettier through `eslint-plugin-prettier` is slower and adds another layer of indirection: [Prettier vs. linters](https://prettier.io/docs/comparison) and [Prettier integrations](https://prettier.io/docs/integrating-with-linters).

The recommended workflow is therefore separate commands:

- `format`: write formatting locally.
- `format:check`: run `prettier --check` in CI.
- `lint`: run ESLint for correctness and framework rules.

#### Monorepo and CI behavior

Use a shared internal ESLint configuration package for platform-neutral rules, then keep `apps/web/eslint.config.*` and the future `apps/mobile/eslint.config.*` as thin platform compositions. Do not force a single config to pretend that browser/Next and native/Expo are the same runtime.

Use package-level scripts named consistently (`format`, `format:check`, `lint`, `typecheck`) and let the monorepo task runner schedule them. Turborepo's official documentation describes package and task graphs, parallel execution, and caching based on task inputs/outputs: [Turborepo task graph](https://turborepo.dev/docs/core-concepts/package-and-task-graph), [Turborepo task configuration](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks), [Turborepo caching](https://turborepo.dev/docs/crafting-your-repository/caching), and [Turborepo TypeScript guide](https://turborepo.dev/docs/guides/tools/typescript).

For a no-emit typecheck or lint task, cached logs are useful even when there are no file outputs. A package build that emits declarations should declare those outputs and can participate in a dependency-aware `tsc -b` or package build graph.

### Option B: Biome as formatter and linter

Biome is a serious alternative and should not be dismissed as merely a formatter.

- It provides formatting, linting, import organization, a language server, and a CI-oriented `biome ci` command. It has first-party editor integrations and documented monorepo/nested-configuration support: [Biome getting started](https://biomejs.dev/guides/getting-started/), [Biome CI](https://biomejs.dev/recipes/continuous-integration/), and [Biome big projects/monorepos](https://biomejs.dev/guides/big-projects).
- The current language-support table lists JavaScript, TypeScript, JSX, and TSX as supported for parsing, formatting, and linting. It also lists React, Next, and React Native linter domains: [Biome language support](https://biomejs.dev/internals/language-support) and [Biome linter domains](https://biomejs.dev/linter/domains/).
- Biome's current React Native domain explicitly has no recommended rules. Its Next domain has Next-specific rules, but that is a Biome rule set, not the same maintained rule set as `eslint-config-next`. This is an important distinction for a project that wants to follow both Next.js and Expo conventions.
- Biome supports GritQL linter plugins and has migration coverage for some ESLint ecosystems, including TypeScript ESLint, JSX a11y, and React. The migration is a rule translation/porting path; it is not a guarantee that arbitrary ESLint shareable configs or Expo plugins can be consumed unchanged: [Biome linter plugins](https://biomejs.dev/linter/plugins) and [Biome migration from ESLint/Prettier](https://biomejs.dev/guides/migrate-eslint-prettier/).
- Biome v2 introduced its own type-inference-based rules rather than relying on the TypeScript compiler. That can be fast and useful, but TypeScript's `tsc` check remains necessary for this project. The Biome language-support page currently lists TypeScript 5.9, so the supported TypeScript-version matrix should be checked again before adopting it as the primary toolchain: [Biome v2](https://biomejs.dev/blog/biome-v2) and [Biome language support](https://biomejs.dev/internals/language-support).

Biome is attractive for a web-only project or for a later performance-focused migration. It is not the best initial default here because the future mobile app depends on Expo's maintained ESLint configuration, and the current Biome React Native domain does not provide a recommended ruleset.

### Option C: Oxlint plus Prettier

Oxlint is another credible future candidate:

- Oxlint is a native linter for JavaScript/TypeScript with JSX/TSX support, a large built-in rule set, ESLint migration tooling, and a documented high-performance focus: [Oxlint overview](https://oxc.rs/docs/guide/usage/linter).
- Its type-aware mode is a separate path using `oxlint-tsgolint`. The current documentation says it requires TypeScript 7 or later, has incomplete rule coverage, and can use substantial memory for very large codebases: [Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware.html).
- Oxlint documents React and `jsx-a11y` compatibility, but the project still needs an Expo-specific validation pass. Its JavaScript plugin compatibility is described as alpha, so it is not a drop-in replacement for every framework-specific ESLint integration: [Oxlint plugins](https://oxc.rs/docs/guide/usage/linter/plugins) and [Oxlint editor setup](https://oxc.rs/docs/guide/usage/linter/editors.html).

Oxlint could become the fast non-type-aware front line if ESLint becomes a measurable CI bottleneck. It should not replace the first-party Next/Expo configurations before the mobile app exists and the actual rule coverage has been tested.

### Option D: Hybrid Biome/Oxlint plus ESLint

Running a fast native linter or Biome alongside ESLint can provide speed and ecosystem coverage, but it creates overlapping diagnostics, multiple suppression syntaxes, more editor configuration, and more upgrade surfaces. It is a later optimization for a measured bottleneck, not a greenfield baseline.

## Recommendation

Adopt **ESLint + Prettier + TypeScript compiler checks**, with **flat ESLint configs and per-platform composition**.

### Recommended shape

1. **TypeScript is authoritative.** Create shared TypeScript config packages when the workspace is scaffolded. Use `strict: true` as the baseline, `noEmit: true` for application checks, and `incremental: true` where the generated `.tsbuildinfo` files are controlled. TypeScript documents that `strict` enables stronger correctness guarantees, `noEmit` leaves transpilation to the framework/bundler, and `incremental` stores project-graph information for faster subsequent checks: [strict](https://www.typescriptlang.org/tsconfig/strict.html), [noEmit](https://www.typescriptlang.org/tsconfig/noEmit.html), and [incremental](https://www.typescriptlang.org/tsconfig/incremental.html).
2. **Run package-level checks.** Every app and shared package should expose a `typecheck` script. The web app should run `next typegen` before `tsc --noEmit` when route-aware types are needed; Next.js documents `next typegen` specifically for generating route types before external TypeScript validation: [Next CLI](https://nextjs.org/docs/app/api-reference/cli/next) and [Next TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript). The future Expo app should use `tsc --noEmit`; React Native documents that Babel transforms TypeScript during bundling and that `tsc` is used for type checking: [React Native TypeScript](https://reactnative.dev/docs/typescript).
3. **Use project references deliberately, not preemptively.** TypeScript project references and `tsc -b` can improve build/editor performance, enforce package separation, and build dependent projects in order. They also require composite projects, declaration output, and a policy for generated declarations. Start with one `tsconfig` per app/package plus a solution config; introduce a full reference/build graph for shared packages when emitted declarations or package boundaries require it: [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references).
4. **Use a shared, platform-neutral ESLint base package.** Put common TypeScript, import-hygiene, and project-convention rules in a package such as `packages/eslint-config`. Keep framework dependencies out of that base unless the package is explicitly intended for one platform.
5. **Compose web rules in the web app.** `apps/web/eslint.config.*` should compose the current `eslint-config-next` base or Core Web Vitals config, its TypeScript config, the shared base, and web accessibility rules. Use the ESLint CLI directly; do not depend on `next lint`.
6. **Compose native rules in the future mobile app.** `apps/mobile/eslint.config.*` should start from `eslint-config-expo/flat` and then add the shared base. Evaluate `eslint-plugin-react-native` only as an optional, pinned rule source after checking its compatibility with the chosen Expo SDK. Do not apply DOM accessibility rules to React Native code.
7. **Use Prettier separately.** Share a root Prettier configuration and ignore files, run Prettier directly in the editor and CI, and use `eslint-config-prettier` to remove conflicting formatting rules. Do not run Prettier through `eslint-plugin-prettier` unless a later constraint makes the indirection worthwhile.
8. **Run import/dependency hygiene at the package boundary.** Begin with high-signal `eslint-plugin-import` checks and explicit package dependencies. Add cycle and architectural-boundary rules only after the package graph is established. Evaluate Knip later for unused dependencies, files, and exports.
9. **Use Turborepo task names consistently.** Once apps and packages exist, expose `format:check`, `lint`, and `typecheck` in each relevant workspace and run them through Turborepo. Cache deterministic checks and emitted package builds; avoid caching persistent development tasks. This keeps the quality system compatible with the planned monorepo without making the lint configuration itself depend on Turborepo.
10. **Treat generated code explicitly.** Ignore framework/build output and generated fixtures in ESLint and Prettier. Keep generated declarations or API clients in a separately documented type-checking path. Do not silently lint or format generated files as if they were hand-authored source.

### Why this is the best initial decision

The recommendation accepts the extra configuration of ESLint plus Prettier in exchange for using the rule/configuration ecosystems that Next.js and Expo maintain today. It also preserves an easy future exit: formatting is isolated, TypeScript checks are independent, the shared ESLint package contains platform-neutral rules, and app-local flat configs make a later Biome/Oxlint experiment possible without rewriting the application architecture.

## Tradeoffs

- **More moving pieces:** ESLint, Prettier, TypeScript, and framework configs are more packages than Biome alone. The cost is explicit, but the integration boundary is easier to understand and aligns with both Next.js and Expo.
- **Typed ESLint is slower:** `typescript-eslint` documents that type-aware rules require project type information and can add a TypeScript build cost. Keep `tsc` authoritative and add typed linting where it provides clear value instead of turning every edit into a full type-aware lint.
- **Framework configs evolve:** Next.js and Expo may change rule presets or flat-config interfaces. Pin versions and upgrade each framework with its corresponding config, rather than hiding those dependencies behind a generic one-size-fits-all config.
- **`skipLibCheck` is a deliberate compromise:** TypeScript documents that it saves time but reduces type-system accuracy. Do not use it to hide errors in shared domain packages. If app-level dependency declarations require it, record the reason and revisit it during dependency upgrades: [TypeScript `skipLibCheck`](https://www.typescriptlang.org/tsconfig/skipLibCheck.html).
- **React Native static lint coverage is weaker than web DOM coverage:** Native accessibility depends heavily on platform behavior and testing with assistive technologies. The linter can catch some code patterns, but it cannot certify VoiceOver/TalkBack behavior.
- **Biome and Oxlint may be faster:** Their performance and integrated workflows are attractive. Choosing them now would trade away some first-party Next/Expo alignment and introduce a migration or compatibility layer before the repository has a measured bottleneck.
- **Monorepo config sharing needs discipline:** A shared config package should share policy, not force browser and native runtime assumptions together. Per-app configs are intentionally part of the design.

## Unresolved follow-ups

1. After scaffolding `apps/web` and the first shared packages, validate the exact versions of Next.js, React, TypeScript, ESLint, `eslint-config-next`, and `typescript-eslint` together in a minimal workspace.
2. When the mobile app is added, validate `eslint-config-expo/flat` with the chosen Expo SDK, pnpm linker mode, shared packages, and platform-specific file extensions.
3. Decide whether shared packages will emit declarations and therefore require `composite`/project-reference builds, or whether the initial workspace can use source-based package consumption with package-level `tsc --noEmit`.
4. Decide which `strict` family extensions to enable after the first domain model exists, especially `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and unused-symbol checks.
5. Decide whether typed ESLint should run for all application code or only shared/domain/server code, using measured CI and editor timings.
6. Establish the import architecture before enabling expensive `import/no-cycle` or broad dependency-boundary rules. Re-evaluate Knip once the monorepo has enough packages and entry points for its findings to be meaningful.
7. Define the generated-code policy for Next route types, API clients, database types, and any future native code generation.
8. Add a separate accessibility/testing decision covering web automated checks, React Native accessibility assertions, and manual VoiceOver/TalkBack verification.
9. Re-evaluate Biome and Oxlint after the first real CI timings and after `apps/mobile` exists. They are candidates for a measured optimization or a future migration, not rejected permanently.

## Sources

All sources below are first-party documentation or the upstream source repository for the tool being evaluated.

- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references)
- [TypeScript `strict`](https://www.typescriptlang.org/tsconfig/strict.html), [`noEmit`](https://www.typescriptlang.org/tsconfig/noEmit.html), [`incremental`](https://www.typescriptlang.org/tsconfig/incremental.html), and [`skipLibCheck`](https://www.typescriptlang.org/tsconfig/skipLibCheck.html)
- [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint), [Next.js TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript), [Next CLI/type generation](https://nextjs.org/docs/app/api-reference/cli/next), and [Next.js 16 upgrade notes](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Expo ESLint and Prettier guide](https://docs.expo.dev/guides/using-eslint/), [Expo CLI lint](https://docs.expo.dev/more/expo-cli/#lint), and [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [Expo `eslint-config-expo` source](https://github.com/expo/expo/tree/main/packages/eslint-config-expo)
- [React Native TypeScript](https://reactnative.dev/docs/typescript) and [React Native accessibility](https://reactnative.dev/docs/accessibility)
- [ESLint getting started](https://eslint.org/docs/latest/use/getting-started) and [flat-config migration](https://eslint.org/docs/latest/extend/plugin-migration-flat-config)
- [typescript-eslint quickstart](https://typescript-eslint.io/getting-started/), [typed linting](https://typescript-eslint.io/getting-started/typed-linting/), and [shared configs](https://typescript-eslint.io/users/configs/)
- [Prettier](https://prettier.io/docs/), [Prettier vs. linters](https://prettier.io/docs/comparison), and [Prettier integrations](https://prettier.io/docs/integrating-with-linters)
- [Biome language support](https://biomejs.dev/internals/language-support), [Biome linter domains](https://biomejs.dev/linter/domains/), [Biome plugins](https://biomejs.dev/linter/plugins/), [Biome monorepos](https://biomejs.dev/guides/big-projects/), and [Biome CI](https://biomejs.dev/recipes/continuous-integration/)
- [Oxlint overview](https://oxc.rs/docs/guide/usage/linter), [Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware.html), and [Oxlint plugins](https://oxc.rs/docs/guide/usage/linter/plugins)
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y), [eslint-plugin-react-native](https://github.com/Intellicode/eslint-plugin-react-native), and [eslint-plugin-import](https://github.com/import-js/eslint-plugin-import)
- [Turborepo TypeScript guide](https://turborepo.dev/docs/guides/tools/typescript), [task graph](https://turborepo.dev/docs/core-concepts/package-and-task-graph), [task configuration](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks), and [caching](https://turborepo.dev/docs/crafting-your-repository/caching)
