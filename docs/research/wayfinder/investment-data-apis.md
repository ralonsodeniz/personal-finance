# Investment data API provider landscape

- Status: Research complete, with an implementation recommendation
- Date checked: 2026-08-22
- GitHub issue: [#61, Market Data and Investment API Provider Landscape](https://github.com/ralonsodeniz/personal-finance/issues/61)
- Scope: global listed instruments, ETFs and ETC-like traded products, funds and NAVs, FX, corporate actions, pensions, cash and deposits, and Spain/EU bank and brokerage imports

## Executive recommendation

Confirmed: the public evidence separates this problem into at least four source classes. Regulatory and official-institution services provide filings, reference data, registries, statistics, or reference FX. Open-banking providers expose payment-account data, while wealth aggregators may add investment and pension positions through commercial connectors. Market-data vendors provide prices, NAVs, symbology, and corporate actions under separate data and redistribution terms. The checked sources do not document one provider with complete coverage of all of these classes. See the [SEC EDGAR API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [ESMA FIRDS description](https://www.esma.europa.eu/data-reporting/mifir-reporting), [ECB exchange-rate methodology](https://data.ecb.europa.eu/key-figures/ecb-interest-rates-and-exchange-rates/exchange-rates), [Tink Investments](https://tink.com/es/productos/investments/), [Powens Wealth aggregation](https://docs.powens.com/documentation/integration-guides/wealth), and [Morningstar licensed data](https://www.morningstar.com/en-us/business/products/data).

Inference: v1 should have no live provider integrations. The first useful boundary is a provider-neutral domain model with manual entry, CSV or statement import, offline reference fixtures, and fake adapters that exercise refresh, pagination, rate-limit, stale-data, revision, and outage behavior. This delivers a testable product without taking on credentials, consent, licensing, or redistribution obligations before the coverage decision is made.

Inference: after that boundary is stable, the most credible pilot sequence is:

1. Use [ECB SDMX data](https://data.ecb.europa.eu/help/api/data) for reference FX and [OpenFIGI](https://www.openfigi.com/api/documentation) plus [GLEIF](https://www.gleif.org/en/lei-data/gleif-api) for identity assistance. These are supporting services, not a portfolio source.
2. Evaluate [Tink Investments](https://tink.com/es/productos/investments/) and [Powens Wealth](https://www.powens.com/es/productos/agregacion-datos-financieros/) for Spain/EU investment and pension connections. Require an institution-by-institution capability result and a contract before selecting either.
3. Use [GoCardless Bank Account Data](https://developer.gocardless.com/bank-account-data/overview) or [TrueLayer Data](https://docs.truelayer.com/docs/data-api-basics) only for payment-account balances and transactions unless a separate, documented investment product is contracted.
4. For market prices, corporate actions, and fund NAVs, run a licensing and sample-coverage evaluation with [Twelve Data](https://twelvedata.com/pricing), [Morningstar](https://equityapi.morningstar.com/), [LSEG](https://www.lseg.com/en/data-analytics/market-data/data-analytics-pricing/reference-data/corporate-actions), or [FactSet](https://developer.factset.com/api-catalog/factset-global-prices-api). Do not use a personal or free plan for a consumer-facing service.

The final provider choice remains unresolved. Public product pages establish capabilities and vendor claims, not entitlement to redistribute data, coverage of a particular Spanish bank or broker, a service-level agreement, or permission to retain user data.

## Evidence rules and limits

`Confirmed` means that the cited official regulator, institution, or vendor documentation states the capability or term. `Inference` means a design or selection consequence drawn from confirmed evidence. `No public evidence found` means that the checked public material did not establish a claim; it does not prove that a private, sales-led, or undocumented service does not exist.

The check date is fixed at 2026-08-22. Pricing, plan limits, supported institutions, product names, terms, and market-data entitlements can change. No credentials were used. No source payload, account number, personal identifier, real portfolio, or real security identifier was copied into this document. Examples below use field names only.

## Capability map

| Source class | Confirmed fit | Important boundary | Proposed role |
| --- | --- | --- | --- |
| SEC EDGAR | US issuer submissions, company facts, concepts, and frames through unauthenticated JSON APIs | Filings and XBRL are not quotes, account imports, or a complete corporate-action feed | Optional issuer-fundamental enrichment |
| ESMA FIRDS | EU MiFIR reference data published from venues and systematic internalisers | Reference data is not a quote or fund NAV service | EU instrument and venue reference |
| ECB SDMX | Programmatic macroeconomic and FX data, with version-history query parameters | Euro reference rates are informational and are not execution or broker rates | Reference FX and revision-aware fixtures |
| CNMV and DGSFP | Spanish collective-investment and pension registers, publications, and statistics | The checked pages do not establish a public user-position or live-NAV API | Spanish reference and discovery metadata |
| GoCardless and TrueLayer | Payment-account identity, balances, and transactions through PSD2-oriented products | Public docs checked do not establish securities, pension, or term-deposit holdings | Later cash-account pilot |
| Tink and Powens | Officially marketed investment, pension, wealth, or savings aggregation | Institution coverage, field completeness, connector method, retention, and commercial terms need validation | Later Spain/EU wealth pilot candidates |
| Alpha Vantage, Twelve Data, Massive | Market prices, FX, reference data, and selected corporate-action or fund functions | Free or self-serve plans have material personal-use, display, redistribution, or exchange-license limits | Offline fixtures or post-contract pilots |
| Morningstar, LSEG, FactSet | Enterprise global investment, price, corporate-action, and managed-investment datasets | Pricing, licensing, and exact Spanish or European fund coverage are sales-led or entitlement-dependent | Enterprise evaluation only |
| muFunds | Its own page documents a spreadsheet function that reads a current price or NAV and names Morningstar and QueFondos as selectable sources | No public API, SLA, coverage manifest, or redistribution licence for Personal Finance was established | Do not make it a runtime adapter |

The summary is a comparison of public evidence, not a vendor ranking. An advertised instrument count or country count must be converted into an entitlement and coverage test before implementation.

## Official and institutional sources

### US filings and issuer facts

Confirmed: the [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) expose submissions history and XBRL company facts, concepts, and frames as REST JSON endpoints without an API key. The SEC says submissions and XBRL data are updated as filings are disseminated, with bulk archives updated nightly. The same page says the APIs do not support CORS, so a server-side fetch is the appropriate integration shape.

Confirmed: the [SEC EDGAR API toolkit documentation](https://api.edgarfiling.sec.gov/docs/index.html) warns that resources can be rate-limited, that limits can change, that a `429` response can be returned, and that requests should identify the application with a descriptive `User-Agent`. These are operational requirements even though an API key is not required.

Inference: EDGAR can enrich issuer facts, filing-derived events, and audit evidence for US securities. It cannot be treated as a global price, user-account, pension, cash, or fund-NAV provider. A future adapter should preserve filing accession and reported-period provenance rather than turning filing facts into an authoritative market valuation.

### EU instrument reference data

Confirmed: [ESMA FIRDS](https://www.esma.europa.eu/data-reporting/mifir-reporting) publishes MiFIR and MAR reference data supplied by trading venues and systematic internalisers. [MiFIR Article 27](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mifir/article-27-obligation-supply-financial) describes venue obligations to supply identifying reference data before trading and when data changes, and ESMA's publication duty.

Inference: FIRDS is useful for EU instrument, venue, and trading-attribute discovery. The official scope does not establish live bid or ask data, historical prices, fund NAVs, user positions, or a consumer-account import. The adapter should label it as reference data and preserve the publication or effective context.

### FX reference rates and revisions

Confirmed: the [ECB data API](https://data.ecb.europa.eu/help/api/overview) exposes SDMX REST access to data and metadata. The [ECB data endpoint documentation](https://data.ecb.europa.eu/help/api/data) documents `updatedAfter` and `includeHistory`, which are relevant to detecting revisions and retrieving prior versions. The [ECB exchange-rate page](https://data.ecb.europa.eu/key-figures/ecb-interest-rates-and-exchange-rates/exchange-rates) says euro foreign-exchange reference rates for 30 currencies are published on working days around 16:00 CET and are informational rather than necessarily the rates used in a transaction.

Inference: ECB rates are a defensible reference-rate source for offline valuation and reporting, provided the application records the rate date, publication timestamp, and revision status. They must not silently replace a broker's execution FX, card rate, or account-reported conversion.

### Spanish funds and pension institutions

Confirmed: the [CNMV collective-investment register](https://www.cnmv.es/portal/consultas/indiceiic?lang=es) and [CNMV IIC functions page](https://www.cnmv.es/portal/quees/funciones/iic?lang=es) describe official records for collective-investment institutions marketed in Spain, including registration and access to prospectuses, periodic information, audited accounts, and relevant facts. The [CNMV IIC statistics page](https://www.cnmv.es/portal/publicaciones/consultasestadisticas?id=IIC&lang=es) provides statistical publications. The [CNMV individual-information download](https://www.cnmv.es/Portal/Publicaciones/Descarga-Informacion-Individual?lang=en) publishes XML files: monthly files include mutual-fund basic data such as net asset value and investors, while quarterly files include more detailed commissions, returns, and portfolio information.

Confirmed: the [DGSFP pension-plan balances and accounts page](https://dgsfp.mineco.gob.es/es/Entidades/balancesycuentas/Paginas/BalancesCuentasPlanesFondosNew.aspx) says its published data is extracted from statistical-accounting documents declared by entities and remains under those entities' responsibility. It provides historical search and publications, not a consumer endpoint for an individual's current pension holdings.

Confirmed: the SEC also publishes periodic registered-fund holdings through its [Form N-PORT data sets](https://www.sec.gov/data-research/sec-markets-data/form-n-port-data-sets). That source can support US fund research and filing provenance, but it is not a normalized daily NAV feed or a user-account import.

No public evidence found: the checked CNMV and DGSFP pages did not establish a public live-NAV API or an authenticated user-position API for Personal Finance. CNMV does provide periodic official NAV-related XML files, but that is not the same as a live or user-specific API. This is an observation of the checked pages, not proof that no other machine-readable service exists elsewhere.

Inference: CNMV and DGSFP should supply discovery, eligibility, and audit metadata. Current Spanish fund NAVs, pension balances, contributions, fees, and contract values still need a licensed fund-data source, an aggregator, a statement import, or manual entry.

### Identity services

Confirmed: [ISO 6166](https://www.iso.org/standard/78502.html) defines the structure for ISINs and the minimum descriptive information associated with financial instruments and reference instruments. [OpenFIGI](https://www.openfigi.com/api/documentation) maps third-party identifiers to FIGIs and documents unauthenticated and API-key rate limits. Its [FAQ](https://www.openfigi.com/about/faq) says FIGI symbology is free but also explains restrictions around returning third-party proprietary identifiers.

Confirmed: the [GLEIF API](https://www.gleif.org/en/lei-data/gleif-api) provides public LEI search and relationship data, including mappings to identifiers such as BIC and ISIN. GLEIF's [data-access page](https://www.gleif.org/en/lei-data/access-and-use-lei-data) describes free access to the LEI data pool and published data products.

Inference: ISIN is the preferred supplied identity for a security or fund share class when available. FIGI is useful for cross-source resolution and listing or composite identity. LEI identifies an issuer or legal entity, not a security. A ticker is local to a listing, venue, and sometimes currency, so it must never be the canonical global instrument key.

## Spain and EU account connections

### Regulatory boundary

Confirmed: [PSD2 Article 4](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32015L2366) defines a payment account in the context of payment transactions and defines account-information services as consolidated online information on one or more payment accounts. The [Banco de España account-information guidance](https://clientebancario.bde.es/pcb/en/menu-horizontal/productosservici/relacionados/entidades/guia-textual/tiposentidadesso/entidades-prestadoras-de-servicios-de-informacion-de-cuentas.html) describes registered AIS providers and points to the official register.

Confirmed: the [Berlin Group NextGenPSD2 framework](https://www.berlin-group.org/psd2-access-to-bank-accounts) standardizes access-to-account data and messaging around PSD2 and the EBA regulatory technical standards. Its [openFinance page](https://www.berlin-group.org/open-finance) describes extensions beyond the PSD2 baseline for additional data and account types.

Inference: regulatory AIS coverage should be assumed to cover payment accounts first. Securities, pension contracts, and term deposits require explicit product evidence or a separate open-finance or wealth connector. A provider that advertises investment aggregation is not automatically offering the same consent, legal basis, refresh, or data quality as PSD2 AIS.

### Open-banking aggregators

| Provider | Confirmed public capability | Terms and data-quality boundary | Assessment |
| --- | --- | --- | --- |
| [GoCardless Bank Account Data](https://developer.gocardless.com/bank-account-data/overview) | The product documents account holder and account information, balances, and transactions; it says up to 24 months of transaction history and up to 90 days of continuous access can be available across EEA PSD2 countries. | The [quick-start guide](https://developer.gocardless.com/bank-account-data/quick-start-guide/) documents access and refresh tokens, institution-specific history and access settings, and consent scopes. The checked site says this version of the documentation will no longer be available from 2026-08-24 and points to the [new developer documentation](https://docs.gocardless.com/). The [GDPR page](https://gocardless.com/legal/gdpr) describes retention and deletion controls but not one universal retention period for every customer use. | Good later cash and payment-account candidate, but re-check the replacement docs before implementation. The public Bank Account Data material does not establish investment holdings, pension positions, or term-deposit schedules. |
| [TrueLayer Data](https://docs.truelayer.com/docs/data-api-basics) | The public Data API v1 documents identity, accounts, balances, transactions, regular payments, and provider-specific scopes. The [current Data API v3 page](https://docs.truelayer.com/docs/enable-your-users-to-connect-their-bank-account) documents account and transaction data and explicitly says Data v3 is currently supported only in the UK. | The [consent guidance](https://docs.truelayer.com/docs/ux-for-reconfirmation-of-consent) documents reconfirmation for regulated AIS access. The [EEA end-user terms](https://truelayer.com/legal/enduser_tos/) describe privacy and retention obligations, including a general seven-year period after last use subject to exceptions; this is not a substitute for the customer contract or DPA. | Not a current Spain recommendation based on the public v3 page. The older [Spain launch announcement](https://truelayer.com/newsroom/announcements/spain-launch/) is historical evidence only. Reconsider only after the live provider console and contract confirm a supported Spain/EU product. The public pages reviewed do not establish a holdings or pension-position resource. |
| [Tink Investments](https://tink.com/es/productos/investments/) | Tink's current Spanish product page markets funds, stocks, bonds, pensions, and ISK accounts, and describes holdings such as value, quantity, acquisition price, ISIN, and name. The [launch announcement](https://tink.com/tink-investments-product-launch/) records an initial Spain and Sweden launch. | The [Tink API documentation](https://docs.tink.com/api) documents authenticated REST APIs, investment-account resources, scopes, `429` rate limiting, request IDs, and compatibility rules. The [aggregation capabilities documentation](https://docs.tink.com/market-capabilities/aggregation) is the required bank-level coverage check; product marketing is not proof that every Spanish institution exposes every field. | Strongest public evidence for a Spain investment and pension pilot, subject to commercial access, exact bank or broker coverage, field completeness, consent duration, retention, and price. |
| [Powens Wealth aggregation](https://docs.powens.com/documentation/integration-guides/wealth) | Powens documents extensions for savings, market accounts, life insurance, retirement savings, and company savings. Its [Spanish product page](https://www.powens.com/es/productos/agregacion-datos-financieros/) claims more than 1,800 banks in more than 12 European countries and more than 200 investment platforms. | The [investment API reference](https://docs.powens.com/api-reference/products/wealth-aggregation/investments) includes fields such as ISIN, quantity, unit value, valuation, value date, and history. The wealth guide warns that connector fields can be empty, history may be shallow, and source-derived histories can differ. Powens' [Spanish terms](https://www.powens.com/es/sas-condiciones-uso/) describe Direct Access methods including web scraping or reverse engineering outside PSD2. | Broad candidate for a later Spain/EU wealth pilot, but connector fragility, source-derived valuations, contract terms, and non-PSD2 access need a security and legal review. |

Confirmed: the provider pages above document different data and consent models. They do not prove that a single provider can connect to the user's bank, broker, pension manager, or term-deposit issuer. Coverage must be checked against an institution list and a test account before selection.

### Cash, deposits, brokerage, and pensions

Cash balances and payment transactions have the clearest public path through PSD2 AIS. Savings-account fields are documented by [TrueLayer Data v1](https://docs.truelayer.com/docs/account-and-card-data), and account and transaction data by [GoCardless Bank Account Data](https://developer.gocardless.com/bank-account-data/overview). A term deposit is not equivalent to a payment account under the [PSD2 definition](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32015L2366): the reviewed public AIS material does not establish maturity date, early-withdrawal penalty, accrued interest, or principal schedule for Spanish term deposits.

Brokerage and pension positions have stronger public evidence in Tink and Powens than in the PSD2-only products, but the evidence is vendor-level. A later pilot must prove, for each target institution, whether the connector returns positions, transactions, cost basis, instrument IDs, cash, fees, corporate actions, and historical valuations. Missing fields must be represented as missing, not inferred.

The [Morningstar ByAllAccounts investor aggregation documentation](https://developers.byallaccounts.morningstar.com/docs/what-is-investor-account-aggregation) lists account types such as retirement, brokerage, cash, checking, and savings and data categories such as positions, transactions, prices, securities, and tax lots. It does not establish Spain or EU bank and pension coverage in the checked public material, so it is a comparator rather than a Spain recommendation.

## Market-data and fund-data vendors

### Self-serve and developer-oriented vendors

| Provider | Confirmed public coverage | Terms, freshness, and licensing | Recommendation |
| --- | --- | --- | --- |
| [Alpha Vantage documentation](https://www.alphavantage.co/documentation/) | Documents global symbols, stocks, ETFs, mutual-fund symbol search, time series, FX, dividends, splits, listings, and adjusted data. | The [premium page](https://www.alphavantage.co/premium/) and [support page](https://www.alphavantage.co/support/) describe free and paid limits and exchange entitlements. Its [terms](https://www.alphavantage.co/terms_of_service/) restrict free use to personal or non-commercial use and require a written commercial agreement for broader use. | Useful for offline experiments and fixtures after checking the exact field. Not suitable as a live consumer backend under the free or personal terms. Public docs do not guarantee European or Spanish fund NAV coverage. |
| [Twelve Data documentation](https://twelvedata.com/docs) | Documents global equities, ETFs, FX, mutual funds, dividends, splits, identifier search, and fund or ETF metrics. Its [European-equities market-data page](https://support.twelvedata.com/en/articles/12656239-european-equities-market-data) includes Spanish venues or coverage examples and describes display, non-display, and external-distribution models. | The [pricing page](https://twelvedata.com/pricing) shows that global, real-time, and mutual-fund-NAV entitlements vary by plan. The [terms](https://twelvedata.com/terms) and [commercial-use guidance](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) distinguish internal or personal use from commercial display and redistribution, with exchange-specific approval sometimes required. | Best self-serve candidate to evaluate for prices, FX, ETFs, and fund NAVs after a business entitlement review. Do not infer complete European or Spanish fund coverage from a country list. |
| [Massive stock APIs](https://massive.com/docs/rest/stocks) | Documents US stocks, reference tickers, FIGI fields, historical and real-time data, dividends, splits, and a separate [forex product](https://massive.com/docs/rest/forex/overview?auth=login%2Fgetting-started). | The [market-data terms](https://massive.com/legal/market-data-terms-of-service) restrict self-service market data to personal, non-business, non-commercial use, prohibit treating it as an end-user application without the relevant agreement, and reserve suspension or data changes. | Good reference for a future US market-data evaluation, not a v1 consumer integration and not evidence for European funds or pension data. |

Confirmed: these vendors expose different combinations of prices, reference data, corporate actions, FX, and funds. “Global symbols” or “all tickers” does not mean that every listing has a usable quote, NAV, corporate-action history, or redistribution right. The [Twelve Data commercial-use guidance](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage), [Alpha Vantage terms](https://www.alphavantage.co/terms_of_service/), and [Massive terms](https://massive.com/legal/market-data-terms-of-service) make this distinction explicit.

### Enterprise and licensed sources

| Provider | Official evidence | Boundary and likely use |
| --- | --- | --- |
| [Morningstar Equity API](https://equityapi.morningstar.com/) and [Morningstar licensed data](https://www.morningstar.com/en-us/business/products/data) | Morningstar documents licensed data across managed investments, equities, bonds, indexes, alternatives, funds, ETFs, corporate actions, currency pairs, and historical data. The [API overview](https://equityapi.morningstar.com/OverView.html) documents REST and SOAP access, credentials, test access, and production data. | This is the strongest candidate for a licensed managed-investment and fund-data evaluation, but public pages do not state the price, exact Spanish or European NAV universe, redistribution rights, or SLA for this project. Require a contract, sample response, identifier coverage, and entitlement matrix. |
| [LSEG corporate actions](https://www.lseg.com/en/data-analytics/market-data/data-analytics-pricing/reference-data/corporate-actions) and [LSEG equities](https://www.lseg.com/en/data-catalogue/equities) | LSEG documents global equity pricing, traded products, and corporate-action coverage with multiple delivery methods and event types. Its [developer API catalog](https://developers.lseg.com/en/api-catalog) covers pricing, reference, symbology, and FX products. | Enterprise commercial terms, data packages, and exchange redistribution rules are not fully public on the checked pages. Evaluate for global prices and corporate actions when the budget and licensing model justify it. |
| [FactSet Global Prices API](https://developer.factset.com/api-catalog/factset-global-prices-api) | FactSet documents global equities, ADRs, GDRs, preferred securities, closed-end funds, ETFs, structured products, historical prices, and event-based corporate actions. | The public developer catalog does not establish a Spanish or European mutual-fund NAV universe, public pricing, or redistribution permission. Treat as an enterprise RFP candidate. |

Inference: Morningstar, LSEG, and FactSet are more plausible than self-serve APIs when complete fund, corporate-action, and global-market coverage is a product requirement. That inference is about data and licensing posture, not a vendor selection. A written proposal and test universe are required.

### Official exchange and broker surfaces

Confirmed: [BME market-data documentation](https://www.bolsasymercados.es/en/bme-exchange/prices-and-markets/market-data-services/documentation.html) and [BME corporate-action information](https://www.bolsasymercados.es/en/bme-exchange/prices-and-markets/shares/corporate-actions.html) are first-party sources for Spanish exchange data. BME's public information is not a general global holdings API, and commercial redistribution requires the exchange's permission under the applicable data terms.

Confirmed: [Euronext Web Services](https://www.euronext.com/en/data/how-access-market-data/web-services) documents machine-readable access to Euronext market data, while [Euronext cash-market notices](https://www.euronext.com/en/products-services/cash-market-notices) provide exchange notices and corporate-action-related information. These are venue-specific licensed sources, not a unified EU account connector.

Confirmed: the [Interactive Brokers Web API](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/) documents account, portfolio, balance, position, transaction, and statement access for eligible brokerage accounts. Inference: a broker's first-party API should be modeled as a broker-specific `AccountDataAdapter`, with its own authentication and eligibility, rather than treated as generic PSD2 AIS coverage.

Inference: BME and Euronext are the highest-provenance choices for their own listings and notices when the product needs Spanish or Euronext venue data. They do not remove the need for a separate fund-NAV, pension, cash, or cross-venue identity strategy.

ETFs and ETC-like products should be treated as listed products unless a source explicitly supplies a NAV or indicative value. The checked vendor pages document ETPs or traded products, but do not establish a universal ETC-specific NAV contract. See [Twelve Data European equities](https://support.twelvedata.com/en/articles/12656239-european-equities-market-data), [LSEG equities](https://www.lseg.com/en/data-catalogue/equities), and [FactSet Global Prices](https://developer.factset.com/api-catalog/factset-global-prices-api).

### muFunds and Morningstar-style spreadsheet use

Confirmed: the [muFunds compatibility list](https://mufunds.com/compatibility.html) and [usage page](https://mufunds.com/usage.html) document a Google Workspace spreadsheet function that reads current prices or NAVs and names Morningstar and QueFondos as selectable sources for mutual funds, pension plans, bonds, and other assets. This is evidence about the muFunds product documentation only.

Confirmed: muFunds' [behavior documentation](https://mufunds.com/behavior.html) says that it fetches an HTML page from the selected source, parses the requested data, and caches it for two hours. Its [terms](https://mufunds.com/terms.html) provide a limited as-is service license. No public evidence found: the checked material did not establish a supported server API, a source-level availability or freshness SLA, a complete coverage manifest, a Personal Finance redistribution licence, or a data-retention contract. The page's use of a source name is not evidence that Personal Finance may call or redistribute that source directly.

Confirmed: Morningstar separately documents commercial [data licensing](https://www.morningstar.com/en-us/business/products/data) and an [Equity API](https://equityapi.morningstar.com/). Inference: muFunds should not become a runtime dependency or an identity source. If Morningstar is selected, integrate against a contracted Morningstar API or feed and keep the adapter independent of spreadsheet functions.

## Provider-neutral identity and adapter boundary

### Canonical identity

Inference: the domain should separate the following objects:

- `Issuer`: a legal entity, optionally linked to LEI and issuer identifiers.
- `Instrument`: the economic security or contract, with a stable internal ID and a set of scheme-qualified external identifiers.
- `Listing`: a venue-specific tradable representation with ticker, MIC, currency, trading status, and provider symbols.
- `FundShareClass`: a fund share class with its own ISIN, currency, fee, distribution policy, and NAV calendar where known.
- `Account`: a cash, brokerage, pension, deposit, or other provider account, namespaced by provider and connection.
- `Position`: an account's quantity or balance at an as-of time, linked to an instrument or an account-native contract when no universal instrument ID exists.
- `Valuation`: a quote, NAV, broker-reported value, or reference FX conversion with explicit method, source, timestamp, as-of date, and freshness state.
- `CorporateAction`: a source event with event type, effective dates, terms, adjustment basis, source event ID, and revision state.

Every external identifier should be stored as `(scheme, normalized_value, source, observed_at)`. Preserve the original value and source context. ISIN, FIGI, LEI, ticker, RIC, CUSIP, SEDOL, provider security ID, and account-native contract ID are not interchangeable. A resolver should return candidate matches, evidence, and confidence; it should not silently merge two instruments because names or tickers look similar.

Fund NAV identity must include the share class and NAV date, not just a fund name. ETFs and ETC-like products should be treated as listed instruments unless a source explicitly supplies a NAV or indicative value. Cash, deposits, and pension contracts should not be forced into a security identity when the source only supplies an account balance or contract value.

### Adapter boundary

Inference: application code should depend on these provider-neutral ports:

| Port | Responsibility | Provider-specific concerns kept behind it |
| --- | --- | --- |
| `AccountDataAdapter` | Consent or connection state, accounts, balances, transactions, positions, statements, refresh, revoke, cursors, idempotency, and errors | Tink, Powens, GoCardless, TrueLayer scopes, tokens, pagination, institution IDs, and re-auth rules |
| `MarketDataAdapter` | Instrument search and resolution, reference data, quotes, historical prices, NAVs, FX, corporate actions, capability, and entitlement | Vendor symbols, exchange feeds, plan limits, rate limits, revisions, adjustment flags, and license restrictions |
| `IdentityResolver` | Identifier normalization, candidate resolution, confidence, and ambiguous-match review | FIGI, ISIN, LEI, vendor symbology, and mapping restrictions |
| `ImportAdapter` | Manual, CSV, and statement parsing into canonical records with row or document provenance | Broker columns, localized dates and decimal formats, PDF extraction, duplicate detection, and user correction |
| `ProviderMetadata` | Regions, institutions, asset classes, freshness, revision semantics, quotas, retention, status, and license mode | Capability manifests, contract entitlements, source health, and exit or deletion behavior |

The normalized domain owns financial semantics and reconciliation. A provider adapter must not leak a vendor's account, position, quote, or fund class into UI or storage as the canonical model. Raw source evidence should be retained separately, encrypted where it contains personal data, and linked by a provenance record rather than copied into public reference fixtures.

## Phased v1 without live integrations

| Phase | Scope | Evidence of completion |
| --- | --- | --- |
| 1. Canonical contract | Define issuer, instrument, listing, fund share class, account, position, transaction, valuation, FX rate, and corporate action. Add source, observed-at, as-of, freshness, confidence, and verification status. | Manual creation supports stocks, ETFs, funds, cash, deposits, pensions, and generic account balances without credentials or live calls. |
| 2. Manual and file import | Add CSV and sanitized statement import with deterministic templates, raw-file hash, row provenance, review of ambiguous identities, and duplicate or correction handling. | A redacted fixture can be imported twice without duplicating transactions, and unresolved identifiers remain visible for review. |
| 3. Offline reference fixtures | Add small, fixed, redacted fixtures for generic instrument identity, ECB FX, filing-derived facts, corporate actions, fund NAV dates, and missing-data cases. Store check date and source URL with each fixture. | Tests never depend on a live endpoint, personal credential, or copied personal or source payload. |
| 4. Fake adapter contracts | Simulate cursor pagination, consent expiry, `429`, outage, stale values, revised NAVs, missing identifiers, duplicate transactions, unsupported account types, and corporate-action corrections. | Contract tests protect each credible failure mode and assert that stale or ambiguous data is not presented as confirmed. |
| 5. Commercial and coverage gate | Obtain written terms and a sandbox or controlled test for exact Spain/EU institutions, brokerages, pension managers, target funds, and desired markets. Decide display, non-display, redistribution, retention, DPA, refresh, SLA, and exit terms. | A signed entitlement matrix names the provider, institution or venue, asset class, fields, freshness, retention, rate limits, and permitted use. |
| 6. First live pilot | Only after the gate, activate one account connector and one market or fund source behind server-side credentials, feature flags, source health, stale-data handling, audit logs, and a kill switch. | A reversible pilot demonstrates consent, refresh, reconciliation, deletion, outage handling, and license-compliant display. |

Inference: phases 1 to 4 are the actual v1 path. Phase 6 is a later, conditional activation and should not be treated as a v1 dependency.

## Operational requirements

The adapter contract should expose more than a successful response. It should carry:

- freshness: `observed_at`, `as_of`, source timezone, and a stale threshold;
- revisions: source version, cursor or filing accession, superseded value, and correction reason;
- provenance: provider, endpoint or document type, capability, and license mode;
- limits: request budget, `429` retry information, consent expiry, pagination cursor, and backoff;
- failure state: provider outage, institution unavailable, authentication failure, unsupported asset, malformed source data, and partial response;
- retention: deletion deadline, raw-payload policy, token lifetime, and user revocation result;
- reconciliation: source transaction ID, source position ID, duplicate key, and correction workflow.

Confirmed: SEC documents changing rate limits and `User-Agent` requirements; OpenFIGI documents rate-limit responses; Tink documents `429` handling and request IDs; GoCardless and TrueLayer document consent and access-lifecycle constraints; ECB documents revision-aware queries; and Powens documents connector-dependent missing or shallow investment history. Sources: [SEC API toolkit](https://api.edgarfiling.sec.gov/docs/index.html), [OpenFIGI API](https://www.openfigi.com/api/documentation), [Tink API](https://docs.tink.com/api), [GoCardless quick start](https://developer.gocardless.com/bank-account-data/quick-start-guide/), [TrueLayer reconfirmation](https://docs.truelayer.com/docs/ux-for-reconfirmation-of-consent), [ECB data API](https://data.ecb.europa.eu/help/api/data), and [Powens wealth guide](https://docs.powens.com/documentation/integration-guides/wealth).

Confirmed: market-data terms are not uniform. Alpha Vantage's [terms](https://www.alphavantage.co/terms_of_service/), Twelve Data's [commercial-use guidance](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage), and Massive's [market-data terms](https://massive.com/legal/market-data-terms-of-service) distinguish personal or internal use from commercial display or redistribution. Inference: the application must model license mode and entitlement as provider metadata, not as a hidden assumption in a quote table.

## Unresolved decisions

- Select no live source for v1, or select a first account pilot between Tink and Powens after exact Spanish institution testing.
- Decide whether cash and transactions need one PSD2 provider, and whether any target institution requires a second provider for resilience.
- Confirm whether the product needs user-visible real-time or delayed prices, EOD prices, NAV-only valuations, or only user-supplied valuations. This determines exchange licensing and display rights.
- Define the target fund universe: Spanish CNMV-registered funds, European UCITS, share classes without an immediately available ISIN, ETFs, ETCs, or all of them.
- Choose source precedence and revision policy when a broker value, a fund NAV, a market quote, and ECB FX disagree.
- Decide the canonical identifier and merge-review policy for instruments with multiple listings, class changes, stale identifiers, or incomplete source mappings.
- Confirm whether pension and deposit records are modeled as positions, balances, contracts, or separate asset types, including contributions, fees, maturity, and surrender or withdrawal rules.
- Agree account-consent, token, raw-payload retention, deletion, re-authentication, outage, and data-export requirements with the selected provider and DPA.
- Define CSV and statement templates for target Spanish banks, brokers, pension managers, and deposit providers, including tax lots and duplicate correction behavior.
- Confirm the required service level, refresh cadence, rate budget, source-health signal, backfill policy, and circuit-breaker behavior.
- Verify Spain/EU coverage institution by institution. A Spanish product page or country list does not prove coverage for a particular bank, broker, pension manager, or term-deposit issuer.

## Source-quality caveats

1. This research was checked on 2026-08-22. Vendor pricing, plan names, quotas, product pages, terms, supported institutions, and exchange entitlements are volatile. Re-check them at procurement and before every live integration.
2. Official vendor marketing claims are not contracts. Counts such as institutions, countries, platforms, instruments, or years of history require an entitlement matrix, a test universe, and an SLA or support commitment.
3. Public API documentation can omit private products, sales-led fields, institution-specific exceptions, and commercial restrictions. Absence from a public page is recorded here as unresolved, not as proof of absence.
4. PSD2 AIS, open finance, wealth aggregation, and direct-access connectors have different legal and technical bases. The checked Powens terms expressly describe non-PSD2 Direct Access methods; this increases the need for security, consent, data-provenance, and continuity review.
5. Fund and pension values are not interchangeable with market quotes. NAV dates, share classes, valuation currency, broker-reported values, fees, stale data, and revisions must remain explicit in the canonical model.
6. CNMV and DGSFP evidence in this document is official registry, publication, or statistical evidence. It is not evidence of a personal holdings API or a guaranteed live Spanish NAV feed.
7. No live integration, credential, source payload, personal identifier, real portfolio, or real account data was used or copied. The recommended v1 intentionally stops before that operational and legal commitment.
