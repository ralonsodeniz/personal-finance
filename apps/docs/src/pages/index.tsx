import Link from "@docusaurus/Link";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import type { ReactElement } from "react";

function ArrowUpRight(): ReactElement {
  return (
    <svg aria-hidden="true" className="docs-home__arrow" fill="none" viewBox="0 0 16 16">
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

export default function Home(): ReactElement {
  return (
    <Layout title="Documentation" description="Wayfinder architecture and user-help documentation">
      <main className="docs-home">
        <section className="docs-home__masthead" aria-labelledby="docs-home-title">
          <div className="container">
            <div className="docs-home__header">
              <span className="docs-home__utility">WAYFINDER / FIELD GUIDE</span>
              <span className="docs-home__utility docs-home__utility--muted">
                STATIC EDITION · FOUNDATION
              </span>
            </div>

            <div className="docs-home__hero">
              <div className="docs-home__route-marker" aria-hidden="true">
                <span className="docs-home__route-label">orientation</span>
                <span className="docs-home__route-line" />
                <span className="docs-home__route-dot docs-home__route-dot--start" />
                <span className="docs-home__route-dot docs-home__route-dot--mid" />
                <span className="docs-home__route-dot docs-home__route-dot--end" />
                <span className="docs-home__route-label docs-home__route-label--end">next</span>
              </div>

              <div className="docs-home__hero-copy">
                <p className="docs-home__eyebrow">Architecture, with the edges left visible.</p>
                <Heading as="h1" id="docs-home-title">
                  Keep the <em>way</em> visible.
                </Heading>
                <p className="docs-home__lede">
                  A working guide to the boundaries Wayfinder has chosen—and the finance and mobile
                  decisions it is deliberately leaving for later.
                </p>
              </div>

              <aside className="docs-home__edition" aria-label="Documentation edition">
                <span className="docs-home__utility">CURRENT EDITION</span>
                <strong>Foundation</strong>
                <p>Read the boundary first. Build inside it second.</p>
              </aside>
            </div>
          </div>
        </section>

        <section className="container docs-home__spaces" aria-labelledby="docs-home-spaces-title">
          <div className="docs-home__section-intro">
            <p className="docs-home__eyebrow">Two entrances, one map</p>
            <Heading as="h2" id="docs-home-spaces-title">
              Choose the surface that matches your work.
            </Heading>
            <p>
              Developer guidance names ownership and seams. User help will name tasks and outcomes
              when there are product workflows to explain.
            </p>
          </div>

          <div className="docs-home__space-grid">
            <article className="docs-home__space docs-home__space--developer">
              <div className="docs-home__space-topline">
                <span className="docs-home__utility">FOR CONTRIBUTORS</span>
                <span className="docs-home__space-mark" aria-hidden="true">
                  ↗
                </span>
              </div>
              <Heading as="h3">Developer guide</Heading>
              <p>
                Workspace boundaries, future Expo/mobile relationships, native authentication,
                testing candidates, and the work that remains intentionally deferred.
              </p>
              <Link className="docs-home__button docs-home__button--primary" to="/developers/intro">
                Read the developer guide <ArrowUpRight />
              </Link>
            </article>

            <article className="docs-home__space docs-home__space--help">
              <div className="docs-home__space-topline">
                <span className="docs-home__utility">FOR PEOPLE USING THE PRODUCT</span>
                <span className="docs-home__space-mark" aria-hidden="true">
                  ↗
                </span>
              </div>
              <Heading as="h3">User help</Heading>
              <p>
                A task-oriented home for future product guidance, kept separate from implementation
                vocabulary while the product takes shape.
              </p>
              <Link className="docs-home__button docs-home__button--quiet" to="/help/start-here">
                Open user help <ArrowUpRight />
              </Link>
            </article>
          </div>
        </section>

        <aside className="container docs-home__boundary-note" aria-label="Documentation boundary">
          <span className="docs-home__utility">BOUNDARY NOTE</span>
          <p>
            This site is static and credential-free. It contains no live User data, authenticated
            Identity session, or Financial Account data.
          </p>
        </aside>
      </main>
    </Layout>
  );
}
