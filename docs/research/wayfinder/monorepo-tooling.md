# Monorepo orchestration and package layout

## Question

Which monorepo orchestration and package-layout strategy should organize the TypeScript applications and shared packages? The comparison requested by [GitHub issue #7](https://github.com/ralonsodeniz/personal-finance/issues/7) covers Turborepo, Nx, pnpm workspaces without an orchestrator, and other worthwhile options, including task graphs and caching, affected builds, package boundaries, developer experience, CI, remote caching, Expo, documentation, generated code, publishing, and migration cost.

**Evidence convention.** `[Source]` states a behavior documented by the project that owns it. `[Inference]` is the architectural conclusion for this repository drawn from those facts and the current bootstrap state. Links are to primary documentation, specifications, or first-party source repositories only.

## Scope and assumptions

- `[Source]` Issue #7 is open, has no comments, and asks for a strategy for TypeScript applications and shared packages. The repository currently has a root `pnpm-workspace.yaml` containing install-policy settings but no application or package directories. `[Inference]` Migration cost is therefore the cost of establishing the first layout, not moving an existing production graph.
- The target is a package-based JavaScript/TypeScript monorepo: each app or shared package owns a `package.json`, declares its dependencies, and is linked through the package manager. This is intentionally not an Nx integrated-repository decision. Nx documents that package-based repositories can retain existing package tooling and use Nx mainly for speed and task scheduling ([package-based repository guidance](https://nx.dev/docs/reference/deprecated/integrated-vs-package-based)).
- The web application is assumed to be a deployable TypeScript web app (the likely Next.js app from the surrounding issue set); the documentation site is a separately deployable app whose framework remains a follow-up. The future mobile app is assumed to be Expo/React Native and to use EAS from its own app directory.
- Shared code may include runtime code, TypeScript types/contracts, generated clients, UI, and tool configuration. Apps are deployable graph endpoints; shared packages are reusable graph inputs. `[Inference]` This keeps web, docs, and mobile from importing one another directly.
- “Affected build” means selecting only changed projects and their dependency/dependent closure for CI. It does not mean that every tool uses the same algorithm or CLI shape.
- Facts were checked against live primary documentation on 2026-08-15. Tool behavior and hosted-cache terms can change; pin versions in the eventual implementation and re-check release notes then.

## Compared options

### Summary

| Option | Task graph, caching, affected builds | Boundaries and developer experience | CI, remote cache, Expo/docs, generated code, publishing | Migration cost for this repository |
|---|---|---|---|---|
| **pnpm workspaces only** | `[Source]` pnpm discovers workspace packages, runs filtered commands, and can select changed packages plus dependencies/dependents with `--filter ...[since]`. It is a package/dependency graph, not a complete task-cache orchestrator. `[Inference]` CI must encode ordering, affected selection, output caching, and fan-out itself. | `[Source]` `workspace:` forces local resolution; pnpm’s strict linking preserves declared package dependencies. It is a small, familiar mental model, but package boundaries are mainly `package.json`, `exports`, lint, and CI policy. | `[Source]` It works with Expo’s supported pnpm workspace model and any docs framework that has a package. pnpm can pack/publish workspace packages and rewrites `workspace:` ranges, but has no built-in versioning solution. Generated tasks and artifacts require scripts plus CI conventions. | **Lowest now.** `[Inference]` It is a good bootstrap baseline, but the first additional app makes repeated CI work and hand-maintained dependency ordering more expensive. |
| **Turborepo + pnpm** | `[Source]` Turborepo builds a package graph from workspace dependencies and a task DAG from `turbo.json`; it schedules tasks, hashes inputs, restores declared outputs/logs, supports local and remote cache, filters by package/directory/Git history, and exposes `--affected`. `[Inference]` This is enough graph power for three apps and a growing set of TypeScript packages without changing each tool’s native build command. | `[Source]` It is package-based and works from existing `package.json` scripts; package names and `exports` define APIs. Turborepo has an experimental boundary configuration, but it is less prescriptive than Nx’s tag-based architectural rule system. Its commands and one root task file are easy to explain. | `[Source]` It is package-manager/framework agnostic at the orchestration layer, so Expo’s workspace/Metro support remains the relevant mobile integration and a docs app is just an application package. Code generation is supported through `turbo gen`; deterministic codegen can be a cached task when outputs are declared. Internal packages can be just-in-time, compiled, or publishable; Turborepo recommends Changesets for releases. Remote cache may be managed by Vercel or any compatible HTTP server. | **Low to medium.** `[Source]` Turborepo documents incremental adoption into an existing repository. `[Inference]` For this empty application graph, the added cost is mostly `turbo.json`, package scripts, output declarations, and CI cache credentials. |
| **Nx + pnpm** | `[Source]` Nx creates a project/task graph, can infer tasks from configuration and scripts, caches deterministic task outputs/logs, and provides `nx affected` based on Git plus the project graph. | `[Source]` Nx has first-party module-boundary enforcement through tags and ESLint, project graph visualization, generators, plugins, and a broader workspace model. `[Inference]` This is the strongest option if the repository expects many teams, strict layer rules, or repeated scaffolding; it also adds more Nx-specific concepts and configuration. | `[Source]` Nx has Expo support, remote cache through Nx Cloud or a self-hosted OpenAPI-compatible server, Nx Release for npm/private-registry publishing, and generators for consistent project creation. Expo itself still requires ordinary workspace and Metro/EAS rules; Nx does not replace them. A docs app is a normal Nx project. Nx’s 2026 documentation warns that the older S3/GCS/Azure/shared-fs cache packages are deprecated because of cache-poisoning risk; use Nx Cloud, a reviewed custom server, or no remote cache. | **Medium to high.** `[Inference]` Nx can be added package-first, but choosing plugins, tags, project conventions, and Nx Release early creates more policy and upgrade surface than the current repository needs. |
| **Rush + pnpm** | `[Source]` Rush has dependency-aware builds, incremental analysis, optional build-output cache, cloud cache, and phased builds. | `[Source]` Rush supplies a highly opinionated repository/configuration model, version policies, approved-package policies, change files, and publishing workflows. `[Inference]` That governance is valuable for a large multi-team published-package repository but is heavier than this product’s current app-first scope. | `[Source]` Rush supports pnpm, but it relocates the pnpm workspace and expects `rush-pnpm` rather than direct `pnpm` in a Rush repo. It supports cloud build cache and publishing selected public packages. Expo/docs can live as projects, but the tool does not provide the same directly documented Expo workflow as Expo plus ordinary workspaces. | **High.** `[Inference]` It would replace the current simple pnpm workspace with Rush’s `rush.json`/`common/` configuration and developer commands before the repo has the scale that justifies it. |
| **moon + pnpm** | `[Source]` moon has project/task/action graphs, affected CI tasks, smart hashing, local output caching, and remote cache via Bazel Remote Execution-compatible services or Depot. | `[Source]` It can infer JavaScript tasks from `package.json`, manage a pinned Node/pnpm toolchain, and discover package relationships. `[Inference]` The task/toolchain model is attractive for reproducibility, but it introduces another configuration language and binary alongside pnpm and the framework CLIs. | `[Source]` Its JavaScript handbook documents pnpm, React, TypeScript project references, and workspace package types; remote-cache setup is explicit. Expo and documentation apps should work as ordinary JavaScript projects, but there is less direct Expo-specific guidance than the Expo + pnpm/Turborepo or Nx paths. | **Medium.** `[Inference]` It is credible for a toolchain-centric organization, but it is not the lowest-risk default for a small TypeScript/Expo product with no existing moon conventions. |

### pnpm workspaces without an orchestrator

`[Source]` pnpm requires `pnpm-workspace.yaml`, supports exact package selectors, dependency/dependent closures, directory selectors, and Git “since” selectors ([workspace](https://pnpm.io/workspaces), [filtering](https://pnpm.io/filtering)). Its `workspace:` protocol refuses a registry fallback and is rewritten to normal semver ranges when a package is packed ([workspace protocol and publishing](https://pnpm.io/workspaces)).

`[Inference]` pnpm alone is a sound dependency layer and should remain underneath the chosen orchestrator. It is not a bad option: for the first app, `pnpm --filter` plus package scripts is transparent and has nearly zero tool adoption cost. The weakness appears when CI must coordinate `generate -> build packages -> build apps`, reuse outputs between clean runners, avoid rebuilding unaffected dependents, and keep every workflow in sync. Those are solvable with shell scripts and CI caches, but the repository would be building an orchestrator piecemeal.

### Turborepo + pnpm

`[Source]` Turborepo’s package graph comes from the package manager; its task graph is configured in `turbo.json` as a DAG, with task dependencies such as “build dependencies before build.” It caches terminal logs and declared file outputs, hashes package/global inputs, and supports local cache plus managed or self-hosted remote cache ([package/task graph](https://turborepo.dev/docs/core-concepts/package-and-task-graph), [caching](https://turborepo.dev/docs/crafting-your-repository/caching), [remote caching](https://turborepo.dev/docs/core-concepts/remote-caching)).

`[Source]` Turborepo’s CI guidance supports package filters, Git-history filters, and `--affected`; Git history must be available, so CI should not use a shallow checkout for that mode ([constructing CI](https://turborepo.dev/docs/crafting-your-repository/constructing-ci), [run reference](https://turborepo.dev/docs/reference/run)). `[Inference]` Use affected execution for pull-request validation, but keep a scheduled/full validation path because affected selection is an optimization, not proof that a repository-wide invariant can never be missed.

`[Source]` Internal packages can be just-in-time (the consumer bundles TypeScript), compiled (for example with `tsc`), or publishable. A just-in-time package has no independently cacheable build; compiled packages can have their `dist` output cached; publishable packages need stronger packaging and release configuration ([internal packages](https://turborepo.dev/docs/core-concepts/internal-packages)). `[Inference]` Use compiled packages for contracts, generated clients, and code consumed by both Node and browser/mobile toolchains; use just-in-time only where every consumer’s bundler is deliberately configured to transpile it.

`[Source]` Turborepo can generate new workspaces and run custom generators ([generate reference](https://turborepo.dev/docs/reference/generate)). `[Inference]` Model codegen as a named task with explicit inputs and outputs. If generated output is deterministic, cache it; if it depends on network state, timestamps, credentials, or an undeclared environment variable, make the task non-cacheable or include the relevant input in the cache key. This follows the cache systems’ own determinism requirements rather than assuming that “generated” automatically means safe to cache.

### Nx + pnpm

`[Source]` Nx’s affected command combines changed files from Git with its project graph, then runs requested targets only for affected projects. Nx can also inspect pnpm lockfile changes in its dependency-update handling ([affected](https://nx.dev/docs/features/ci-features/affected)). Nx caches terminal output and file artifacts locally and shares results through Nx Cloud; a custom server must implement its published OpenAPI shape ([caching](https://nx.dev/docs/getting-started/tutorials/caching), [self-hosted remote cache](https://nx.dev/docs/kb/self-hosted-caching)).

`[Source]` Nx’s module-boundary rule checks TypeScript/JavaScript imports and `package.json` dependencies, and tag constraints can express layers such as `app -> shared` while disallowing `app -> server-only` or cross-app imports ([module boundaries](https://nx.dev/docs/features/enforce-module-boundaries)). `[Inference]` Nx is the better choice if the main risk is architectural drift rather than build speed. Turborepo can enforce useful boundaries through package APIs, lint, and its experimental boundary configuration ([Turborepo boundaries](https://turborepo.dev/docs/reference/boundaries)), but Nx makes this concern a central, documented feature.

`[Source]` Nx documents Expo integration and Nx generators; it also has Nx Release for versioning, changelogs, and publishing to npm or private registries ([Expo](https://nx.dev/docs/technologies/react/expo), [manage releases](https://nx.dev/docs/features/manage-releases)). `[Inference]` These are real advantages if the repository will have many generated apps/libs or independently released packages. They are not sufficient by themselves to choose Nx because Expo’s fundamental monorepo constraints are still the workspace, Metro, dependency, and EAS rules documented by Expo.

### Rush, moon, and release-only tools

`[Source]` Rush is a serious alternative when the repository needs governed publishing, change files, version policies, and shared build infrastructure. Its build cache can be local or cloud-backed, and phased builds increase parallelism ([build cache](https://rushjs.io/pages/maintainer/build_cache/), [phased builds](https://rushjs.io/pages/maintainer/phased_builds/), [publishing](https://rushjs.io/pages/maintainer/publishing/)). Rush’s own documentation says that a pnpm-backed Rush repo uses the relocated workspace and `rush-pnpm` command ([rush-pnpm](https://rushjs.io/pages/commands/rush-pnpm/)). `[Inference]` That operational model is a migration and maintenance cost not justified by the current app-first repository.

`[Source]` moon is another capable orchestrator: its task graph determines affected CI work, its hash/output cache is local by default, and it supports remote cache services using Bazel Remote Execution APIs or Depot ([task graph](https://moonrepo.dev/docs/how-it-works/task-graph), [cache](https://moonrepo.dev/docs/concepts/cache), [remote caching](https://moonrepo.dev/docs/guides/remote-cache)). Its Node handbook documents pnpm, inferred `package.json` tasks, and TypeScript project references ([Node handbook](https://moonrepo.dev/docs/guides/javascript/node-handbook), [TypeScript example](https://moonrepo.dev/docs/guides/examples/typescript)). `[Inference]` moon is worth revisiting if reproducible toolchains or multi-language builds become first-order requirements; it is not the least-surprise choice for this TypeScript/Expo scope.

`[Source]` Changesets is a release/versioning tool, not a task orchestrator. It updates versions, changelogs, internal dependency ranges, and publishes changed packages; pnpm explicitly points to Changesets or Rush because pnpm itself has no built-in workspace versioning solution ([Changesets repository](https://github.com/changesets/changesets), [pnpm release workflow](https://pnpm.io/workspaces#release-workflow)). `[Inference]` Pair Changesets with Turborepo if public packages emerge; do not introduce Rush or Nx solely to solve release metadata.

## Recommendation

Adopt **pnpm workspaces as the package/install layer and Turborepo as the task orchestrator**, using a conventional package-based repository. Keep the package manager’s strict, explicit dependency model; put all project-specific commands in each package’s `package.json`; put only cross-package task relationships, cache inputs, outputs, and environment policy in `turbo.json`.

`[Inference]` This is the best fit because:

1. The repository has no existing app graph to migrate, so Turborepo’s incremental adoption and package-script model give useful orchestration without an integrated framework migration.
2. The target has a small number of deployable endpoints (`web`, `docs`, future `mobile`) and shared TypeScript packages. Turborepo’s package/task DAG and remote cache cover the likely CI bottlenecks.
3. Expo’s official monorepo support is defined around workspace package managers and Metro; it does not require Nx or Turborepo. The recommendation therefore keeps Expo’s supported pnpm shape and adds orchestration around it rather than coupling the mobile app to a generator-centric workspace.
4. Package boundaries can be made explicit with scoped names, `exports`, dependency declarations, TypeScript project references where useful, and lint rules. If those controls prove insufficient as the graph grows, Nx remains a credible later migration because Nx documents package-based adoption.

### Recommended target layout

```text
/
├── apps/
│   ├── web/                 # deployable TypeScript web app
│   ├── docs/                # deployable documentation app; framework decided separately
│   └── mobile/              # future Expo app; document now, create when mobile work starts
├── packages/
│   ├── contracts/           # shared domain/API types and schemas; no app imports
│   ├── generated-api/       # generated client/types, if needed; explicit generate/build tasks
│   ├── domain/              # platform-neutral finance/domain logic
│   ├── ui/                  # deliberately cross-platform UI primitives, if the design issue permits
│   ├── config-typescript/   # shared TS config package
│   ├── config-eslint/       # shared lint config package
│   └── test-utils/          # test helpers, kept out of production dependency paths
├── docs/
│   └── research/wayfinder/  # research notes, not a workspace package
├── package.json             # private workspace root, scripts, pinned packageManager
├── pnpm-workspace.yaml      # eventual apps/* and packages/* globs plus current policies
└── turbo.json               # task pipeline, inputs/outputs, environment, cache policy
```

`[Source]` Expo’s monorepo guide shows `apps/*` and `packages/*`, a root workspace file, and an Expo app under `apps`; it also says that SDK 52+ automatically configures Metro for recognized workspaces. Expo’s EAS guide says EAS commands run from the app directory and each EAS app owns its `eas.json` and credentials ([Expo monorepos](https://docs.expo.dev/guides/monorepos/), [EAS monorepos](https://docs.expo.dev/build-reference/build-with-monorepos/)). `[Inference]` Therefore `apps/mobile` is a documented future boundary, not a placeholder package that should be created in this research change.

`[Source]` Turborepo recommends application packages as the ends of the package graph and library packages as reusable support nodes ([package types](https://turborepo.dev/docs/core-concepts/package-types)). `[Inference]` Apply these rules:

- `apps/web`, `apps/docs`, and future `apps/mobile` may depend on `packages/*`; apps must not depend on another app.
- A package has one `package.json`, a scoped name such as `@personal-finance/contracts`, an explicit `exports` map, and no undeclared imports. Node’s package specification defines `exports` as the package entry-point mechanism ([Node packages](https://nodejs.org/api/packages.html#exports)).
- Use `workspace:*` for packages that are private to this repository, and set `private: true` on non-publishable packages. For a package intended for a registry, use a deliberate version/release policy and verify the packed artifact.
- Keep platform-neutral packages free of DOM, React Native, Expo, and server-only imports. If a package is platform-specific, name and tag it accordingly (`@personal-finance/ui-web`, `@personal-finance/ui-native`, or equivalent) instead of making a supposedly shared package depend on both platform stacks.
- Treat `apps/docs` as a real app node with `dev`, `generate` (if content is generated), `check-types`, `lint`, `test`, and `build` scripts. The documentation framework is an independent decision; the orchestrator only needs its package scripts and output directory.

### Task and code-generation policy

`[Inference]` Start with a small, explicit pipeline:

```text
generate -> check-types
^generate -> generate
^build    -> build
lint, test, check-types -> build/deploy gates as appropriate
dev       -> never cached
```

The exact `turbo.json` syntax should be implemented separately after each app/package exposes scripts. For every cacheable task, declare all output directories (`dist`, generated output, docs build output, test reports where useful), include relevant environment variables, and keep the task deterministic. Do not cache EAS native builds or codegen that depends on live credentials/network state unless its inputs and security model are explicitly reviewed.

`[Source]` TypeScript project references and `tsc -b` can build referenced projects in dependency order and skip up-to-date projects, while requiring composite/declaration outputs ([TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html)). `[Inference]` Use project references selectively inside compiled TypeScript packages; use Turborepo for cross-package task scheduling and cache restoration. Avoid making every app depend on a monolithic root `tsconfig`.

For generated code, keep the source-of-truth schema/template in a normal package, expose a stable generated package API, and make consumers depend on that package rather than importing generated files by relative path. Decide per generator whether generated files are committed:

- Commit generated files when they are needed by consumers before generation, are reviewed as API artifacts, or are required for offline/native tooling.
- Regenerate in CI and cache outputs when generation is deterministic and reproducible.
- Do not let a generated directory be both an input source and an output of unrelated tasks; that creates stale or poisoned cache results.

### CI and release policy

`[Inference]` CI should have these layers:

- Install once from the repository root with the pinned pnpm version and frozen lockfile.
- On pull requests, run affected `lint`, `check-types`, `test`, and package/app builds with enough Git history for affected selection; run a full graph check on a scheduled or protected branch path.
- Use remote caching after cache inputs/outputs and secrets are reviewed. The cache must never contain credentials or logs that reveal them.
- Deploy `web` and `docs` from their package filters. Run EAS commands from `apps/mobile` when that app exists, with the app’s own EAS files; use Turborepo for JavaScript preparation and dependency tasks, not as a replacement for EAS.
- Keep all packages internal by default. If public packages are introduced, add Changesets and a release CI job that builds/tests before versioning and publishing only intended packages. Never infer publishability from directory location alone.

## Tradeoffs

### Why not pnpm alone?

The benefit is minimal configuration and direct package-manager semantics. The cost is that affected selection, task ordering, task output caching, full-versus-affected policy, and remote-cache security become repository-owned scripts. `[Inference]` That trade is acceptable for a single app or a deliberately tiny workspace; issue #7 already anticipates web, docs, mobile, generated code, and shared packages, so the orchestration boundary is already real.

### Why not Nx as the default?

Nx is the strongest candidate on architectural governance, generators, graph inspection, affected execution, and release automation. Its cost is a larger framework surface, more conventions to learn, plugin/configuration choices, and a remote-cache decision that needs current security review. `[Inference]` Choose Nx instead if the next architectural decisions establish strict cross-domain layering, many generated projects, or a large multi-team workspace where those controls outweigh the lower adoption cost of Turborepo.

### What Turborepo gives up

Turborepo does not by itself define the domain architecture, ownership model, release policy, or native Expo build lifecycle. Its package boundaries are only as good as package APIs, dependency declarations, lint rules, and CI checks unless its experimental boundary configuration is deliberately adopted. Just-in-time packages trade configuration for no independently cacheable package build. Remote caching also creates a security and correctness obligation: undeclared inputs or unsafe environment handling can replay the wrong artifact.

### Why keep the layout package-based?

Package-based boundaries make the web/docs/mobile split visible in the filesystem and package manifests, keep deployables independent, and preserve the option to publish a package later. TypeScript project references can add compiler-level layering without forcing all apps into one build. `[Inference]` A single integrated source tree would lower some local configuration but would blur package ownership and make Expo/native and documentation toolchains harder to isolate.

### Why not Rush or moon now?

Rush is a good fit for a governed package publisher with substantial version-policy and change-file needs; moon is a good fit for a reproducible toolchain and potentially multi-language task graph. `[Inference]` Both are defensible later, but each adds a second operating model before this repository has an operational bottleneck that requires it. Changesets is the narrower, lower-cost answer if the immediate future need is publishing rather than orchestration.

## Unresolved follow-ups

- Confirm the actual web framework and build output directory before finalizing `turbo.json` outputs and `apps/web` package scripts.
- Decide the documentation framework and whether `apps/docs` generates content from Markdown, an API schema, or a CMS; define its `generate` inputs/outputs accordingly.
- Decide whether the future Expo app consumes compiled packages or TypeScript source directly, then validate Expo SDK, React, React Native, Metro, and pnpm `nodeLinker` behavior together. Expo documents isolated-dependency support and notes that some native libraries may still require `nodeLinker: hoisted`.
- Define the package API/boundary lint rule: at minimum explicit `exports`, no relative imports across package roots, declared dependencies, and no app-to-app dependencies. Revisit Nx if these checks become hard to maintain.
- Choose TypeScript project-reference granularity and whether declaration/build outputs are committed, generated in CI, or restored from cache.
- Select a remote-cache provider, retention policy, branch isolation/signing model, and secret/log redaction policy. Do not adopt deprecated Nx cloud-storage cache packages; review the current Nx security notice if Nx is reconsidered.
- Decide whether `packages/contracts` and `packages/generated-api` are internal-only or publishable, and adopt Changesets only when a real registry consumer exists.
- Establish full-graph nightly/protected-branch validation in addition to PR affected validation.
- Re-evaluate Turborepo versus Nx after the repository has several real apps/packages and measured CI timings; the current recommendation is an inference from a bootstrap repository, not a benchmark.

## Direct sources

### Repository and issue

- [Issue #7: Monorepo Orchestration and Package Layout](https://github.com/ralonsodeniz/personal-finance/issues/7)
- [Repository domain-documentation guidance](https://github.com/ralonsodeniz/personal-finance/blob/main/docs/agents/domain.md)

### Package management and TypeScript

- [pnpm workspaces](https://pnpm.io/workspaces)
- [pnpm filtering](https://pnpm.io/filtering)
- [pnpm publish](https://pnpm.io/cli/publish)
- [Node.js package exports](https://nodejs.org/api/packages.html#exports)
- [TypeScript project references and build mode](https://www.typescriptlang.org/docs/handbook/project-references.html)

### Turborepo

- [Package and task graphs](https://turborepo.dev/docs/core-concepts/package-and-task-graph)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Boundaries (experimental)](https://turborepo.dev/docs/reference/boundaries)
- [Constructing CI](https://turborepo.dev/docs/crafting-your-repository/constructing-ci)
- [Run reference: filters, affected execution, cache modes](https://turborepo.dev/docs/reference/run)
- [Structuring a repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [Package types](https://turborepo.dev/docs/core-concepts/package-types)
- [Internal packages](https://turborepo.dev/docs/core-concepts/internal-packages)
- [Add Turborepo to an existing repository](https://turborepo.dev/docs/getting-started/add-to-existing-repository)
- [Generating code](https://turborepo.dev/docs/reference/generate)
- [Publishing libraries](https://turborepo.dev/docs/guides/publishing-libraries)

### Nx

- [Nx affected projects](https://nx.dev/docs/features/ci-features/affected)
- [Nx caching tutorial](https://nx.dev/docs/getting-started/tutorials/caching)
- [Nx self-hosted remote cache](https://nx.dev/docs/kb/self-hosted-caching)
- [Nx module boundaries](https://nx.dev/docs/features/enforce-module-boundaries)
- [Nx package-based repository guidance](https://nx.dev/docs/reference/deprecated/integrated-vs-package-based)
- [Nx Expo integration](https://nx.dev/docs/technologies/react/expo)
- [Nx release management](https://nx.dev/docs/features/manage-releases)
- [Nx remote-cache package deprecation/security notice](https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages)

### Expo

- [Expo workspaces and monorepos](https://docs.expo.dev/guides/monorepos/)
- [Expo EAS builds in a monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/)

### Other options

- [Rush build cache](https://rushjs.io/pages/maintainer/build_cache/)
- [Rush phased builds](https://rushjs.io/pages/maintainer/phased_builds/)
- [Rush publishing](https://rushjs.io/pages/maintainer/publishing/)
- [Rush and pnpm command wrapper](https://rushjs.io/pages/commands/rush-pnpm/)
- [moon task graph](https://moonrepo.dev/docs/how-it-works/task-graph)
- [moon cache](https://moonrepo.dev/docs/concepts/cache)
- [moon remote caching](https://moonrepo.dev/docs/guides/remote-cache)
- [moon JavaScript/TypeScript handbook](https://moonrepo.dev/docs/guides/javascript/node-handbook)
- [Changesets](https://github.com/changesets/changesets)

## Date checked

**2026-08-15 (Atlantic/Canary).** Live primary documentation and the full output requested by `gh issue view 7 --comments` were checked on this date. Issue 7 had no comments at the time of review.
