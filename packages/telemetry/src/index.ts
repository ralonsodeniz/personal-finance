export const PRODUCT_ANALYTICS_REPLAY_ENABLED = false as const;

const operationalDiagnosticPropertyAllowlist = {
  web_shell_rendered: ["route", "surface"],
} as const;

const operationalDiagnosticPropertyValues = {
  route: ["/"] as const,
  surface: ["public-shell"] as const,
} as const;

const productAnalyticsEventPropertyAllowlist = {
  shell_viewed: ["surface"],
} as const;

const productAnalyticsPropertyValues = {
  surface: ["public-shell"] as const,
} as const;

export type TelemetryDispatchStatus = "disabled" | "failed" | "rejected" | "sent";

export interface TelemetryDispatchResult {
  reason?: string;
  status: TelemetryDispatchStatus;
}

export type OperationalDiagnosticName = keyof typeof operationalDiagnosticPropertyAllowlist;

export interface OperationalDiagnosticEvent {
  attributes: Readonly<Record<string, string>>;
  name: OperationalDiagnosticName;
}

export interface OperationalDiagnosticSink {
  emit(event: OperationalDiagnosticEvent): void;
}

export interface OperationalTelemetry {
  diagnostic(name: string, attributes: Record<string, unknown>): TelemetryDispatchResult;
}

export interface OperationalTelemetryOptions {
  sinks?: readonly OperationalDiagnosticSink[];
}

export type ProductAnalyticsEventName = keyof typeof productAnalyticsEventPropertyAllowlist;

export interface ProductAnalyticsProvider {
  capture(eventName: ProductAnalyticsEventName, properties: Readonly<Record<string, string>>): void;
  identify(opaqueIdentity: string): void;
  reset(): void;
}

export type ProductAnalyticsConfiguration =
  | {
      replay: false;
      status: "configured";
    }
  | {
      reason: "configuration-unavailable";
      replay: false;
      status: "disabled";
    };

export interface ProductAnalytics {
  identify(identity: string): TelemetryDispatchResult;
  reset(): TelemetryDispatchResult;
  track(eventName: string, properties?: Record<string, unknown>): TelemetryDispatchResult;
}

export interface ProductAnalyticsOptions {
  configuration?: ProductAnalyticsConfiguration;
  provider?: ProductAnalyticsProvider;
}

function rejected(reason: string): TelemetryDispatchResult {
  return { reason, status: "rejected" };
}

function disabled(reason: string): TelemetryDispatchResult {
  return { reason, status: "disabled" };
}

function failed(reason: string): TelemetryDispatchResult {
  return { reason, status: "failed" };
}

function sent(): TelemetryDispatchResult {
  return { status: "sent" };
}

function includesString(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

function sanitizeAllowlistedProperties(
  name: string,
  properties: Record<string, unknown>,
  eventPropertyAllowlist: Readonly<Record<string, readonly string[]>>,
  propertyValueAllowlist: Readonly<Record<string, readonly string[]>>,
): { properties: Record<string, string>; reason?: string } {
  const allowedProperties = eventPropertyAllowlist[name];

  if (!allowedProperties) {
    return { properties: {}, reason: "event-not-allowed" };
  }

  const sanitized: Record<string, string> = {};

  for (const [property, value] of Object.entries(properties)) {
    if (!includesString(allowedProperties, property)) {
      return { properties: {}, reason: "property-not-allowed" };
    }

    const allowedValues = propertyValueAllowlist[property];

    if (!allowedValues || typeof value !== "string" || !includesString(allowedValues, value)) {
      return { properties: {}, reason: "property-value-not-allowed" };
    }

    sanitized[property] = value;
  }

  return { properties: sanitized };
}

export function createOperationalTelemetry({
  sinks = [],
}: OperationalTelemetryOptions = {}): OperationalTelemetry {
  return {
    diagnostic(name, attributes) {
      const result = sanitizeAllowlistedProperties(
        name,
        attributes,
        operationalDiagnosticPropertyAllowlist,
        operationalDiagnosticPropertyValues,
      );

      if (result.reason) {
        return rejected(result.reason);
      }

      if (sinks.length === 0) {
        return disabled("no-provider");
      }

      let delivered = false;

      for (const sink of sinks) {
        try {
          sink.emit({
            attributes: result.properties,
            name: name as OperationalDiagnosticName,
          });
          delivered = true;
        } catch {
          // Operational telemetry must never block the web shell.
        }
      }

      return delivered ? sent() : failed("provider-failure");
    },
  };
}

function isOpaqueIdentity(value: string): boolean {
  return /^opaque:[a-z0-9][a-z0-9_-]{0,63}$/i.test(value);
}

export function createProductAnalytics({
  configuration = {
    reason: "configuration-unavailable",
    replay: PRODUCT_ANALYTICS_REPLAY_ENABLED,
    status: "disabled",
  },
  provider,
}: ProductAnalyticsOptions = {}): ProductAnalytics {
  function dispatch(
    callback: (activeProvider: ProductAnalyticsProvider) => void,
  ): TelemetryDispatchResult {
    if (configuration.status !== "configured") {
      return disabled(configuration.reason);
    }

    if (!provider) {
      return disabled("no-provider");
    }

    try {
      callback(provider);
      return sent();
    } catch {
      // Product analytics is intentionally fail-open and non-blocking.
      return failed("provider-failure");
    }
  }

  function identify(identity: string): TelemetryDispatchResult {
    if (!isOpaqueIdentity(identity)) {
      return rejected("identity-not-opaque");
    }

    return dispatch((activeProvider) => activeProvider.identify(identity));
  }

  function reset(): TelemetryDispatchResult {
    return dispatch((activeProvider) => activeProvider.reset());
  }

  function track(eventName: string, properties: Record<string, unknown> = {}) {
    const result = sanitizeAllowlistedProperties(
      eventName,
      properties,
      productAnalyticsEventPropertyAllowlist,
      productAnalyticsPropertyValues,
    );

    if (result.reason) {
      return rejected(result.reason);
    }

    return dispatch((activeProvider) =>
      activeProvider.capture(eventName as ProductAnalyticsEventName, result.properties),
    );
  }

  return { identify, reset, track };
}
