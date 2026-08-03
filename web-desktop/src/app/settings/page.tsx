import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Account, synchronization, currency, timezone, and data-management preferences.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Account, offline-replica toggle, currency/timezone, backup &amp; restore land here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
