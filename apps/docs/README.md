# Documentation app

This is the standalone Docusaurus Classic documentation app. It publishes two
unversioned information spaces from one static build:

- `/developers` — implementation and architecture guidance.
- `/help` — task-oriented user help, kept separate so future product guidance
  does not inherit developer vocabulary or navigation.

Build and serve the static output from the repository root:

```bash
pnpm --filter @personal-finance/docs build
pnpm --filter @personal-finance/docs serve
```

The build writes static files to `apps/docs/build`. It does not call the web
application, a provider, a database, or a runtime API. For the later Vercel
deployment, use the repository root for installation and `apps/docs` as the
deployable app boundary; the build output directory is `build`.

`DOCS_BASE_URL` is an optional build-time setting for a deployment subpath.
`DOCS_SITE_URL` is optional for local builds; without it, the output uses a
localhost canonical URL, disables indexing, and does not generate a sitemap.
Set it to the canonical Vercel documentation URL for an indexable deployment.
The committed defaults keep local builds credential free and do not require
provider configuration.
