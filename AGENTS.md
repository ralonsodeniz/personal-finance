## Agent skills

### Issue tracker

Issues live in GitHub Issues and are managed with `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a multi-context repository using root `CONTEXT-MAP.md`, system-wide `docs/adr/`, and context-scoped domain docs. See `docs/agents/domain.md`.

## Code Review Rules

Native Codex review is code-review evidence, not release authorization. When a
native Codex review is requested, ask it to finish with exactly one
machine-readable block at the end of its comment, using the full 40-character
SHA of the commit it actually reviewed:

```text
<!-- codex-review: v1 -->
Reviewed head SHA: <full 40-character lowercase commit SHA>
Result: PASS
```

The result marker must be `PASS` or `CHANGES_REQUESTED`; an unsuccessful review
uses `Result: CHANGES_REQUESTED` in the same block. A review that cannot
provide this block for the exact current pull-request head is not a passing
review. Do not use an arbitrary comment, owner approval, prose, or a reaction
as a substitute for the native Codex result. `/owner-approve` remains the
separate human release-authorization command.
