import { expect, test } from "@playwright/test";

const docsBaseURL = process.env.PREVIEW_DOCS_URL ?? "http://localhost:4200";

test.describe("preview-like delivery boundary", () => {
  test("connects web, PWA, API, session, telemetry, and docs without provider credentials", async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");
    await expect(page).toHaveTitle("Wayfinder — find the thread");
    await expect(
      page.getByRole("heading", { name: "Find the thread in your money." }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-wayfinder-telemetry-runtime",
      "initialized",
    );

    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    await expect
      .poll(async () =>
        page.evaluate(() =>
          navigator.serviceWorker.getRegistrations().then((items) => items.length),
        ),
      )
      .toBeGreaterThan(0);

    const serviceWorker = await request.get("/sw.js");
    expect(serviceWorker.ok()).toBe(true);
    expect(serviceWorker.headers()["cache-control"]).toContain("no-cache");

    const health = await request.get("/api/v1/system/health?scope=system");
    expect(health.ok()).toBe(true);
    expect(await health.json()).toMatchObject({
      data: { database: "ready", migrations: "ready", provider: "provider-double" },
      status: "ok",
    });

    await page.goto("/workspace");
    await expect(page.locator("[data-auth-boundary='unauthenticated']")).toBeVisible();
    await expect(page.locator("[data-auth-configuration='configured']")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\$\d|€\s?\d|£\s?\d/);

    const sessionResponse = await page.goto("/auth/provider-double");
    expect(sessionResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.locator("[data-auth-boundary='authenticated']")).toBeVisible();
    await expect(page.locator("[data-protected-content='withheld']")).toBeVisible();
    await page.getByRole("link", { name: "Sign out" }).click();
    await expect(page.locator("[data-auth-boundary='unauthenticated']")).toBeVisible();

    for (const path of ["/developers/intro", "/help/start-here"]) {
      const documentation = await request.get(`${docsBaseURL}${path}`);
      expect(documentation.ok(), `${path} should be served by the docs preview`).toBe(true);
      expect(await documentation.text()).toContain("Wayfinder");
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("keeps the preview-like system proof readable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/system-health");

    await expect(page.getByRole("heading", { name: "The boundary is awake." })).toBeVisible();
    await expect(page.locator("[data-health-source='application-service']")).toBeVisible();
    await expect(page.locator("[data-health-database='ready']")).toHaveText("ready");
    await expect(page.locator("body")).not.toContainText(/\$\d|€\s?\d|£\s?\d/);
  });
});
