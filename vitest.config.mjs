import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharedConfig from "./packages/config-vitest/index.mjs";

export default defineConfig({
  root: ".",
  ...sharedConfig,
  resolve: {
    alias: {
      "server-only": resolve(
        dirname(fileURLToPath(import.meta.url)),
        "scripts/server-only-vitest-stub.mjs",
      ),
    },
  },
});
