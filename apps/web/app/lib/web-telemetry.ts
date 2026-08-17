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

export function getWebShellTelemetryProviders(): WebShellTelemetryProviders | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const providers =
    window.__WAYFINDER_TELEMETRY_PROVIDERS__ ??
    createWebShellTelemetryProvidersFromRuntimeBoundary(window.__WAYFINDER_TELEMETRY_RUNTIME__);

  window.__WAYFINDER_TELEMETRY_PROVIDERS__ = providers;

  return providers;
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
