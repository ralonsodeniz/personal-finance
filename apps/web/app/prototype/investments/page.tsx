"use client";

import { useEffect, useState } from "react";

import { WayfinderWordmark } from "../../components/wayfinder-wordmark";

import styles from "./page.module.css";

type VariantKey = "A" | "B" | "C";
type SignalTone = "good" | "warn" | "quiet";

type Holding = {
  allocation: number;
  basis: string;
  gain: number;
  id: string;
  name: string;
  status: SignalTone;
  units: string;
  value: number;
};

type Account = {
  evidence: string;
  id: string;
  name: string;
  status: SignalTone;
  type: string;
  updated: string;
  value: number;
};

const holdings: Holding[] = [
  {
    allocation: 28,
    basis: "economic book cost available",
    gain: 6840,
    id: "global-equity",
    name: "Global equity index",
    status: "good",
    units: "1,482.16 units",
    value: 41260,
  },
  {
    allocation: 15,
    basis: "economic book cost available",
    gain: 2950,
    id: "small-cap",
    name: "Global small cap",
    status: "good",
    units: "618.40 units",
    value: 22840,
  },
  {
    allocation: 10,
    basis: "basis incomplete",
    gain: 1210,
    id: "emerging-markets",
    name: "Emerging markets",
    status: "warn",
    units: "410.02 units",
    value: 14890,
  },
  {
    allocation: 8,
    basis: "economic book cost available",
    gain: 430,
    id: "short-bonds",
    name: "Short-duration bonds",
    status: "good",
    units: "304.77 units",
    value: 12300,
  },
  {
    allocation: 5,
    basis: "snapshot value",
    gain: 260,
    id: "physical-metals",
    name: "Physical silver",
    status: "quiet",
    units: "31.00 oz",
    value: 5910,
  },
  {
    allocation: 5,
    basis: "snapshot value",
    gain: 80,
    id: "gold",
    name: "Physical gold",
    status: "quiet",
    units: "1.00 oz",
    value: 7620,
  },
];

const accounts: Account[] = [
  {
    evidence: "activities + holdings",
    id: "myinvestor",
    name: "MyInvestor investments",
    status: "good",
    type: "brokerage account",
    updated: "21 Aug 2026",
    value: 104820,
  },
  {
    evidence: "valuation snapshot",
    id: "pension",
    name: "Personal pension",
    status: "quiet",
    type: "pension plan",
    updated: "20 Aug 2026",
    value: 24540,
  },
  {
    evidence: "balance + activities",
    id: "cash",
    name: "Cash reserve",
    status: "good",
    type: "cash account",
    updated: "21 Aug 2026",
    value: 11640,
  },
  {
    evidence: "valuation snapshot",
    id: "deposit",
    name: "Term deposit",
    status: "warn",
    type: "term deposit",
    updated: "31 Jul 2026",
    value: 7094,
  },
];

const activities = [
  { date: "21 Aug", detail: "Global equity index", kind: "Buy", value: "€850.00" },
  { date: "18 Aug", detail: "Cash reserve", kind: "Transfer", value: "€1,200.00" },
  { date: "14 Aug", detail: "Global equity index", kind: "Dividend", value: "€42.60" },
  { date: "02 Aug", detail: "MyInvestor investments", kind: "Fee", value: "€3.20" },
];

const variantNames: Record<VariantKey, string> = {
  A: "Signal line",
  B: "Source ledger",
  C: "Attention queue",
};

const currency = new Intl.NumberFormat("en-IE", {
  currency: "EUR",
  maximumFractionDigits: 0,
  style: "currency",
});

const currencyWithCents = new Intl.NumberFormat("en-IE", {
  currency: "EUR",
  maximumFractionDigits: 2,
  style: "currency",
});

function formatCurrency(value: number, cents = false) {
  return (cents ? currencyWithCents : currency).format(value);
}

