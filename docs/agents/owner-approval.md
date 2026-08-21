# Owner approval status gate

The `Owner approval` check is the repository owner's release authorization, not
code review. It is separate from security analysis, the Root quality gate, and
any future normal human review for pull requests targeting `main`.

## Usage

After reviewing the current pull-request diff, the canonical repository owner
must add a comment whose complete body is exactly:

```text
/owner-approve
```

Leading or trailing whitespace, prose containing the command, a different
command, a bot comment, or a comment from any other identity is not accepted.
The workflow authenticates the owner by immutable GitHub user ID `28633982`.
The configured login `ralonsodeniz` remains documentary/diagnostic only and is
never an authorization fallback: a login-only comment or a comment with a
different user ID cannot authorize. A username change for the same immutable
user ID remains valid.

The stable status-check name is `Owner approval`. It is successful only when
the current open pull request targets `main` and the current head SHA has an
exact owner approval. A `synchronize` event creates a new non-successful check
for the new SHA; a successful check from an older SHA cannot authorize it.
Creating or editing an exact owner comment can authorize the current SHA.
Editing the approval away from the exact command or deleting the last exact
approval removes authorization. Other comment changes recompute the state and
preserve a successful current-SHA authorization only while the exact approval
with the same recorded comment ID still exists; deleting a newer approval
cannot fall back to an older comment.

The workflow accepts an existing check run as managed only when the REST
payload has the expected name, current head SHA, completed `success` or
`failure` conclusion, managed output marker, and the trusted GitHub Actions
publisher identity: app ID `15368`, slug `github-actions`, and name `GitHub
Actions`. A foreign or malformed check run is ignored and cannot authorize or
be updated as the managed Owner approval result.

The workflow's internal job is named `Recompute current approval state`. It is
a supporting, non-required implementation check; it is not an additional merge
authority. The required owner context remains exactly `Owner approval`; the
separate `Codex review` context covers code-review evidence and never grants
release authorization.

## Operator merge sequence

For a pull request targeting `main`, use this order:

1. Review the current pull-request diff and confirm the target is `main`.
2. Wait for every non-Owner required context to pass for the current head:
   `Root quality gate`, `CodeQL analysis`, `Dependency review`, and `Codex
review`.
3. Re-fetch the check state and verify the exact required-context set is
   `Root quality gate`, `Owner approval`, `CodeQL analysis`, `Dependency
review`, and `Codex review`. Confirm that `Owner approval` is the only
   remaining blocker; do not count the supporting `Recompute current approval
state` job as a second required context.
4. Post a new comment whose complete body is exactly `/owner-approve`.
5. Re-fetch the current head SHA, approval comment, check runs, and pull-request
   merge state. Do not rely on a cached check result or an older head.
6. Merge only when all five required contexts pass for the current head and
   GitHub reports `mergeStateStatus: CLEAN` (the clean merge state).

For example, the final read-only state check is:

```bash
gh pr checks <number>
gh pr view <number> --json headRefOid,baseRefName,state,statusCheckRollup,mergeStateStatus
```

## Security boundary

The workflow uses `pull_request_target` so it can publish a check for a fork
pull request with the repository token. It does not execute pull-request
code. Its checkout is explicitly pinned to the canonical repository's trusted
`main` branch, credentials are not persisted, and the only executed file is
trusted support code from that checkout. It does not install dependencies,
run application commands, or evaluate event fields as shell code.

The workflow has only `checks: write`, `contents: read`, `issues: read`, and
`pull-requests: read` permissions. The write-capable token is available only to
the trusted status-publishing script, not to pull-request-controlled content.

## Safe verification

The policy seam is covered by the representative event tests:

```bash
pnpm exec vitest run tests/owner-approval.test.mjs
```

For a live pull request, inspect the stable check and its head binding with
authenticated `gh` commands:

```bash
gh pr checks <number>
gh api repos/ralonsodeniz/personal-finance/commits/<head-sha>/check-runs \
  --jq '.check_runs[] | select(.name == "Owner approval") | {head_sha, conclusion, output, app: {id, slug, name}}'
```

Never use a real credential or pull-request code as a test fixture.
