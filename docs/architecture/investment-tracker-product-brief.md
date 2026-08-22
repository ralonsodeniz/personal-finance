# Investment tracker product brief

Status: accepted information architecture, implementation handoff in progress
Date: 2026-08-22
Scope: Personal Finance web/PWA first, future Expo client

The formal implementation specification is [Investment tracker implementation
specification](https://github.com/ralonsodeniz/personal-finance/issues/72). The
accepted reporting defaults are recorded in [Investment reporting policy
defaults](https://github.com/ralonsodeniz/personal-finance/issues/71).

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

The overview is an orientation layer. It is not the complete source history
and does not replace source evidence. The prototype decision is recorded on
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
  Valuations. It is not an authentication identity.
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

## Reporting policy defaults

The v1 defaults follow the accepted [Investment reporting policy
defaults](https://github.com/ralonsodeniz/personal-finance/issues/71):

- Market-price Valuations are stale after three market sessions, or after seven
  calendar days when market-session data is unavailable.
- Daily fund or index NAVs are stale after five business days.
- Statement-based Financial Account, pension, and term-deposit values are stale
  after 45 calendar days.
- An unknown source cadence is stale after 30 calendar days.
- A stale value retains its last confirmed value and never becomes zero.
- Term-deposit accrual is Estimated only when principal, rate, dates, and the
  method are explicit. Pension accrual uses a product-specific method.
  Estimated accrual is excluded from the confirmed headline. Missing terms are
  Not available or Not computable.
- Benchmarks are absent unless the user explicitly selects one.
- Corporate Actions are not inferred as ordinary trades. Source evidence is
  preserved and review is required. Dependent basis or performance remains Not
  computable until its lineage is fixed.
- FX uses dated Provider Observations. Valuations use the valuation date and
  Activities use the economic Activity date. The latest prior observation is
  usable only within five business days. Native amounts remain visible, and
  missing dated FX makes the Reporting Currency metric Not computable.
- Reconciliation tolerates only rounding within source precision or a minor
  currency unit. A larger discrepancy blocks Confirmed status and does not
  auto-correct.
- Tax views are Not computable when Tax Basis or account-wrapper evidence is
  missing. Book Cost remains a separate non-tax view.

## Read-model and contract boundary

The web/PWA and future Expo client need stable, purpose-built read models. They
must not consume Drizzle rows or server domain objects directly.

The first contract set should cover these representations:

```text
GET /api/v1/reporting-portfolios/{reportingPortfolioId}/overview
GET /api/v1/reporting-portfolios/{reportingPortfolioId}/health
GET /api/v1/reporting-portfolios/{reportingPortfolioId}/accounts
GET /api/v1/reporting-portfolios/{reportingPortfolioId}/accounts/{financialAccountId}
PUT /api/v1/reporting-portfolios/{reportingPortfolioId}/accounts/{financialAccountId}
DELETE /api/v1/reporting-portfolios/{reportingPortfolioId}/accounts/{financialAccountId}
GET /api/v1/reporting-portfolios/{reportingPortfolioId}/holdings/{holdingId}
GET /api/v1/reporting-portfolios/{reportingPortfolioId}/performance
GET /api/v1/reporting-portfolios/{reportingPortfolioId}/activity
GET /api/v1/financial-accounts/{financialAccountId}
GET /api/v1/holdings/{holdingId}
GET /api/v1/activities/{activityId}
GET /api/v1/valuations/{valuationId}
POST /api/v1/reporting-portfolios/{reportingPortfolioId}/accounts/{financialAccountId}/import-batches
GET /api/v1/import-batches/{importBatchId}
GET /api/v1/reconciliations/{reconciliationId}
GET /api/v1/instruments/{instrumentId}
POST /api/v1/import-batches/{importBatchId}/review
POST /api/v1/reconciliations/{reconciliationId}/review
POST /api/v1/financial-accounts
POST /api/v1/financial-accounts/{financialAccountId}/holdings
POST /api/v1/instruments
POST /api/v1/financial-accounts/{financialAccountId}/valuations
POST /api/v1/holdings/{holdingId}/valuations
POST /api/v1/financial-accounts/{financialAccountId}/activities
```

These paths are a starting boundary for contract design. They do not authorize
an implementation to skip resource-level authorization, pagination, idempotency,
conditional writes, or privacy-safe cache headers.

The application layer applies Reporting Portfolio scope, Resource-level
authorization, and Field visibility before route serialization, caching, or
generated-client responses. An authorized Resource does not automatically make
every field visible.

### v1 field-visibility matrix

Resource-level authorization runs first. A Resource Grant to a parent includes
only the descendants listed below; it never grants siblings or a standalone
Instrument Resource. Viewer access is read-only and summary-oriented. The v1
`ResourceGrant` model has no field selector: `permission: view` is its only
permission. The API therefore applies the fixed allowlists below and never
accepts a client-supplied field list. Tokens, credentials, raw source files or
rows, and unredacted account identifiers are never serialized through these
views.

For the rows that expose source or quality information, the fixed
`evidenceSummary` object means exactly `sourceKind`, `providerDisplayName`,
`observedAt`, `asOf`, `quality`, `coverageState`, and
`reconciliationState`, where a field is applicable to that resource. It never
contains a credential, raw Provider Observation, source row, source file, or
unredacted account identifier. A direct `view` grant uses the target resource's
allowlist and does not inherit to a sibling or to an unlisted descendant.

| Authorized Resource | Implicit descendants                                                                                                                                                   | Visible fields                                                                                                                                                                                                                                                                                                                                                         | Hidden from a v1 `view` grant                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reporting Portfolio | Financial Account summaries                                                                                                                                            | `id`, `name`, `reportingCurrency`, `totalValue`, `valueAsOf`, `allocation.segments`, `allocation.targetState`, `aggregateQuality`, `healthSummary.openIssueCount`, `healthSummary.highestSeverity`, `healthSummary.categoryCounts`, `healthSummary.hasMore`, `performanceAvailability.state`, `performanceAvailability.coverage`, `performanceAvailability.reasonCode` | Financial Account detail and raw source evidence                                                                                                                           |
| Financial Account   | Holding summaries, `ActivityStateSummary`, ImportBatchSummary, ReconciliationSummary, and a portfolio-qualified ActivitySummary, plus nested Instrument display fields | `id`, `displayLabel`, `type`, `providerDisplayName`, `latestValue`, `nativeCurrency`, `valueAsOf`, `quality`, `evidenceSummary`, and each Holding's `instrumentDisplayName`, `instrumentType`, `quantity`, `unit`, `value`, `currency`, `valuationAsOf`, `valuationState`                                                                                              | Account numbers, tokens, source rows/files, full Activities, Lots, Tax Basis, and raw Provider Observations                                                                |
| Holding             | Canonical Instrument display fields                                                                                                                                    | `id`, `instrumentDisplayName`, `instrumentType`, `publicIdentifiers[]`, `providerAliases[]`, `quantity`, `unit`, `nativeValue`, `nativeCurrency`, `valuation.sourceDisplayName`, `valuation.asOf`, `valuation.quality`                                                                                                                                                 | Standalone Instrument access, full Activities, Corporate Actions, Provenance, Reconciliation detail, Tax Basis, Reporting Currency conversion, and all raw source evidence |
| Activity            | None                                                                                                                                                                   | `id`, `activityType`, `economicDate`, `settlementDate`, `amount`, `currency`, `state`, and `evidenceSummary`                                                                                                                                                                                                                                                           | Counterparty details, credentials, unrelated Resource data, source rows/files, and unredacted source payload                                                               |
| Valuation           | None                                                                                                                                                                   | `id`, `asOf`, `value`, `quantity`, `unitPrice`, `currency`, `state`, and `evidenceSummary`                                                                                                                                                                                                                                                                             | Credentials, unrelated Resource data, raw Provider Observations, source rows/files, and unredacted source payload                                                          |
| Import Batch        | None                                                                                                                                                                   | `id`, `status`, `receivedAt`, `sourceAsOf`, `reviewState`, `rowCounts.pending`, `rowCounts.mapped`, `rowCounts.duplicate`, `rowCounts.rejected`, and `evidenceSummary`                                                                                                                                                                                                 | Source filename/content, source rows/files, credentials, mapped canonical records outside the grant, and unredacted source payload                                         |
| Reconciliation      | None                                                                                                                                                                   | `id`, `resourceType`, `asOf`, `state`, `applicationValue`, `sourceValue`, `difference`, `currency`, and `evidenceSummary`                                                                                                                                                                                                                                              | Target Resource identifiers, credentials, unrelated Resource data, source rows/files, raw Provider Observations, and unredacted source payload                             |
| Instrument          | None                                                                                                                                                                   | `id`, `displayName`, `type`, `publicIdentifiers[]`, and `providerAliases[]`                                                                                                                                                                                                                                                                                            | Account ownership, quantities, holdings, and source-specific account evidence                                                                                              |

The nested Instrument metadata is fixed as well. Each
`publicIdentifiers[]` item contains exactly `scheme` and `value`. Each
`providerAliases[]` item contains exactly `providerDisplayName`, `label`, and
`symbol`. Neither shape may contain a Provider account identifier, source-row
identifier, credential, account ownership, holding quantity, or raw Provider
metadata.

The inherited summary profiles are fixed and separate from direct target
representations:

- A Reporting Portfolio may inherit a `FinancialAccountSummary` with exactly
  `id`, `displayLabel`, `type`, `providerDisplayName`, `latestValue`,
  `nativeCurrency`, `valueAsOf`, `quality`, and
  `evidenceSummary.coverageState`. It does not inherit Holdings or any
  account-level detail.
- A Financial Account may inherit a `HoldingSummary` with exactly
  `id`, `instrumentDisplayName`, `instrumentType`, `quantity`, `unit`,
  `value`, `currency`, `valuationAsOf`, and `valuationState`; this is the same
  summary shape listed in the Financial Account row.
- A direct Financial Account read may inherit an `ActivityStateSummary` with
  exactly `recordCount`, `latestEconomicDate`, `stateCounts`, and
  `evidenceSummary.quality`. It contains no money totals, currency, FX, or
  external-flow classification.
- A Financial Account may inherit the full `ActivitySummary` only through a
  Reporting Portfolio-qualified account read. It has exactly `recordCount`,
  `periodStart`, `periodEnd`, `reportingCurrency`, `incomeTotal`,
  `costTotal`, `externalFlowTotal`, `stateCounts`, and
  `evidenceSummary.quality`. Each total is an array of `MoneySummary` items;
  each item contains exactly `amount`, `currency`, `reportingAmount`,
  `reportingCurrency`, and `fxState`. `reportingAmount` is `null` when
  `fxState` is `missing` or `notComputable`; its canonical serialized values
  are exactly `confirmed`, `stale`, `estimated`, `missing`, and
  `notComputable`, corresponding to the shared Confirmed, Stale, Estimated,
  Missing, and Not computable states.
- A Financial Account may inherit an `ImportBatchSummary` with exactly
  `batchCount`, `latestReceivedAt`, `pendingRowCount`, `reviewState`, and
  `evidenceSummary.quality`.
- A Financial Account may inherit a `ReconciliationSummary` with exactly
  `state`, `lastAsOf`, `difference`, `currency`, and
  `evidenceSummary.quality`. It never includes a target Resource identifier.

The portfolio-qualified ActivitySummary is available only from
`GET /api/v1/reporting-portfolios/{reportingPortfolioId}/accounts/{financialAccountId}`
and other representations carrying the same `reportingPortfolioId`. The
service classifies internal versus external flows against that portfolio's
selected account set and uses its Reporting Currency and dated FX policy.
`GET /api/v1/financial-accounts/{financialAccountId}` and a direct Financial
Account grant return only the ActivityStateSummary; they never serialize
portfolio-dependent totals or Reporting Currency amounts.

These inherited summaries do not grant a direct read of the descendant. A
direct `view` grant is exercised through the canonical target reads
`GET /api/v1/financial-accounts/{financialAccountId}`,
`GET /api/v1/holdings/{holdingId}`, `GET /api/v1/activities/{activityId}`,
`GET /api/v1/valuations/{valuationId}`,
`GET /api/v1/import-batches/{importBatchId}`,
`GET /api/v1/reconciliations/{reconciliationId}`, and
`GET /api/v1/instruments/{instrumentId}`. The direct Reconciliation response
omits `resourceId`; an authorized parent representation may link a target only
after the target is independently within the same authorized scope.

The standalone `GET /api/v1/holdings/{holdingId}` and a direct Holding grant
return only `nativeValue` and `nativeCurrency`. The
`GET /api/v1/reporting-portfolios/{reportingPortfolioId}/holdings/{holdingId}`
representation may additionally return `reportingValue` and
`reportingCurrency`, computed from that portfolio's Reporting Currency and
dated FX evidence. No standalone Holding response may choose an arbitrary
Reporting Currency.

The Reporting Portfolio `healthSummary` fields above are an aggregate-only
profile. `categoryCounts` has exactly the categories `staleValuation`,
`missingEvidence`, `pendingImport`, `reconciliationDiscrepancy`, and
`calculationUnavailable`; each value is a count. A direct portfolio `view`
grant never receives a health signal array, affected Resource identifier or
label, source, as-of date, or next action. The portfolio health route returns
only this aggregate profile for that grant. An in-Workspace member may receive
signal detail only for affected Resources that the actor is independently
authorized to read; other signals remain represented only in the aggregate
counts. `hasMore` makes truncation explicit without disclosing any hidden
Resource.

The Reporting Portfolio `allocation` fields above are also aggregate-only.
`allocation.segments` is an array whose items contain exactly `assetClass`,
`reportingValue`, `percentage`, and `state`. `allocation.targetState` is one
of `configured`, `notConfigured`, or `notComputable`. A segment never contains
an Account, Holding, Instrument, Provider, source, or stable Resource
identifier. Direct portfolio grants therefore receive allocation totals and
labels only; detail or target changes require an independently authorized
resource operation.

The Reporting Portfolio `performanceAvailability` fields are an exact
aggregate-only profile. `state` is one of `available`, `estimated`, or
`notComputable`; `coverage` is one of `complete`, `partial`, or `missing`; and
`reasonCode` is one of `completeHistory`, `missingValuation`,
`missingCashFlow`, `missingFX`, `incompleteHistory`, or `unsupportedPolicy`.
This profile never contains an affected Resource identifier, Activity or
Valuation identifier, source, as-of date, raw evidence, or next action. A
direct portfolio grant receives availability only; performance detail is
returned only through independently authorized, portfolio-qualified reads.

`Tax Basis`, Lots, Corporate Actions, and raw Provider Observations are not
available through a v1 Resource Grant, including an inherited grant. A
same-Workspace member view may include Tax Basis only in a purpose-built tax
representation when the account wrapper, tax jurisdiction, and required
source evidence are present; otherwise it returns `Not computable`. Adding
grant access to those fields requires a future authorization-model change and
schema review rather than an ad-hoc request field. Phase 0 must test every
allowlist above, including direct grants, inherited summaries, and the absence
of hidden fields.

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

Every retryable `POST` mutation in this contract requires an
`Idempotency-Key`: import-batch creation, Import Batch review,
reconciliation review, and manual Financial Account, Instrument, Holding,
Valuation, and Activity creation. The key is scoped to the authenticated user,
route, and target Workspace. The server stores the request fingerprint and
completed response; a retry with the same key and body returns the original status,
identifiers, representation, and state without creating another resource. A
same key with a different body or target fails with an idempotency-key-reuse
Problem Details response and performs no write.

Import operations return an Import Batch identifier and review state; the
review surface reads the batch and applies accepted mappings through the
canonical Activity model. Import Batch creation is nested under
`/api/v1/reporting-portfolios/{reportingPortfolioId}/accounts/{financialAccountId}/import-batches`.
The server requires that the Financial Account belongs to the same Workspace,
is selected in the Reporting Portfolio, and is writable by the actor; the
Import Batch and all accepted canonical Activities retain that account target.
`POST
/api/v1/import-batches/{importBatchId}/review` requires an expected current
version, supplied as `If-Match` or the operation's version field. A stale
version fails with a precondition Problem Details response and performs no
mapping or Activity write.

`POST
/api/v1/reconciliations/{reconciliationId}/review` also requires an expected
current version. Its request records one explicit decision—`acceptSource`,
`retainApplicationValue`, `markIntentionallyUnchanged`, or
`createCorrection`—plus a reason. `createCorrection` additionally requires a
typed `correctionPayload`, which is one of:

- `{ kind: valuation, asOf, value, currency, quantity, unitPrice }`;
- `{ kind: activity, activityType, economicDate, amount, currency }`.

The payload's target is bound to the Reconciliation by the server and is not
client-selectable. The other decisions must omit `correctionPayload`. Its
shape is validated against the Reconciliation target before the append-only
Correction is created. Decision effects are fixed: `acceptSource` derives a
source-valued Correction from the stored source evidence, applies it in the
canonical read model, changes Reconciliation `state` to `resolved`, and
requires a non-null `correctionId`; `retainApplicationValue` records the
decision without changing the canonical value and changes `state` to
`acknowledged`; `markIntentionallyUnchanged` records the decision without a
Correction and changes `state` to `acknowledged`; `createCorrection` appends
the typed Correction, applies it in the canonical read model, changes `state`
to `resolved`, and requires a non-null `correctionId`. The response always
returns the resulting `reconciliationId` and review `state`, while
`correctionId` is `null` for the two no-Correction decisions. The original
evidence remains unchanged, and a retry with the same idempotency key returns
the original identifiers and state.

Manual-entry create operations are distinct from imports and Corrections:
creating a Financial Account or Instrument returns that canonical resource's
identifier and representation or location, along with its evidence state.
Snapshot-backed Holding creation uses
`POST /api/v1/financial-accounts/{financialAccountId}/holdings`. The request
identifies the canonical Instrument and supplies the dated snapshot fields
needed by the Holding model. The server resolves the Financial Account and
Instrument in one transaction, requires both to belong to the same Workspace,
and requires the actor's write access to that Workspace before creating the
Holding. A cross-Workspace pair fails with a generic authorization/not-found
Problem Details response and creates no resource, so the response cannot reveal
which supplied identifier was outside the actor's scope. The operation returns
the Holding identifier with its snapshot provenance. It does not synthesize
Activities or Lots from an incomplete snapshot. A later account-scoped or
holding-scoped Valuation can then record the dated value without fabricating
transaction history. The operation is idempotent and cannot attach a Holding
to an unrelated account or Workspace.
Manual Valuation creation is nested under its owner: an account-level
Valuation uses
`POST /api/v1/financial-accounts/{financialAccountId}/valuations`, while a
Holding-level Valuation uses `POST /api/v1/holdings/{holdingId}/valuations`.
The server resolves the target from the path, requires the actor's write
access to the owning Financial Account's Workspace, and verifies that the
Holding belongs to that account before accepting the Valuation. Neither route
accepts a client-selectable unrelated target, so manual Valuations cannot be
orphaned or attached across Workspaces. Manual Activity creation uses
`POST /api/v1/financial-accounts/{financialAccountId}/activities`; the path
binds the Activity to its Financial Account, and the server requires the
actor's write access to that account's Workspace. It cannot create an orphan
or cross-Workspace Activity. A Correction identifier is returned only when
the operation reverses or supersedes an existing record.

Creating a Financial Account does not implicitly change any Reporting
Portfolio. The manual-entry flow explicitly calls the idempotent `PUT
/api/v1/reporting-portfolios/{reportingPortfolioId}/accounts/{financialAccountId}`
membership operation after creation to select the account. A matching
idempotent `DELETE` deselects the account without deleting the Financial
Account, its Activities, or its evidence. Both operations return the resulting
selection state. The membership operations are authorized only when the
Reporting Portfolio and Financial Account resolve to the same `workspaceId`
and the acting user has an active `owner` or `editor` Membership in that
Workspace. A `ResourceGrant`—which is `view`-only in v1—cannot authorize this
write. The check and membership write occur in one transaction; a
cross-Workspace pair fails with a generic authorization/not-found Problem
Details response and creates no membership. An atomic create-and-include
command must create the Financial Account in the Reporting Portfolio's
Workspace and must enforce the same conditions before committing either
result.

All financial responses default to `Cache-Control: private, no-store` until a
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
- Add contract tests for runtime schemas, OpenAPI examples, Problem Details,
  and generated-client reproducibility.
- Add application tests for scope, evidence quality, calculation availability,
  policy defaults, the field allowlists above, and cross-Workspace membership
  authorization, portfolio-qualified flow classification, and conversion
  scope.
- Add route tests for validation, authorization, serialization, cache behavior,
  idempotency replay and key-reuse for every retryable `POST`,
  Import Batch and reconciliation version preconditions, append-only
  Correction payload validation and decision results, account-bound imports
  and Activities, portfolio selection and deselection, unsupported methods,
  and Problem Details errors.
- Add web tests for accessible content, mobile layout, loading and error states,
  detail navigation, and chart table alternatives.
- Add one mobile-sized Playwright journey covering overview, health review,
  detail navigation, and a manual-entry or import outcome.

### Phase 1: manual and file-based v1

- Add manual Financial Account, Instrument, snapshot-backed Holding, Valuation,
  and Activity entry.
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

The approved tracer-bullet issues below are the current execution handoff. They
are intentionally smaller than the decision map and should not reopen the A+
hierarchy, the manual-first Provider strategy, or the reporting policy defaults.

- [Read one Reporting Portfolio overview through the shared contract](https://github.com/ralonsodeniz/personal-finance/issues/73)
- [Create one manually entered investment and show it in the overview](https://github.com/ralonsodeniz/personal-finance/issues/74)
- [Surface freshness and calculation health with review actions](https://github.com/ralonsodeniz/personal-finance/issues/75)
- [Stage and accept a MyInvestor CSV/XLSX Import Batch](https://github.com/ralonsodeniz/personal-finance/issues/76)
- [Navigate from overview to Financial Account and Holding evidence](https://github.com/ralonsodeniz/personal-finance/issues/77)
- [Reconcile imported evidence and create append-only Corrections](https://github.com/ralonsodeniz/personal-finance/issues/78)
- [Explain Reporting Portfolio performance with method and coverage](https://github.com/ralonsodeniz/personal-finance/issues/79)
- [Add allocation, income, and cost summaries](https://github.com/ralonsodeniz/personal-finance/issues/80)

Issues 65 through 70 are preliminary workstreams. They remain open until the
new vertical slices are reviewed and explicitly reconciled.
