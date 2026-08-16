import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { WayfinderWordmark } from "../components/wayfinder-wordmark";

export default function OfflinePage() {
  return (
    <main className="boundary-page">
      <div className="boundary-frame">
        <WayfinderWordmark />
        <Card className="boundary-card">
          <CardHeader>
            <p className="eyebrow">Offline / northline</p>
            <CardTitle>The clear line is waiting.</CardTitle>
            <CardDescription>
              Reconnect to load current financial data. This page contains no saved balances or
              transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="boundary-note">
              Wayfinder keeps private information out of offline fallbacks.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
