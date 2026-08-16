"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ExpensePie, TrendChart } from "@/components/Charts";
import { Panel, StatCard } from "@/components/ui";
import { formatPHP, formatPercent } from "@/lib/utils";
import {
  ChartPoint,
  DashboardKpis,
  ExpenseBreakdown,
} from "@/types";

interface DashboardPayload {
  kpis: DashboardKpis;
  trend: ChartPoint[];
  expenseBreakdown: ExpenseBreakdown[];
  lowStock: Array<{
    _id: string;
    name: string;
    sku: string;
    quantity: number;
    reorderLevel: number;
  }>;
  alerts: Array<{
    _id: string;
    title: string;
    message: string;
    severity: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/kpis")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, []);

  const k = data?.kpis;

  return (
    <AppShell
      title="Dashboard"
      subtitle="Real-time financial health, inventory, and capital position"
    >
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          {error}. Open Login and click &quot;Load demo data&quot; if MongoDB is
          empty.
        </div>
      ) : null}

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue MTD"
          value={formatPHP(k?.revenueMtd || 0)}
          hint={`YTD ${formatPHP(k?.revenueYtd || 0)}`}
          tone="good"
        />
        <StatCard
          label="Net Profit MTD"
          value={formatPHP(k?.netProfitMtd || 0)}
          hint={`Net margin ${formatPercent(k?.netMargin || 0)}`}
          tone={(k?.netProfitMtd || 0) >= 0 ? "good" : "bad"}
        />
        <StatCard
          label="Gross Margin"
          value={formatPercent(k?.grossMargin || 0)}
          hint={`Expense ratio ${formatPercent(k?.expenseRatio || 0)}`}
        />
        <StatCard
          label="Cash Position"
          value={formatPHP(k?.cashPosition || 0)}
          hint={`Working capital ${formatPHP(k?.workingCapital || 0)}`}
          tone={(k?.cashPosition || 0) >= 0 ? "default" : "bad"}
        />
        <StatCard
          label="Inventory Value"
          value={formatPHP(k?.inventoryValue || 0)}
          hint={`${k?.inventoryCount || 0} active SKUs`}
        />
        <StatCard
          label="Low Stock Alerts"
          value={String(k?.lowStockCount || 0)}
          hint="Reorder threshold breached"
          tone={(k?.lowStockCount || 0) > 0 ? "warn" : "good"}
        />
        <StatCard
          label="Inventory Turnover"
          value={(k?.inventoryTurnover || 0).toFixed(2)}
          hint="COGS / inventory value (MTD)"
        />
        <StatCard
          label="ROI on Capital"
          value={formatPercent(k?.roiOnCapital || 0)}
          hint={`Capital deployed ${formatPHP(k?.totalCapital || 0)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Panel title="Revenue vs Expenses (6 months)">
            <TrendChart data={data?.trend || []} />
          </Panel>
        </div>
        <div className="xl:col-span-2">
          <Panel title="Expense Breakdown (MTD)">
            <ExpensePie data={data?.expenseBreakdown || []} />
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Low Stock"
          action={
            <Link href="/inventory" className="text-sm text-violet-800 hover:underline">
              Manage
            </Link>
          }
        >
          <div className="space-y-3">
            {(data?.lowStock || []).slice(0, 5).map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-violet-950">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.sku}</p>
                </div>
                <p className="text-sm font-semibold text-amber-800">
                  {item.quantity}/{item.reorderLevel}
                </p>
              </div>
            ))}
            {!data?.lowStock?.length ? (
              <p className="text-sm text-slate-500">All stock levels healthy.</p>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Recent Alerts"
          action={
            <Link href="/alerts" className="text-sm text-violet-800 hover:underline">
              View all
            </Link>
          }
        >
          <div className="space-y-3">
            {(data?.alerts || []).slice(0, 5).map((alert) => (
              <div
                key={alert._id}
                className="rounded-xl border border-violet-900/10 bg-violet-50/40 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-violet-950">{alert.title}</p>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
              </div>
            ))}
            {!data?.alerts?.length ? (
              <p className="text-sm text-slate-500">No alerts yet.</p>
            ) : null}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
