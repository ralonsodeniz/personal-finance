# Native Codex review status gate

The `Codex review` check is a fail-closed compatibility bridge around the
native Codex GitHub integration. It observes the native Codex final comment and
publishes a stable status check for the exact current pull-request head. It is
code-review evidence; `/owner-approve` remains the repository owner's separate
release authorization.

## Protocol

The root `AGENTS.md` Code Review Rules section asks native Codex to finish with
one machine-readable block at the end of its comment:

```text
<!-- codex-review: v1 -->
Reviewed head SHA: <full 40-character lowercase commit SHA>
Result: PASS
```

`Result: CHANGES_REQUESTED` is the explicit failing form. The block must name
the full current head SHA exactly. A trusted Codex comment without the block is
not evidence, and a block with missing, extra, malformed, or unsupported fields
is rejected.

The bridge trusts the observed native publisher identity
`chatgpt-codex-connector[bot]`, whose immutable GitHub user ID is `199175422`
and whose GitHub user type is `Bot`. The evaluator requires all three identity
fields exactly. The separate public `codex` profile (ID `267193182`, type
`User`) is not the native response publisher and is rejected. The resulting
check is accepted as managed only when it was published by the trusted GitHub
Actions app metadata (app ID `15368`, slug `github-actions`, and name `GitHub
Actions`).

## Fail-closed behavior

The stable check context is `Codex review`. The workflow's supporting job is
named `Recompute current Codex review state`; it is not a second merge
authority. The published `Codex review` check is successful only when exactly
one trusted, well-formed native result for the current full head says `PASS`.
The check is non-successful for:

- no result, a reaction-only signal, or a result from the owner or another user;
- a missing, malformed, unsupported, or unresolved final result;
- a stale result for an older head;
- duplicate or conflicting results for the current head;
- `CHANGES_REQUESTED`; or
- an unavailable, timed-out, or otherwise unverifiable GitHub metadata/comments
  read.

Each `gh api` response is bounded at 8 MiB before JSON parsing. Exceeding that
bound is treated as an unavailable verification and publishes a non-successful
current-head result; the workflow does not discard or partially trust an
oversized response.

A new commit is a new review boundary. The old result cannot authorize it. A
fresh current-head result causes the `issue_comment` event to recompute the
gate; historical stale comments are never used as the result for that new
head.

## Workflow security boundary

The workflow recomputes on pull-request lifecycle events and issue-comment
create/edit/delete events. It uses `pull_request_target` only to read GitHub
metadata/comments and publish a check. It checks out `main` explicitly and
executes only the trusted `scripts/codex-review.mjs` from that checkout. It
does not check out or execute pull-request code, install dependencies, use
`OPENAI_API_KEY`, use the API-key `codex-action`, or pass pull-request content
to a write-capable secret.

Its permissions are limited to `checks: write`, `contents: read`, `issues:
read`, and `pull-requests: read`. It does not write comments, accept reactions,
or alter the Root quality, CodeQL, Dependency review, or Owner approval gates.

## Branch-protection sequencing

The exact main-protection target includes `Root quality gate`, `Owner approval`,
`CodeQL analysis`, `Dependency review`, and `Codex review`. Issue #51 does not
mutate live main protection: the workflow must first be merged from `main` and
produce a successful baseline `Codex review` result. Only then should an
operator add `Codex review` to the live branch-protection rule and rerun
`pnpm run protection:check`. Until that explicit control-plane step, the live
rule may still expose its previous four-context baseline; the current pull
request does not treat that missing live context as a passing check.

## Native-integration limitation and recovery

GitHub does not expose the native Codex review as an official status API that
this repository can depend on. This bridge therefore parses the native
comment's documented final block and can remain pending or failing when the
native integration is unavailable, delayed, edited, or returns an unexpected
shape. A green bridge check is not proof that an external Codex service will
remain available, and it is not a substitute for the repository's deterministic
quality/security checks or owner authorization.

When `Codex review` is pending or failing:

1. Confirm the pull request still targets `main` and note its exact current
   full head SHA.
2. Request a fresh native review with `@codex review`; do not manufacture a
   passing comment or rely on a reaction.
3. Confirm the native comment ends with the exact protocol block for that
   current SHA and an explicit `Result: PASS`.
4. Wait for the issue-comment workflow to recompute `Codex review`. If the
   integration or GitHub metadata/comments API remains unavailable, the
   workflow publishes a non-successful gate when a verifiable current head is
   available and exits non-successful after reporting the verification error.
   An issue-comment payload may not contain a head SHA, so the workflow cannot
   safely invent one; in that case it fails the supporting run without
   refreshing a prior head-bound check. Treat that failed run as requiring a
   retry, never as a passing recomputation.

   When the issue-comment payload is the trusted native Codex comment itself,
   the workflow may use only that comment's exact protocol head line to publish
   a failure. It never derives a head from an arbitrary commenter, reaction, or
   prose comment.

5. Only after the current Codex evidence and the independent deterministic
   gates are successful should the owner post the exact `/owner-approve`
   release-authorization command.

No real credentials, live Codex dependency, pull-request code, or application
behavior is part of this bridge's tests.
