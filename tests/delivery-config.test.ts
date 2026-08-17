import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootDirectory = fileURLToPath(new URL("..", import.meta.url));

function file(relativePath: string) {
  return readFileSync(`${rootDirectory}/${relativePath}`, "utf8");
}

function json(relativePath: string) {
  return JSON.parse(file(relativePath)) as Record<string, unknown>;
}

function fileURLToPath(url: URL) {
  return decodeURIComponent(url.pathname);
}

describe("preview delivery contract", () => {
  it("publishes reproducible web and docs build scripts", () => {
    const rootPackage = json("package.json") as {
      scripts: Record<string, string>;
    };
    const webPackage = json("apps/web/package.json") as {
      scripts: Record<string, string>;
    };
    const docsPackage = json("apps/docs/package.json") as {
      scripts: Record<string, string>;
    };

    expect(rootPackage.scripts["preview:build:web"]).toBe("node scripts/preview-build.mjs web");
    expect(rootPackage.scripts["preview:build:docs"]).toBe("node scripts/preview-build.mjs docs");
    expect(rootPackage.scripts["preview:smoke"]).toBe("node scripts/preview-smoke.mjs");
    expect(webPackage.scripts["build:preview"]).toBe("node ../../scripts/preview-build.mjs web");
    expect(docsPackage.scripts["build:preview"]).toBe("node ../../scripts/preview-build.mjs docs");
  });

  it("keeps each Vercel project rooted at its deployable workspace", () => {
    expect(existsSync(`${rootDirectory}/apps/web/vercel.json`)).toBe(true);
    expect(existsSync(`${rootDirectory}/apps/docs/vercel.json`)).toBe(true);

    expect(json("apps/web/vercel.json")).toMatchObject({
      buildCommand: "pnpm run build:preview",
      installCommand: "pnpm install --frozen-lockfile",
    });
    expect(json("apps/docs/vercel.json")).toMatchObject({
      buildCommand: "pnpm run build:preview",
      installCommand: "pnpm install --frozen-lockfile",
      outputDirectory: "build",
    });
  });

  it("documents environment and portable worker boundaries", () => {
    const delivery = file("docs/architecture/delivery.md");

    expect(delivery).toContain("WAYFINDER_PREVIEW_*");
    expect(delivery).toContain("WAYFINDER_PRODUCTION_*");
    expect(delivery).toContain("JobQueue");
    expect(delivery).toContain("Supabase Queues");
    expect(delivery).toContain("Render background worker");
  });

  it("wires the preview delivery gate into the root verification flow and Actions", () => {
    const verifier = file("scripts/verify.mjs");
    const workflow = file(".github/workflows/quality.yml");

    expect(verifier).toContain("preview:build:web");
    expect(verifier).toContain("preview:build:docs");
    expect(verifier).toContain("preview:smoke");
    expect(workflow).toContain("pnpm run verify");
    expect(workflow).toContain("pnpm run verify:affected");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("push:\n    branches:\n      - main");
  });
});
