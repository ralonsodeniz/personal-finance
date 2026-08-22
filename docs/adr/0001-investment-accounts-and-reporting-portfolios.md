---
status: accepted
---

# Separate source accounts from reporting portfolios

Wayfinder treats each bank, brokerage, pension, and term deposit as a typed
Financial Account that owns its activities, holdings, lots, and valuations.
Reporting Portfolios are read-only scopes over those accounts, and manual and
imported records share one canonical Activity model with append-only
corrections. This preserves source provenance, supports incomplete statements,
and enables cross-account reporting without duplicating balances.

## Considered options

- Treat each reporting portfolio as an independent ledger. Rejected because it
  would duplicate ownership and create reconciliation problems when an account
  appears in more than one view.
- Force every source into a transaction-only or holdings-only mode. Rejected
  because real sources provide different evidence, including activity exports,
  current holdings, and dated value snapshots.

## Consequences

- A report must disclose its account scope, evidence coverage, valuation date,
  currency, and data quality.
- Incomplete history is valid input, but basis and derived performance can be
  unknown or estimated.
- Corrections, reconciliation, and import provenance are part of the domain
  record rather than hidden cleanup steps.
