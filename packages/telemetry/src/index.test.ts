import { describe, expect, it, vi } from "vitest";

import {
  PRODUCT_ANALYTICS_REPLAY_ENABLED,
  createOperationalTelemetry,
  createProductAnalytics,
} from "./index.js";

describe("operational telemetry", () => {
  it("emits one allowlisted diagnostic through OpenTelemetry and Sentry sinks", () => {
    const openTelemetryEvents: unknown[] = [];
    const sentryEvents: unknown[] = [];
    const telemetry = createOperationalTelemetry({
      sinks: [
        {
          emit(event) {
            openTelemetryEvents.push(event);
          },
        },
        {
          emit(event) {
            sentryEvents.push(event);
          },
        },
      ],
    });

    const result = telemetry.diagnostic("web_shell_rendered", {
      route: "/",
      surface: "public-shell",
    });

    expect(result.status).toBe("sent");
    expect(openTelemetryEvents).toEqual([
      {
        attributes: { route: "/", surface: "public-shell" },
        name: "web_shell_rendered",
      },
    ]);
    expect(sentryEvents).toEqual(openTelemetryEvents);
  });

  it("rejects sensitive or unknown diagnostic attributes before either sink", () => {
    const emit = vi.fn();
    const captureMessage = vi.fn();
    const telemetry = createOperationalTelemetry({ sinks: [{ emit }, { emit: captureMessage }] });

    const result = telemetry.diagnostic("web_shell_rendered", {
      requestBody: { amount: 42 },
      route: "/",
      surface: "public-shell",
      token: "Bearer sensitive-token",
    });

    expect(result.status).toBe("rejected");
    expect(emit).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("fails open when an operational provider is unavailable or throws", () => {
    const unavailable = createOperationalTelemetry();
    expect(
      unavailable.diagnostic("web_shell_rendered", { route: "/", surface: "public-shell" }),
    ).toMatchObject({
      status: "disabled",
    });

    const failing = createOperationalTelemetry({
      sinks: [
        {
          emit() {
            throw new Error("provider outage");
          },
        },
      ],
    });

    expect(() =>
      failing.diagnostic("web_shell_rendered", { route: "/", surface: "public-shell" }),
    ).not.toThrow();
    expect(
      failing.diagnostic("web_shell_rendered", { route: "/", surface: "public-shell" }),
    ).toMatchObject({
      status: "failed",
    });
  });
});

describe("product analytics", () => {
  const configured = {
    replay: false,
    status: "configured" as const,
  } as const;

  it("keeps replay disabled in the provider-neutral analytics boundary", () => {
    expect(PRODUCT_ANALYTICS_REPLAY_ENABLED).toBe(false);
  });

  it("allows only the explicit event and property vocabulary", () => {
    const captures: unknown[] = [];
    const analytics = createProductAnalytics({
      configuration: configured,
      provider: {
        capture(eventName, properties) {
          captures.push({ eventName, properties });
        },
        identify: vi.fn(),
        reset: vi.fn(),
      },
    });

    expect(analytics.track("shell_viewed", { surface: "public-shell" })).toMatchObject({
      status: "sent",
    });
    expect(
      analytics.track("shell_viewed", {
        amount: 42,
        cookie: "session-cookie",
        credential: "secret",
        description: "salary",
        identifier: "resource-123",
        requestBody: { amount: 42 },
        surface: "public-shell",
        token: "Bearer sensitive-token",
      }),
    ).toMatchObject({ status: "rejected" });
    expect(analytics.track("unapproved_event", {})).toMatchObject({ status: "rejected" });
    expect(captures).toEqual([
      { eventName: "shell_viewed", properties: { surface: "public-shell" } },
    ]);
  });

  it("accepts an opaque identity, resets it, and rejects identifier-bearing identities", () => {
    const identify = vi.fn();
    const reset = vi.fn();
    const analytics = createProductAnalytics({
      configuration: configured,
      provider: {
        capture: vi.fn(),
        identify,
        reset,
      },
    });

    expect(analytics.identify("opaque:test-identity")).toMatchObject({ status: "sent" });
    expect(analytics.reset()).toMatchObject({ status: "sent" });
    expect(analytics.identify("person@example.com")).toMatchObject({ status: "rejected" });
    expect(analytics.identify("user-123")).toMatchObject({ status: "rejected" });
    expect(identify).toHaveBeenCalledWith("opaque:test-identity");
    expect(reset).toHaveBeenCalledOnce();
  });

  it("does not throw on missing configuration or provider outages", () => {
    const disabled = createProductAnalytics();
    expect(() => disabled.track("shell_viewed", { surface: "public-shell" })).not.toThrow();
    expect(disabled.track("shell_viewed", { surface: "public-shell" })).toMatchObject({
      status: "disabled",
    });

    const analytics = createProductAnalytics({
      configuration: configured,
      provider: {
        capture() {
          throw new Error("analytics outage");
        },
        identify() {
          throw new Error("analytics outage");
        },
        reset() {
          throw new Error("analytics outage");
        },
      },
    });

    expect(() => analytics.track("shell_viewed", { surface: "public-shell" })).not.toThrow();
    expect(() => analytics.identify("opaque:test-identity")).not.toThrow();
    expect(() => analytics.reset()).not.toThrow();
    expect(analytics.track("shell_viewed", { surface: "public-shell" })).toMatchObject({
      status: "failed",
    });
  });

  it("keeps operational and product telemetry separate from an application audit store", () => {
    const applicationAuditStore = { append: vi.fn() };
    const operationalProvider = { append: applicationAuditStore.append, emit: vi.fn() };
    const productProvider = {
      append: applicationAuditStore.append,
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
    };
    const analytics = createProductAnalytics({
      configuration: configured,
      provider: productProvider,
    });
    const operational = createOperationalTelemetry({
      sinks: [operationalProvider],
    });

    analytics.track("shell_viewed", { surface: "public-shell" });
    operational.diagnostic("web_shell_rendered", { route: "/", surface: "public-shell" });

    expect(
      analytics.track("shell_viewed", {
        auditEvent: { action: "financial-record-mutated", payload: "withheld" },
        surface: "public-shell",
      }),
    ).toMatchObject({ status: "rejected" });
    expect(
      operational.diagnostic("web_shell_rendered", {
        auditEvent: { action: "financial-record-mutated", payload: "withheld" },
        route: "/",
        surface: "public-shell",
      }),
    ).toMatchObject({ status: "rejected" });

    expect(productProvider.capture).toHaveBeenCalledOnce();
    expect(operationalProvider.emit).toHaveBeenCalledOnce();
    expect(applicationAuditStore.append).not.toHaveBeenCalled();
    expect(analytics).not.toHaveProperty("audit");
    expect(operational).not.toHaveProperty("audit");
  });
});
