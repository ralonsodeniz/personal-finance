---
status: accepted
---

# Gate live providers behind manual-first ingestion

The first usable investment tracker will use manual records and staged CSV or
XLSX imports, plus fixtures and fake adapters, without live provider
credentials. Live investment or wealth connectivity comes only after exact
Spain and EU institution and product coverage, field completeness, consent and
security, freshness and revision, reconciliation, deletion and outage,
licensing, and controlled-test evidence. Market-data and cash connectors remain
separate later phases.

## Considered options

- Start with a live provider and shape the domain around its responses. Rejected
  because public coverage claims do not prove the fields or institutions needed
  by this product.
- Use one provider for accounts, market data, NAVs, FX, and corporate actions.
  Rejected because the researched source classes have different coverage,
  freshness, licensing, and consent boundaries.

## Consequences

- The first release can be useful without credentials or vendor contracts.
- Later connections must pass a coverage and entitlement gate and remain
  optional per Financial Account.
- Provider observations, revisions, outages, and freshness remain visible
  instead of silently replacing imported history.
