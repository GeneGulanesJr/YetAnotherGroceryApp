import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Reports &amp; Export</h2>
          <p className="text-sm text-muted-foreground">
            Spending history, price history, savings, and raw-data exports.
          </p>
        </div>
        <Button variant="outline">Export CSV</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Available reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Spending history, product price history, store comparisons, savings, and grocery inflation.</p>
          <p>CSV, Excel, and PDF export options arrive in a later phase.</p>
        </CardContent>
      </Card>
    </div>
  );
}
