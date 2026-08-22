# Investment tracker product brief

Status: accepted information architecture, implementation handoff in progress  
Date: 2026-08-22  
Scope: Personal Finance web/PWA first, future Expo client

## Product decision

The investment tracker uses the A+ hierarchy from the mobile prototype:

1. The overview leads with total value, reporting currency, valuation date, and
   a readable trend.
2. A compact `What needs a look` panel brings stale Valuations, incomplete
   basis, pending Import Batches, and Reconciliation discrepancies into the
   first view.
3. A compact `No unlabeled return` panel shows performance, income, and costs
   only with their method, period, scope, and data-availability state.
4. Financial Account, Holding, Activity, allocation, and detailed performance
   views remain available through progressive disclosure.

The overview is an orientation layer. It is not the complete ledger and it
does not replace source evidence. The prototype decision is recorded on
[Mobile-First Investment Overview and Drill-Down Prototype](https://github.com/ralonsodeniz/personal-finance/issues/59).

## Goals

- Show a trustworthy Reporting Portfolio summary on a small screen.
- Support market Instruments, pension plans, cash, term deposits, and other
  manually represented assets when a dated Valuation is available.
- Accept manual records and staged CSV or XLSX imports without requiring a
  Provider Connection.
- Explain where every displayed value came from, when it was observed, and
  whether it is complete enough for the requested calculation.
- Let a user move from a summary number to its Financial Account, Instrument,
  Holding, Activity, Import Batch, Valuation, or Reconciliation evidence.
- Keep the client-facing boundary usable by the current web/PWA and a future
  independently released Expo client.

## Non-goals for the first implementation

- Trading, order execution, or automated investment advice.
- A live market-data or wealth connection before its coverage and entitlement
  evidence is verified.
- Tax filing or jurisdiction-specific tax advice.
- Full offline mutation support before conflict, retention, export, and device
  protection rules are designed.
- Silent correction of imported or provider-supplied records.

## Domain boundaries to preserve

The product uses the vocabulary and boundaries in
[CONTEXT.md](../../CONTEXT.md), [ADR 0001](../adr/0001-investment-accounts-and-reporting-portfolios.md),
and [ADR 0002](../adr/0002-manual-first-provider-strategy.md).

- A **Financial Account** owns source balances, Activities, Holdings, Lots, and
  Valuations. It is not a login identity.
- An **Instrument** is canonical across Providers. A provider symbol or label
  is an alias, not the product identity.
- An **Activity** is the dated economic event model. Contributions, trades,
  distributions, fees, taxes, transfers, and Corporate Actions are typed
  Activities.
- A **Holding** is the current or as-of quantity or value of an Instrument in a
  Financial Account. It can be derived from Activities or supported by a
  source snapshot when history is incomplete.
- A **Lot** carries acquisition date, basis, currency, and lineage. It supports
  Book Cost and Tax Basis views but does not replace the Holding.
- A **Valuation** always has an as-of time, source, currency, and Valuation
  quality. Missing or stale evidence is an explicit state, not zero.
- A **Reporting Portfolio** is a saved, read-only scope over selected Financial
  Accounts. It does not duplicate or own their balances.
- An **Import Batch** preserves source rows, mapping, review, and outcome.
- **Provenance** and **Reconciliation** remain visible in detail views and in
  any report that depends on incomplete or conflicting evidence.
- A **Provider Observation** never silently replaces a canonical Activity or
  Valuation. Provider Connections remain optional and revocable.

## Information architecture

The production route can live under the authenticated workspace, for example
`/workspace/investments`. The exact route name is a routing decision, not a
domain concept. The page surfaces are:

### 1. Investment overview

This is the A+ entry point for one selected Reporting Portfolio.

Order on mobile:

1. Reporting Portfolio name, reporting currency, total value, and as-of date.
2. Trend chart with a visible `View trend data` table alternative.
3. One compact health summary with the highest-priority open signals.
4. One compact performance summary with method and coverage labels.
5. Financial Account summary rows.
6. Holding summary rows.
7. Allocation summary and an accessible data table.

The first view should answer four questions without a horizontal scroll:

- What is the selected scope worth?
- How current is the displayed value?
- What needs attention?
- What kind of return or income is being shown?

The overview should show at most the most important open signals. `View all`
opens the health and review surface. It must not hide the existence of more
signals when the list is truncated.

### 2. Health and import review

This surface turns data problems into actions. It groups issues by state and
links each one to its evidence:

- stale or missing Valuation;
- incomplete Book Cost or Tax Basis;
- pending Import Batch rows;
- unmapped or duplicate Activities;
- Reconciliation discrepancy;
- Provider Observation unavailable or revoked;
- calculation not computable because required evidence is absent.

Review actions create a Correction, map an Import Batch row, mark a source
value as intentionally unchanged, add a manual Valuation, or open the related
Financial Account or Holding. They do not overwrite the original evidence.

Each issue displays its severity, affected resource, source, as-of date, and
next action. Empty health means `No open data issues`, not a blank card.

### 3. Financial Account and source detail

This surface explains one source-owned Financial Account. It should show:

- account type and Provider identity when known;
- latest balance or Valuation with quality and as-of date;
- evidence coverage and last import or observation;
- Holdings and their source support;
- recent Activities;
- pending Import Batches and Reconciliation status;
- native currency and any Reporting Currency conversion evidence.

The account view must distinguish a statement snapshot from a complete
Activity history. A current balance can be usable while historical gain,
income, or Tax Basis remains unknown.

### 4. Holding and Instrument detail

This surface explains one Holding and its canonical Instrument:

- Instrument name, type, identifiers, and Provider aliases;
- quantity, unit, current value, native currency, and Reporting Currency value;
- Valuation source, as-of time, and Valuation quality;
- Book Cost and Tax Basis as separate views;
- Lots when lineage is available;
- derived or snapshot support;
- linked Activities and Corporate Actions;
- Provenance and Reconciliation state.

The detail sheet in the prototype is only the first interaction. Production
detail needs a full route or sheet that can handle long evidence histories and
accessible table navigation.

### 5. Performance, allocation, income, and cost detail

This surface reports the selected Reporting Portfolio and its date range. It
must show:

- Money-Weighted Return, with the external-flow convention and cash-flow
  coverage;
- Time-Weighted Return, with valuation checkpoints and missing-period state;
- absolute change and the contribution of External Flows;
- recorded income by Activity type;
- recorded costs by Activity type;
- allocation by canonical asset class and the target state when a target has
  been configured;
- native amounts, Reporting Currency amounts, and dated FX evidence where
  conversion affects the result;
- data-quality warnings that limit interpretation.

The product must never show a bare percentage. If a metric is not computable,
show the reason and the action needed. If it is estimated, say what was
estimated. If it is based on incomplete history, show the coverage boundary.

## Shared data states

Every summary and detail surface needs a consistent state vocabulary.

| State                      | Meaning                                                              | User treatment                                                                 |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Confirmed                  | Evidence satisfies the use case's freshness and completeness policy. | Show the value and its source and as-of date.                                  |
| Stale                      | Evidence exists but is older than the applicable Freshness Policy.   | Show the value with a stale marker and review action.                          |
| Missing                    | The app has no usable evidence for the requested field.              | Show `Not available` and the missing-evidence action.                          |
| Estimated                  | The value is derived under an explicit estimation policy.            | Show the method, inputs, and estimation marker.                                |
| Manually overridden        | A user added or corrected a value while retaining prior evidence.    | Show the correction link, author, date, and reason.                            |
| Import pending             | An Import Batch contains rows not yet mapped or accepted.            | Show pending count and review action.                                          |
| Reconciliation discrepancy | App records and external evidence disagree.                          | Show both sides and do not auto-correct.                                       |
| Not computable             | Required valuations, cash flows, lots, or FX evidence are absent.    | Explain the missing prerequisite instead of showing a partial metric as final. |

Loading, empty, permission, offline, and server-error states use the same
labels and retain the last known as-of date where it is safe to do so. A stale
value and an unavailable value are never represented by the same color alone.

## Read-model and contract boundary

The web/PWA and future Expo client need stable, purpose-built read models. They
must not consume Drizzle rows or server domain objects directly.

The first contract set should cover these representations:

```text
GET /v1/reporting-portfolios/{reportingPortfolioId}/overview
GET /v1/reporting-portfolios/{reportingPortfolioId}/health
GET /v1/reporting-portfolios/{reportingPortfolioId}/accounts
GET /v1/reporting-portfolios/{reportingPortfolioId}/holdings/{holdingId}
GET /v1/reporting-portfolios/{reportingPortfolioId}/performance
GET /v1/reporting-portfolios/{reportingPortfolioId}/activity
POST /v1/reporting-portfolios/{reportingPortfolioId}/import-batches
GET /v1/import-batches/{importBatchId}
POST /v1/import-batches/{importBatchId}/review
```

These paths are a starting boundary for contract design. They do not authorize
an implementation to skip resource-level authorization, pagination, idempotency,
conditional writes, or privacy-safe cache headers.

### Overview representation

The overview read model should contain:

- Reporting Portfolio identity and selected Financial Account scope;
- Reporting Currency;
- total value, valuation date, and aggregate Valuation quality;
- period start, period end, absolute change, and percentage change with method;
- compact performance, income, and cost summaries with availability states;
- attention count and the first visible signals;
- account summaries with value, evidence type, and freshness;
- holding summaries with Instrument identity, value, quantity, allocation, and
  gain availability;
- allocation segments and target configuration state;
- a server-provided `generatedAt` value for cache and diagnostic purposes.

### Mutations

Import and manual-entry mutations should be idempotent where retries can occur.
They should return an Import Batch or Correction identifier and a review state,
not pretend that the final holdings are synchronously complete. The review
surface then reads the batch and applies accepted mappings through the canonical
Activity model.

All financial responses default to private or no-store cache policy until a
resource-specific review approves a safer policy. Response errors use the
repository's planned `application/problem+json` boundary. Financial values,
source rows, tokens, and account identifiers must not enter operational logs,
product analytics, or error telemetry.

## Accessibility and responsive rules

- Every chart has a text summary and an expandable table with captions and
  scoped headers.
- Every status uses text and iconography in addition to color.
- All rows that open details are keyboard reachable and have a visible focus
  state. Touch targets are at least 44 by 44 CSS pixels.
- The overview remains a single-column reading path on narrow screens. Desktop
  may use two-column context cards, but no critical content depends on side by
  side placement.
- The page keeps the reporting scope, currency, and as-of date near every
  summary where a user could otherwise mistake two scopes for one.
- Reduced-motion users receive no required animation. Motion must not carry the
  meaning of stale, missing, or changed financial data.
- Future Expo screens reuse the same information order and state vocabulary,
  but do not need to preserve web-specific layout or URL behavior.

## Delivery phases

### Phase 0: contracts and fixtures

- Define DTO schemas and Problem Details examples.
- Build fixture data for complete, stale, missing, estimated, imported, and
  reconciled states.
- Add application read models behind provider-free fake adapters.
- Confirm money, native currency, dated FX, date range, and enum serialization.

### Phase 1: manual and file-based v1

- Add manual Financial Account, Instrument, Valuation, and Activity entry.
- Accept MyInvestor-shaped CSV/XLSX through staged Import Batches.
- Build the overview, account detail, and health/import review surfaces.
- Keep all review actions append-only and provenance-aware.

### Phase 2: holding and reporting detail

- Add Holding and Instrument detail with snapshot fallback.
- Add Lots, Book Cost, Tax Basis, and Reconciliation views where evidence
  exists.
- Add allocation and accessible chart/table representations.

### Phase 3: explainable performance

- Add MWR, TWR, income, costs, External Flow, and FX-aware reporting.
- Expose calculation coverage and Not computable states.
- Add regression fixtures for incomplete history and mixed account scopes.

### Phase 4: gated Provider Connections

- Evaluate one Provider class at a time against the decision recorded in
  [Phased Investment Ingestion and Provider Strategy](https://github.com/ralonsodeniz/personal-finance/issues/63).
- Keep account, market or NAV, identity, and FX/reference Providers separate.
- Do not make a live connection a prerequisite for the manual-first product.

## Acceptance boundary for production implementation

The first production slice is ready to build when:

- the overview and health read models have contract examples for every shared
  data state;
- the selected Reporting Portfolio scope is enforced in the application layer;
- fixture-backed responses cover accounts, holdings, Activities, Valuations,
  imports, income, costs, allocation, and performance;
- no return metric can render without method, period, scope, and data state;
- imports produce reviewable Import Batches and never silently mutate accepted
  Activities;
- all overview charts have an accessible table alternative;
- the web route can be reused by a future Expo client through the versioned
  contract rather than server implementation imports;
- the implementation tickets below have explicit owners and dependencies.

## Implementation ticket set

The GitHub issues linked here are the execution handoff. They are intentionally
smaller than the decision map and should not reopen the A+ hierarchy or the
manual-first provider decision.

- API contracts, fixtures, and read models
- Overview route and Reporting Portfolio summary
- Health, Import Batch review, and Reconciliation actions
- Financial Account, Holding, and Instrument detail
- Performance, allocation, income, and cost reporting
