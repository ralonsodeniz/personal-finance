# Owner approval status gate

The `Owner approval` check is the repository owner's release authorization for
pull requests targeting `main`. It is separate from code review, security
analysis, and the Root quality gate.

## Usage

After reviewing the current pull-request diff, the canonical repository owner
must add a comment whose complete body is exactly:

```text
/owner-approve
```

Leading or trailing whitespace, prose containing the command, a different
command, a bot comment, or a comment from any other identity is not accepted.
The workflow authenticates the owner by the configured login `ralonsodeniz` or
immutable GitHub user ID `28633982`; the immutable ID keeps authorization
working if the owner changes their username.

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
  --jq '.check_runs[] | select(.name == "Owner approval") | {head_sha, conclusion, output}'
```

Never use a real credential or pull-request code as a test fixture.
