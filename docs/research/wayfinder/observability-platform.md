# Observability platform for operational events and errors

**Status:** decision accepted; implementation follow-up remains
**Date checked:** 2026-08-16
**Ticket:** [Observability Platform for Operational Events and Errors](https://github.com/ralonsodeniz/personal-finance/issues/18)

## Scope

This decision covers operational errors, logs, metrics, traces, alerts, and
diagnostic events for the Next.js web/PWA and future Expo client. It does not
make a monitoring SaaS the source of truth for security/audit events or
financial-record history. Those remain application-owned and require their own
durable retention, integrity, access, and export rules.

The application must emit an allowlisted, provider-neutral telemetry shape and
redact before egress. Do not send balances, transaction descriptions, account
numbers, tokens, authorization headers, request bodies, or audit payloads to a
monitoring provider. Correlate operational telemetry to application-owned
events only through opaque identifiers such as a trace ID or audit-event ID.

## Diagnostic interactions versus product analytics

Sentry can capture browser clicks, key presses, navigation changes, requests,
and custom breadcrumbs. Those signals are valuable as the trail leading to an
error, but they are not a substitute for product-usage analysis. Grafana Faro
can collect frontend sessions, user behavior, custom events, errors, and traces
and correlate them with backend telemetry; its primary model is still
frontend/operational observability.

Page views, feature interactions, funnels, retention, paths, and other usage
questions are tracked separately in [Product Analytics and Usage Events
Platform](https://github.com/ralonsodeniz/personal-finance/issues/19). Do not
send financial values or descriptions to either class of platform.

## Accepted decision

Choose **Sentry as the initial operational observability platform**, with
OpenTelemetry remaining the instrumentation and portability boundary.

This recommendation is based on the current scope: Next.js/PWA first, Expo
later, free-tier-first, and an explicit need for useful error and operational
event triage. Sentry has the clearest first-party Expo/EAS integration and
strongest error grouping/workflow. Its free Developer plan is appropriate for
early non-production work, subject to quota and PII-redaction checks.

Keep the provider adapter and telemetry schema replaceable. Revisit Grafana
Cloud if full-stack logs/metrics/traces, OTel-native routing, or long-term
provider portability becomes more important than first-class error/crash
triage. Do not select Datadog initially because its permanent free offering
does not include the complete APM/log/RUM surface needed here and its paid
cost model is materially more complex.

## Comparison

| Platform | Strength | Limitation | Current assessment |
| --- | --- | --- | --- |
| **Sentry** | Best error grouping and issue workflow; official Next.js integration; official Expo/EAS source-map, update, and dashboard guidance; useful logs, traces, metrics, and monitors | Native issue/metric models are proprietary; OTLP metrics are not the same as a general-purpose OTel metrics backend; free quotas require monitoring | **Recommended initial platform** |
| **Grafana Cloud** | Strongest OTel-first full-stack boundary; native OTLP for metrics, logs, and traces; broad permanent free tier; Grafana/Loki/Tempo/Alloy portability | No equivalent official Expo/React Native SDK was found; browser errors are less purpose-built for grouping; production redaction/routing benefits from Alloy or a Collector | **Strong alternative; run an Expo spike before selecting it** |
| **Datadog** | Broadest integrated infrastructure/APM/log/RUM/mobile operations; official Next.js and Expo integrations; mature monitors | APM/log/RUM are paid products rather than part of the permanent free tier; higher cost and product coupling; some OTel data does not map to all Datadog-native products | **Enterprise/scale alternative, not initial choice** |

## Free-tier and regional facts

- Sentry Developer is listed at $0 with one user, 5,000 errors, 5 GB logs,
  5 GB application metrics, 5 million spans, limited replays/monitors, and a
  30-day lookback. Germany storage is available; data must still be scrubbed
  before sending.
- Grafana Cloud Free is listed at $0 with 14-day retention, 10,000 active
  metric series per month, 50 GB logs, 50 GB traces, and 50,000 frontend
  sessions per month. Region selection is made per stack and cannot be changed
  in place.
- Datadog's permanent free tier is primarily infrastructure monitoring. APM,
  logs, and RUM require paid products after the trial, so it is not comparable
  to the Sentry/Grafana free-tier posture for this use case.

These limits are current source checks, not permanent guarantees; revalidate
them before provisioning a production account.

## Required integration boundary

1. Instrument server and client code through a small internal telemetry API and
   OpenTelemetry-compatible conventions.
2. Apply allowlists and redaction before data leaves the application or a
   collector. Treat default vendor scrubbing as a second layer, not the first.
3. Use opaque release, environment, service, trace, and audit-event IDs. Never
   use raw financial identifiers as tags or searchable attributes.
4. Keep security/audit events in an application-owned append-only or audited
   store. Monitoring alerts may reference those events but cannot replace them.
5. Configure EU data storage and complete the DPA/subprocessor review before
   real financial data is introduced.

## Follow-ups after acceptance

- Confirm the Sentry region and free-tier quota alerts.
- Verify Next.js server/client redaction, source maps, and release tagging.
- Verify a future Expo development build, EAS source maps, update releases, and
  crash grouping before native implementation is considered supported.
- Define the vendor-neutral telemetry schema and redaction test cases before
  SDK wiring.
- Reconsider Grafana Cloud if the system needs full logs/metrics/traces or
  collector-based routing that Sentry does not satisfy.

## Sources checked

- [Sentry pricing](https://sentry.io/pricing/)
- [Expo Sentry guide](https://docs.expo.dev/guides/using-sentry/)
- [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry event grouping](https://docs.sentry.io/concepts/data-management/event-grouping/)
- [Sentry security](https://sentry.io/security/)
- [Grafana Cloud pricing](https://grafana.com/pricing/?tab=free)
- [Grafana OTLP ingestion](https://grafana.com/docs/grafana-cloud/observe-and-act/send-data/otlp/send-data-otlp/)
- [Grafana Next.js frontend observability](https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/frontend-observability/get-started/instrument-nextjs/)
- [Grafana frontend error tracking](https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/frontend-observability/instrument/error-tracking/)
- [Grafana regional availability](https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/account-management/regional-availability/)
- [Datadog pricing](https://www.datadoghq.com/pricing/)
- [Datadog OpenTelemetry](https://docs.datadoghq.com/opentelemetry/getting_started/)
- [Datadog Next.js RUM](https://docs.datadoghq.com/real_user_monitoring/guide/monitor-your-nextjs-app-with-rum/)
- [Datadog Expo integration](https://docs.datadoghq.com/error_tracking/frontend/mobile/expo/)
- [Datadog sensitive-data scanner](https://docs.datadoghq.com/security/sensitive_data_scanner/)
