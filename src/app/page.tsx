"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Boxes,
  CircleDollarSign,
  FileSpreadsheet,
  Landmark,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Tags,
  Settings,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ExpensePie, TrendChart } from "@/components/Charts";
import { Panel, StatCard } from "@/components/ui";
import { can, formatPHP, formatPercent } from "@/lib/utils";
import { UserRole } from "@/types";
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

const shortcuts = [
  {
    href: "/pos",
    label: "Ring a sale",
    hint: "POS checkout",
    icon: ShoppingCart,
    permission: "usePos" as const,
  },
  {
    href: "/sales",
    label: "View sales",
    hint: "POS sales report",
    icon: TrendingUp,
  },
  {
    href: "/expenses",
    label: "Log expense",
    hint: "Costs and losses",
    icon: Receipt,
  },
  {
    href: "/inventory",
    label: "Update stock",
    hint: "SKU and quantity",
    icon: Boxes,
  },
  {
    href: "/categories",
    label: "Manage categories",
    hint: "POS and inventory groups",
    icon: Tags,
    permission: "editInventory" as const,
  },
  {
    href: "/prices",
    label: "Set prices",
    hint: "Cost and sell price",
    icon: CircleDollarSign,
    permission: "editInventory" as const,
  },
  {
    href: "/capital",
    label: "Capital entry",
    hint: "Invest or withdraw",
    icon: Landmark,
    permission: "manageCapital" as const,
  },
  {
    href: "/reports",
    label: "Build report",
    hint: "P&L and KPIs",
    icon: FileSpreadsheet,
    permission: "exportReports" as const,
  },
  {
    href: "/users",
    label: "Manage users",
    hint: "Roles and access",
    icon: Users,
    permission: "manageUsers" as const,
  },
  {
    href: "/settings",
    label: "Update profile",
    hint: "Name, email, password",
    icon: Settings,
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
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
  const visibleShortcuts = shortcuts.filter(
    (item) => !item.permission || can(role, item.permission)
  );

  return (
    <AppShell
      title="Dashboard"
      subtitle="Real-time financial health, inventory, and capital position"
    >
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          {error}. Check your connection and that the database is available.
        </div>
      ) : null}

      <Panel title="Quick actions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-violet-900/10 bg-white px-4 py-3 transition hover:border-violet-700/40 hover:bg-violet-50/70"
              >
                <span className="rounded-xl bg-violet-100 p-2 text-violet-800">
                  <Icon size={18} />
                </span>
                <span>
                  <p className="font-medium text-violet-950">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.hint}</p>
                </span>
              </Link>
            );
          })}
        </div>
      </Panel>

      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          href="/sales"
          label="Sales MTD"
          value={formatPHP(k?.revenueMtd || 0)}
          hint={`YTD ${formatPHP(k?.revenueYtd || 0)} · POS sales`}
          tone="good"
        />
        <StatCard
          href="/reports"
          label="Net Profit MTD"
          value={formatPHP(k?.netProfitMtd || 0)}
          hint={`Net margin ${formatPercent(k?.netMargin || 0)} · View P&L`}
          tone={(k?.netProfitMtd || 0) >= 0 ? "good" : "bad"}
        />
        <StatCard
          href="/expenses"
          label="Gross Margin"
          value={formatPercent(k?.grossMargin || 0)}
          hint={`Expense ratio ${formatPercent(k?.expenseRatio || 0)} · Log costs`}
        />
        <StatCard
          href={can(role, "manageCapital") ? "/capital" : "/sales"}
          label="Cash Position"
          value={formatPHP(k?.cashPosition || 0)}
          hint={`Working capital ${formatPHP(k?.workingCapital || 0)}`}
          tone={(k?.cashPosition || 0) >= 0 ? "default" : "bad"}
        />
        <StatCard
          href="/inventory"
          label="Inventory Value"
          value={formatPHP(k?.inventoryValue || 0)}
          hint={`${k?.inventoryCount || 0} SKUs · ${k?.unitsSold || 0} sold`}
        />
        <StatCard
          href="/inventory"
          label="Low Stock Alerts"
          value={String(k?.lowStockCount || 0)}
          hint="Reorder threshold breached"
          tone={(k?.lowStockCount || 0) > 0 ? "warn" : "good"}
        />
        <StatCard
          href={can(role, "editInventory") ? "/prices" : "/inventory"}
          label="Inventory Turnover"
          value={(k?.inventoryTurnover || 0).toFixed(2)}
          hint="COGS / inventory value (MTD)"
        />
        <StatCard
          href={can(role, "manageCapital") ? "/capital" : "/reports"}
          label="ROI on Capital"
          value={formatPercent(k?.roiOnCapital || 0)}
          hint={`Capital deployed ${formatPHP(k?.totalCapital || 0)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Panel
            title="Sales vs Expenses (6 months)"
            action={
              <div className="flex gap-3 text-sm">
                <Link href="/sales" className="text-violet-800 hover:underline">
                  Sales
                </Link>
                <Link href="/expenses" className="text-violet-800 hover:underline">
                  Expenses
                </Link>
              </div>
            }
          >
            <TrendChart data={data?.trend || []} />
          </Panel>
        </div>
        <div className="lg:col-span-2">
          <Panel
            title="Expense Breakdown (MTD)"
            action={
              <Link href="/expenses" className="text-sm text-violet-800 hover:underline">
                Add expense
              </Link>
            }
          >
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
              <Link
                key={item._id}
                href="/inventory"
                className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 transition hover:border-amber-400"
              >
                <div>
                  <p className="font-medium text-violet-950">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.sku}</p>
                </div>
                <p className="text-sm font-semibold text-amber-800">
                  {item.quantity}/{item.reorderLevel}
                </p>
              </Link>
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
              <Link
                key={alert._id}
                href="/alerts"
                className="block rounded-xl border border-violet-900/10 bg-violet-50/40 px-3 py-2 transition hover:border-violet-700/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-violet-950">{alert.title}</p>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
              </Link>
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
