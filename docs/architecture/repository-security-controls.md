# Repository security controls

This repository-level configuration records the live GitHub security controls
for `ralonsodeniz/personal-finance`. The settings are managed by GitHub rather
than by a repository file, so this record documents the safe verification seam
and the effective state observed for issue [#41](https://github.com/ralonsodeniz/personal-finance/issues/41),
which is part of [#38](https://github.com/ralonsodeniz/personal-finance/issues/38).

## Effective state

Verified on 2026-08-18 through authenticated `gh` commands against the public
repository and its `main` default branch:

| Control                     | Effective state | Verification evidence                                                                                                                         |
| --------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret scanning             | Enabled         | `security_and_analysis.secret_scanning.status` is `enabled`.                                                                                  |
| Push protection             | Enabled         | `security_and_analysis.secret_scanning_push_protection.status` is `enabled`.                                                                  |
| Dependabot security alerts  | Enabled         | `GET /repos/ralonsodeniz/personal-finance/vulnerability-alerts` returns HTTP 204.                                                             |
| Dependabot security updates | Enabled         | `security_and_analysis.dependabot_security_updates.status` is `enabled`; automated security fixes report `enabled: true` and `paused: false`. |

## Observed API results

The final authenticated read returned these redacted, credential-free results:

```text
gh api repos/ralonsodeniz/personal-finance --jq '{visibility,default_branch,plan,security_and_analysis}'
{"default_branch":"main","plan":null,"security_and_analysis":{"dependabot_security_updates":{"status":"enabled"},"secret_scanning":{"status":"enabled"},"secret_scanning_non_provider_patterns":{"status":"disabled"},"secret_scanning_push_protection":{"status":"enabled"},"secret_scanning_validity_checks":{"status":"disabled"}},"visibility":"public"}

gh api -i repos/ralonsodeniz/personal-finance/vulnerability-alerts
HTTP/2.0 204 No Content

gh api repos/ralonsodeniz/personal-finance/automated-security-fixes --jq '{enabled,paused}'
{"enabled":true,"paused":false}
```

The repository also exposes `secret_scanning_non_provider_patterns`, but the
authenticated API accepted an enablement request without changing its
effective value from `disabled`. The repository response reports `plan: null`
for this public repository and does not identify whether the limitation is plan
entitlement or an unsupported API mutation. This coverage is therefore
recorded as unavailable through the current API/plan surface; the enabled
provider-pattern controls must not be interpreted as non-provider coverage.

This issue intentionally does not configure CodeQL, dependency review, branch
protection, or required status checks. Parent #38 requires those protection
controls to be applied only after their workflows and stable check names have
merged and produced successful baseline runs; that work remains a separate
follow-up.

## Safe verification commands

These commands inspect configuration only and do not submit credentials,
secret-scanning fixtures, or dependency changes:

```sh
gh auth status
gh repo view ralonsodeniz/personal-finance --json nameWithOwner,url,defaultBranchRef
gh api repos/ralonsodeniz/personal-finance --jq '{visibility,default_branch,plan,security_and_analysis}'
gh api -i repos/ralonsodeniz/personal-finance/vulnerability-alerts
gh api repos/ralonsodeniz/personal-finance/automated-security-fixes --jq '{enabled,paused}'
```

No real or test credential was added to the repository, and no intentionally
vulnerable dependency was introduced to exercise these controls.
