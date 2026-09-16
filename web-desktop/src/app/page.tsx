import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendingChart } from "@/components/spending-chart";
import { StatCard } from "@/components/stat-card";
import { formatMoney } from "@/lib/money";

// Placeholder data. The real dashboard reads through the shared DataSource /
// backend API once the typed api-client lands. Money is always integer minor
// units (see src/lib/money.ts).
const CURRENCY = "PHP";
const summary = {
  totalSpent: { amountMinor: 482300, currency: CURRENCY },
  tripCount: 23,
  items: 187,
  savings: { amountMinor: 12640, currency: CURRENCY },
};

const series = [
  { day: "Mon", amountMinor: 980 },
  { day: "Tue", amountMinor: 1340 },
  { day: "Wed", amountMinor: 760 },
  { day: "Thu", amountMinor: 2100 },
  { day: "Fri", amountMinor: 1820 },
  { day: "Sat", amountMinor: 3050 },
  { day: "Sun", amountMinor: 1240 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Spending Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Overview of your grocery spending, trips, and detected savings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total spent"
          value={formatMoney(summary.totalSpent)}
          hint="Last 30 days"
        />
        <StatCard label="Shopping trips" value={String(summary.tripCount)} hint="Last 30 days" />
        <StatCard label="Items purchased" value={String(summary.items)} hint="Last 30 days" />
        <StatCard
          label="Savings detected"
          value={formatMoney(summary.savings)}
          hint="From receipt checks"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spending over time</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendingChart data={series} currency={CURRENCY} />
        </CardContent>
      </Card>
    </div>
  );
}
