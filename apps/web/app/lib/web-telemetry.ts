import {
  PRODUCT_ANALYTICS_REPLAY_ENABLED,
  createOperationalTelemetry,
  createProductAnalytics,
  type OperationalTelemetry,
  type OperationalDiagnosticEvent,
  type OperationalDiagnosticSink,
  type ProductAnalytics,
  type ProductAnalyticsConfiguration,
  type ProductAnalyticsProvider,
  type TelemetryDispatchResult,
} from "@personal-finance/telemetry";

export const POSTHOG_EU_HOST = "https://eu.i.posthog.com" as const;

export interface PostHogEnvironment {
  NEXT_PUBLIC_POSTHOG_HOST?: string;
  NEXT_PUBLIC_POSTHOG_KEY?: string;
}

export type PostHogConfiguration =
  | {
      apiKey: string;
      host: typeof POSTHOG_EU_HOST;
      replay: false;
      status: "configured";
    }
  | {
      host: string;
      reason: "invalid-key" | "missing-configuration" | "unsupported-host";
      replay: false;
      status: "disabled";
    };

export interface WebShellTelemetryProviders {
  createProductAnalyticsProvider?: (
    configuration: Extract<PostHogConfiguration, { status: "configured" }>,
  ) => ProductAnalyticsProvider | undefined;
  operationalSinks?: readonly OperationalDiagnosticSink[];
  productAnalytics?: ProductAnalyticsProvider;
}

export interface WebShellTelemetryRuntimeBoundary {
  openTelemetry?: {
    emitDiagnostic(event: OperationalDiagnosticEvent): void;
  };
  postHog?: {
    capture(eventName: string, properties: Readonly<Record<string, string>>): void;
    configure(configuration: Extract<PostHogConfiguration, { status: "configured" }>): void;
    identify(opaqueIdentity: string): void;
    reset(): void;
  };
  sentry?: {
    captureDiagnostic(event: OperationalDiagnosticEvent): void;
  };
}

export interface WebShellTelemetryRuntimeInitializationOptions {
  boundary?: WebShellTelemetryRuntimeBoundary;
  fetch?: typeof globalThis.fetch;
}

declare global {
  interface Window {
    __WAYFINDER_TELEMETRY_RUNTIME__?: WebShellTelemetryRuntimeBoundary;
    __WAYFINDER_TELEMETRY_PROVIDERS__?: WebShellTelemetryProviders;
  }
}

export interface WebShellTelemetryOptions {
  environment?: PostHogEnvironment;
  operational?: OperationalTelemetry;
  productAnalytics?: ProductAnalytics;
  providers?: WebShellTelemetryProviders;
}

export interface WebShellTelemetryResult {
  operational: TelemetryDispatchResult;
  productAnalytics: TelemetryDispatchResult;
}

export interface WebShellTelemetry {
  shellViewed(): WebShellTelemetryResult;
}

function defaultEnvironment(): PostHogEnvironment {
  return {
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  };
}

function isAcceptedPostHogHost(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      url.hostname === "eu.i.posthog.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function parsePostHogConfiguration(environment: PostHogEnvironment): PostHogConfiguration {
  const host = environment.NEXT_PUBLIC_POSTHOG_HOST?.trim() || POSTHOG_EU_HOST;
  const apiKey = environment.NEXT_PUBLIC_POSTHOG_KEY?.trim();

  if (!apiKey) {
    return {
      host,
      reason: "missing-configuration",
      replay: PRODUCT_ANALYTICS_REPLAY_ENABLED,
      status: "disabled",
    };
  }

  if (!/^phc_[A-Za-z0-9._-]+$/.test(apiKey)) {
    return {
      host,
      reason: "invalid-key",
      replay: PRODUCT_ANALYTICS_REPLAY_ENABLED,
      status: "disabled",
    };
  }

  if (!isAcceptedPostHogHost(host)) {
    return {
      host,
      reason: "unsupported-host",
      replay: PRODUCT_ANALYTICS_REPLAY_ENABLED,
      status: "disabled",
    };
  }

  return {
    apiKey,
    host: POSTHOG_EU_HOST,
    replay: PRODUCT_ANALYTICS_REPLAY_ENABLED,
    status: "configured",
  };
}

function adapterConfiguration(configuration: PostHogConfiguration): ProductAnalyticsConfiguration {
  return configuration.status === "configured"
    ? { replay: PRODUCT_ANALYTICS_REPLAY_ENABLED, status: "configured" }
    : {
        reason: "configuration-unavailable",
        replay: PRODUCT_ANALYTICS_REPLAY_ENABLED,
        status: "disabled",
      };
}

const DEFAULT_OPAQUE_IDENTITY = "opaque:web-shell";
const POSTHOG_API_KEY_FIELD = ["api", "key"].join("_");

