import { describe, expect, it, vi } from "vitest";

import {
  POSTHOG_EU_HOST,
  createWebShellTelemetryProvidersFromRuntimeBoundary,
  createWebShellTelemetry,
  getWebShellTelemetryProviders,
  parsePostHogConfiguration,
} from "./web-telemetry";

describe("web shell telemetry", () => {
  it("emits the shell diagnostic and usage event only through the injected adapters", () => {
    const diagnostics: unknown[] = [];
    const analytics: unknown[] = [];
    const telemetry = createWebShellTelemetry({
      environment: {
        NEXT_PUBLIC_POSTHOG_HOST: POSTHOG_EU_HOST,
        NEXT_PUBLIC_POSTHOG_KEY: "phc_public_test_key",
      },
      providers: {
        operationalSinks: [
          {
            emit(event) {
              diagnostics.push({ sink: "opentelemetry", event });
            },
          },
          {
            emit(event) {
              diagnostics.push({ sink: "sentry", event });
            },
          },
        ],
        createProductAnalyticsProvider(configuration) {
          expect(configuration).toMatchObject({
            host: POSTHOG_EU_HOST,
            replay: false,
            status: "configured",
          });
          return {
            capture(eventName, properties) {
              analytics.push({ eventName, properties });
            },
            identify: vi.fn(),
            reset: vi.fn(),
          };
        },
        productAnalytics: undefined,
      },
    });

    const result = telemetry.shellViewed();

    expect(result).toMatchObject({
      operational: { status: "sent" },
      productAnalytics: { status: "sent" },
    });
    expect(diagnostics).toEqual([
      {
        event: { attributes: { route: "/", surface: "public-shell" }, name: "web_shell_rendered" },
        sink: "opentelemetry",
      },
      {
        event: { attributes: { route: "/", surface: "public-shell" }, name: "web_shell_rendered" },
        sink: "sentry",
      },
    ]);
    expect(analytics).toEqual([
      { eventName: "shell_viewed", properties: { surface: "public-shell" } },
    ]);
  });

  it("accepts only the EU PostHog configuration boundary", () => {
    expect(
      parsePostHogConfiguration({
        NEXT_PUBLIC_POSTHOG_HOST: POSTHOG_EU_HOST,
        NEXT_PUBLIC_POSTHOG_KEY: "phc_public_test_key",
      }),
    ).toEqual({
      apiKey: "phc_public_test_key",
      host: POSTHOG_EU_HOST,
      replay: false,
      status: "configured",
    });
    expect(parsePostHogConfiguration({})).toMatchObject({
      reason: "missing-configuration",
      status: "disabled",
    });
    expect(
      parsePostHogConfiguration({
        NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
        NEXT_PUBLIC_POSTHOG_KEY: "phc_public_test_key",
      }),
    ).toMatchObject({
      reason: "unsupported-host",
      status: "disabled",
    });
  });

  it("registers OpenTelemetry, Sentry, and EU PostHog runtime adapters", () => {
    const openTelemetry = { emitDiagnostic: vi.fn() };
    const sentry = { captureDiagnostic: vi.fn() };
    const postHog = {
      capture: vi.fn(),
      configure: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
    };
    const telemetry = createWebShellTelemetry({
      environment: {
        NEXT_PUBLIC_POSTHOG_HOST: POSTHOG_EU_HOST,
        NEXT_PUBLIC_POSTHOG_KEY: "phc_public_test_key",
      },
      providers: createWebShellTelemetryProvidersFromRuntimeBoundary({
        openTelemetry,
        postHog,
        sentry,
      }),
    });

    expect(telemetry.shellViewed()).toMatchObject({
      operational: { status: "sent" },
      productAnalytics: { status: "sent" },
    });
    const expectedDiagnostic = {
      attributes: { route: "/", surface: "public-shell" },
      name: "web_shell_rendered",
    };
    expect(openTelemetry.emitDiagnostic).toHaveBeenCalledWith(expectedDiagnostic);
    expect(sentry.captureDiagnostic).toHaveBeenCalledWith(expectedDiagnostic);
    expect(postHog.configure).toHaveBeenCalledWith({
      apiKey: "phc_public_test_key",
      host: POSTHOG_EU_HOST,
      replay: false,
      status: "configured",
    });
    expect(postHog.capture).toHaveBeenCalledWith("shell_viewed", {
      surface: "public-shell",
    });
  });

  it("registers the runtime boundary once at the web-shell seam", () => {
    const boundary = {
      openTelemetry: { emitDiagnostic: vi.fn() },
      postHog: {
        capture: vi.fn(),
        configure: vi.fn(),
        identify: vi.fn(),
        reset: vi.fn(),
      },
      sentry: { captureDiagnostic: vi.fn() },
    };
    const runtimeWindow = { __WAYFINDER_TELEMETRY_RUNTIME__: boundary } as unknown as Window;
    const globalWithWindow = globalThis as typeof globalThis & { window?: Window };
    const originalWindow = globalWithWindow.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: runtimeWindow,
    });

    try {
      const providers = getWebShellTelemetryProviders();

      expect(providers).toBe(runtimeWindow.__WAYFINDER_TELEMETRY_PROVIDERS__);
      expect(providers?.operationalSinks).toHaveLength(2);
      expect(runtimeWindow.__WAYFINDER_TELEMETRY_PROVIDERS__).toBe(providers);
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: originalWindow,
        });
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });

  it("keeps the shell non-blocking when provider initialization throws", () => {
    const emit = vi.fn();
    const telemetry = createWebShellTelemetry({
      environment: {
        NEXT_PUBLIC_POSTHOG_HOST: POSTHOG_EU_HOST,
        NEXT_PUBLIC_POSTHOG_KEY: "phc_public_test_key",
      },
      providers: {
        operationalSinks: [{ emit }],
        createProductAnalyticsProvider() {
          throw new Error("provider initialization failed");
        },
      },
    });

    expect(() => telemetry.shellViewed()).not.toThrow();
    expect(emit).toHaveBeenCalledOnce();
    expect(telemetry.shellViewed()).toMatchObject({
      operational: { status: "sent" },
      productAnalytics: { status: "disabled" },
    });
  });

  it("keeps the shell non-blocking when analytics configuration is missing", () => {
    const telemetry = createWebShellTelemetry({ environment: {} });

    expect(() => telemetry.shellViewed()).not.toThrow();
    expect(telemetry.shellViewed()).toMatchObject({
      operational: { status: "disabled" },
      productAnalytics: { status: "disabled" },
    });
  });
});
