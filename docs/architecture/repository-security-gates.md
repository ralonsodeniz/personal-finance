# Repository security gates

Issue #40 adds two deterministic pull-request security checks. They inspect
repository metadata and source analysis only; neither workflow installs
dependencies or executes application code from a pull request.

## Stable check contexts

The workflow and job names are intentionally explicit. GitHub exposes the job
name as the stable required check context; the workflow name is metadata and
must not be prefixed to the context when configuring `main` protection:

| Gate              | Workflow name       | Job name            | Expected check context |
| ----------------- | ------------------- | ------------------- | ---------------------- |
| CodeQL            | `CodeQL`            | `CodeQL analysis`   | `CodeQL analysis`      |
| Dependency review | `Dependency review` | `Dependency review` | `Dependency review`    |

The existing quality check remains `Root quality gate`.

The exact protected merge policy also includes the native `Codex review`
compatibility bridge. This is the narrow issue #51/#55 exception to parent #38's
general advisory-AI policy: it is a required code-review context, not a human
approval or release authorization. The structured required-check entry must be
bound to the trusted GitHub Actions app ID `15368`, and the separate
`Owner approval` context remains the explicit release gate.

## Trigger and threshold policy

- CodeQL analyzes JavaScript and TypeScript on pull requests targeting `main`,
  pushes to `main`, and a weekly schedule. A manual dispatch is also available
  for an explicit baseline rerun.
- Dependency review runs when a pull request targeting `main` is opened,
  updated, reopened, or marked ready for review.
- Dependency review uses `fail-on-severity: high`, which blocks high and
  critical dependency findings without adding an intentionally vulnerable
  dependency to the repository.
- Both workflows grant read-only repository access by default. CodeQL receives
  only the additional `security-events: write` permission required to upload
  its analysis results. Neither workflow uses `pull_request_target`, secrets,
  or pull-request-controlled commands.
- The Codex workflow uses only `checks: write`, `contents: read`, `issues: read`,
  and `pull-requests: read`; it checks out trusted `main`, does not execute
  pull-request code, and uses `cancel-in-progress: false`. Lifecycle and
  issue-comment deliveries serialize by pull request; review and
  review-comment deliveries use their unique run IDs so adjacent native
  deliveries cannot cancel a supporting recomputation run. The evaluator
  suppresses superseded delivery snapshots before publication, preventing a
  delayed decision from overwriting a newer one. The supporting job is not the
  stable required check; only the current-head `Codex review` publication is
  authoritative.

## Baseline evidence

The clean local baseline for this implementation passed on 2026-08-18 with
Node.js `24.18.0` and pnpm `11.21.0`:

- `pnpm install --frozen-lockfile` passed with the lockfile up to date and its
  supply-chain policies satisfied.
- `pnpm run verify` passed environment, secret-safety, security-workflow,
  documentation-build, root quality, and all 56 workspace tasks.
- `GITHUB_BASE_REF=main pnpm run verify:affected` passed environment,
  secret-safety, security-workflow, and all 56 affected-workspace tasks.
- `pnpm --filter @personal-finance/web build` passed the production build.
- `pnpm run security:check` passed a synthetic severity fixture: low and
  moderate findings do not block, while high and critical findings block.

The CodeQL and dependency-review check runs themselves are GitHub control-plane
results and must be observed on the first authorized pull request before the
`main` protection rule requires them. This task deliberately does not open
that pull request.
