import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  parseEnvironmentText,
  validateEnvironmentBoundary,
} from "../packages/config-environment/index.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRootDirectory = resolve(scriptDirectory, "..");
const secretKeyPattern = /(?:SECRET|PASSWORD|API_KEY|AUTH_TOKEN|ACCESS_TOKEN|PRIVATE_KEY)/i;
const safePlaceholderPattern = /^(?:|changeme|replace[-_ ]?me|set[-_ ]?locally|<[^>]+>)$/i;

const environmentTemplates = [
  ".env.example",
  ".env.development.example",
  ".env.preview.example",
  ".env.production.example",
];

function validateTemplate(contents, fileName) {
  const parsed = parseEnvironmentText(contents, fileName);
  const errors = [...parsed.errors];

  for (const [key, value] of Object.entries(parsed.entries)) {
    if (secretKeyPattern.test(key) && !safePlaceholderPattern.test(value)) {
      errors.push(`${fileName} must not contain a value for secret ${key}`);
    }
  }

  errors.push(
    ...validateEnvironmentBoundary(parsed.entries).errors.map((error) => `${fileName}: ${error}`),
  );

  return { entries: parsed.entries, errors };
}

export function validateEnvironment({ rootDirectory = defaultRootDirectory } = {}) {
  const errors = [];

  for (const template of environmentTemplates) {
    const templatePath = resolve(rootDirectory, template);

    if (!existsSync(templatePath)) {
      errors.push(`${template} is required for environment-boundary validation`);
      continue;
    }

    const result = validateTemplate(readFileSync(templatePath, "utf8"), template);
    errors.push(...result.errors);

    if (template === ".env.example") {
      for (const key of ["APP_BASE_URL", "API_BASE_URL", "EXPO_SCHEME"]) {
        if (!(key in result.entries)) {
          errors.push(`.env.example is missing the non-secret ${key} setting`);
        }
      }
    }
  }

  errors.push(
    ...validateEnvironmentBoundary(process.env).errors.map(
      (error) => `runtime environment: ${error}`,
    ),
  );

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateEnvironment();

  if (result.ok) {
    console.log(
      "Environment validation passed (development, preview, and production boundaries are explicit; provider credentials are optional).",
    );
  } else {
    console.error("Environment validation failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
