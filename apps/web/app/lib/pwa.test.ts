import { describe, expect, it } from "vitest";

import { pwaConfig } from "./pwa";

describe("PWA registration safeguards", () => {
  it("keeps the service worker disabled outside production", () => {
    expect(pwaConfig.register).toBe(false);
    expect(pwaConfig.disable).toBe(true);
  });

  it("does not ask the provider to cache navigations or reload online", () => {
    expect(pwaConfig.cacheOnNavigation).toBe(false);
    expect(pwaConfig.reloadOnOnline).toBe(false);
  });

  it("uses a root-scoped production worker without an HTTP cache", () => {
    expect(pwaConfig.swUrl).toBe("/sw.js");
    expect(pwaConfig.options).toEqual({
      scope: "/",
      updateViaCache: "none",
    });
  });
});
