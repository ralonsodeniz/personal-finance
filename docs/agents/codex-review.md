# Native Codex review status gate

The `Codex review` check is a fail-closed compatibility bridge around the
native Codex GitHub integration. It observes the native artifacts that GitHub
actually publishes and reports a stable check for the exact current
pull-request head. It is code-review evidence; `/owner-approve` remains the
repository owner's separate release authorization.

## Native trigger and artifacts

The native integration is triggered explicitly with exactly one standalone
`@codex review` issue comment for a full current head SHA. Before posting,
check whether an equivalent request already exists for that SHA; record the
request comment ID, creation time, and full SHA. After every new head, request
and record a fresh review. A reaction is an assessment signal only.

The bridge reads these trusted native surfaces:

- issue-conversation comments beginning `Codex Review: Didn't find any major
issues.` and containing a `Reviewed commit` line;
- pull-request reviews, whose full `commit_id` binds the review to a head; and
- pull-request review comments, whose full `commit_id` and
  `pull_request_review_id` identify the reviewed head and parent review. A
  review comment beginning `Codex Review: Didn't find any major issues.` is a
  final result; its full `commit_id` is authoritative and the abbreviated
  `Reviewed commit` line is optional.

The full `commit_id` or current pull-request metadata is authoritative. The
abbreviated value in `Reviewed commit: \`<prefix>\`` is only a consistency
check against that full head. A missing, ambiguous, malformed, or conflicting
binding is not evidence. The generic native review envelope is not itself a
PASS. When that envelope has trusted child review comments, those child
artifacts determine the result; otherwise an active current-head review body
that is not a recognized final result, or an inline finding, is a failing review
artifact.

The bridge trusts the observed native publisher identity
`chatgpt-codex-connector[bot]`, whose immutable GitHub user ID is `199175422`
and whose GitHub user type is `Bot`. The evaluator requires all three identity
fields exactly. The separate public `codex` profile (ID `267193182`, type
`User`) is not the native response publisher and is rejected. The resulting
check is accepted as managed only when it was published by the trusted GitHub
Actions app metadata (app ID `15368`, slug `github-actions`, and name `GitHub
Actions`).
The protection verifier separately requires the structured `Codex review`
context to bind to GitHub Actions app ID `15368`; a null or different
`app_id` is not an equivalent required check.

## Fail-closed behavior

The stable check context is `Codex review`. The workflow's supporting job is
named `Recompute current Codex review state`; it is not a second merge
authority. The published `Codex review` check is successful only when exactly
one trusted native no-major-issues result binds to the current full head and
there are no active current-head native findings. The check is non-successful
for:

- no native result, a reaction-only signal, arbitrary prose, or an unsupported
  native shape;
- a current or unbound result with a missing, malformed, ambiguous, or
  conflicting `Reviewed commit`/`commit_id` binding;
- stale-only evidence; a new head never inherits an earlier result;
- an active current-head review finding or `CHANGES_REQUESTED` review;
- a duplicate current-head result;
- a review or review comment belonging to a dismissed pull-request review; or
- unavailable, timed-out, malformed, or otherwise unverifiable GitHub API
  responses.

Stale artifacts remain in GitHub history. They are ignored only when a valid
current-head native result exists; stale-only state still fails. The evaluator
does not accept the old custom `codex-review: v1` marker, the public `codex`
user, an owner approval, or an emoji as a substitute for native evidence.

Each `gh api` response is bounded at 8 MiB before JSON parsing. Exceeding that
bound is treated as an unavailable verification and publishes a non-successful
current-head result; the workflow does not discard or partially trust an
oversized response.

Issue-comment edit/delete payloads may identify the pull request only by URL and
omit its head SHA. If the pull-request metadata lookup fails, the bridge reads
the authoritative GraphQL pull-request metadata field `headRefOid` and updates
or creates a non-successful check for that exact SHA. It does not infer the head
from a capped pull-request commits list. If no trustworthy full SHA can be
recovered, the workflow fails without claiming success.

