import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRootDirectory = resolve(scriptDirectory, "..");
const allowedEnvironmentFiles = new Set([
  ".env.development.example",
  ".env.example",
  ".env.preview.example",
  ".env.production.example",
  ".env.template",
]);
const forbiddenPathPattern =
  /(?:^|\/)(?:\.env(?:\.[^/]+)?|\.secrets|secrets)(?:\/|$)|\.(?:pem|key|p12|pfx)$/i;
const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk_(?:live|test)|ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{8,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:client_secret|api_key|auth_token|access_token|database_url)\s*[:=]\s*["']?[^\s"'#]{12,}/i,
];

function repositoryFiles(rootDirectory) {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: rootDirectory },
  );

  return output.toString("utf8").split("\0").filter(Boolean);
}

export function checkSecretSafety({ rootDirectory = defaultRootDirectory } = {}) {
  const errors = [];

  for (const relativePath of repositoryFiles(rootDirectory)) {
    const baseName = relativePath.split("/").at(-1);

    if (forbiddenPathPattern.test(relativePath) && !allowedEnvironmentFiles.has(baseName)) {
      errors.push(`${relativePath} is a forbidden credential or environment file`);
      continue;
    }

    const absolutePath = resolve(rootDirectory, relativePath);
    const contents = readFileSync(absolutePath);

    if (contents.includes(0)) {
      continue;
    }

    const text = contents.toString("utf8");

    for (const pattern of secretPatterns) {
      if (pattern.test(text)) {
        errors.push(`${relativePath} contains a value matching ${pattern}`);
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkSecretSafety();

  if (result.ok) {
    console.log("Secret-safety validation passed (no tracked credentials detected).");
  } else {
    console.error("Secret-safety validation failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
