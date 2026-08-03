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
  { day: "Mon", amount: 980 },
  { day: "Tue", amount: 1340 },
  { day: "Wed", amount: 760 },
  { day: "Thu", amount: 2100 },
  { day: "Fri", amount: 1820 },
  { day: "Sat", amount: 3050 },
  { day: "Sun", amount: 1240 },
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