function formatGain(value: number) {
  return `${value >= 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

function Signal({ label, tone }: { label: string; tone: SignalTone }) {
  const toneClass = {
    good: styles.signalGood,
    quiet: styles.signalQuiet,
    warn: styles.signalWarn,
  }[tone];

  return (
    <span className={`${styles.signal} ${toneClass}`}>
      <span aria-hidden="true" className={styles.signalDot} />
      {label}
    </span>
  );
}

function PrototypeHeader() {
  return (
    <header className={styles.prototypeHeader}>
      <WayfinderWordmark />
      <div className={styles.prototypeHeaderMeta}>
        <span className={styles.prototypeKicker}>Investment tracker</span>
        <span className={styles.prototypeBadge}>Prototype</span>
      </div>
    </header>
  );
}

function TrendChart({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.chartFrame} ${compact ? styles.chartCompact : ""}`}>
      <svg
        aria-labelledby="trend-chart-title trend-chart-description"
        className={styles.trendChart}
        fill="none"
        role="img"
        viewBox="0 0 640 220"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title id="trend-chart-title">Portfolio value trend</title>
        <desc id="trend-chart-description">
          Portfolio value rises over twelve months with a small dip in May and a stronger rise in
          the last two months.
        </desc>
        <path
          d="M0 182C42 185 51 163 91 169S141 153 176 158s51-42 92-21 53 5 83 11 54-42 91-28 55-5 78-29 78-12 120-52"
          pathLength="1"
          stroke="var(--color-palette-sea-glass)"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          d="M0 182C42 185 51 163 91 169S141 153 176 158s51-42 92-21 53 5 83 11 54-42 91-28 55-5 78-29 78-12 120-52V220H0Z"
          fill="url(#trend-fill)"
          opacity="0.9"
        />
        <path d="M0 206H640" stroke="currentColor" strokeOpacity="0.12" />
        <path d="M0 142H640" stroke="currentColor" strokeDasharray="2 10" strokeOpacity="0.12" />
        <path d="M0 78H640" stroke="currentColor" strokeDasharray="2 10" strokeOpacity="0.12" />
        <circle cx="560" cy="60" fill="var(--color-palette-waypoint)" r="7" />
        <circle
          cx="560"
          cy="60"
          fill="none"
          r="14"
          stroke="var(--color-palette-waypoint)"
          strokeOpacity="0.35"
        />
        <defs>
          <linearGradient
            id="trend-fill"
            x1="320"
            x2="320"
            y1="0"
            y2="220"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--color-palette-sea-glass)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--color-palette-sea-glass)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className={styles.chartAxis} aria-hidden="true">
        <span>Aug 25</span>
        <span>Feb 26</span>
        <span>Aug 26</span>
      </div>
      <details className={styles.chartDetails}>
        <summary>View trend data</summary>
        <table>
          <caption>Illustrative portfolio value checkpoints</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Aug 2025</th>
              <td>€122,100</td>
            </tr>
            <tr>
              <th scope="row">Feb 2026</th>
              <td>€136,800</td>
            </tr>
            <tr>
              <th scope="row">Aug 2026</th>
              <td>€148,094</td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}

function AllocationBar() {
  const segments = [
    { color: "var(--color-palette-tide)", label: "Equities", value: 53 },
    { color: "var(--color-palette-sea-glass)", label: "Bonds", value: 20 },
    { color: "var(--color-palette-waypoint)", label: "Cash + deposits", value: 13 },
    { color: "var(--color-palette-basalt)", label: "Pension", value: 9 },
    { color: "var(--color-palette-fog)", label: "Metals", value: 5 },
  ];

  return (
    <div className={styles.allocationBlock}>
      <div
        className={styles.allocationBar}
        aria-label="Illustrative allocation by asset class"
        role="img"
      >
        {segments.map((segment) => (
          <span
            aria-hidden="true"
            key={segment.label}
            style={{ background: segment.color, flex: segment.value }}
          />
        ))}
      </div>
      <div className={styles.allocationLegend}>
        {segments.map((segment) => (
          <span key={segment.label}>
            <i aria-hidden="true" style={{ background: segment.color }} />
            {segment.label} <strong>{segment.value}%</strong>
          </span>
        ))}
      </div>
      <details className={styles.chartDetails}>
        <summary>View allocation data</summary>
        <table>
          <caption>Illustrative allocation by asset class</caption>
          <thead>
            <tr>
              <th scope="col">Asset class</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.label}>
                <th scope="row">{segment.label}</th>
                <td>{segment.value}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function HoldingRows({ onSelect }: { onSelect: (holding: Holding) => void }) {
  return (
    <div className={styles.holdingRows}>
      {holdings.map((holding) => (
        <button
          className={styles.holdingRow}
          id={`holding-${holding.id}`}
          key={holding.id}
          onClick={() => onSelect(holding)}
          type="button"
        >
          <span className={styles.holdingMark} aria-hidden="true">
            {holding.name.slice(0, 1)}
          </span>
          <span className={styles.holdingIdentity}>
            <strong>{holding.name}</strong>
            <small>{holding.units}</small>
          </span>
          <span className={styles.holdingNumbers}>
            <strong>{formatCurrency(holding.value)}</strong>
            <small>{formatGain(holding.gain)}</small>
          </span>
          <span aria-hidden="true" className={styles.rowArrow}>
            ↗
          </span>
        </button>
      ))}
    </div>
  );
}

function AccountRows({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.accountRows} ${compact ? styles.accountRowsCompact : ""}`}>
      {accounts.map((account) => (
        <a
          className={styles.accountRow}
          href={`#account-${account.id}`}
          id={`account-${account.id}`}
          key={account.id}
        >
          <span className={styles.accountIndex} aria-hidden="true">
            {String(accounts.indexOf(account) + 1).padStart(2, "0")}
          </span>
          <span className={styles.accountIdentity}>
            <strong>{account.name}</strong>
            <small>
              {account.type} · {account.evidence}
            </small>
          </span>
          <span className={styles.accountValue}>
            <strong>{formatCurrency(account.value)}</strong>
            <small>
              <Signal
                label={account.status === "warn" ? "stale" : account.updated}
                tone={account.status}
              />
            </small>
          </span>
          <span aria-hidden="true" className={styles.rowArrow}>
            ↗
          </span>
        </a>
      ))}
    </div>
  );
}

