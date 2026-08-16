# personal-finance

This repository is in the Wayfinder architecture and monorepo-bootstrap phase.
The accepted stack and implementation boundaries are recorded in the
[Wayfinder recommendation review](docs/research/wayfinder/recommendation-review.md)
and the [context map](CONTEXT-MAP.md).

## Workspace foundation

The repository is a pnpm/Turborepo workspace. Use Node.js `24.18.0` (the
version in `.node-version`) and the pinned pnpm version from `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm run workspaces
pnpm run task
```

The initial graph contains web, documentation, and shared package boundaries.
The future Expo/mobile boundary is documented in
[`docs/architecture/workspace-spine.md`](docs/architecture/workspace-spine.md)
but is not scaffolded.