function createDefaultPostHogRuntime(
  runtimeFetch: typeof globalThis.fetch | undefined,
): NonNullable<WebShellTelemetryRuntimeBoundary["postHog"]> {
  let configuration: Extract<PostHogConfiguration, { status: "configured" }> | undefined;
  let opaqueIdentity = DEFAULT_OPAQUE_IDENTITY;

  return {
    capture(eventName, properties) {
      if (!configuration || !runtimeFetch) {
        return;
      }

      const payload = {
        [POSTHOG_API_KEY_FIELD]: configuration.apiKey,
        event: eventName,
        properties: {
          ...properties,
          distinct_id: opaqueIdentity,
        },
      };

      try {
        void Promise.resolve(
          runtimeFetch(`${configuration.host}/capture/`, {
            body: JSON.stringify(payload),
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        ).catch(() => undefined);
      } catch {
        // Provider outages are isolated from the web shell.
      }
    },
    configure(nextConfiguration) {
      configuration = nextConfiguration;
    },
    identify(nextOpaqueIdentity) {
      opaqueIdentity = nextOpaqueIdentity;
    },
    reset() {
      opaqueIdentity = DEFAULT_OPAQUE_IDENTITY;
    },
  };
}

export function createDefaultWebShellTelemetryRuntime(
  runtimeFetch: typeof globalThis.fetch | undefined = typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : undefined,
): WebShellTelemetryRuntimeBoundary {
  return {
    // Live operational SDK bootstrap remains an environment-owned concern. These
    // initialized hooks are deliberately safe no-ops until a provider runtime is attached.
    openTelemetry: {
      emitDiagnostic() {},
    },
    postHog: createDefaultPostHogRuntime(runtimeFetch),
    sentry: {
      captureDiagnostic() {},
    },
  };
}

export function createWebShellTelemetryProvidersFromRuntimeBoundary(
  boundary: WebShellTelemetryRuntimeBoundary = {},
): WebShellTelemetryProviders {
  const operationalSinks: OperationalDiagnosticSink[] = [];

  if (boundary.openTelemetry) {
    operationalSinks.push({
      emit(event) {
        boundary.openTelemetry?.emitDiagnostic(event);
      },
    });
  }

  if (boundary.sentry) {
    operationalSinks.push({
      emit(event) {
        boundary.sentry?.captureDiagnostic(event);
      },
    });
  }

  return {
    operationalSinks,
    createProductAnalyticsProvider: boundary.postHog
      ? (configuration) => {
          const postHog = boundary.postHog;

          if (!postHog) {
            return undefined;
          }

          postHog.configure(configuration);

          return {
            capture(eventName, properties) {
              postHog.capture(eventName, properties);
            },
            identify(opaqueIdentity) {
              postHog.identify(opaqueIdentity);
            },
            reset() {
              postHog.reset();
            },
          };
        }
      : undefined,
  };
}

export function initializeWebShellTelemetryProviders({
  boundary,
  fetch: runtimeFetch,
}: WebShellTelemetryRuntimeInitializationOptions = {}): WebShellTelemetryProviders | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (!window.__WAYFINDER_TELEMETRY_RUNTIME__) {
    window.__WAYFINDER_TELEMETRY_RUNTIME__ =
      boundary ?? createDefaultWebShellTelemetryRuntime(runtimeFetch);
  }

  const providers =
    window.__WAYFINDER_TELEMETRY_PROVIDERS__ ??
    createWebShellTelemetryProvidersFromRuntimeBoundary(window.__WAYFINDER_TELEMETRY_RUNTIME__);

  window.__WAYFINDER_TELEMETRY_PROVIDERS__ = providers;

  return providers;
}

export function getWebShellTelemetryProviders(): WebShellTelemetryProviders | undefined {
  return initializeWebShellTelemetryProviders();
}

export function createWebShellTelemetry({
  environment = defaultEnvironment(),
  operational,
  productAnalytics,
  providers,
}: WebShellTelemetryOptions = {}): WebShellTelemetry {
  const postHogConfiguration = parsePostHogConfiguration(environment);
  let productAnalyticsProvider = providers?.productAnalytics;

  if (!productAnalyticsProvider && postHogConfiguration.status === "configured") {
    try {
      productAnalyticsProvider = providers?.createProductAnalyticsProvider?.(postHogConfiguration);
    } catch {
      // Provider initialization is optional and must never block the shell.
    }
  }
  const activeOperational =
    operational ??
    createOperationalTelemetry({
      sinks: providers?.operationalSinks,
    });
  const activeProductAnalytics =
    productAnalytics ??
    createProductAnalytics({
      configuration: adapterConfiguration(postHogConfiguration),
      provider: productAnalyticsProvider,
    });

  return {
    shellViewed() {
      return {
        operational: activeOperational.diagnostic("web_shell_rendered", {
          route: "/",
          surface: "public-shell",
        }),
        productAnalytics: activeProductAnalytics.track("shell_viewed", {
          surface: "public-shell",
        }),
      };
    },
  };
}
