"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney, formatMoneyCompact } from "@/lib/money";

interface SpendingChartProps {
  // `amountMinor` is integer minor units (e.g. cents/centavos), matching the
  // shared money model in src/lib/money.ts. The chart must NOT treat these as
  // major units when formatting currency.
  data: { day: string; amountMinor: number }[];
  currency: string;
}

export function SpendingChart({ data, currency }: SpendingChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) =>
              formatMoneyCompact({ amountMinor: value, currency })
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              color: "hsl(var(--foreground))",
            }}
            formatter={(value: number) =>
              formatMoney({ amountMinor: value, currency })
            }
          />
          <Area
            type="monotone"
            dataKey="amountMinor"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#spendFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
