import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: "list",
  testDir: "./tests/e2e",
  testMatch: /shell\.e2e\.ts/,
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `pnpm build && pnpm start --hostname 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      APP_ENV: "preview",
      VERCEL_ENV: "preview",
      WAYFINDER_PREVIEW_AUTH0_SECRET: "test-only-local-session-secret-not-a-credential",
      WAYFINDER_PREVIEW_AUTH_PROVIDER: "double",
      WAYFINDER_PREVIEW_DATA_MODE: "provider-double",
    },
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    timeout: 120_000,
    url: baseURL,
  },
});
