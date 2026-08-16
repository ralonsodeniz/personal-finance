import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const qualityTasks = ["typecheck", "lint", "format:check", "test"];

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
  const rootCommands = [
    ["pnpm", ["run", "env:check"]],
    ["pnpm", ["run", "secrets:check"]],
    ...(affected ? [] : qualityTasks.map((task) => ["pnpm", ["run", task]])),
  ];

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
