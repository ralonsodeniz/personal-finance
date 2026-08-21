import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "ralonsodeniz/personal-finance";
const defaultBranch = "main";
export const TRUSTED_GITHUB_ACTIONS_APP_ID = 15368;
export const REQUIRED_CONTEXTS = [
  "Root quality gate",
  "Owner approval",
  "CodeQL analysis",
  "Dependency review",
  "Codex review",
];
export const REQUIRED_CHECK_BINDINGS = [
  { context: "Codex review", app_id: TRUSTED_GITHUB_ACTIONS_APP_ID },
];

export function hasExpectedCodexReviewBinding(checks) {
  if (!Array.isArray(checks)) {
    return false;
  }

  const codexBindings = checks
    .filter((check) => check?.context === "Codex review")
    .map((check) => ({ context: check.context, app_id: check.app_id }));

  return JSON.stringify(codexBindings) === JSON.stringify(REQUIRED_CHECK_BINDINGS);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    const details = result.stderr?.trim() || `exit code ${result.status}`;
    throw new Error(`${command} ${args.join(" ")} failed: ${details}`);
  }

  return result.stdout.trim();
}

function ghJson(args) {
  const output = run("gh", ["api", ...args]);

  return output ? JSON.parse(output) : null;
}

function ghJsonPages(args) {
  const output = run("gh", ["api", "--paginate", "--slurp", ...args]);
  const pages = output ? JSON.parse(output) : [];

  return pages.flatMap((page) => (Array.isArray(page) ? page : []));
}

function verifyAuthentication() {
  run("gh", ["auth", "status"]);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}: ${JSON.stringify(actual)}`,
  );
}

function assertSameItems(actual, expected, message) {
  assert(Array.isArray(actual), `${message}: expected an array`);
  assertEqual([...actual].sort(), [...expected].sort(), message);
}

function emptyBypassAllowances(value) {
  if (value === undefined) {
    return true;
  }

  return (
    value &&
    Array.isArray(value.users) &&
    value.users.length === 0 &&
    Array.isArray(value.teams) &&
    value.teams.length === 0 &&
    Array.isArray(value.apps) &&
    value.apps.length === 0
  );
}

function verifyRepositoryIdentity() {
  const repositoryView = JSON.parse(
    run("gh", ["repo", "view", repository, "--json", "nameWithOwner,defaultBranchRef"]),
  );

  assert(repositoryView.nameWithOwner === repository, "The canonical repository identity changed.");
  assert(
    repositoryView.defaultBranchRef?.name === defaultBranch,
    `The canonical default branch must remain ${defaultBranch}.`,
  );
}

function verifyProtection() {
  const protection = ghJson([`repos/${repository}/branches/${defaultBranch}/protection`]);
  const reviews = ghJson([
    `repos/${repository}/branches/${defaultBranch}/protection/required_pull_request_reviews`,
  ]);
  const statusChecks = protection.required_status_checks;

  assert(
    protection.required_pull_request_reviews !== undefined,
    "main must require pull requests.",
  );
  assert(statusChecks?.strict === true, "main must require a strictly up-to-date branch.");
  assertSameItems(statusChecks.contexts, REQUIRED_CONTEXTS, "main required-check contexts changed");
  assertSameItems(
    statusChecks.checks?.map(({ context }) => context),
    REQUIRED_CONTEXTS,
    "main structured required-check contexts changed",
  );
  assert(
    hasExpectedCodexReviewBinding(statusChecks.checks),
    "main Codex review publisher binding changed",
  );
  assert(
    protection.enforce_admins?.enabled === true,
    "main must enforce the rule for administrators.",
  );
  assert(reviews?.dismiss_stale_reviews === true, "main must dismiss stale human approvals.");
  assert(
    reviews?.require_last_push_approval === false,
    "main must defer latest-push approval until human approvals are enabled.",
  );
  assert(
    reviews?.required_approving_review_count === 0,
    "main must require zero normal human approvals while solo-maintained.",
  );
  assert(
    reviews?.require_code_owner_reviews === false,
    "main must not introduce a separate CODEOWNERS approval gate.",
  );
  assert(
    emptyBypassAllowances(reviews?.bypass_pull_request_allowances),
    "main must have no pull-request bypass actors.",
  );
  assert(
    protection.restrictions === null || protection.restrictions === undefined,
    "main must not configure push restrictions or bypass actors.",
  );
  assert(
    protection.required_conversation_resolution?.enabled === true,
    "main must require resolved conversations.",
  );
  assert(protection.allow_force_pushes?.enabled === false, "main must reject force-pushes.");
  assert(protection.allow_deletions?.enabled === false, "main must reject branch deletion.");
}

function matchesRefPattern(pattern, refName) {
  if (pattern === "~ALL") {
    return true;
  }

  const normalizedPattern = pattern === "~DEFAULT_BRANCH" ? "refs/heads/main" : pattern;
  const expression = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*")
    .replaceAll("?", ".");

  return new RegExp(`^${expression}$`).test(refName);
}

function rulesetAppliesToMain(ruleset) {
  if (ruleset.target === "tag") {
    return false;
  }

  const refName = "refs/heads/main";
  const refCondition = ruleset.conditions?.ref_name;
  const includedRefs = refCondition?.include ?? [];
  const excludedRefs = refCondition?.exclude ?? [];

  if (excludedRefs.some((pattern) => matchesRefPattern(pattern, refName))) {
    return false;
  }

  return (
    includedRefs.length === 0 || includedRefs.some((pattern) => matchesRefPattern(pattern, refName))
  );
}

function verifyNoOverlappingRulesets() {
  const rulesetSummaries = ghJsonPages([
    `repos/${repository}/rulesets?includes_parents=true&per_page=100`,
  ]);
  const rulesets = rulesetSummaries.map(({ id }) => {
    assert(Number.isInteger(id), "Every repository ruleset must expose an integer ID.");

    return ghJson([`repos/${repository}/rulesets/${id}`]);
  });
  const overlappingRulesets = rulesets.filter(rulesetAppliesToMain);

  assert(
    overlappingRulesets.length === 0,
    `main must have no overlapping repository rulesets: ${overlappingRulesets
      .map(({ name, id }) => `${name ?? "unnamed"} (${id})`)
      .join(", ")}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyAuthentication();
  verifyRepositoryIdentity();
  verifyProtection();
  verifyNoOverlappingRulesets();

  console.log(
    `Authenticated main protection verification passed: one branch-protection rule, ${REQUIRED_CONTEXTS.length} required contexts, Codex review bound to GitHub Actions app ${TRUSTED_GITHUB_ACTIONS_APP_ID}, zero normal human approvals, no bypass actors, resolved conversations, administrator enforcement, and no force-push/deletion.`,
  );
}