function ActivityRows() {
  return (
    <div className={styles.activityRows}>
      {activities.map((activity) => (
        <div className={styles.activityRow} key={`${activity.date}-${activity.detail}`}>
          <span className={styles.activityDate}>{activity.date}</span>
          <span className={styles.activityIdentity}>
            <strong>{activity.detail}</strong>
            <small>{activity.kind}</small>
          </span>
          <strong className={styles.activityValue}>{activity.value}</strong>
        </div>
      ))}
    </div>
  );
}

function VariantA({ onSelectHolding }: { onSelectHolding: (holding: Holding) => void }) {
  return (
    <main className={styles.variantMain} id="overview-a" aria-labelledby="variant-a-title">
      <section className={styles.aHero}>
        <div className={styles.aHeroHeader}>
          <div>
            <p className={styles.eyebrow}>ALL SOURCES / EUR</p>
            <h1 id="variant-a-title">A clear line through the noise.</h1>
          </div>
          <span className={styles.asOfLabel}>
            <i aria-hidden="true" />
            as of 21 Aug 2026
          </span>
        </div>
        <div className={styles.aTotalBlock}>
          <span className={styles.aTotal}>{formatCurrency(148094)}</span>
          <span className={styles.aTotalLabel}>total value</span>
        </div>
        <div className={styles.aHeroStats}>
          <span className={styles.positiveText}>+€2,144 this period</span>
          <span>+1.47%</span>
          <span>MWR · +24.11% since first entry</span>
        </div>
        <TrendChart />
        <div className={styles.aHealthStrip}>
          <Signal label="Mostly current" tone="good" />
          <span>1 valuation needs attention</span>
          <a href="#health">Review it ↗</a>
        </div>
      </section>

      <section className={styles.aContextGrid} aria-label="Portfolio context">
        <article className={styles.aContextCard} id="health" aria-labelledby="a-health-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>DATA HEALTH</p>
              <h2 id="a-health-title">What needs a look</h2>
            </div>
            <span className={styles.sectionMeta}>3 open signals</span>
          </div>
          <div className={styles.healthList}>
            <div>
              <Signal label="stale valuation" tone="warn" />
              <p>Term deposit last observed 31 Jul 2026.</p>
            </div>
            <div>
              <Signal label="basis incomplete" tone="warn" />
              <p>Emerging markets needs lot history.</p>
            </div>
            <div>
              <Signal label="import ready" tone="good" />
              <p>4 rows are ready for review.</p>
            </div>
          </div>
          <a className={styles.textAction} href="#account-deposit">
            Review open signals ↗
          </a>
        </article>

        <article className={styles.aContextCard} aria-labelledby="a-performance-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>PERFORMANCE / EXPLAINED</p>
              <h2 id="a-performance-title">No unlabeled return</h2>
            </div>
            <span className={styles.sectionMeta}>since Aug 2025</span>
          </div>
          <div className={styles.metricTable} role="table" aria-label="Performance metrics">
            <div role="row">
              <span role="cell">Money-weighted return</span>
              <strong role="cell">+24.11%</strong>
              <small role="cell">your timing included</small>
            </div>
            <div role="row">
              <span role="cell">Time-weighted return</span>
              <strong role="cell">+19.01%</strong>
              <small role="cell">comparison view</small>
            </div>
            <div role="row">
              <span role="cell">Recorded income</span>
              <strong role="cell">+€638</strong>
              <small role="cell">dividends + interest</small>
            </div>
            <div role="row">
              <span role="cell">Recorded costs</span>
              <strong role="cell">−€41</strong>
              <small role="cell">fees + commissions</small>
            </div>
          </div>
          <p className={styles.aMethodNote}>
            Every figure names its method, period, and cash-flow treatment.
          </p>
          <a className={styles.textAction} href="#a-allocation-title">
            View reporting scope ↗
          </a>
        </article>
      </section>

      <section className={styles.aSection} aria-labelledby="a-accounts-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>THE SOURCES</p>
            <h2 id="a-accounts-title">Where it sits</h2>
          </div>
          <a className={styles.textAction} href="#account-myinvestor">
            View accounts ↗
          </a>
        </div>
        <AccountRows compact />
      </section>

      <section className={styles.aSection} aria-labelledby="a-holdings-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>THE HOLDINGS</p>
            <h2 id="a-holdings-title">The weight of the work</h2>
          </div>
          <span className={styles.sectionMeta}>6 instruments</span>
        </div>
        <HoldingRows onSelect={onSelectHolding} />
      </section>

      <section className={styles.aSection} aria-labelledby="a-allocation-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>THE SHAPE</p>
            <h2 id="a-allocation-title">Allocation, at a glance</h2>
          </div>
          <span className={styles.sectionMeta}>target not set</span>
        </div>
        <AllocationBar />
      </section>

      <section className={styles.aFooterNote} aria-label="Prototype note">
        <span className={styles.routeGlyph} aria-hidden="true">
          ●···○
        </span>
        <p>One overview, multiple trails. Follow any number back to its evidence.</p>
      </section>
    </main>
  );
}

