# Portfolio performance and mixed-asset accounting semantics

**Status:** research complete; recommendation ready; implementation follow-up remains
**Ticket:** [Wayfinder issue #60](https://github.com/ralonsodeniz/personal-finance/issues/60)
**Date checked:** 2026-08-22
**Scope:** metric semantics and source-data rules only. No application code, schema, import adapter, or tax filing logic is decided here.

## Decision in one page

Wayfinder should treat investment performance as a derived view over an
event ledger, position history, tax lots, cash balances, and dated valuations.
An ending balance alone cannot explain performance, tax basis, or a correction.

The contract is:

1. Use total return as the performance concept. Total return includes both
   capital appreciation or depreciation and income. The GIPS standards make
   that distinction explicit in Provision 2.A.8
   ([CFA Institute, GIPS Standards Handbook for Firms](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).
2. Make time-weighted return, or TWR, the primary comparison metric for a
   portfolio with user-controlled deposits and withdrawals. Value the
   portfolio at each external flow when possible, calculate sub-period returns,
   and link them geometrically. GIPS requires TWR unless narrow conditions
   permit an MWR presentation, and explains that TWR removes the effect of
   client-driven cash-flow timing
   ([CFA Institute, TWR and MWR guidance](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).
3. Show money-weighted return, or MWR, as the investor-experience metric. MWR
   reflects the timing and size of external cash flows and can use an IRR
   calculation. Use the actual dated flow whenever it is known
   ([CFA Institute, MWR definition and IRR](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).
4. Keep absolute net gain, simple return, realized gain, unrealized gain,
   income, fees, taxes, and FX movement as separate components. None of them
   is a substitute for total return.
5. Keep tax basis and economic book cost as separate concepts. A position can
   have one economic cost view and several jurisdiction-specific tax views.
   Do not claim tax-ready basis when the source did not supply enough lot
   history.
6. Treat contributions and withdrawals as external flows at the selected
   account boundary. Transfers between two Financial Accounts inside the same
   reporting scope are internal. The same transfer is external when the report
   covers only one side.
7. Record dividends and interest as income events, not contributions. Record
   reinvestment as income plus an internal purchase. Record fees, commissions,
   and taxes separately so a user can see both before-cost and after-cost
   results.
8. Apply corporate actions as explicit quantity and basis transformations.
   A split is not a gain. A merger or spin-off is not automatically a sale.
   Cash or other property received during an action needs its own tax and
   performance treatment.
9. Convert each transaction and valuation using a dated, identified FX rate.
   Do not convert historical amounts with today's rate. IAS 21 requires initial
   recognition of a foreign-currency transaction at the spot rate on the
   transaction date, and GIPS requires a documented, consistent conversion
   policy
   ([IFRS Foundation, IAS 21](https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/);
   [CFA Institute, GIPS currency guidance](https://www.gipsstandards.org/standards/gips-standards-handbook-for-asset-owners/)).
10. Make every result explainable. A metric must identify its scope, currency,
    valuation date, cash-flow treatment, fee and tax treatment, price quality,
    source coverage, lot policy, and calculation version.

This is an accounting and reporting contract for Wayfinder. It is not a
statement that Wayfinder is GIPS compliant, and it is not tax advice.

## Source facts and their limits

### Performance

The GIPS standards define total return as capital change plus income. They
require geometric linking for TWR sub-periods, define MWR as a return affected
by the timing and size of external cash flows, and describe IRR as the rate
that equates discounted cash outflows and inflows
([GIPS Standards Handbook for Firms](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).

GIPS also says that daily external cash flows must be used for MWR from
1 January 2020, and that a period of less than one year must not be presented
as an annualized return. Annualized returns use a geometric average, not an
arithmetic average
([GIPS MWR timing guidance](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).

GIPS calculation guidance gives the no-external-flow return as the change in
value divided by beginning value, including income, and says that dividend and
interest payments are not external cash flows. That supports limiting
Wayfinder's simple-return display to periods with no net external flow
([CFA Institute, GIPS calculation methodology](https://www.gipsstandards.org/wp-content/uploads/2021/03/gips-handbook-3rd-edition.pdf)).

These are standards for firms, composites, pooled funds, and asset owners. The
Wayfinder decision is an inference from those standards for a personal finance
product. The standards are a useful guard against misleading metrics, but they
do not define Wayfinder's product scope or tax policy.

### Cost basis and lots

The SEC describes cost basis as normally the original purchase amount, while
noting that the acquisition method can change the basis and that incomplete
records may require reconstruction
([SEC, Cost Basis for Securities Transactions](https://www.sec.gov/answers/costbasis.htm)).
An SEC illustrative brokerage statement separates purchases and sales,
deposits and withdrawals, dividends and interest, realized gains and losses,
reinvested income, fees, taxes withheld, and unrealized gains and losses
([Investor.gov, Better Understanding Your Brokerage Account Statement](https://www.investor.gov/better-understanding-your-brokerage-account-statement)).

IRS Publication 550 is a U.S. tax source, not a global accounting rule. It
nevertheless demonstrates why one unqualified cost field is unsafe. For U.S.
stocks and bonds, the publication generally starts basis with purchase price
plus purchase costs, then adjusts it for later events. It supports specific
share identification, FIFO, and limited average-basis cases, and explains that
reinvested distributions create basis in the acquired shares
([IRS Publication 550, basis and identification](https://www.irs.gov/publications/p550)).
The same publication describes wash-sale adjustments and basis allocation in
some splits, stock rights, reorganizations, and nondividend distributions
([IRS Publication 550, wash sales and corporate actions](https://www.irs.gov/publications/p550)).

The contract therefore stores lots and basis policy as data. It does not
silently infer a tax answer from a market value.

### Income, fees, and taxes

GIPS requires accrual accounting for fixed-income investments and other
interest-bearing investments, with accrued income included in beginning and
ending values for performance. It recommends recognizing dividends on the
ex-dividend date, accruing investment-management fees, and calculating returns
net of non-reclaimable withholding taxes
([GIPS accounting guidance](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).

The SEC illustrative statement uses separate lines for income received,
interest charges, fees and expenses, federal or foreign tax withheld, and
income that is reinvested
([Investor.gov brokerage statement guide](https://www.investor.gov/better-understanding-your-brokerage-account-statement)).
That is useful reporting vocabulary, but the page is an illustrative investor
education document. It does not decide Wayfinder's tax treatment.

Tax treatment varies by jurisdiction, account wrapper, asset, and tax year.
For example, the Spanish tax authority classifies interest and dividends as
capital income and treats pension-plan benefits as employment income in its
2025 IRPF guidance
([Agencia Tributaria, IRPF income categories](https://sede.agenciatributaria.gob.es/Sede/educacion-civico-tributaria/programa-educacion-civico-tributaria/que-impuestos/contenidos/impuesto-sobre-renta-personas-fisicas/elementos-irpf.html);
 [Agencia Tributaria, pension-plan benefits](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/7-cumplimentacion-irpf/7_1-rendimientos-trabajo-personal/7_1_1-rendimientos-integros.html)).
The IRS applies different rules in its own jurisdiction. Wayfinder must expose
tax jurisdiction and tax profile rather than presenting one universal tax
calculation.

### Corporate actions

A stock split increases the number of shares without changing shareholders'
equity. The SEC's example shows the quantity doubling while the per-share price
halves
([Investor.gov, Stock Split](https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-split)).
IRS Publication 550 describes the corresponding U.S. basis allocation for
identical stock and gives examples for corporate reorganizations and spin-offs
([IRS Publication 550, stock splits and reorganizations](https://www.irs.gov/publications/p550)).

The source facts support an explicit corporate-action event. They do not support
one universal tax rule for every merger, tender, rights issue, liquidation, or
spin-off. Wayfinder must preserve the action and defer tax classification to a
jurisdiction-aware policy.

### Valuation and stale prices

GIPS defines fair value using an objective, observable quoted price for an
identical investment in an active market on the measurement date when one is
available. If it is not available, the valuation should be the best estimate of
fair value and include accrued income. GIPS also says that inactive markets,
non-current prices, and preliminary estimated values require valuation policies
and disclosure
([GIPS valuation hierarchy](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).

The SEC investor statement guide makes the same practical problem visible:
infrequently traded assets may have an estimated value based on market data
that is not current
([Investor.gov market value guidance](https://www.investor.gov/better-understanding-your-brokerage-account-statement)).

Wayfinder must preserve a last-known value when that is the only available
value, but it must label the price stale or estimated. A missing price is not
zero and must not silently produce a complete-looking return.

### FX

IAS 21 establishes a functional currency and addresses how foreign-currency
transactions and balances are translated. The issued standard says that a
foreign-currency transaction is initially recorded in the functional currency
using the spot exchange rate on the transaction date
([IFRS Foundation, IAS 21 issued standard](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ias-21-the-effects-of-changes-in-foreign-exchange-rates.pdf?bypass=on)).

GIPS requires a documented conversion policy. Its asset-owner guidance says to
convert values and external cash flows using the selected method at the date
of each flow and valuation, and not by applying today's rate to historical
data
([GIPS asset-owner currency guidance](https://www.gipsstandards.org/standards/gips-standards-handbook-for-asset-owners/)).

The Wayfinder contract uses those principles for reporting. It does not claim
that the resulting FX gain is the same as a jurisdiction's taxable foreign
currency gain.

### Cash, deposits, and pensions

The SEC guide treats cash and cash equivalents as part of account assets. It
includes insured checking and savings deposits, money-market funds, and other
short-term highly liquid investments among its examples
([Investor.gov cash and cash equivalents](https://www.investor.gov/better-understanding-your-brokerage-account-statement)).
The principal of a deposit is therefore an asset balance. Interest is the
income event. A deposit made into a single-account report is a contribution;
the same movement between two included Financial Accounts is an internal
transfer.

IAS 26 distinguishes defined-contribution and defined-benefit retirement
benefit plans and states that the standard concerns reporting by the plan as a
reporting entity, not reports to individual participants
([IFRS Foundation, IAS 26](https://www.ifrs.org/issued-standards/list-of-standards/ias-26-accounting-and-reporting-by-retirement-benefit-plans/)).
The contract consequently models a pension as a typed Financial Account with
plan-specific contribution, valuation, fee, and withdrawal events. It does not
assume that a defined-benefit promise has tradeable lots.

### Reconciliation and corrections

The SEC guide tells investors to compare account statements with trade
confirmations and to report inaccuracies or discrepancies promptly and in
writing
([Investor.gov statement review guidance](https://www.investor.gov/better-understanding-your-brokerage-account-statement)).
GIPS requires documented and consistently applied policies and procedures, and
requires material performance errors to be corrected under an error-correction
policy
([GIPS error-correction guidance](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/);
 [CFA Institute sample error-correction policy](https://www.gipsstandards.org/wp-content/uploads/2021/03/sample_error_correction_policy_firms-1.pdf)).

The Wayfinder design below is an inference. These sources do not prescribe an
event-sourced application, but they support retaining the inputs, documenting
the method, and making corrections traceable.

## Proposed Wayfinder metric contract

The following is the recommended product contract. It is an inference from the
source facts above and is not itself a quoted standard.

### Reporting scope

Every report has:

- a scope, such as one Financial Account, a group of Financial Accounts, or a
  Workspace;
- a start and end timestamp, with a named timezone;
- a reporting currency and a conversion policy;
- an as-of valuation timestamp;
- an inclusion policy for cash, deposits, pensions, private assets, and
  external holdings;
- a data coverage status.

The scope decides whether a transfer is external. A contribution into a
brokerage account is an external flow for that account. The same contribution
is an internal transfer for a Workspace report if its source Financial Account
is also in scope.

### Canonical event record

Each imported or manual event needs these semantic fields:

| Field | Contract |
| --- | --- |
| Event identity | Stable internal event identity, source system, redacted source reference, and import batch. |
| Dates | Occurred or trade date, settlement date when supplied, record date for distributions, and imported-at timestamp. Performance uses the economic date required by the selected policy. |
| Scope | Financial Account, instrument, currency wallet, and Workspace relationships. |
| Amounts | Native amount, reporting-currency amount when known, gross amount, net cash effect, fee amount, tax amount, and FX rate with source and timestamp. |
| Position effect | Quantity delta, unit price, quote currency, and resulting cash effect. |
| Income | Dividend, interest, distribution, return of capital, or other income classification, with accrued, paid, withheld, and reinvested amounts separated. |
| Lot effect | Acquired or disposed quantity, source lot, basis amount, basis currency, lot-selection method, and holding-period dates. |
| Corporate action | Action type, old and new instruments, ratio or allocation, cash or property received, and an immutable link to the action record. |
| Provenance | Source document or API name, source record reference, source hash where permitted, confidence, and reconciliation status. |
| Corrections | Correction or reversal link, reason, actor or import process, effective date, and calculation-version impact. |

The stored source payload must be protected and redacted. The research artifact
contains no personal account, broker, security, or taxpayer identifiers.

### Position and valuation record

At each valuation snapshot, retain:

- quantity by instrument and currency;
- cash and deposit balances by currency;
- price, quote currency, price timestamp, price source, and price method;
- accrued interest or other accrued income when used;
- valuation status: confirmed, estimated, stale, missing, or manually
  overridden;
- the calculation and policy version.

Value is the sum of quantity times price plus cash, deposits, and other
included assets, converted into reporting currency at the selected valuation
rate. A snapshot with missing required prices is incomplete. A snapshot that
uses stale or estimated prices is provisional and must say so.

### Event classification

| Event | Position and cash behavior | External-flow behavior | Performance and basis behavior |
| --- | --- | --- | --- |
| Contribution or withdrawal | Changes cash or adds/removes an asset. | External at the selected account boundary; internal inside a consolidated scope. | Excluded from TWR investment return. Included in MWR cash flows. |
| Cash or security transfer | Moves cash or quantity between Financial Accounts. | Scope-dependent as above. | Preserve source basis for an in-scope asset transfer when supplied. Mark basis unknown when it is not supplied. |
| Buy or sell | Exchanges cash and position quantity inside the scope. | Not an external flow. | Sell creates realized gain against the selected lot basis. Market return is measured from dated valuations, not from the trade's cash movement alone. |
| Dividend or interest | Creates income receivable or cash. | Not an external contribution. | Included in total return. Store gross income, withholding, net cash, and reinvestment separately. |
| Reinvestment | Converts income cash into a purchase. | Not an external flow. | Income remains income. The purchase creates a new lot with its own acquisition date and basis. |
| Fee or commission | Reduces cash or is deducted from proceeds. | Not an external flow. | Reduces net return. Store acquisition and disposal costs separately because tax rules differ. |
| Tax or withholding | Reduces cash or creates a tax payable. | Tax paid from inside the scope is not capital contributed by the investor. | Show tax drag separately. Do not silently mix tax with investment management fees. |
| Return of capital | Adds cash and reduces the related basis, subject to the tax policy. | Not a contribution. | Usually value-neutral at the distribution date. Tax classification remains jurisdiction-specific. |
| Split or reverse split | Changes quantity and per-unit basis; no cash is required. | Not an external flow. | Preserve total basis and lot lineage unless the jurisdiction-specific action rule says otherwise. |
| Merger, spin-off, rights, or liquidation | Replaces or reallocates instruments and may add cash or other property. | Not an external flow unless property leaves or enters the selected scope. | Preserve action lineage. Classify gain, loss, basis, and tax only through the selected jurisdiction policy. |
| FX conversion | Exchanges one currency balance for another. | Internal if both balances are inside the scope. | Preserve native amounts and the actual rate. Optional realized FX gain applies when a currency position is disposed of. |
| Correction | Reverses or supersedes a prior event without erasing it. | Reuses the original event's classification. | Recompute derived lots, valuations, reconciliation, and returns. Retain both the original and correction. |

### Cost basis and lots

Wayfinder should maintain at least two views:

1. Economic book cost, used to explain invested capital and portfolio
   movements.
2. Tax basis, keyed by tax jurisdiction, account wrapper, instrument, and
   effective tax rule set.

A tax lot contains quantity remaining, acquisition date, unit and total basis,
currency, basis adjustments, source, and lineage. A sale stores the exact lots
used. The account policy must say whether the selection came from:

- broker-specific identification;
- user-selected specific identification;
- FIFO;
- average basis where allowed; or
- another jurisdiction-specific rule.

If source data does not identify the lot or enough history is missing, the
result is basis unknown or estimated. The system must not present a precise
realized gain as tax-ready merely because it can calculate a market-value
difference.

For a selected basis view:

realized_gain = net_disposal_proceeds - allocated_adjusted_basis

unrealized_gain = current_fair_value - remaining_adjusted_basis

The label must say whether the basis is economic, tax, broker-reported, or
estimated. Realized and unrealized gain are position diagnostics. They do not
replace total return, because income, fees, taxes, and FX may sit outside
those two numbers.

### Income, costs, and taxes

The default reporting views are:

- gross income: dividends, interest, and other distributions before withholding;
- net cash income: gross income less withholding and other deductions;
- net-of-recorded-costs return: total return after recorded transaction costs,
  account fees, fund expenses, interest charges, and management fees that the
  source exposes;
- tax drag: non-reclaimable withholding and tax payments attributed to the
  scope;
- after-tax return: net-of-recorded-costs return after the selected tax view.

The user interface must display the exact view name. "Return" without a fee and
tax label is not explainable.

### TWR

Let V_i_before be the value immediately before external flow F_i, and
V_i_after be the value immediately after that flow. Let the next valuation be
V_i_end. Then:

r_i = V_i_end / V_i_after - 1

Link sub-periods geometrically:

TWR = (1 + r_1) × (1 + r_2) × ... × (1 + r_n) - 1

For an external flow that is recorded at a day boundary:

V_i_after = V_i_before + F_i

where a contribution is positive and a withdrawal is negative. The exact
valuation timing must be stored. If no value exists at the flow, Wayfinder may
use a documented Modified Dietz estimate, but the result must be labeled
estimated rather than called a true flow-time TWR.

TWR answers: "How did the invested portfolio perform, independent of when the
investor added or removed money?" It is the default comparison metric for
user-controlled flows.

### MWR

MWR answers: "What return did this investor experience, given the dates and
sizes of their cash flows?"

Use the investor-perspective cash-flow sign convention:

- contribution: negative;
- withdrawal or distribution to the investor: positive;
- ending portfolio value: positive terminal flow.

Solve for r in:

Σ CF_k / (1 + r)^((date_k - date_0) / 365) = 0

Use actual dates, not statement-period labels, whenever the source supplies
them. Store the day-count convention, root-finding method, and whether the
solution is unique. GIPS notes that IRR requires an iterative solution and can
have multiple answers when positive and negative external flows are mixed
([GIPS IRR guidance](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).

If no valid root exists, return MWR unavailable with the reason. Do not choose a
favorable root silently.

### Simple return and absolute gain

Simple return is a display-only metric under this contract:

simple_return = (V_end - V_start) / V_start

It is available only when net external flow for the period is zero and
V_start is positive. If there is an external flow, show absolute flow-adjusted
gain instead:

net_gain = V_end - V_start - Σ external_flows

An optional Modified Dietz diagnostic may divide net gain by
V_start + Σ(weight_i × flow_i), where the weight reflects how long the flow
was invested. That diagnostic is not the primary return. It is a transparent
approximation when flow-time valuations are unavailable. The GIPS asset-owner
handbook describes the Modified Dietz method and its flow weights
([GIPS asset-owner handbook](https://www.gipsstandards.org/standards/gips-standards-for-asset-owners/gips-standards-handbook-for-asset-owners/)).

### Annualization

For a valid cumulative return R over D days with D at least one year:

annualized_return = (1 + R)^(365 / D) - 1

Use the selected day-count policy consistently. Do not annualize a period shorter
than one year. Report both cumulative and annualized values when the period is
longer than one year. This follows the GIPS preference for geometric annual
compounding and its prohibition on annualizing a partial first year
([GIPS annualization guidance](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).

### Benchmarks

A benchmark record needs:

- provider and exact index or model name;
- version or methodology date;
- price return or total return type;
- currency and FX convention;
- observation frequency and calendar;
- source URL or imported series reference;
- the selected period and valuation convention.

Compare like with like. GIPS requires benchmark returns to use the same return
type, currency, and periods as the presented portfolio return, and says that a
price-only benchmark does not satisfy a total-return comparison
([GIPS benchmark guidance](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)).

For Wayfinder, a benchmark is user-selected or policy-selected. It is not
automatically inferred from the top holding. A multi-asset benchmark may be a
documented blend with weights, rebalance dates, dividends, fees, and FX rules.
The benchmark result remains a comparison, not a claim that the portfolio
should have held the benchmark.

## Mixed-asset rules

| Asset or account type | Value source | Return components | Special handling |
| --- | --- | --- | --- |
| Equity, ETF, or mutual fund | Dated market price or NAV in quote currency. | Price change, dividends or distributions, fees, taxes, and FX. | Keep each acquisition as a lot. Treat reinvested income as a new purchase. |
| Bond or other interest-bearing asset | Market value plus accrued interest when the policy uses accrual. | Price change, coupon or interest, amortization if supported, fees, taxes, and FX. | Do not wait for settlement cash if accrued-income reporting is selected. |
| Cash wallet or brokerage cash | Currency balance. | Interest, account fees, tax, and FX. | Principal deposits and withdrawals are flows at the account boundary. |
| Bank deposit or certificate of deposit | Principal balance and, where available, accrued interest or contractual maturity value. | Interest, fees, tax, and FX. | Principal repayment is not investment gain. Keep maturity and early-withdrawal terms as source metadata. |
| Defined-contribution pension | Plan-reported value or holdings. | Contributions, employer contributions, investment return, fees, tax, and withdrawals. | Tag employee and employer contributions separately. Do not reuse taxable-brokerage rules automatically. |
| Defined-benefit pension | Plan-reported entitlement or an explicitly entered estimate. | Benefit accrual or payment view, not trade-level market return unless the plan supplies assets. | Keep the estimate separate from market-valued investments. |
| Private or stale-priced asset | Dated estimate, last known price, or manual valuation. | Estimated market movement, income, fees, and FX. | Mark provisional, show age and method, and surface a data-quality warning. |

## Reconciliation contract

For a closed period, the report must show this bridge in reporting currency:

ending_value = beginning_value + net_external_flow + income + market_and_fx_change - fees - taxes + other_adjustments

The terms are derived from the event and valuation ledger. Buys, sells, and
internal transfers should cancel in the total-value bridge, while still
changing positions, cash, lots, and realized gain. Corporate actions should
also reconcile through quantity, basis, and value effects rather than being
hidden inside "other."

The system should also reconcile separately:

1. cash by currency;
2. quantity by instrument;
3. accrued income;
4. open tax lots;
5. ending value;
6. source statement balances and positions.

Each reconciliation result is one of:

- balanced within the configured tolerance;
- balanced only after a documented rounding or FX tolerance;
- incomplete because a source position, price, cash leg, or lot is missing;
- unreconciled because the difference has no accepted explanation.

An unreconciled report can still show provisional metrics, but the result must
not look complete.

## Auditability and corrections

The proposed audit model is append-only at the economic-event layer:

- retain the original source event and its source reference;
- add a reversal or correction event instead of editing history in place;
- link the correction to the event it supersedes;
- record who or what applied the correction and why;
- recompute lots, positions, values, reconciliation, and metrics;
- retain the calculation version and policy set used for each published result;
- disclose when a previously displayed result changed.

A report drill-down should answer:

1. Which events and valuation snapshots produced this number?
2. Which external flows were excluded from TWR?
3. Which fees and taxes were included?
4. Which prices and FX rates were used, and were any stale or estimated?
5. Which lots and basis method produced realized or unrealized gain?
6. Was the source complete and reconciled?
7. Which correction or policy version changed the result?

This is an application design recommendation, not a claim that GIPS or IFRS
requires this exact storage model.

## Worked examples

All values below are synthetic and intentionally contain no account, broker,
security, or taxpayer identifiers.

### Example 1: lots, split, dividend, and sale

Assume a user buys 10 units of Security A at 100.00 in the quote currency and
pays a 5.00 purchase commission.

| Step | Quantity | Cash or value | Basis result |
| --- | ---: | ---: | --- |
| Purchase | 10 | 1,000.00 purchase plus 5.00 commission | Total basis 1,005.00 |
| Two-for-one split | 20 | No cash | Total basis remains 1,005.00; unit basis becomes 50.25 |
| Gross dividend | 20 | 30.00 income | Income is 30.00 |
| Withholding | 20 | 5.00 tax withheld | Net dividend cash is 25.00; tax drag is 5.00 |
| Sale of 8 units at 60.00 | 12 remaining | 480.00 gross proceeds less 3.00 sale commission | Net proceeds 477.00; allocated basis 402.00; realized gain 75.00 |

After the sale, the remaining 12 units have basis 603.00. If the current price
is 65.00, their current value is 780.00 and their unrealized gain is 177.00
under this selected basis view.

The split did not create a gain. The dividend is income. The commission is a
cost. The realized and unrealized figures depend on the lot and basis policy.
For a U.S. tax view, IRS Publication 550 supports purchase costs in basis and
describes basis allocation for identical stock splits
([IRS Publication 550](https://www.irs.gov/publications/p550)). Other tax
profiles may differ.

### Example 2: TWR, MWR, and simple return with a contribution

Assume:

- starting value on 1 January: 1,000.00;
- value immediately before a 500.00 contribution on 1 July: 1,100.00;
- ending value on 31 December: 1,650.00.

The first sub-period return is 10.00%. The second is:

1,650 / (1,100 + 500) - 1 = 3.125%

The TWR is:

1.10 × 1.03125 - 1 = 13.4375%

The MWR solves:

-1,000 - 500 / (1 + r)^0.5 + 1,650 / (1 + r) = 0

and is approximately 12.0687% for this one-year example. The two metrics
differ because the additional 500.00 was invested after the first gain.

The unadjusted simple-return calculation would be:

(1,650 - 1,000) / 1,000 = 65%

That number is not a valid performance return because it includes the 500.00
contribution. The flow-adjusted absolute gain is 150.00. If flow-time values
are unavailable, a Modified Dietz diagnostic with a half-year weight gives
150.00 / (1,000.00 + 0.5 × 500.00) = 12.00%, and must be labeled as an
estimate.

### Example 3: reconciliation with income, costs, tax, and market movement

For a synthetic period:

| Component | Amount |
| --- | ---: |
| Beginning value | 10,000.00 |
| External contribution | +1,000.00 |
| Dividend income | +100.00 |
| Interest income | +20.00 |
| Fees and commissions | -30.00 |
| Tax withheld | -15.00 |
| Market and FX change | +425.00 |
| Ending value | 11,500.00 |

The bridge balances:

10,000 + 1,000 + 100 + 20 - 30 - 15 + 425 = 11,500

The period's absolute gain after excluding the contribution is 500.00. Net
income after the listed costs and tax is 75.00. The report must not call 5%
the portfolio return without specifying how the 1,000.00 contribution was
timed. TWR needs a valuation at the flow. MWR needs the dated flow.

### Example 4: local price movement and FX

Assume 10 units are bought at EUR 100.00 when the reporting currency is USD and
the transaction-date rate is 1.10 USD per EUR. The base-currency cost is
1,100.00 USD. At the valuation date, the units are worth EUR 110.00 each and
the rate is 1.20 USD per EUR. The value is 1,320.00 USD, so total base-currency
gain is 220.00 USD.

Using one documented sequential decomposition:

- local price effect at the original rate: EUR 100.00 × 1.10 = 110.00 USD;
- FX effect on the ending local value: EUR 1,100.00 × (1.20 - 1.10) =
  110.00 USD;
- total: 220.00 USD.

Another decomposition order moves the cross term between the two components.
The contract therefore stores the total base-currency result as authoritative
and treats market-versus-FX decomposition as a named method, not as two
independently rounded numbers that must always add up by accident.

### Example 5: cash deposit and pension contribution

Assume a bank deposit begins with principal 5,000.00, earns 25.00 interest,
and ends at 5,025.00. The 5,000.00 principal is an asset balance and the 25.00
is income. If the deposit is inside a single-account report, the original
5,000.00 deposit is an external contribution. If it was transferred from
another included Financial Account, it is internal for the consolidated report.

Assume a defined-contribution pension receives 300.00 from the individual and
200.00 from an employer, then reports a 40.00 investment gain and a 5.00 plan
fee. The performance ledger records 500.00 of tagged external contributions,
40.00 investment gain, and 5.00 cost. It does not call the employer's 200.00
contribution an investment return. The pension tax view is selected separately
from the brokerage tax-lot view.

## Unresolved decisions

The research resolves the metric vocabulary and accounting boundary, but these
decisions still need an explicit finance-domain session:

1. Which tax jurisdictions and account wrappers will v1 support? Spain is
   relevant to the current product context, but the contract does not assume
   Spanish tax residence.
2. What is the default reporting scope for a personal Workspace, and how are
   transfers treated when only one side is connected?
3. Which price and FX providers are permitted, and what stale thresholds apply
   to exchange-traded assets, funds, bonds, deposits, private assets, and
   pensions?
4. What is the default lot policy when a broker does not provide lot
   allocations? How will unknown inbound basis be presented?
5. Is the default income recognition accrual, cash, or both, and which
   transaction dates are authoritative for each asset type?
6. Which fees are observable and attributable enough to support gross,
   net-of-costs, and after-tax views?
7. Will benchmarks be user-selected, allocation-derived, or both? How are
   blended benchmarks rebalanced and versioned?
8. Which corporate actions are supported in v1, and where will action terms
   and tax classifications come from?
9. How will options, short positions, derivatives, crypto assets, employer
   stock, and non-traded pension entitlements extend the contract?
10. What reconciliation tolerances, correction materiality levels, retention
    rules, and report-restatement behavior are acceptable?
11. Which day-count, timezone, rounding, quote convention, and FX-rate
    selection policies are fixed for published results?

## Source-quality caveats

- GIPS is the strongest source for comparable investment-performance method,
  but it governs firms and asset owners claiming compliance. Wayfinder uses it
  as a design reference, not as a compliance claim.
- IRS and Agencia Tributaria sources are authoritative only within their
  respective tax systems and tax years. They justify a jurisdiction-aware tax
  adapter, not a universal basis rule.
- The SEC investor statement page is an educational, illustrative statement.
  It is useful for vocabulary and reconciliation categories, not as a current
  legal definition of every product's reporting obligation.
- OFX is useful for import coverage, but the OFX 2.3 specification explicitly
  says that the release does not support tax lots. An OFX import cannot be the
  sole source of tax-lot truth.
- The FDX OFX page contains a current v2.3 specification table and older FAQ
  text that still calls v2.2 current. The contract uses the linked v2.3 PDF and
  stores the source version explicitly.
- IFRS IAS 21 and IAS 26 are financial-reporting standards. They provide
  durable terminology for currency and retirement-plan boundaries, but they do
  not prescribe a consumer investment dashboard.
- The supplied GitHub issue could not be fetched in this environment. The
  authenticated CLI reported an invalid token and an API connection failure,
  and the browser fetch returned a cache miss. The scope in this document is
  therefore grounded in the ticket title, the user's research brief, the
  repository context, and the cited first-party sources.

## Sources checked

All sources below were checked on 2026-08-22.

| Source | Use |
| --- | --- |
| [CFA Institute, GIPS Standards Handbook for Firms](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/) | Total return, TWR, MWR, IRR, cash-flow timing, fees, withholding taxes, valuation, annualization, benchmarks, and error policies. |
| [CFA Institute, GIPS Standards Handbook for Asset Owners](https://www.gipsstandards.org/standards/gips-standards-handbook-for-asset-owners/) | Currency conversion, asset-owner fee views, and same-currency reporting. |
| [CFA Institute, GIPS calculation methodology](https://www.gipsstandards.org/wp-content/uploads/2021/03/gips-handbook-3rd-edition.pdf) | No-external-flow total-return formula and the distinction between income payments and external cash flows. |
| [CFA Institute, sample error-correction policy](https://www.gipsstandards.org/wp-content/uploads/2021/03/sample_error_correction_policy_firms-1.pdf) | Materiality and correction-policy pattern. |
| [SEC, Cost Basis for Securities Transactions](https://www.sec.gov/answers/costbasis.htm) | Cost-basis meaning and record reconstruction caveat. |
| [Investor.gov, Better Understanding Your Brokerage Account Statement](https://www.investor.gov/better-understanding-your-brokerage-account-statement) | Statement vocabulary for holdings, cash, deposits, withdrawals, income, fees, taxes, realized and unrealized gains, and stale market values. |
| [Investor.gov, Stock Split](https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-split) | Split quantity and price example. |
| [IRS Publication 550, Investment Income and Expenses](https://www.irs.gov/publications/p550) | U.S. examples for adjusted basis, lot identification, reinvestment, wash sales, return of capital, splits, rights, and reorganizations. |
| [IRS Publication 575, Pension and Annuity Income](https://www.irs.gov/publications/p575) | U.S. pension contribution, cost, distribution, and tax-treatment examples. |
| [Agencia Tributaria, IRPF income categories](https://sede.agenciatributaria.gob.es/Sede/educacion-civico-tributaria/programa-educacion-civico-tributaria/que-impuestos/contenidos/impuesto-sobre-renta-personas-fisicas/elementos-irpf.html) | Spanish example showing that interest, dividends, and gains have jurisdiction-specific classifications. |
| [Agencia Tributaria, pension-plan benefits](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/7-cumplimentacion-irpf/7_1-rendimientos-trabajo-personal/7_1_1-rendimientos-integros.html) | Spanish pension-benefit tax classification example. |
| [Financial Data Exchange, OFX Work Group](https://financialdataexchange.org/about-fdx/ofx-work-group/) | Current OFX message-set and specification ownership context. |
| [OFX Banking Specification v2.3](https://financialdataexchange.org/common/Uploaded%20files/OFX%20files/OFX%20Banking%20Specification%20v2.3.pdf) | Investment statements, transactions, positions, balances, and the explicit tax-lot limitation. |
| [IFRS Foundation, IAS 21](https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/) | Foreign-currency transaction and translation principles. |
| [IFRS Foundation, IAS 26](https://www.ifrs.org/issued-standards/list-of-standards/ias-26-accounting-and-reporting-by-retirement-benefit-plans/) | Defined-contribution and defined-benefit pension-plan boundary. |
