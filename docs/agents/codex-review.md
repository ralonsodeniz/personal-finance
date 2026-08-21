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
- pull-request review comments, which are joined by `pull_request_review_id` to
  exactly one trusted, active parent review. The parent's full `commit_id`
  binds the comment to a head; a child comment's `commit_id` is not
  authoritative. A review comment beginning `Codex Review: Didn't find any
major issues.` is a final result; its abbreviated `Reviewed commit` line is
  optional.

The full parent `commit_id` (or current pull-request metadata for issue
comments) is authoritative. The abbreviated value in `Reviewed commit:
\`<prefix>\`` is only a consistency check against that full head. A missing,
ambiguous, malformed, or conflicting parent/comment binding is not evidence.
The generic native review envelope is not itself a PASS. When that envelope
has trusted child review comments, those child artifacts determine the result;
otherwise an active current-head review body that is not a recognized final
result, or an inline finding, is a failing review artifact.

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

The trusted-main bootstrap is complete: merged PR #53 added
`.github/workflows/codex-review.yml` to `main`, and merged PR #54 added the
parent-review-bound evaluator in `scripts/codex-review.mjs`. The previous
`MODULE_NOT_FOUND` run was a historical pre-bootstrap failure, not the current
bridge state or a native review result, and must never be represented as a
passing check.

The safe sequence is:

1. Confirm the workflow and evaluator are read from trusted `main`; never
   check out or execute pull-request code from `pull_request_target`.
2. On the current or a later pull request, post one idempotent `@codex review`
   request for the exact head and observe the native result and a successful
   bridge check.
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

## Governance decision

Parent specification [#38](https://github.com/ralonsodeniz/personal-finance/issues/38)
keeps conversational AI advisory in general. Issues
[#51](https://github.com/ralonsodeniz/personal-finance/issues/51) and
[#55](https://github.com/ralonsodeniz/personal-finance/issues/55) record the
narrow exception accepted here: the repository's native Codex compatibility
bridge is a required code-review context. The exception does not make an AI
comment an approval, replace deterministic checks, or grant release authority.
Other AI providers remain advisory.

## Workflow boundary and duplicate delivery

The supporting job is named `Recompute current Codex review state`; it is not
a second merge authority. Lifecycle and issue-comment deliveries use a
pull-request concurrency group with the supported `cancel-in-progress: false`
setting. `pull_request_review` and `pull_request_review_comment` deliveries
include their unique `github.run_id` in the group, so adjacent native-review
deliveries cannot cancel one another and leave a misleading supporting failure
in the status rollup. Before publishing, the evaluator also compares the
delivery's review/comment timestamp and ID with the fetched review surfaces;
superseded deliveries publish their verified current-state decision before
continuing through the same post-publication reconciliation before exiting
successfully. Immediately after
publishing, it re-reads the authoritative review, comment, and check-run state;
if a newer delivery changed the decision during the write window, the run
reconciles the managed check to that newer decision, and a failed re-read
publishes a current-head non-success result. This post-publication freshness
fence also verifies that the managed `Codex review` check run itself contains
the authoritative decision before accepting publication; if another delivery
overwrites it, the run republishes or fails closed. When duplicate trusted
managed copies exist for the same head, every copy must agree with that
decision; a conflict remains non-success rather than accepting one matching
copy. It prevents a delayed snapshot from remaining as a newer decision's
stale overwrite. A
reconciliation that adopts a newer snapshot then validates that snapshot
without requiring the original delivery to remain newest. A
`pull_request_review` dismissal is always recomputed even when GitHub exposes
only the dismissed review's original submission timestamp;
otherwise a later child comment could make the dismissal look superseded and
leave dismissed evidence authoritative. A `pull_request_review_comment`
deletion is treated the same way because its payload retains the deleted
comment's original timestamp; otherwise a later review artifact could make
the deletion look superseded and leave deleted PASS evidence authoritative.
A `pull_request_review_comment` edit is also always recomputed because the
payload retains the edited comment's original creation timestamp; otherwise a
later review artifact could make an edited finding look superseded and leave a
stale PASS authoritative.
A `pull_request_review` edit is also always recomputed because GitHub retains
the original review submission timestamp for edits; otherwise an edited PASS
could leave a new current-head finding hidden behind a later artifact.
Cross-surface review/comment timestamps that tie are treated as the same
generation so either delivery recomputes the full authoritative state. That
supporting run is
non-required and never becomes the stable check's conclusion or status-rollup
authority: only the managed `Codex review` check is the required context. Each
current delivery re-reads authoritative PR metadata and republishes the stable
check for that head. A delivery that loses the freshness comparison still
publishes its verified current-state decision before exiting, so a prior stable
success cannot remain authoritative while a newer finding is already visible.
The documented recovery path reruns it if a platform failure still prevents
publication.

## Review-comment assessment

Assess each review comment with `+1` when the finding is accepted/correct or
`-1` when it is rejected/not applicable, then reply with exact evidence. These
reactions are assessment telemetry only; neither reaction can authorize a
merge. The five required contexts are `Root quality gate`, `Owner approval`,
`CodeQL analysis`, `Dependency review`, and `Codex review`. The Codex context
must be bound to the trusted GitHub Actions app ID `15368`; it never grants
Owner release authorization.
