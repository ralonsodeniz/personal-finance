import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? "3101");
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  testDir: "./tests/e2e",
  testMatch: /provider-double\.e2e\.ts/,
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      AUTH0_SECRET: "test-only-local-session-secret-not-a-credential",
      AUTH_PROVIDER: "double",
      NODE_ENV: "development",
    },
    timeout: 120_000,
    url: baseURL,
  },
});
