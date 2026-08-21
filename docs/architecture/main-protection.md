# Main branch protection

Issue [#42](https://github.com/ralonsodeniz/personal-finance/issues/42)
configures one effective GitHub branch-protection rule for the canonical
repository `ralonsodeniz/personal-finance` and its default branch `main`.
No repository ruleset applies to `main`, so the effective policy has one
control-plane source.

## Exact merge gate

A change to `main` is eligible only when all of these conditions hold:

1. The change arrives through a pull request targeting `main`; direct pushes
   are not a merge path.
2. The pull-request head is up to date with `main`.
3. These five stable check contexts are successful for the current head:
   `Root quality gate`, `Owner approval`, `CodeQL analysis`, `Dependency
review`, and `Codex review`. These are the check-run names exposed by
   GitHub; the workflow names are metadata and are not part of the required
   context.
4. Every review conversation is resolved.
5. The pull request has zero required normal human approvals for the current
   solo-maintainer phase. The separate `Owner approval` check is the explicit
   release authorization gate.
6. Administrators are subject to the same policy. No bypass actor is
   configured; the personal-repository API omits the bypass-list field when it
   is empty and rejects explicit user/team restriction arrays.
7. Force-pushes and deletion of `main` remain disabled.

The policy dismisses stale human approvals after new commits. Latest-push
approval is disabled while normal human approvals remain at zero: GitHub
enforces `require_last_push_approval` through a review record, and the Owner
approval mechanism is a status check rather than a GitHub review. Enabling it
now would block the sole-maintainer path even after the Owner check succeeds.
When a second human maintainer and a non-zero human-approval requirement are
introduced, enable latest-push approval in the same protection update and
verify an independent approval of the newest head. `require_code_owner_reviews`
is false because no CODEOWNERS policy is in scope and the owner check is not a
substitute for a future independent human reviewer.

Other AI review integrations remain advisory. The native Codex bridge is the
explicit issue #51 exception and is a required code-review context once its
control-plane activation is complete.
It is triggered by one standalone `@codex review` request for the exact head
and consumes the trusted native issue comment, review, and review-comment
artifacts. The full GitHub `commit_id` or current PR metadata binds the result;
the abbreviated `Reviewed commit` text is only a consistency check. Active
findings and reactions never grant release authorization.
Secret scanning, push protection, Dependabot security alerts/security updates,
CodeQL, dependency review, and the Owner approval workflow are configured by
the prerequisite issues and remain independent deterministic controls.

`Owner approval` is release authorization, not code review. The workflow's
internal job is named `Recompute current approval state`; that supporting job
is not an additional required context or merge authority. The required context
remains exactly `Owner approval`; `Codex review` is a separate review context
and never grants release authorization.

The verifier's exact required-context target includes `Codex review`. This issue
does not mutate live main protection: until this workflow is merged from `main`
and a successful baseline `Codex review` check is observed, live `main` may still
expose the previous four-context set. After that successful baseline, explicitly
add `Codex review` to the live branch-protection rule and rerun
`pnpm run protection:check`. The current pull request does not run that live
control-plane assertion, so the deferred mutation does not self-block this
implementation. The trusted-main bootstrap is complete: merged PR #53 added the
workflow to `main`, and merged PR #54 added the parent-review-bound evaluator.
The current bridge still checks out trusted `main` and never executes
pull-request code. Any earlier `MODULE_NOT_FOUND` run is historical bootstrap
evidence, not a current blocker or a passing Codex result.
The structured branch-protection entry for `Codex review` must also carry
`app_id: 15368` for the GitHub Actions app. A null or different publisher
binding fails the verifier; this binding is part of the same deferred
post-bootstrap control-plane update.

## Operator merge sequence

For each pull request, follow this order against the current GitHub state:

1. Review the current pull-request diff and confirm that the target branch is
   `main`.
2. Wait for all non-Owner required contexts to pass for the current head:
   `Root quality gate`, `CodeQL analysis`, `Dependency review`, and `Codex
review`.
3. Re-fetch the checks and verify the exact required-context names are
   `Root quality gate`, `Owner approval`, `CodeQL analysis`, `Dependency
review`, and `Codex review`. Confirm that the only remaining blocker is
   `Owner approval`; the supporting `Recompute current approval state` job does
   not add another required merge authority.
4. Post a comment whose complete body is exactly `/owner-approve` as the
   canonical owner.
5. Re-fetch the current head SHA, exact approval comment ID, check results, and
   pull-request merge state after the workflow recomputes authorization.
6. Merge only when all five required contexts pass for that current head and
   GitHub reports `mergeState is clean` (`mergeStateStatus: CLEAN`).

The final read-only inspection can use:

```bash
gh pr checks <number>
gh pr view <number> --json headRefOid,baseRefName,state,statusCheckRollup,mergeStateStatus
```

## Re-authorize a new head SHA

After any new commit is pushed to a pull-request branch:

1. Review the new diff and confirm that the pull request still targets `main`.
2. Wait for the `synchronize` event to publish a non-successful Owner approval
   result for the new full head SHA. An approval for the previous head is not
   reusable.
3. Wait for the non-Owner required contexts to pass, then verify the exact
   five-context set and that Owner approval is the only remaining blocker.
4. Add a comment whose complete body is exactly `/owner-approve` as the
   canonical owner `ralonsodeniz` (immutable user ID `28633982`).
5. Re-fetch the current state. Confirm that `Owner approval` is successful for
   the new head SHA and that
   the Root quality gate, CodeQL analysis, dependency review, and Codex review
   contexts are also successful, then merge only when `mergeStateStatus` is
   `CLEAN`.

When normal human approvals are later enabled, update the protection rule to
set `require_last_push_approval: true` and obtain an independent approval for
the newest head before treating the pull request as eligible. Do not use the
Owner status check as that review record.

Editing the approval comment away from the exact command or deleting it
invalidates authorization. A new exact comment is required. The workflow
executes only trusted support code checked out from `main`; it does not check
out or run pull-request code.

The detailed comment contract and security boundary are documented in
[`docs/agents/owner-approval.md`](../agents/owner-approval.md).

## Authenticated verification

The repeatable local read-only assertion is:

```bash
gh auth status
gh repo view ralonsodeniz/personal-finance --json nameWithOwner,defaultBranchRef
pnpm run protection:check
```

The script reads the branch-protection response, the required-review
subresource, and the repository ruleset inventory through authenticated `gh`
calls. It fails if the required contexts, strict up-to-date behavior, review
settings, conversation resolution, administrator enforcement, force-push or
deletion settings, or no-overlap-on-main invariant changes.

The effective state observed on 2026-08-18 was:

```text
main: protected
rulesets applying to main (including inherited): []
required_status_checks.strict: true
required_status_checks.contexts:
  - Root quality gate
  - Owner approval
  - CodeQL analysis
  - Dependency review
required_pull_request_reviews.dismiss_stale_reviews: true
required_pull_request_reviews.require_last_push_approval: false
required_pull_request_reviews.required_approving_review_count: 0
required_pull_request_reviews.require_code_owner_reviews: false
enforce_admins.enabled: true
required_conversation_resolution.enabled: true
allow_force_pushes.enabled: false
allow_deletions.enabled: false
required_pull_request_reviews.bypass_pull_request_allowances: omitted because the personal-repository API rejects user/team restriction fields; no actors are configured
```

The exact API reads used for that observation were:

```bash
gh api repos/ralonsodeniz/personal-finance/branches/main/protection
gh api repos/ralonsodeniz/personal-finance/branches/main/protection/required_pull_request_reviews
gh api 'repos/ralonsodeniz/personal-finance/rulesets?includes_parents=true&per_page=100'
gh api repos/ralonsodeniz/personal-finance/branches/main --jq '{name,protected,protection_url}'
```

The first attempted update included explicit empty `users` and `teams` bypass
arrays and failed with HTTP 422: `Only organization repositories can have
users and team restrictions`. The successful update omitted that unsupported
field. The resulting review response omitted `bypass_pull_request_allowances`,
the ruleset inventory had no entry applying to `main`, and no bypass actor was
configured. This is the exact GitHub personal-repository API limitation; it
was not hidden by weakening the required checks or administrator enforcement.

## Representative evidence boundary

The already merged prerequisite PR
[#45](https://github.com/ralonsodeniz/personal-finance/pull/45) is a safe
read-only baseline: its head `8fb6e5de81fe37e33e06e8320968c81e2bb0f3c6` has
passing CodeQL, dependency-review, and Root quality checks. It predates this
protection rule and its historical check list has no `Owner approval` result,
so it is not claimed as a post-policy merge test; under the current rule a new
head with that missing required context is ineligible.

The Owner approval event fixture tests cover the complementary non-live
demonstration: missing, stale, edited, deleted, wrong-actor, prose, bot, and
non-`main` approvals fail, while the exact canonical-owner command succeeds for
the current head. A current valid approval plus all four passing required
contexts is demonstrated by the authorized PR lifecycle for PR #46: before
approval, the Owner check was non-successful and the PR was blocked; after the
exact owner command, the current-head Owner check and all other required
contexts passed. With latest-push approval deferred for the solo-maintainer
phase, GitHub can evaluate that policy as merge-eligible without a normal human
review record.