function VariantB({ onSelectHolding }: { onSelectHolding: (holding: Holding) => void }) {
  return (
    <main className={`${styles.variantMain} ${styles.bMain}`} aria-labelledby="variant-b-title">
      <section className={styles.bIntro}>
        <div className={styles.bIndex}>02 / SOURCE VIEW</div>
        <h1 id="variant-b-title">Follow the number back to its source.</h1>
        <p>
          Every value carries an account, an evidence mode, and an as-of date. Start with the source
          when trust matters more than speed.
        </p>
      </section>

      <section className={styles.bSourcePanel} aria-labelledby="b-source-title">
        <div className={styles.bPanelHeader}>
          <div>
            <p className={styles.sectionEyebrow}>FINANCIAL ACCOUNTS</p>
            <h2 id="b-source-title">Four sources in scope</h2>
          </div>
          <span className={styles.bScopeTotal}>{formatCurrency(148094)}</span>
        </div>
        <AccountRows />
      </section>

      <section className={styles.bEvidenceGrid} aria-label="Evidence detail">
        <article className={styles.bEvidencePanel} id="activity-review">
          <p className={styles.sectionEyebrow}>LATEST ACTIVITY</p>
          <h2>What changed</h2>
          <ActivityRows />
          <a className={styles.textAction} href="#activity-review">
            Open activity review ↗
          </a>
        </article>
        <article className={styles.bEvidencePanel} id="health">
          <p className={styles.sectionEyebrow}>DATA HEALTH</p>
          <h2>What needs a look</h2>
          <div className={styles.healthList} id="activity-review">
            <div>
              <Signal label="stale valuation" tone="warn" />
              <p>Term deposit last observed 31 Jul 2026.</p>
            </div>
            <div>
              <Signal label="basis incomplete" tone="warn" />
              <p>Emerging markets needs lot history.</p>
            </div>
            <div>
              <Signal label="import ready" tone="good" />
              <p>4 rows are ready for review.</p>
            </div>
          </div>
          <a className={styles.textAction} href="#health">
            Open health center ↗
          </a>
        </article>
      </section>

      <section className={styles.bHoldingsPanel} aria-labelledby="b-holdings-title">
        <div className={styles.bPanelHeader}>
          <div>
            <p className={styles.sectionEyebrow}>SELECTED ACCOUNT / MYINVESTOR</p>
            <h2 id="b-holdings-title">Holdings with a trail</h2>
          </div>
          <span className={styles.sectionMeta}>activities + holdings</span>
        </div>
        <HoldingRows onSelect={onSelectHolding} />
      </section>
    </main>
  );
}

