import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, extname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const eslintEntryPoint = resolve(rootDirectory, "node_modules/eslint/bin/eslint.js");
const lintableExtensions = new Set([".cjs", ".cts", ".js", ".mjs", ".mts", ".ts", ".tsx"]);
const ignoredDirectories = new Set([
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

function findLintableFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...findLintableFiles(resolve(directory, entry.name)));
      }
      continue;
    }

    if (lintableExtensions.has(extname(entry.name))) {
      files.push(resolve(directory, entry.name));
    }
  }

  return files;
}

const workspaceFiles = findLintableFiles(process.cwd());
const workspaceConfig = resolve(process.cwd(), "eslint.config.mjs");
const eslintConfig = existsSync(workspaceConfig)
  ? workspaceConfig
  : resolve(rootDirectory, "eslint.config.mjs");

if (workspaceFiles.length === 0) {
  console.log("No lintable source files in this workspace.");
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [eslintEntryPoint, "--config", eslintConfig, ...workspaceFiles],
  { cwd: rootDirectory, stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
