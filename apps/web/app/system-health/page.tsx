import { getSystemHealth } from "@personal-finance/application";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { WayfinderWordmark } from "../components/wayfinder-wordmark";

export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  const health = await getSystemHealth();
  const isHealthy = health.status === "ok";

  return (
    <main className="boundary-page system-health-page">
      <div className="boundary-frame">
        <WayfinderWordmark />
        <Card className="system-health-card" data-health-source="application-service">
          <CardHeader>
            <p className="eyebrow">SYSTEM HEALTH / V1</p>
            <CardTitle>
              {isHealthy ? "The boundary is awake." : "The boundary needs attention."}
            </CardTitle>
            <CardDescription>
              A small non-financial check that follows the rendered web path through the shared
              application service and its server-only data boundary.
            </CardDescription>
          </CardHeader>
          <CardContent className="system-health-content">
            <div
              aria-live="polite"
              className="health-signal"
              data-health-status={health.status}
              role="status"
            >
              <span aria-hidden="true" className="health-signal-dot" />
              <span>{isHealthy ? "Ready for the next request" : "Check the server boundary"}</span>
            </div>

            <div aria-hidden="true" className="health-path">
              <span className="health-path-node" />
              <span className="health-path-line" />
              <span className="health-path-node health-path-node--end" />
            </div>

            <dl className="health-facts">
              <div>
                <dt>Database</dt>
                <dd data-health-database={health.data.database}>{health.data.database}</dd>
              </div>
              <div>
                <dt>Migrations</dt>
                <dd data-health-migrations={health.data.migrations}>{health.data.migrations}</dd>
              </div>
              <div>
                <dt>Connection</dt>
                <dd data-health-provider={health.data.provider}>{health.data.provider}</dd>
              </div>
            </dl>

            <p className="health-source">
              Rendered from the shared service. This page does not call its own HTTP route.
            </p>
            <a className="text-link" href="/">
              Return to the clear line <span aria-hidden="true">↗</span>
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
