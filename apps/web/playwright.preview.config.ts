import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PREVIEW_WEB_PORT ?? "3200");

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: "list",
  testDir: "./tests/e2e",
  testMatch: /(?:preview|shell)\.e2e\.ts/,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
