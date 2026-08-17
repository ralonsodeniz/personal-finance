import { expect, test } from "@playwright/test";

import { IdentityDirectory, ProviderDouble } from "@personal-finance/auth";
import {
  createWebSession,
  encryptWebSession,
  WEB_SESSION_COOKIE_NAME,
} from "../../app/lib/web-session-core";

test.describe("production web/PWA shell", () => {
  test("renders the public shell with its clear entry point", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle("Wayfinder — find the thread");
    await expect(
      page.getByRole("heading", { name: "Find the thread in your money." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Enter the workspace" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const rootScope = new URL("/", page.url()).href;
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            if (!("serviceWorker" in navigator)) {
              return [];
            }

            const registrations = await navigator.serviceWorker.getRegistrations();
            return registrations.map((registration) => registration.scope);
          }),
        { timeout: 10_000 },
      )
      .toContain(rootScope);
  });

  test("initializes the telemetry runtime on the mounted public shell", async ({ page }) => {
    await page.goto("/");

    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            analyticsProviderFactory:
              typeof window.__WAYFINDER_TELEMETRY_PROVIDERS__?.createProductAnalyticsProvider,
            operationalSinkCount:
              window.__WAYFINDER_TELEMETRY_PROVIDERS__?.operationalSinks?.length,
            postHogCapture: typeof window.__WAYFINDER_TELEMETRY_RUNTIME__?.postHog?.capture,
            runtime: Boolean(window.__WAYFINDER_TELEMETRY_RUNTIME__),
            runtimeMarker: document.documentElement.dataset.wayfinderTelemetryRuntime,
          })),
        { timeout: 10_000 },
      )
      .toEqual({
        analyticsProviderFactory: "function",
        operationalSinkCount: 2,
        postHogCapture: "function",
        runtime: true,
        runtimeMarker: "initialized",
      });
  });

  test("serves an installability manifest and its icon", async ({ request }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");

    expect(manifestResponse.ok()).toBe(true);
    expect(manifestResponse.headers()["content-type"]).toContain("application/manifest+json");

    const manifest = await manifestResponse.json();
    expect(manifest).toMatchObject({
      display: "standalone",
      id: "/",
      name: "Wayfinder — personal finance",
      scope: "/",
      start_url: "/",
      theme_color: "#14252B",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: "maskable",
          sizes: "192x192",
          src: "/icons/wayfinder-192.png",
        }),
        expect.objectContaining({
          purpose: "maskable",
          sizes: "512x512",
          src: "/icons/wayfinder-512.png",
        }),
        expect.objectContaining({ purpose: "any", sizes: "any", src: "/icons/wayfinder-mark.svg" }),
      ]),
    );

    for (const [iconPath, contentType] of [
      ["/icons/wayfinder-192.png", "image/png"],
      ["/icons/wayfinder-512.png", "image/png"],
      ["/icons/wayfinder-mark.svg", "image/svg+xml"],
    ] as const) {
      const iconResponse = await request.get(iconPath);
      expect(iconResponse.ok()).toBe(true);
      expect(iconResponse.headers()["content-type"]).toContain(contentType);
    }
  });

  test("serves the production Serwist service-worker asset", async ({ request }) => {
    const serviceWorkerResponse = await request.get("/sw.js");

    expect(serviceWorkerResponse.ok()).toBe(true);
    expect(serviceWorkerResponse.headers()["content-type"]).toContain("javascript");
    expect(serviceWorkerResponse.headers()["cache-control"]).toContain("no-cache");
    expect(serviceWorkerResponse.headers()["service-worker-allowed"]).toBe("/");
    expect((await serviceWorkerResponse.body()).byteLength).toBeGreaterThan(0);
  });

  test("uses an online-first offline fallback without caching private pages", async ({
    context,
    page,
  }) => {
    await page.goto("/");
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.ready;
            return registration.scope;
          }),
        { timeout: 10_000 },
      )
      .toBe(new URL("/", page.url()).href);

    await page.reload();
    await expect
      .poll(
        async () => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null),
        {
          timeout: 10_000,
        },
      )
      .toBeTruthy();

    const cachedUrls = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const cachedRequests = await Promise.all(
        cacheNames.map(async (cacheName) => (await caches.open(cacheName)).keys()),
      );

      return cachedRequests.flat().map((request) => new URL(request.url).pathname);
    });

    expect(
      cachedUrls.some(
        (pathname) =>
          pathname === "/workspace" ||
          pathname.startsWith("/api/") ||
          pathname.startsWith("/_next/data/"),
      ),
    ).toBe(false);

    await context.setOffline(true);
    try {
      const offlineResponse = await page.goto("/workspace");

      expect(offlineResponse?.ok()).toBe(true);
      await expect(page.getByText("Reconnect to load current financial data.")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/\$\d|€\s?\d|£\s?\d/);
    } finally {
      await context.setOffline(false);
    }
  });

  test("keeps the unauthenticated workspace boundary empty", async ({ page }) => {
    const response = await page.goto("/workspace");

    expect(response?.ok()).toBe(true);
    await expect(page.locator("[data-auth-boundary='unauthenticated']")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your workspace starts with an identity." }),
    ).toBeVisible();
    await expect(page.getByText(/No workspace data is available yet/)).toBeVisible();
    await expect(page.locator("[data-auth-configuration='configured']")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\$\d|€\s?\d|£\s?\d/);
  });

  test("recognizes the provider-double session without revealing protected content", async ({
    context,
    page,
  }) => {
    const provider = new ProviderDouble();
    const identity = new IdentityDirectory().establish(
      provider.authenticate({ subject: "double|browser-user" }),
    );

    await context.addCookies([
      {
        domain: "localhost",
        httpOnly: true,
        name: WEB_SESSION_COOKIE_NAME,
        path: "/",
        sameSite: "Lax",
        secure: true,
        value: encryptWebSession(
          createWebSession({ identityId: identity.id, userId: identity.userId }),
          "test-only-local-session-secret-not-a-credential",
        ),
      },
    ]);

    const response = await page.goto("/workspace");

    expect(response?.ok()).toBe(true);
    await expect(page.locator("[data-auth-boundary='authenticated']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "The private line is open." })).toBeVisible();
    await expect(page.locator("[data-protected-content='withheld']")).toBeVisible();
    await expect(page.locator("[data-auth-node='data'] strong")).toHaveText("withheld");
    await expect(page.locator("body")).not.toContainText(/\$\d|€\s?\d|£\s?\d/);

    await page.getByRole("link", { name: "Sign out" }).click();
    await expect(page.locator("[data-auth-boundary='unauthenticated']")).toBeVisible();
  });
});