A new commit is a new review boundary. The old result cannot authorize it. A
fresh current-head result causes its native review event or the `issue_comment`
event to recompute the gate; historical stale artifacts are never used as the
result for that new head.

## Workflow security boundary

The workflow recomputes on pull-request lifecycle events, issue-comment
create/edit/delete events, `pull_request_review` submitted/edited/dismissed
events, and `pull_request_review_comment` created/edited/deleted events. It
uses `pull_request_target` only for GitHub metadata, native review reads from
`issues/{number}/comments`, `pulls/{number}/reviews`, and
`pulls/{number}/comments`, and publishing a check. It checks out `main`
explicitly and executes only the trusted `scripts/codex-review.mjs` from that
checkout. It does not check out or execute pull-request code, install
dependencies, use `OPENAI_API_KEY`, use the API-key `codex-action`, or pass
pull-request content to a write-capable secret.

Its permissions are limited to `checks: write`, `contents: read`, `issues:
read`, and `pull-requests: read`. It does not write comments, accept reactions,
or alter the Root quality, CodeQL, Dependency review, or Owner approval gates.

## Trusted-main bootstrap boundary

The bridge support code must exist on `main` before the bridge can be treated
as a usable required context. The current PR cannot safely bootstrap itself by
checking out its own support code: that would execute PR-controlled code from
`pull_request_target`.

At the current PR #52 head, `origin/main` does not contain
`.github/workflows/codex-review.yml` or `scripts/codex-review.mjs`. The live
bridge run `32481234507` therefore failed before evaluation with
`MODULE_NOT_FOUND` for `/home/runner/work/personal-finance/personal-finance/scripts/codex-review.mjs`.
That failure is not a native review result and must not be represented as a
passing check.

The safe sequence is:

1. Merge the implementation through the existing live four-context protection
   and Owner approval path; do not use `--admin` or a bypass.
2. After merge, confirm `main` contains the workflow and support script. On a
   representative later PR, post one idempotent `@codex review` request for
   the exact head and observe the native result and a successful bridge check.
3. Only after that successful post-bootstrap baseline should an authorized
   operator add `Codex review` to live `main` protection and rerun
   `pnpm run protection:check`. This issue does not mutate the live rule.

Until that sequence is complete, a missing or failing bridge check is a
bootstrap/control-plane blocker, never an implicit pass.

## Native-integration limitation and recovery

GitHub does not expose the native Codex review as an official status API that
this repository can depend on. This bridge therefore consumes observed native
GitHub artifacts and can remain pending or failing when the integration is
unavailable, delayed, edited, dismissed, or returns an unexpected shape. A
green bridge check is not proof that an external Codex service will remain
available, and it is not a substitute for deterministic quality/security checks
or owner authorization.

When `Codex review` is pending or failing:

1. Fetch the PR's exact current full head SHA and confirm the base is `main`.
2. Find a standalone `@codex review` request for that exact SHA. Post one only
   when no equivalent request exists; record its comment ID, timestamp, and
   full SHA.
3. Wait for the trusted native bot response. Inspect the issue comment, review,
   and review-comment APIs; do not treat a reaction as PASS.
4. Confirm the no-major-issues artifact's `Reviewed commit` prefix agrees with
   the full current head, or that the review/review-comment `commit_id` equals
   it, and confirm there are no active current-head findings.
5. Let the matching native event or `issue_comment` event recompute the gate.
   If API data is unavailable or the shape is unexpected, retry; never reuse a
   prior head's check.
6. React to each review comment as an assessment (`+1` when accepted/correct,
   `-1` when rejected/not applicable) and reply with exact evidence. Neither
   action authorizes release.
7. Only after the independent deterministic checks and current Codex evidence
   are successful may the owner post the exact `/owner-approve` authorization.

No real credentials, live Codex dependency, pull-request code, or application
behavior is part of this bridge's tests.
