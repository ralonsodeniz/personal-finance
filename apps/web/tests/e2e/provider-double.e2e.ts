import { expect, test } from "@playwright/test";

import { WEB_SESSION_COOKIE_NAME } from "../../app/lib/web-session-core";

test("establishes and clears a provider-double session through the browser route", async ({
  context,
  page,
}) => {
  const response = await page.goto("/auth/provider-double");

  expect(response?.ok()).toBe(true);
  expect(page.url()).toMatch(/\/workspace$/);
  await expect(page.locator("[data-auth-boundary='authenticated']")).toBeVisible();
  await expect(page.locator("[data-protected-content='withheld']")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\$\d|€\s?\d|£\s?\d/);

  const sessionCookie = (await context.cookies()).find(
    (cookie) => cookie.name === WEB_SESSION_COOKIE_NAME,
  );

  expect(sessionCookie).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  expect(sessionCookie?.value).not.toContain("double|demo-user");

  await page.getByRole("link", { name: "Sign out" }).click();
  await expect(page.locator("[data-auth-boundary='unauthenticated']")).toBeVisible();
  await expect(page.locator("[data-protected-content='withheld']")).toBeVisible();
});