test.describe("system health boundary", () => {
  test("serves the OpenAPI document and versioned health response", async ({ request }) => {
    const openApiResponse = await request.get("/api/v1/openapi.json");

    expect(openApiResponse.ok()).toBe(true);
    expect(openApiResponse.headers()["content-type"]).toContain("application/json");
    expect(await openApiResponse.json()).toMatchObject({
      openapi: "3.1.0",
      paths: { "/system/health": { get: { operationId: "getSystemHealth" } } },
    });

    const healthResponse = await request.get("/api/v1/system/health?scope=system");

    expect(healthResponse.ok()).toBe(true);
    expect(healthResponse.headers()["cache-control"]).toContain("no-store");
    expect(await healthResponse.json()).toMatchObject({
      contractVersion: "v1",
      data: { database: "ready", migrations: "ready", provider: "provider-double" },
      service: "wayfinder",
      status: "ok",
    });

    const invalidResponse = await request.get("/api/v1/system/health?scope=finance");

    expect(invalidResponse.status()).toBe(400);
    expect(invalidResponse.headers()["content-type"]).toContain("application/problem+json");
    expect(await invalidResponse.json()).toMatchObject({
      status: 400,
      title: "Invalid request",
      type: "https://wayfinder.dev/problems/invalid-request",
    });
  });

  test("renders the direct service proof at a representative mobile size", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto("/system-health");

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle("Wayfinder — find the thread");
    await expect(page.getByRole("heading", { name: "The boundary is awake." })).toBeVisible();
    await expect(page.locator("[data-health-source='application-service']")).toBeVisible();
    await expect(page.locator("[data-health-database='ready']")).toHaveText("ready");
    await expect(page.locator("[data-health-migrations='ready']")).toHaveText("ready");
    await expect(page.locator("body")).not.toContainText(/\$\d|€\s?\d|£\s?\d/);
  });
});
