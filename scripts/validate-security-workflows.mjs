import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const documentationPath = resolve(rootDirectory, "docs/architecture/repository-security-gates.md");

function readRepositoryFile(relativePath) {
  return readFileSync(resolve(rootDirectory, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(contents, expected, relativePath) {
  assert(contents.includes(expected), `${relativePath} must contain ${JSON.stringify(expected)}`);
}

function assertExcludes(contents, forbidden, relativePath) {
  assert(
    !contents.includes(forbidden),
    `${relativePath} must not contain ${JSON.stringify(forbidden)}`,
  );
}

function assertAllIncludes(contents, expectedValues, relativePath) {
  for (const expected of expectedValues) {
    assertIncludes(contents, expected, relativePath);
  }
}

function assertAllExcludes(contents, forbiddenValues, relativePath) {
  for (const forbidden of forbiddenValues) {
    assertExcludes(contents, forbidden, relativePath);
  }
}

const codeqlPath = ".github/workflows/codeql.yml";
const codeqlWorkflow = readRepositoryFile(codeqlPath);

assertAllIncludes(
  codeqlWorkflow,
  [
    "name: CodeQL",
    "pull_request:",
    "push:",
    "schedule:",
    "languages: javascript-typescript",
    "security-events: write",
    "persist-credentials: false",
    'category: "/language:javascript-typescript"',
  ],
  codeqlPath,
);

assertAllExcludes(
  codeqlWorkflow,
  ["pull_request_target:", "run:", "secrets.", "secrets:"],
  codeqlPath,
);

const dependencyReviewPath = ".github/workflows/dependency-review.yml";
const dependencyReviewWorkflow = readRepositoryFile(dependencyReviewPath);

assertAllIncludes(
  dependencyReviewWorkflow,
  ["name: Dependency review", "pull_request:", "contents: read", "fail-on-severity: high"],
  dependencyReviewPath,
);

assertAllExcludes(
  dependencyReviewWorkflow,
  ["pull_request_target:", "actions/checkout@", "run:", "secrets.", "secrets:"],
  dependencyReviewPath,
);

assertAllIncludes(
  readFileSync(documentationPath, "utf8"),
  ["CodeQL / CodeQL analysis", "Dependency review / Dependency review"],
  "security-gates documentation",
);

const severityRank = new Map([
  ["low", 0],
  ["moderate", 1],
  ["high", 2],
  ["critical", 3],
]);
const threshold = "high";
const syntheticFindings = ["low", "moderate", "high", "critical"];
const blockingFindings = syntheticFindings.filter(
  (severity) => severityRank.get(severity) >= severityRank.get(threshold),
);

assert(
  JSON.stringify(blockingFindings) === JSON.stringify(["high", "critical"]),
  "dependency-review high threshold must block high and critical findings only",
);

console.log(
  "Security workflow validation passed (CodeQL scope/safety, dependency-review threshold, and stable check names).",
);
