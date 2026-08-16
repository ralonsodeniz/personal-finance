import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const qualityTasks = ["typecheck", "lint", "format:check", "test"];
const docsBuildInputs = [
  ".prettierignore",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "apps/docs/",
  "packages/config-eslint/",
  "packages/config-prettier/",
  "packages/config-typescript/",
  "packages/config-vitest/",
];

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: rootDirectory,
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    return "";
  }

  return result.stdout;
}

function changedPaths() {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const mergeBase = gitOutput(["merge-base", baseRef, "HEAD"]).trim();
  const committedDiff = mergeBase
    ? gitOutput(["diff", "--name-only", `${mergeBase}...HEAD`])
    : gitOutput(["diff", "--name-only", "HEAD^"]);
  const pendingDiff = [
    gitOutput(["diff", "--name-only"]),
    gitOutput(["diff", "--cached", "--name-only"]),
    gitOutput(["ls-files", "--others", "--exclude-standard"]),
  ].join("\n");

  return `${committedDiff}\n${pendingDiff}`
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean);
}

export function docsBuildRequired() {
  return changedPaths().some((path) =>
    docsBuildInputs.some((input) =>
      input.endsWith("/") ? path.startsWith(input) : path === input,
    ),
  );
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDirectory,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }

  return result.status ?? 1;
}

export function verify({ affected = process.argv.includes("--affected") } = {}) {
  const shouldBuildDocs = !affected || docsBuildRequired();

  const rootCommands = [
    ["pnpm", ["run", "env:check"]],
    ["pnpm", ["run", "secrets:check"]],
    ...(shouldBuildDocs ? [["pnpm", ["run", "docs:build"]]] : []),
    ...(affected ? [] : qualityTasks.map((task) => ["pnpm", ["run", task]])),
  ];

  if (affected && !shouldBuildDocs) {
    console.log("\n> Skipping docs:build because its build inputs are unaffected");
  }

  for (const [command, args] of rootCommands) {
    const exitCode = run(command, args);

    if (exitCode !== 0) {
      return exitCode;
    }
  }

  const turboArgs = [
    "exec",
    "turbo",
    "run",
    ...qualityTasks,
    "--cache-dir",
    ".turbo/cache",
    "--output-logs=full",
  ];

  if (affected) {
    turboArgs.push("--affected");
  }

  return run("pnpm", turboArgs);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = verify();
}
