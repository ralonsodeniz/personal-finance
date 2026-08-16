import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "../components/ui/card";
import { WayfinderWordmark } from "../components/wayfinder-wordmark";
import { isProviderDoubleEnabled } from "../lib/auth-double";
import { getWebAuthState } from "../lib/auth-server";

export const dynamic = "force-dynamic";

export default async function WorkspaceBoundaryPage() {
  const { authorization, configuration } = await getWebAuthState();
  const isAuthenticated = authorization.allowed;
  const isProviderDoubleAvailable =
    isProviderDoubleEnabled() &&
    configuration.status === "configured" &&
    configuration.provider === "double";

  return (
    <main
      className="boundary-page workspace-boundary"
      data-auth-boundary={isAuthenticated ? "authenticated" : "unauthenticated"}
      data-auth-configuration={configuration.status}
    >
      <div className="boundary-frame workspace-boundary-frame">
        <WayfinderWordmark />
        <Card className="workspace-gate" data-protected-content="withheld">
          <div aria-hidden="true" className="workspace-gate-rail">
            <span>IDENTITY GATE</span>
            <span className="workspace-gate-rail-mark">◌</span>
          </div>
          <div className="workspace-gate-body">
            <div className="workspace-gate-header">
              <p className="eyebrow">
                PRIVATE WORKSPACE / {isAuthenticated ? "IDENTITY RECOGNIZED" : "FIRST GATE"}
              </p>
              <Badge>
                {isAuthenticated
                  ? "authenticated"
                  : configuration.status === "unavailable"
                    ? "provider unavailable"
                    : "awaiting identity"}
              </Badge>
            </div>
            <CardHeader className="workspace-gate-heading">
              <h1 className="card-title">
                {isAuthenticated
                  ? "The private line is open."
                  : "Your workspace starts with an identity."}
              </h1>
              <CardDescription>
                {isAuthenticated
                  ? "Wayfinder recognizes the internal identity behind this session. Financial content stays withheld until the workspace boundary is built."
                  : configuration.status === "unavailable"
                    ? "This route is intentionally empty until the server has a valid identity and session configuration. No private information is loaded."
                    : "No workspace data is available yet. Establish an identity to cross the first gate; the protected surface remains empty while the product foundation is assembled."}
              </CardDescription>
            </CardHeader>

            <div
              aria-label="Provider to protected data boundary"
              className="identity-ledger"
              role="img"
            >
              <div className="identity-ledger-node" data-auth-node="provider">
                <span className="utility-label">Provider</span>
                <strong>
                  {configuration.status === "configured" ? configuration.provider : "not ready"}
                </strong>
                <small>verifies the person</small>
              </div>
              <span aria-hidden="true" className="identity-ledger-arrow">
                →
              </span>
              <div className="identity-ledger-node" data-auth-node="identity">
                <span className="utility-label">Identity</span>
                <strong>{isAuthenticated ? "recognized" : "unresolved"}</strong>
                <small>belongs to the application</small>
              </div>
              <span aria-hidden="true" className="identity-ledger-arrow">
                →
              </span>
              <div
                className="identity-ledger-node identity-ledger-node--withheld"
                data-auth-node="data"
              >
                <span className="utility-label">Data</span>
                <strong>withheld</strong>
                <small>no balances or entries</small>
              </div>
            </div>

            <CardContent className="boundary-actions workspace-gate-actions">
              {isAuthenticated ? (
                <a className="button button-primary" href="/auth/logout">
                  Sign out
                </a>
              ) : isProviderDoubleAvailable ? (
                <a className="button button-primary" href="/auth/provider-double">
                  Use provider double
                </a>
              ) : (
                <Button disabled type="button" variant="secondary">
                  Sign-in provider unavailable
                </Button>
              )}
              <a className="text-link" href="/">
                Return to the clear line <span aria-hidden="true">↗</span>
              </a>
            </CardContent>
            <p className="workspace-gate-note" role="status">
              {isAuthenticated
                ? "Authenticated at the web session seam · protected content withheld"
                : "Unauthenticated at the web session seam · protected content withheld"}
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
