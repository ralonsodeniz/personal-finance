# Product analytics and usage events platform

**Status:** decision accepted; implementation follow-up remains
**Date checked:** 2026-08-16
**Ticket:** [Product Analytics and Usage Events Platform](https://github.com/ralonsodeniz/personal-finance/issues/19)

## Scope

This decision covers low-sensitivity product-usage analytics: page views,
screen/navigation changes, feature interactions, custom usage events, funnels,
retention, paths, cohorts, and optional session replay. It does not cover
operational errors/logs/metrics/traces or application-owned security/audit
events.

Analytics must use an explicit allowlist. Never send balances, amounts,
transaction descriptions, account numbers, holdings, credentials, tokens,
raw resource IDs, or identifier-bearing URLs. Analytics must be
non-blocking/fail-open, respect consent and opt-out, reset identity on logout,
and have event-volume budgets and quota alerts.

## Accepted decision

Choose **PostHog** as the default product-analytics provider for v1, using an
EU Frankfurt project and a small provider-neutral application adapter.

PostHog is the best fit across the Next.js web/PWA and future Expo app: its
official documentation covers web capture, autocapture, custom events,
funnels, retention, paths, and an official React Native SDK with an Expo setup.
Its current free cloud tier lists 1 million analytics events per month, 5,000
web replay recordings, 2,500 mobile replay recordings, one-year retention, and
EU hosting.

Keep **Umami** as the alternative if self-hosting, data sovereignty, or a
permanently free self-hosted deployment is more important than a first-party
Expo SDK. Umami has strong current product-analytics features, but the native
client would need a custom API/adapter.

Plausible is better for privacy-first anonymous website analytics and Matomo is
a credible self-hosted/feature-rich alternative, but neither is as good a
cross-platform fit for an authenticated web plus future Expo product.

## Comparison

| Provider | Web/PWA | Future Expo/native | Free-first posture | Assessment |
| --- | --- | --- | --- | --- |
| **PostHog** | Official capture/autocapture, custom events, pageviews, funnels, retention, paths | Official React Native SDK and documented Expo installation | 1M analytics events/month, 5K web replays, 2.5K mobile replays, 1-year retention, EU Frankfurt | **Recommended** |
| **Umami** | Pageviews, custom events/properties, funnels, journeys, retention/cohorts, replay | No official Expo SDK found; direct API/custom adapter required | Free self-hosting; cloud Hobby has a 100K events/month and 6-month retention posture | Strong sovereignty/self-host alternative |
| **Plausible** | Excellent privacy-first pageviews and custom goals; richer funnels/journeys are paid | API/custom adapter needed for Expo | No permanent hosted free tier; EU hosted and paid | Good anonymous web analytics, not the sole product platform |
| **Matomo** | Broad web tracking, goals, funnels, cohorts, APIs | Native clients exist, but React Native/Expo integration is community-level | Free self-hosted edition; hosted cloud is paid after trial | Feature-rich self-host option with more operational burden |

## Boundary with operational observability

- **Sentry** is for frontend/backend errors, crashes, performance, and
  diagnostic breadcrumbs/context.
- **Grafana Cloud/OpenTelemetry** is for operational logs, metrics, traces, and
  full-stack telemetry when that depth is needed.
- **PostHog** is for sanitized product-usage analysis.
- **Application-owned storage** is for security/audit events and financial
  record history.

These systems may share opaque correlation IDs, but none of the external
platforms is authoritative for financial data, authorization, audit history,
or security decisions.

## Required adapter contract

Keep application code independent of PostHog:

```ts
productAnalytics.track(eventName, sanitizedProperties)
productAnalytics.screen(screenName, sanitizedProperties)
productAnalytics.identify(opaqueAnalyticsUserId)
productAnalytics.reset()
```

The adapter must enforce event/property allowlists, redaction, consent/opt-out,
logout reset, sampling/replay policy, and fail-open behavior. Disable
exception/error autocapture in the product-analytics project; errors belong in
the operational observability pipeline.

## Remaining decisions

1. Accept PostHog over Umami for the official Expo SDK and cross-platform
   analytics, or prioritize self-hosted sovereignty.
2. Select EU cloud versus self-hosting and complete the DPA/legal/consent
   review before identified analytics is enabled.
3. Define the provider-neutral event taxonomy and pseudonymous identity model.
4. Decide whether replay is needed at all; if enabled, allowlist safe screens,
   mask content, sample, and test redaction first.
5. Set monthly event/replay budgets and hard usage alerts.

## Sources checked

- [PostHog product analytics](https://posthog.com/docs/product-analytics)
- [PostHog pricing](https://posthog.com/pricing)
- [PostHog event capture](https://posthog.com/docs/product-analytics/capture-events)
- [PostHog autocapture](https://posthog.com/docs/product-analytics/autocapture)
- [PostHog React Native/Expo](https://posthog.com/docs/libraries/react-native)
- [Umami documentation](https://docs.umami.is/docs)
- [Umami pricing](https://umami.is/pricing)
- [Plausible](https://plausible.io/)
- [Plausible custom event goals](https://plausible.io/docs/custom-event-goals)
- [Matomo pricing](https://matomo.org/pricing/)
- [Matomo product and app analytics](https://matomo.org/faq/getting-started/matomo-for-product-and-app-analytics/)
