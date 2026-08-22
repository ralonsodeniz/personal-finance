# Investment tracking products and mobile visualization patterns

**Status:** Research complete. The product recommendation is ready for prototype planning; domain and integration decisions remain open.

**Date checked:** 2026-08-22

**Ticket:** [Wayfinder issue #64](https://github.com/ralonsodeniz/personal-finance/issues/64)

**Scope:** First-party documentation, feature pages, official demos or screenshots, and public schemas or APIs for consumer, serious-investor, open-source, and desktop or web portfolio trackers. The review covers mixed-asset hierarchy, dashboards, allocation, performance, income, imports, reconciliation, mobile density, accessibility, and progressive disclosure.

**Data handling:** No user files or private source data were read. Examples in this note are vendor documentation or vendor demo values only. No personal identifiers are reproduced.

## Executive recommendation

Wayfinder should be a source-aware wealth tracker with three deliberate layers:

1. `Financial Account` is the source boundary. It can represent a brokerage, cash account, pension, property, or another resource whose value is maintained by a provider, a statement, or the user.
2. Holdings and Activities are different evidence levels. A holding answers "what do I have now?" An activity answers "what happened, when, and at what cost?" A lot is a cost-basis detail, not a replacement for either.
3. A Reporting Portfolio is a view over selected Financial Accounts. It must not move ownership or duplicate balances. Overlapping views should be allowed and clearly labeled.

This structure is an inference from the repeated product pattern. Wealthfolio explicitly supports transaction tracking and holdings snapshots per account, including pension accounts, and lets both modes roll up into one portfolio ([tracking modes](https://wealthfolio.app/docs/concepts/tracking-modes/)). Sharesight reports across multiple portfolios and custom groups ([performance reporting](https://www.sharesight.com/investment-portfolio-performance/)). Kubera uses nested portfolios for separate people, trusts, and entities while linking their totals into a unified view ([nested portfolios](https://help.kubera.com/article/122-nested-portfolios)).

For the first mobile prototype, use a summary card, a scoped list, and a detail sheet as the primary interaction. The home view should show total value, "as of" freshness, account groups, top holdings, allocation, income, and data-health warnings. Tapping a card should preserve the active scope, date range, base currency, and method label. Put lots, activities, corrections, and reconciliation behind the detail view.

Keep the broad net-worth view and manual fallback. Add explicit data provenance, transaction and snapshot modes, income, allocation taxonomy, staged imports, deduplication, internal data health, and accessible chart equivalents. Avoid silent stale values, one unlabeled return percentage, real-time claims for every asset, provider-specific identifiers in the interface, automatic rebalancing or trade placement, and AI document import in the first release.

## Comparison of products

| Product and class | Confirmed first-party model and surfaces | Pattern worth borrowing | Boundary or caveat |
| --- | --- | --- | --- |
| [Monarch Money](https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch), consumer | Separates holdings from underlying securities; groups holdings by type, institution, or account; provides allocation, benchmarked performance, net worth, account drill-down, a dashboard investments widget, and phone widgets. | Make account, holding, security, and cross-account views distinct. Provide a useful mobile summary and a manual fallback. | The help page says unsupported tickers can make prices and performance inaccurate. It also documents differences between provider account balances and quantity times closing price, plus limited manual transaction support ([manual holdings](https://help.monarch.com/hc/en-us/articles/10032888165140-Manual-Investment-Holdings)). |
| [Empower Personal Dashboard](https://support-personalwealth.empower.com/hc/en-us/articles/201169720-Investment-Account-Details), consumer and wealth | Investment account details use Summary, Balance, Income, and Holdings tabs. Income excludes transfers and deposits. The public [tools page](https://www.empower.com/tools) shows connected investment, cash, credit, loan, and other accounts, allocation, risk, and net worth. | Keep income separate from balance and return. Let the user move from a combined net-worth view into one account and one date range. | The checked first-party pages do not expose a public schema or API. Their screenshots show intended product surfaces, not independent accuracy or accessibility evidence. |
| [Kubera](https://www.kubera.com/portfolio-tracker), serious and mixed-asset | Markets stocks, crypto, real estate, private equity, alternatives, documents, and multiple entities. Nested portfolios provide independent views, access control, money flows, and linked totals. Its [Data API v3](https://help.kubera.com/article/171-kubera-data-api-v3) documents portfolio export, asset and debt fields, cash flows, cost basis, unrealized gain, allocation, and connection update timestamps. | Treat non-market assets as first-class valued resources. Keep entity ownership and reporting scope visible. | Most capability detail is vendor marketing or help content. Claims such as "real-time," connector breadth, and AI appraisal were not independently tested. The API documentation does not establish connector accuracy or statement reconciliation. |
| [Sharesight](https://www.sharesight.com/investment-portfolio-performance/), serious-investor web | Reports total return with capital gains, dividends, fees, and currency; supports benchmarks, contribution analysis, custom groups, diversity, multi-period views, multi-currency valuation, exports, and reports across portfolios. | Make return decomposition, filters, custom groups, and exports first-class. | The [V3 API](https://portfolio.sharesight.com/api/3/overview) is documented as a closed beta and may change. Do not make it a dependency assumption. |
| [Ghostfolio](https://github.com/ghostfolio/ghostfolio), open-source web and PWA | Uses accounts and activities, supports transaction CRUD, multi-account roll-up, period returns, import/export, charts, and a mobile-first PWA. Its public import endpoint documents fields such as date, symbol, activity type, quantity, price, fee, currency, and duplicate rejection. | Publish a small, explicit activity schema and make imports idempotent. A mobile-first web app can serve as the first client. | The repository README describes current project behavior, but feature status and data-provider behavior can change. Its risk analysis is a product feature, not an independent risk assessment. |
| [Wealthfolio](https://wealthfolio.app/docs/introduction/), open-source desktop, web, and mobile | Supports local data, accounts, reporting portfolios, holdings or transactions tracking modes, dashboards, income, goals, allocation targets, imports, exports, and a native iOS app or PWA. | Give every Financial Account an explicit evidence mode, then roll modes into a reporting scope without pretending they have equal precision. | The documentation is very current and may change. Its health checks validate internal consistency, not whether a broker statement is correct. |
| [Portfolio Performance](https://help.portfolio-performance.info/en/), open-source desktop | Supports multiple depots and accounts, taxonomies, TTWROR and IRR, configurable dashboards, earnings, fees, taxes, risk indicators, CSV or PDF imports, JSON or XML and CSV exports. | Keep a serious calculation view separate from the mobile home view. Use expandable sections and calculation breakdowns for users who need auditability. | This is a desktop-first information density reference. Its configurable multi-column dashboard is not a mobile layout to copy directly. |

## Confirmed product findings

### Mixed-asset hierarchy and cross-account views

- **Confirmed:** Monarch names holdings as units of a security in a given account, and securities as the underlying stocks, funds, ETFs, crypto, or other assets with price history ([Monarch investments](https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch)). Empower keeps the combined net-worth view, the investment account list, and the selected account's detail tabs separate ([Empower account details](https://support-personalwealth.empower.com/hc/en-us/articles/201169720-Investment-Account-Details)).
- **Confirmed:** Wealthfolio account groups are display roll-ups, while named portfolios are reporting scopes that can span accounts and overlap them ([accounts and portfolios](https://wealthfolio.app/docs/guide/accounts/)). Its dashboard also supports account rows that drill into holdings and activities ([dashboards](https://wealthfolio.app/docs/guide/dashboards/)).
- **Confirmed:** Kubera's nested portfolios model separate people, trusts, entities, and family-office structures, then add linked totals as an asset and debt row in the parent view ([nested portfolios](https://help.kubera.com/article/122-nested-portfolios)).
- **Inference for Wayfinder:** Preserve ownership in the Financial Account and make cross-account "portfolios" read-only reporting overlays. For pension, property, and private assets, store a valuation snapshot and its source rather than inventing a tradable unit, ticker, or live price.

### Dashboards and progressive disclosure

- **Confirmed:** Monarch's investment widget shows total investments, today's change, and top movers, with phone widgets for quick access ([Monarch investments](https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch)).
- **Confirmed:** Empower's public dashboard pattern puts connected investments, cash, credit, loans, and other accounts into one net-worth picture, then offers portfolio allocation and risk views ([Empower tools](https://www.empower.com/tools)).
- **Confirmed:** Wealthfolio's dashboard uses total portfolio value, day and all-time change, account rows, top holdings, allocation, a date-ranged net-worth chart, goals, and a separate income dashboard. Its account rows and top holdings link to deeper holdings or asset pages ([Wealthfolio dashboards](https://wealthfolio.app/docs/guide/dashboards/)).
- **Confirmed:** Portfolio Performance supports configurable dashboards with collapsible sections, actual versus target allocation, top contributors, performance charts with selectable aggregation, earnings widgets, taxes, fees, and trades ([dashboard manual](https://help.portfolio-performance.info/en/reference/view/reports/performance/dashboard/)).
- **Inference for Wayfinder:** The mobile home should be a short decision surface, not a miniature desktop report. Show the top five to ten holdings and a "view all" action. Keep filters and calculation explanations one tap away. Every number should carry scope, date range, base currency, and freshness when those can change its meaning.

### Allocation, performance, benchmarks, and income

- **Confirmed:** Monarch offers asset-class allocation and a time-weighted return benchmarked against the S&P 500, while warning that unsupported securities can freeze prices or produce inaccurate performance ([Monarch investments](https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch)).
- **Confirmed:** Sharesight decomposes performance into capital gains, dividends, fees, and currency fluctuations. Its reports support multiple date periods, benchmark comparisons, contribution analysis, custom grouping, and market, currency, sector, industry, investment type, and country dimensions ([Sharesight performance](https://www.sharesight.com/investment-portfolio-performance/), [Sharesight performance report](https://help.sharesight.com/au/performance_report/)).
- **Confirmed:** Portfolio Performance exposes both true time-weighted return and internal rate of return, and makes the calculation breakdown available by assets, earnings, taxes, fees, and transfers ([performance concepts](https://help.portfolio-performance.info/en/concepts/performance/), [calculation report](https://help.portfolio-performance.info/en/reference/view/reports/performance/calculation/)).
- **Confirmed:** Wealthfolio labels money-weighted return as the dashboard default and offers time-weighted return in Performance. It separates dividend and interest income by period, account, and asset ([Wealthfolio dashboards](https://wealthfolio.app/docs/guide/dashboards/), [performance metrics](https://wealthfolio.app/docs/concepts/performance-metrics/)).
- **Confirmed:** Empower's Income tab includes Interest and Investment Income but excludes transfers and deposits ([Empower account details](https://support-personalwealth.empower.com/hc/en-us/articles/201169720-Investment-Account-Details)). Sharesight also provides dividend tracking, estimates, DRIP handling, and future income reporting ([Sharesight dividend tracker](https://www.sharesight.com/dividend-tracker/)).
- **Inference for Wayfinder:** Never display "return" without the method. At minimum, distinguish value change, realized gain, unrealized gain, cash income, money-weighted return, and time-weighted return. Start allocation with asset class, then disclose region, sector, currency, or custom taxonomies. Show "unclassified," "stale," and "not available" as explicit categories. Add target allocation and drift only when a user has set a target.

### Imports, corrections, and reconciliation

- **Confirmed:** Ghostfolio's official README documents a public activity import API with ISO date, symbol, quantity, unit price, fee, currency, account identifier, and types such as BUY, SELL, DIVIDEND, INTEREST, FEE, and LIABILITY. A duplicate activity returns a `400 Bad Request` ([Ghostfolio README and API](https://github.com/ghostfolio/ghostfolio)).
- **Confirmed:** Wealthfolio's CSV importer has upload, mapping, asset review, activity review with duplicate flags, and an import summary. It supports both activity rows and holdings snapshots, saves mappings per account, and documents native fields for date, symbol, instrument type, quantity, activity type, price, currency, fee, amount, FX rate, and subtype ([CSV import](https://wealthfolio.app/docs/guide/csv-import/)).
- **Confirmed:** Sharesight's public API documents OAuth and trade or payout codes including BUY, SELL, DIV, INT, DIS, transfer, split, and cost-basis-related operations ([API introduction](https://portfolio.sharesight.com/api), [API codes](https://portfolio.sharesight.com/api/3/codes)).
- **Confirmed:** Kubera's Data API v3 documents portfolio export, asset and debt objects, net worth, cost basis, unrealized gain, allocation by asset class, cash-flow entries, and connection last-updated timestamps ([Kubera Data API v3](https://help.kubera.com/article/171-kubera-data-api-v3)).
- **Confirmed:** Monarch explicitly distinguishes the provider's account balance from the investments page's quantity times closing price. Missing, private, unsupported, or cash holdings can make the totals differ ([Monarch investments](https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch)).
- **Confirmed:** Wealthfolio's Health Center checks orphan records, negative positions and cash, stale prices and FX, missing classifications, and account configuration. It says that internal checks cannot validate a broker statement, which must be compared separately ([Health Center](https://wealthfolio.app/docs/guide/health-center/)).
- **Inference for Wayfinder:** Use a staged import flow: upload, map, resolve instruments, review warnings and duplicates, preview the resulting ledger, then commit. Store the original source row and import batch. Make deduplication deterministic and reversible. Separate "internally consistent" from "reconciled to an external statement." A correction should create an auditable replacement or adjustment, not silently overwrite the source record.

### Mobile density and interaction patterns

- **Confirmed:** Ghostfolio describes its PWA as mobile-first ([Ghostfolio README](https://github.com/ghostfolio/ghostfolio)). Wealthfolio documents the same dashboard controls on mobile and a native iOS client with mobile dashboard, holdings, activities, performance, goals, and import surfaces ([Wealthfolio dashboards](https://wealthfolio.app/docs/guide/dashboards/), [mobile guide](https://wealthfolio.app/docs/guide/mobile/)).
- **Confirmed:** The strongest official screenshots and demos repeatedly show a compact headline, account or holding list, one allocation or trend chart, and a drill-down path. Wealthfolio's documented top-holdings rows open asset detail with lots, price history, and dividends ([Wealthfolio dashboards](https://wealthfolio.app/docs/guide/dashboards/)).
- **Inference for Wayfinder:** Prefer one-column cards, short lists, segmented date controls, and bottom sheets or drawers for detail. Use horizontal scrolling only for an unavoidable comparison table. Keep current scope visible above the fold. Do not make a dense desktop table the default mobile view.

### Accessibility

- **Confirmed:** WCAG 2.2 applies to web content on mobile devices and includes requirements for text alternatives, color use, contrast, text resizing, reflow, keyboard access, visible focus, focus not obscured, and target size ([W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)). W3C also publishes mobile application guidance for applying WCAG 2.2 ([WCAG2Mobile](https://www.w3.org/TR/wcag2mobile-22/)).
- **Inference for Wayfinder:** Every chart needs a text summary and an accessible data table or equivalent. Green and red must not be the only signal for gain, loss, goal status, or stale data. Provide a visible focus indicator, meaningful labels, reflow at narrow widths, sufficient non-text contrast, and touch targets that remain usable with zoom and assistive technology. Treat these as product requirements, not polish after the visualization is chosen.

## What Wayfinder should keep, add, and avoid

| Keep | Add | Avoid |
| --- | --- | --- |
| Net worth alongside investments, with account and holding drill-down. | A Financial Account source boundary and a Reporting Portfolio overlay. | A single undifferentiated "account" model for identity, ownership, and reporting. |
| Holdings versus underlying securities, manual balances, date ranges, top holdings, and allocation. | Transaction mode and holdings-snapshot mode per Financial Account, with visible confidence and freshness. | Forcing pension, private, or unsupported assets into ticker and share precision. |
| Manual fallback when a connector lacks holdings or a security. | Activities, lots, cost basis, cash movements, dividends, interest, fees, taxes, and transfers. | Mixing deposits or transfers into performance or income. |
| Cross-account reporting and a clear base currency. | Method-labeled performance, return decomposition, benchmarks as named proxies, and explicit FX effects. | One unlabeled percentage or a benchmark that appears authoritative when it is only a proxy. |
| Compact summary cards and drill-down. | Staged CSV import, deterministic duplicate handling, source-row retention, exports, and a Health Center. | Silent imports, destructive corrections, provider IDs in the UI, or "sync succeeded" without freshness evidence. |
| Allocation by a simple asset class. | Region, sector, currency, custom taxonomy, actual versus target drift, and an unclassified bucket. | A wall of pies, overlapping classifications that silently double-count, or a target without a user decision behind it. |
| A web or PWA-first delivery path. | Accessible chart alternatives, hidden-value mode, reduced-motion behavior, and mobile-specific interaction tests. | Copying a desktop-configurable dashboard onto a phone or treating color as the data model. |
| User-controlled data and exportability. | Reconciliation against statements as a separate workflow from internal consistency. | Auto-trading, trade placement, automatic rebalancing, AI document import, and deep risk metrics in v1. |

## Proposed first mobile prototype

This is an inferred prototype sequence, not a confirmed requirement in the current application:

1. **Home:** total wealth or selected Reporting Portfolio, base currency, as-of timestamp, day change, and a freshness or data-health badge.
2. **Accounts:** grouped Financial Accounts with value, evidence mode, source, and last update. A row opens holdings, snapshots, or activities according to that account's mode.
3. **Allocation:** asset-class bars or a donut with a text table, total percentages, unclassified value, and drill-down to region, sector, or currency.
4. **Performance:** date range, method selector, value change, realized and unrealized gain, income, fees, FX effect, and benchmark selector. Do not default to a method that the user cannot explain.
5. **Income:** dividends, interest, distributions, fees, and taxes by period, account, asset, and status. Keep projected income separate from received income.
6. **Data health:** stale valuation, missing price or FX, unmapped instrument, duplicate import, negative cash, and unclassified asset. Each warning links to the affected record and explains whether it is an internal check or a statement reconciliation.
7. **Detail:** one asset or Financial Account at a time, with holdings or snapshots, lots, activities, source evidence, corrections, and an audit trail.

## Unresolved decisions

1. Which mixed assets are in the first release: listed securities, cash, pensions, property, private investments, liabilities, or all of them as valuation snapshots?
2. Is the first ledger transaction-first, snapshot-first, or explicitly hybrid per Financial Account? If hybrid, which metrics are suppressed when history is incomplete?
3. Which performance method is the default in the home view: MWR, TWR, value return, or no return until data quality is sufficient?
4. What is the authoritative source hierarchy when provider balance, imported statement, manual snapshot, and derived holding value disagree?
5. Which Reporting Portfolio scopes are permitted, and how should ownership, household membership, and cross-entity reporting interact with them?
6. Which market-data and FX providers are acceptable, what are their licensing boundaries, and what freshness thresholds are appropriate for market, pension, property, and manual values?
7. What is the canonical activity and instrument schema, including identifiers, lots, corporate actions, cash movements, transfers, and import-batch provenance?
8. What exact duplicate fingerprint and correction model will preserve source rows while preventing double counting?
9. Which allocation taxonomies are built in, how are look-through holdings handled, and how are classification gaps shown without false completeness?
10. What accessibility target and chart technology will support both the web or PWA client and the future Expo client?

## Source-quality caveats

- All external product claims are from first-party product pages, help documentation, official repositories, official API documentation, or W3C standards. Vendor marketing claims are labeled as such and are not treated as independent accuracy or performance evidence.
- Official screenshots and demos establish intended information architecture and density. They do not prove usability, accessibility conformance, data freshness, or calculation correctness.
- Feature status was checked on 2026-08-22. Product documentation, APIs, plan gates, and screenshots can change. Sharesight's V3 API is explicitly a closed beta. Ghostfolio's README describes the repository's current public interface, not a stability guarantee.
- No public schema or API was found in the checked first-party pages for Monarch or Empower. Kubera does publish a Data API v3, but its documentation does not establish connector accuracy or statement reconciliation. A search result about a missing public API is not evidence that a product has no private or partner APIs.
- The products use different terms for account, portfolio, holding, activity, and performance. The recommendations above map those observations into Wayfinder's existing domain vocabulary rather than importing vendor semantics unchanged.
- No private user data was used. No application code, product documentation, or GitHub issue was modified as part of the research.

## Sources checked

### Consumer and wealth products

- [Monarch, Investments in Monarch](https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch)
- [Monarch, Manual Investment Holdings](https://help.monarch.com/hc/en-us/articles/10032888165140-Manual-Investment-Holdings)
- [Empower, Financial Tools](https://www.empower.com/tools)
- [Empower, Investment Account Details](https://support-personalwealth.empower.com/hc/en-us/articles/201169720-Investment-Account-Details)
- [Empower, Investment Checkup](https://www.empower.com/investment-checkup)

### Serious-investor and mixed-asset products

- [Kubera, Portfolio Tracker](https://www.kubera.com/portfolio-tracker)
- [Kubera, Nested Portfolios](https://help.kubera.com/article/122-nested-portfolios)
- [Kubera, Data API v3](https://help.kubera.com/article/171-kubera-data-api-v3)
- [Sharesight, Investment Portfolio Performance](https://www.sharesight.com/investment-portfolio-performance/)
- [Sharesight, Dividend Tracker](https://www.sharesight.com/dividend-tracker/)
- [Sharesight, Show Portfolio](https://help.sharesight.com/us/show_portfolio/)
- [Sharesight, Performance Report](https://help.sharesight.com/au/performance_report/)
- [Sharesight, API Introduction](https://portfolio.sharesight.com/api)
- [Sharesight, API Overview](https://portfolio.sharesight.com/api/3/overview)
- [Sharesight, API Codes](https://portfolio.sharesight.com/api/3/codes)

### Open-source and desktop products

- [Ghostfolio, official repository and README](https://github.com/ghostfolio/ghostfolio)
- [Wealthfolio, Introduction](https://wealthfolio.app/docs/introduction/)
- [Wealthfolio, Accounts and Portfolios](https://wealthfolio.app/docs/guide/accounts/)
- [Wealthfolio, Dashboards](https://wealthfolio.app/docs/guide/dashboards/)
- [Wealthfolio, Tracking Modes](https://wealthfolio.app/docs/concepts/tracking-modes/)
- [Wealthfolio, Performance Metrics](https://wealthfolio.app/docs/concepts/performance-metrics/)
- [Wealthfolio, Activities](https://wealthfolio.app/docs/guide/activities/)
- [Wealthfolio, CSV Import](https://wealthfolio.app/docs/guide/csv-import/)
- [Wealthfolio, Health Center](https://wealthfolio.app/docs/guide/health-center/)
- [Wealthfolio, Allocation Targets and Rebalancing](https://wealthfolio.app/docs/guide/allocation-targets/)
- [Wealthfolio, Mobile](https://wealthfolio.app/docs/guide/mobile/)
- [Wealthfolio, Data Export](https://wealthfolio.app/docs/guide/data-export/)
- [Portfolio Performance, documentation](https://help.portfolio-performance.info/en/)
- [Portfolio Performance, performance concepts](https://help.portfolio-performance.info/en/concepts/performance/)
- [Portfolio Performance, dashboard](https://help.portfolio-performance.info/en/reference/view/reports/performance/dashboard/)
- [Portfolio Performance, calculation](https://help.portfolio-performance.info/en/reference/view/reports/performance/calculation/)
- [Portfolio Performance, import](https://help.portfolio-performance.info/en/reference/file/import/)
- [Portfolio Performance, export](https://help.portfolio-performance.info/en/reference/file/export/)
- [Portfolio Performance, save format](https://help.portfolio-performance.info/en/reference/file/save/)

### Accessibility standards

- [W3C, Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C, WCAG2Mobile](https://www.w3.org/TR/wcag2mobile-22/)
- [W3C, Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [W3C, Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
