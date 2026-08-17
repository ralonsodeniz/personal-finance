import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { createPreviewEnvironment } from "../packages/config-environment/index.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const target = process.argv[2];

const targets = {
  docs: {
    filter: "@personal-finance/docs",
    label: "documentation",
  },
  web: {
    filter: "@personal-finance/web",
    label: "web/PWA",
  },
};

if (!target || !targets[target]) {
  console.error("Usage: node scripts/preview-build.mjs <web|docs>");
  process.exitCode = 1;
} else {
  const previewEnvironment = createPreviewEnvironment(process.env);
  const result = spawnSync("pnpm", ["--filter", targets[target].filter, "run", "build"], {
    cwd: rootDirectory,
    env: previewEnvironment,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Unable to build ${targets[target].label}: ${result.error.message}`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
