---
id: deferred-work
title: Deferred product and platform work
sidebar_label: Deferred work
---

This bootstrap establishes boundaries, not the finance product. The following
items are intentionally future work and must be specified by the finance-domain
and implementation tickets that follow.

## Finance domain

- Finance-domain schemas and tables, including Financial Accounts,
  transactions, investments, savings, currencies, reports, attachments, and
  import jobs, are not defined here.
- The exact Resource hierarchy, inheritance rules, field visibility, and
  authorization projections are not defined here.
- Versioned API resources, request/response DTOs, endpoint behavior, paging,
  concurrency, and error examples are not defined here. The contracts package
  is only a future location and boundary.
- CSV behavior is future work: accepted columns, encoding, delimiter,
  line-ending, dates, decimals, duplicate detection, validation errors,
  idempotency, import status, and export semantics all need a dedicated
  decision.

## Native platform

- The Expo/React Native application and its screens, native UI components,
  token adapter, secure-storage implementation, deep-link setup, and EAS
  credentials are future work.
- Native test infrastructure and device-flow automation are candidates
  documented in [Native testing candidates](native/testing), not implemented
  in this ticket.
- Offline writes, synchronization, push notifications, and conflict resolution
  remain deferred until their data and security semantics are specified.

The static documentation build is deliberately useful before these decisions
are made: it records the boundary and makes the missing work visible without
inventing schemas, API resources, CSV rules, or native runtime behavior.
