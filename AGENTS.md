## Agent skills

### Issue tracker

Issues live in GitHub Issues and are managed with `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a multi-context repository using root `CONTEXT-MAP.md`, system-wide `docs/adr/`, and context-scoped domain docs. See `docs/agents/domain.md`.

## Code Review Rules

Native Codex review is code-review evidence, not release authorization. For an
implementation or review-fix push, post exactly one standalone `@codex review`
request for the exact current pull-request head when no request for that SHA is
already present. Record the request comment ID, timestamp, and full head SHA;
wait for the trusted native response and repeat the request after every new
head.

The compatibility bridge consumes the native integration's actual GitHub
artifacts: a trusted issue-conversation result beginning `Codex Review: Didn't
find any major issues.` with its `Reviewed commit` line, a pull-request review,
or a pull-request review comment. GitHub's full `commit_id`/current PR metadata
is authoritative; an abbreviated `Reviewed commit` value is only a
consistency check. Active current-head findings, changes requested, dismissed
evidence, missing or malformed binding, stale-only evidence, API failure, and
ambiguous or conflicting artifacts are non-successful. A reaction is assessment
telemetry only and never approval.

Do not ask native Codex to emit an undocumented custom marker or treat arbitrary
prose, the public `codex` user, or an owner approval as a native result. The
trusted publisher is `chatgpt-codex-connector[bot]` (immutable user ID
`199175422`, GitHub type `Bot`). `/owner-approve` remains the separate human
release-authorization command.