function VariantC({ onSelectHolding }: { onSelectHolding: (holding: Holding) => void }) {
  return (
    <main className={`${styles.variantMain} ${styles.cMain}`} aria-labelledby="variant-c-title">
      <section className={styles.cIntro}>
        <p className={styles.sectionEyebrow}>DATA HEALTH / ACTION VIEW</p>
        <h1 id="variant-c-title">Before the return, check the signal.</h1>
        <p>Three small issues are keeping the picture from being fully current.</p>
      </section>

      <section className={styles.attentionStack} aria-labelledby="c-attention-title" id="health">
        <div className={styles.cSectionHeader}>
          <h2 id="c-attention-title">Needs your attention</h2>
          <span className={styles.sectionMeta}>3 open signals</span>
        </div>
        <article className={`${styles.attentionItem} ${styles.attentionWarning}`}>
          <span className={styles.attentionNumber}>01</span>
          <div>
            <Signal label="stale valuation" tone="warn" />
            <h3>Term deposit has not moved since July.</h3>
            <p>Use a current statement or mark the value as intentionally unchanged.</p>
          </div>
          <a href="#account-deposit" className={styles.attentionAction}>
            Review ↗
          </a>
        </article>
        <article className={`${styles.attentionItem} ${styles.attentionReview}`}>
          <span className={styles.attentionNumber}>02</span>
          <div>
            <Signal label="basis incomplete" tone="warn" />
            <h3>One holding cannot explain its gain yet.</h3>
            <p>Its current value is usable. Its tax basis is not confirmed.</p>
          </div>
          <a href="#holding-emerging-markets" className={styles.attentionAction}>
            Inspect ↗
          </a>
        </article>
        <article className={`${styles.attentionItem} ${styles.attentionGood}`} id="activity-review">
          <span className={styles.attentionNumber}>03</span>
          <div>
            <Signal label="import ready" tone="good" />
            <h3>Four new activity rows are waiting.</h3>
            <p>Review the mapping before adding them to the ledger.</p>
          </div>
          <a href="#activity-review" className={styles.attentionAction}>
            Review ↗
          </a>
        </article>
      </section>

      <section className={styles.cSummary} aria-labelledby="c-summary-title">
        <div className={styles.cSummaryTotal}>
          <p className={styles.sectionEyebrow}>ALL SOURCES / EUR</p>
          <h2 id="c-summary-title">{formatCurrency(148094)}</h2>
          <p>
            <span className={styles.positiveText}>+€2,144</span> this period · +1.47%
          </p>
          <span className={styles.asOfLabel}>
            <i aria-hidden="true" />
            as of 21 Aug 2026
          </span>
        </div>
        <TrendChart compact />
      </section>

      <section className={styles.cPerformance} aria-labelledby="c-performance-title">
        <div className={styles.cSectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>PERFORMANCE / EXPLAINED</p>
            <h2 id="c-performance-title">No unlabeled return</h2>
          </div>
          <span className={styles.sectionMeta}>since Aug 2025</span>
        </div>
        <div className={styles.metricTable} role="table" aria-label="Performance metrics">
          <div role="row">
            <span role="cell">Money-weighted return</span>
            <strong role="cell">+24.11%</strong>
            <small role="cell">your timing included</small>
          </div>
          <div role="row">
            <span role="cell">Time-weighted return</span>
            <strong role="cell">+19.01%</strong>
            <small role="cell">comparison view</small>
          </div>
          <div role="row">
            <span role="cell">Recorded income</span>
            <strong role="cell">+€638</strong>
            <small role="cell">dividends + interest</small>
          </div>
          <div role="row">
            <span role="cell">Recorded costs</span>
            <strong role="cell">−€41</strong>
            <small role="cell">fees + commissions</small>
          </div>
        </div>
      </section>

      <section className={styles.cHoldings} aria-labelledby="c-holdings-title">
        <div className={styles.cSectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>TOP HOLDINGS</p>
            <h2 id="c-holdings-title">What is doing the work</h2>
          </div>
        </div>
        <HoldingRows onSelect={onSelectHolding} />
      </section>
    </main>
  );
}

function HoldingSheet({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  return (
    <div className={styles.sheetLayer}>
      <section
        aria-labelledby="holding-sheet-title"
        aria-modal="true"
        className={styles.holdingSheet}
        role="dialog"
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <div>
            <p className={styles.sectionEyebrow}>HOLDING DETAIL / SAMPLE FIXTURE</p>
            <h2 id="holding-sheet-title">{holding.name}</h2>
          </div>
          <button
            aria-label="Close holding detail"
            className={styles.sheetClose}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className={styles.sheetValueRow}>
          <strong>{formatCurrency(holding.value)}</strong>
          <span className={styles.positiveText}>{formatGain(holding.gain)}</span>
        </div>
        <dl className={styles.sheetFacts}>
          <div>
            <dt>Position</dt>
            <dd>{holding.units}</dd>
          </div>
          <div>
            <dt>Allocation</dt>
            <dd>{holding.allocation}%</dd>
          </div>
          <div>
            <dt>Basis state</dt>
            <dd>{holding.basis}</dd>
          </div>
          <div>
            <dt>Price state</dt>
            <dd>
              <Signal
                label={holding.status === "good" ? "confirmed" : "review"}
                tone={holding.status}
              />
            </dd>
          </div>
        </dl>
        <p className={styles.sheetNote}>
          Prototype question: can a person understand the value, the evidence, and the next action
          in one quiet surface?
        </p>
      </section>
    </div>
  );
}

function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: VariantKey;
  onChange: (variant: VariantKey) => void;
}) {
  const keys: VariantKey[] = ["A", "B", "C"];
  const currentIndex = keys.indexOf(current);
  const cycle = (direction: number) => {
    const nextIndex = (currentIndex + direction + keys.length) % keys.length;
    onChange(keys[nextIndex] ?? current);
  };

  return (
    <nav aria-label="Prototype variants" className={styles.prototypeSwitcher}>
      <button aria-label="Previous prototype variant" onClick={() => cycle(-1)} type="button">
        ←
      </button>
      <span aria-live="polite">
        <strong>{current}</strong> · {variantNames[current]}
      </span>
      <button aria-label="Next prototype variant" onClick={() => cycle(1)} type="button">
        →
      </button>
    </nav>
  );
}

export default function InvestmentsPrototypePage() {
  const [variant, setVariant] = useState<VariantKey>("A");
  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

  useEffect(() => {
    const initialVariant = new URLSearchParams(window.location.search)
      .get("variant")
      ?.toUpperCase();
    if (initialVariant === "A" || initialVariant === "B" || initialVariant === "C") {
      setVariant(initialVariant);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get("variant") !== variant) {
      url.searchParams.set("variant", variant);
      window.history.replaceState({}, "", url);
    }
  }, [isHydrated, variant]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const keys: VariantKey[] = ["A", "B", "C"];
        const currentIndex = keys.indexOf(variant);
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const nextIndex = (currentIndex + direction + keys.length) % keys.length;
        const nextVariant = keys[nextIndex] ?? variant;
        setVariant(nextVariant);
        return;
      }

      if (event.key === "Escape") {
        setSelectedHolding(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [variant]);

  function changeVariant(nextVariant: VariantKey) {
    setVariant(nextVariant);
  }

  if (process.env.NODE_ENV === "production") {
    return (
      <main className={styles.prototypeDisabled}>
        <WayfinderWordmark />
        <p>This prototype is available in development builds only.</p>
      </main>
    );
  }

  return (
    <div className={`${styles.prototype} ${styles[`variant${variant}`]}`}>
      <PrototypeHeader />
      <div className={styles.prototypeNotice}>
        <span>Prototype / sample fixture</span>
        <span>
          Read-only · no private data · <a href="?variant=A">share variant A</a>
        </span>
      </div>
      {variant === "A" ? (
        <VariantA onSelectHolding={setSelectedHolding} />
      ) : variant === "B" ? (
        <VariantB onSelectHolding={setSelectedHolding} />
      ) : (
        <VariantC onSelectHolding={setSelectedHolding} />
      )}
      {selectedHolding ? (
        <HoldingSheet holding={selectedHolding} onClose={() => setSelectedHolding(null)} />
      ) : null}
      <PrototypeSwitcher current={variant} onChange={changeVariant} />
    </div>
  );
}
