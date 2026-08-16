import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const rootDirectory = fileURLToPath(new URL("..", import.meta.url));

type PackageJson = {
  scripts: Record<string, string>;
};

type TurboConfig = {
  tasks: Record<string, { dependsOn?: string[] }>;
};

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(`${rootDirectory}/${relativePath}`, "utf8")) as T;
}

function providerFreeEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };

  for (const key of Object.keys(environment)) {
    if (/AUTH0|CLERK|WORKOS|SUPABASE|SENTRY|POSTHOG|DATABASE_URL|SECRET|TOKEN|API_KEY/i.test(key)) {
      delete environment[key];
    }
  }

  return environment;
}

function runPnpm(args: string[]) {
  return spawnSync("pnpm", args, {
    cwd: rootDirectory,
    encoding: "utf8",
    env: providerFreeEnvironment(),
  });
}

describe("root quality gate", () => {
  it("publishes one full and one affected verification command", () => {
    const packageJson = readJson<PackageJson>("package.json");

    expect(packageJson.scripts.verify).toBe("node scripts/verify.mjs");
    expect(packageJson.scripts["verify:affected"]).toBe("node scripts/verify.mjs --affected");
    expect(packageJson.scripts["env:check"]).toBe("node scripts/validate-environment.mjs");
    expect(packageJson.scripts["secrets:check"]).toBe("node scripts/check-secret-safety.mjs");
  });

  it("accepts the committed environment example without provider credentials", () => {
    const result = runPnpm(["run", "env:check"]);

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Environment validation passed");
  });

  it("runs secret-safety validation without provider credentials", () => {
    const result = runPnpm(["run", "secrets:check"]);

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Secret-safety validation passed");
  });

  it("keeps the quality checks in the workspace task graph", () => {
    const turbo = readJson<TurboConfig>("turbo.json");

    for (const taskName of ["typecheck", "lint", "format:check", "test"]) {
      expect(turbo.tasks[taskName]).toBeDefined();
      expect(turbo.tasks[taskName]?.dependsOn).toContain("^" + taskName);
    }
  });

  it("runs the same root gate in the initial GitHub Actions job", () => {
    const workflow = readFileSync(`${rootDirectory}/.github/workflows/quality.yml`, "utf8");

    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm run verify");
    expect(workflow).toContain("pnpm run verify:affected");
  });
});
