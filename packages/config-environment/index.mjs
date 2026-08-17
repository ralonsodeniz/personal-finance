export const APPLICATION_ENVIRONMENTS = Object.freeze(["development", "preview", "production"]);

const environmentScopedKeys = Object.freeze([
  "AUTH_PROVIDER",
  "AUTH0_DOMAIN",
  "AUTH0_ISSUER_BASE_URL",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "DATABASE_URL",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "TELEMETRY_APPROVED",
  "TELEMETRY_MODE",
]);

const previewGenericKeys = Object.freeze([
  "AUTH_PROVIDER",
  "AUTH0_DOMAIN",
  "AUTH0_ISSUER_BASE_URL",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "DATABASE_URL",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_POSTHOG_KEY",
]);

const previewProductionMarkers = Object.freeze([
  "WAYFINDER_PRODUCTION_SECRETS",
  "WAYFINDER_USE_PRODUCTION_DATA",
  "WAYFINDER_PRODUCTION_DATABASE_URL",
  "WAYFINDER_PRODUCTION_AUTH0_SECRET",
]);

function normalized(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function environmentVariablePrefix(name) {
  return `WAYFINDER_${name.toUpperCase()}_`;
}

function scopedEnvironmentName(resolved) {
  return resolved.vercel === "preview" || resolved.vercel === "production"
    ? resolved.vercel
    : resolved.name;
}

export function parseEnvironmentText(contents, fileName = ".env.example") {
  const entries = {};
  const errors = [];

  contents.split(/\r?\n/).forEach((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(trimmedLine);

    if (!match) {
      errors.push(`${fileName}:${index + 1} must use KEY=value syntax`);
      return;
    }

    const [, key, value] = match;

    if (Object.hasOwn(entries, key)) {
      errors.push(`${fileName}:${index + 1} defines ${key} more than once`);
      return;
    }

    entries[key] = value.trim();
  });

  return { entries, errors };
}

export function resolveApplicationEnvironment(environment = {}) {
  const explicit = normalized(environment.APP_ENV);
  const vercel = normalized(environment.VERCEL_ENV);
  const inferredFromVercel = vercel === "preview" || vercel === "production" ? vercel : undefined;
  const inferred =
    explicit ||
    inferredFromVercel ||
    (normalized(environment.NODE_ENV) === "production" ? "production" : "development");

  return {
    explicit: explicit || undefined,
    invalid: inferred && !APPLICATION_ENVIRONMENTS.includes(inferred) ? inferred : undefined,
    name: APPLICATION_ENVIRONMENTS.includes(inferred) ? inferred : "development",
    vercel: vercel || undefined,
  };
}

export function getScopedEnvironment(environment = {}) {
  const resolved = resolveApplicationEnvironment(environment);
  const scopedEnvironment = { ...environment };
  const name = scopedEnvironmentName(resolved);
  const prefix = environmentVariablePrefix(name);

  for (const key of environmentScopedKeys) {
    const scopedKey = `${prefix}${key}`;

    if (Object.hasOwn(environment, scopedKey)) {
      scopedEnvironment[key] = environment[scopedKey];
    } else if (name !== "development") {
      // Preview and production never fall back to generic credentials. Their
      // values must be configured under the matching environment namespace.
      delete scopedEnvironment[key];
    }
  }

  return scopedEnvironment;
}

const previewBlockedPrefixes = Object.freeze(["WAYFINDER_DEVELOPMENT_", "WAYFINDER_PRODUCTION_"]);
const previewSensitivePattern =
  /(?:SECRET|PASSWORD|API_KEY|AUTH_TOKEN|ACCESS_TOKEN|PRIVATE_KEY|CLIENT_SECRET|DATABASE_URL|TOKEN|KEY|CREDENTIAL)/i;

function isPreviewPassthroughKey(key) {
  if (key.startsWith("WAYFINDER_PREVIEW_")) {
    return true;
  }

  if (previewBlockedPrefixes.some((prefix) => key.startsWith(prefix))) {
    return false;
  }

  if (environmentScopedKeys.includes(key) || previewGenericKeys.includes(key)) {
    return false;
  }

  return !previewSensitivePattern.test(key);
}

export function createPreviewEnvironment(environment = {}, overrides = {}) {
  const sanitizedEnvironment = Object.fromEntries(
    Object.entries(environment).filter(([key]) => isPreviewPassthroughKey(key)),
  );
  const scopedEnvironment = getScopedEnvironment({
    ...environment,
    APP_ENV: "preview",
    VERCEL_ENV: "preview",
  });

  for (const key of environmentScopedKeys) {
    if (isNonEmpty(scopedEnvironment[key])) {
      sanitizedEnvironment[key] = scopedEnvironment[key];
    }
  }

  return {
    ...sanitizedEnvironment,
    APP_ENV: "preview",
    VERCEL_ENV: "preview",
    WAYFINDER_PREVIEW_AUTH0_SECRET:
      environment.WAYFINDER_PREVIEW_AUTH0_SECRET ??
      "test-only-local-session-secret-not-a-credential",
    WAYFINDER_PREVIEW_AUTH_PROVIDER: "double",
    WAYFINDER_PREVIEW_DATA_MODE: "provider-double",
    WAYFINDER_PREVIEW_NEXT_PUBLIC_POSTHOG_HOST:
      environment.WAYFINDER_PREVIEW_NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    WAYFINDER_PREVIEW_NEXT_PUBLIC_POSTHOG_KEY:
      environment.WAYFINDER_PREVIEW_NEXT_PUBLIC_POSTHOG_KEY ?? "",
    WAYFINDER_PREVIEW_TELEMETRY_MODE: "disabled",
    ...overrides,
  };
}

export function validateEnvironmentBoundary(environment = {}) {
  const resolved = resolveApplicationEnvironment(environment);
  const errors = [];

  if (resolved.invalid) {
    errors.push(
      `APP_ENV must be development, preview, or production (received ${resolved.invalid})`,
    );
  }

  if (
    resolved.vercel &&
    (resolved.vercel === "preview" || resolved.vercel === "production") &&
    resolved.name !== resolved.vercel
  ) {
    errors.push(`APP_ENV ${resolved.name} does not match VERCEL_ENV ${resolved.vercel}`);
  }

  if (resolved.name === "preview") {
    for (const key of previewGenericKeys) {
      if (isNonEmpty(environment[key])) {
        errors.push(`${key} is not accepted in preview; use WAYFINDER_PREVIEW_${key}`);
      }
    }

    for (const key of previewProductionMarkers) {
      if (isNonEmpty(environment[key]) && normalized(environment[key]) !== "false") {
        errors.push(`${key} is forbidden in preview`);
      }
    }

    const authProvider = normalized(
      environment.WAYFINDER_PREVIEW_AUTH_PROVIDER ?? environment.AUTH_PROVIDER,
    );
    const authApproved = normalized(environment.WAYFINDER_PREVIEW_PROVIDER_APPROVED) === "true";

    if (authProvider && authProvider !== "double" && !authApproved) {
      errors.push(
        "preview provider integrations must use the provider double or set WAYFINDER_PREVIEW_PROVIDER_APPROVED=true",
      );
    }

    const dataMode = normalized(
      environment.WAYFINDER_PREVIEW_DATA_MODE ?? environment.WAYFINDER_DATA_MODE,
    );
    const dataApproved = normalized(environment.WAYFINDER_PREVIEW_DATA_APPROVED) === "true";

    if (dataMode && dataMode !== "provider-double" && !dataApproved) {
      errors.push(
        "preview data integrations must use provider-double or set WAYFINDER_PREVIEW_DATA_APPROVED=true",
      );
    }

    const telemetryMode = normalized(
      environment.WAYFINDER_PREVIEW_TELEMETRY_MODE ?? environment.TELEMETRY_MODE,
    );
    const telemetryApproved =
      normalized(environment.WAYFINDER_PREVIEW_TELEMETRY_APPROVED) === "true";

    if (telemetryMode && telemetryMode !== "disabled" && !telemetryApproved) {
      errors.push(
        "preview telemetry must remain disabled or set WAYFINDER_PREVIEW_TELEMETRY_APPROVED=true",
      );
    }
  }

  if (resolved.name === "production") {
    const authProvider = normalized(
      environment.WAYFINDER_PRODUCTION_AUTH_PROVIDER ?? environment.AUTH_PROVIDER,
    );

    if (authProvider === "double") {
      errors.push("the provider double cannot be enabled in production");
    }
  }

  return { environment: resolved, errors, ok: errors.length === 0 };
}

export function scopedEnvironmentKeys() {
  return [...environmentScopedKeys];
}
