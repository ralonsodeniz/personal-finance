import { Badge } from "./components/ui/badge";
import { buttonVariants } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { WayfinderWordmark } from "./components/wayfinder-wordmark";

function ArrowUpRight() {
  return (
    <svg
      aria-hidden="true"
      className="arrow-icon"
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 12.5 12 4M5 4h7v7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="page-shell">
      <header className="site-header">
        <WayfinderWordmark />
        <div className="header-actions">
          <span className="availability" role="status">
            <span aria-hidden="true" className="availability-dot" />
            web shell / ready
          </span>
          <a className={buttonVariants({ size: "sm", variant: "ghost" })} href="/workspace">
            Sign in
          </a>
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-title" className="hero-grid">
          <aside className="identity-rail" aria-label="Wayfinder shell note">
            <div className="rail-rule" />
            <p className="rail-kicker">FIELD NOTE / 001</p>
            <p className="rail-copy">A quieter instrument for the decisions that matter.</p>
            <p className="rail-footer">
              PERSONAL + HOUSEHOLD
              <br />
              WEB / PWA PATH
            </p>
          </aside>

          <div className="hero-copy">
            <p className="eyebrow">PERSONAL MONEY · A CLEARER COURSE</p>
            <h1 id="hero-title">
              Find the <em>thread</em> in your money.
            </h1>
            <p className="hero-description">
              Wayfinder gives personal and household decisions a calm place to land — private by
              default, ready when you are.
            </p>
            <div className="hero-actions">
              <a className={buttonVariants()} href="/workspace">
                Enter the workspace
                <ArrowUpRight />
              </a>
              <span className="action-note">no financial data in this shell</span>
            </div>
          </div>

          <Card className="route-card">
            <CardHeader className="route-card-header">
              <div>
                <p className="eyebrow">THE NORTHLINE</p>
                <CardTitle>Start with what you can see.</CardTitle>
              </div>
              <Badge>shell</Badge>
            </CardHeader>
            <CardContent>
              <div
                className="route-map"
                aria-label="A route from noise to a clear next step"
                role="img"
              >
                <div className="route-map-label route-map-label-start">noise</div>
                <div className="route-map-label route-map-label-end">next step</div>
                <svg
                  aria-hidden="true"
                  className="route-line"
                  fill="none"
                  viewBox="0 0 460 180"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M25 142C85 142 83 54 153 54s66 82 133 82c65 0 67-70 149-70"
                    stroke="var(--color-palette-sea-glass)"
                    strokeDasharray="1 11"
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                  <path
                    d="M25 142C85 142 83 54 153 54s66 82 133 82c65 0 67-70 149-70"
                    stroke="var(--color-palette-tide)"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                  <circle
                    cx="25"
                    cy="142"
                    fill="var(--color-palette-salt)"
                    r="8"
                    stroke="var(--color-palette-tide)"
                    strokeWidth="2"
                  />
                  <circle
                    className="waypoint-pulse"
                    cx="305"
                    cy="136"
                    fill="var(--color-palette-waypoint)"
                    r="9"
                  />
                  <circle
                    cx="435"
                    cy="66"
                    fill="var(--color-palette-paper)"
                    r="8"
                    stroke="var(--color-palette-tide)"
                    strokeWidth="2"
                  />
                </svg>
                <span className="route-waypoint" aria-hidden="true">
                  clear line
                </span>
              </div>
              <div className="route-caption">
                <p>One surface. No sample balances. No noise added for effect.</p>
                <span className="utility-label">BOUNDARY / PUBLIC SHELL</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label="Shell boundaries" className="boundary-strip">
          <div className="boundary-intro">
            <span className="utility-label">THE FIRST MILE</span>
            <p>The foundation is deliberately small.</p>
          </div>
          <div className="boundary-item">
            <span className="boundary-marker" aria-hidden="true">
              ↘
            </span>
            <div>
              <h2>Private</h2>
              <p>Unauthenticated screens carry no workspace data.</p>
            </div>
          </div>
          <div className="boundary-item">
            <span className="boundary-marker" aria-hidden="true">
              ↘
            </span>
            <div>
              <h2>Portable</h2>
              <p>Shared tokens keep the visual language platform-neutral.</p>
            </div>
          </div>
          <div className="boundary-item">
            <span className="boundary-marker" aria-hidden="true">
              ↘
            </span>
            <div>
              <h2>Installable</h2>
              <p>The production path includes a manifest and service worker.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>Wayfinder / web shell</span>
        <span>Built for a clearer next step</span>
      </footer>
    </div>
  );
}
