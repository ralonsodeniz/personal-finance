# Pull-request lifecycle ownership

This repository uses one lifecycle owner per open pull request. The owner is
the delegated implementation chat together with exactly one active monitor;
the orchestrator authorizes phase transitions but does not become a second PR
operator. A worktree, branch, delegate, and monitor are recorded together.

## Ownership invariant

At every open-PR phase, maintain exactly one active lifecycle owner:

- one delegated chat owns the branch, PR review responses, fixes, checks, and
  merge sequence;
- one temporary recurring monitor observes the PR and wakes the delegated chat
  on new state; and
- no second delegate, foreground polling loop, or replacement monitor acts
  concurrently on the same PR.

The implementation handoff is not PR authorization. The orchestrator first
checks the scoped diff and complete validation, then explicitly authorizes the
same delegate to open a normal non-draft PR. The delegate keeps ownership
through review, release authorization, merge, monitor cancellation, and the
final report.

## Recovery and stop conditions

If the delegate or monitor is paused, deleted, stale, or otherwise absent while
the PR is open, inspect the existing worktree and task state before creating a
replacement. Restore or replace the monitor, confirm the delegate's ownership,
and report the lifecycle blocked until exactly one owner is active again. Do
not authorize release or merge during an ownership gap.

Pending or failing required checks, a changed head SHA, unresolved review
conversation, merge conflict, unexpected branch-protection context, or a
failed authenticated `gh` operation is a stop condition. Re-check the current
head before any later action; older Codex evidence and Owner authorization are
stale after a new commit.

## Owner authorization

`Owner approval` is release authorization, not code review. A delegated agent
may post the exact `/owner-approve` command only when the orchestrator has
explicitly delegated that release action through the authenticated Owner
session and the current five required contexts are otherwise successful. This
is delegated Owner authorization, not an independent human approval. When
independent human consent is required, stop and request it; agent access must
not be inferred as consent.

`Codex review` is separate code-review evidence. A native review request is
one standalone `@codex review` comment for the exact head, and a fresh head
requires a fresh request/result. For every review comment, react `+1` when the
finding is accepted/correct and `-1` when it is rejected/not applicable, then
reply with the evidence. The reaction is an assessment only; it is never an
approval, Owner authorization, or merge decision.

## Manual-merge reconciliation

If the Owner or another authorized actor merges the PR before the delegate's
normal lifecycle report, treat it as manual-merge reconciliation. Using the
authenticated `gh` CLI, verify the exact merged PR, merge commit, target/head
relationship, final five required contexts, review/comment and conversation
state, and any follow-up issue. Confirm the temporary monitor is cancelled or
remove its stale ownership safely. Do not close the issue or archive the
delegate until that reconciliation is complete and reported.

Use `gh` for repository and PR state, checks, comments, reactions, reviews, and
lifecycle mutations. Do not use a browser or connector fallback when the
authenticated control-plane path fails; report the exact failure and smallest
recovery action.
