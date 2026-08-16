import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { WayfinderWordmark } from "../components/wayfinder-wordmark";

export const dynamic = "force-dynamic";

export default function WorkspaceBoundaryPage() {
  return (
    <main className="boundary-page">
      <div className="boundary-frame">
        <WayfinderWordmark />
        <Card className="boundary-card" data-auth-boundary="unauthenticated">
          <CardHeader>
            <p className="eyebrow">PRIVATE WORKSPACE</p>
            <CardTitle>Your workspace starts with an identity.</CardTitle>
            <CardDescription>
              No workspace data is available until sign-in is connected. This boundary keeps private
              information out of the public shell.
            </CardDescription>
          </CardHeader>
          <CardContent className="boundary-actions">
            <Button disabled type="button" variant="secondary">
              Sign-in provider pending
            </Button>
            <a className="text-link" href="/">
              Return to the clear line <span aria-hidden="true">↗</span>
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
