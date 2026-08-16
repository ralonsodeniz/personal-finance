import { defineConfig } from "vitest/config";
import sharedConfig from "./packages/config-vitest/index.mjs";

export default defineConfig({
  root: ".",
  ...sharedConfig,
});
