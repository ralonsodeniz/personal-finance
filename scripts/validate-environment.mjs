import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRootDirectory = resolve(scriptDirectory, "..");
const secretKeyPattern = /(?:SECRET|PASSWORD|API_KEY|AUTH_TOKEN|ACCESS_TOKEN|PRIVATE_KEY)/i;
const safePlaceholderPattern = /^(?:|changeme|replace[-_ ]?me|set[-_ ]?locally|<[^>]+>)$/i;

function parseEnvironmentExample(contents) {
  const entries = new Map();
  const errors = [];

  contents.split(/\r?\n/).forEach((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(trimmedLine);

    if (!match) {
      errors.push(`.env.example:${index + 1} must use KEY=value syntax`);
      return;
    }

    const [, key, value] = match;

    if (entries.has(key)) {
      errors.push(`.env.example:${index + 1} defines ${key} more than once`);
    }

    entries.set(key, value.trim());

    if (secretKeyPattern.test(key) && !safePlaceholderPattern.test(value.trim())) {
      errors.push(`.env.example:${index + 1} must not contain a value for secret ${key}`);
    }
  });

  return { entries, errors };
}

export function validateEnvironment({ rootDirectory = defaultRootDirectory } = {}) {
  const examplePath = resolve(rootDirectory, ".env.example");
  const errors = [];

  if (!existsSync(examplePath)) {
    errors.push(".env.example is required for provider-free environment validation");
    return { ok: false, errors };
  }

  const { entries, errors: parseErrors } = parseEnvironmentExample(
    readFileSync(examplePath, "utf8"),
  );
  errors.push(...parseErrors);

  for (const key of ["APP_BASE_URL", "API_BASE_URL", "EXPO_SCHEME"]) {
    if (!entries.has(key)) {
      errors.push(`.env.example is missing the non-secret ${key} setting`);
    }
  }

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateEnvironment();

  if (result.ok) {
    console.log("Environment validation passed (provider credentials are optional).");
  } else {
    console.error("Environment validation failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
