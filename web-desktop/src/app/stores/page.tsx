import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Store Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Visits, average basket, unit prices, and cheapest-store comparisons.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stores</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Store comparison tables and receipt-discrepancy history land here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
