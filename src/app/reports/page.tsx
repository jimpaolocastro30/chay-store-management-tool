"use client";

import { ReactNode, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, StatCard } from "@/components/ui";
import {
  formatDatePH,
  formatPercent,
  formatPHP,
} from "@/lib/utils";

type ReportType = "pnl" | "inventory" | "kpi" | "capital";

interface PnlTx {
  _id?: string;
  type: string;
  amount: number;
  category?: string;
  description: string;
  date: string;
  paymentMethod?: string;
  source?: string;
}

interface InventoryRow {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  sold?: number;
  unitCost: number;
  sellingPrice: number;
  stockValue: number;
  lowStock: boolean;
}

interface CapitalRow {
  _id?: string;
  type: string;
  amount: number;
  description: string;
  date: string;
}

interface PnlReport {
  type: "pnl";
  from?: string | null;
  to?: string | null;
  revenue: number;
  expenses: number;
  netProfit: number;
  transactions: PnlTx[];
}

interface InventoryReport {
  type: "inventory";
  totalValue: number;
  items: InventoryRow[];
}

interface KpiReport {
  type: "kpi";
  revenueMtd: number;
  revenueYtd: number;
  expensesMtd: number;
  netProfitMtd: number;
  grossMargin: number;
  netMargin: number;
  inventoryValue: number;
  inventoryCount: number;
  unitsSold?: number;
  lowStockCount: number;
  inventoryTurnover: number;
  totalCapital: number;
  workingCapital: number;
  cashPosition: number;
  roiOnCapital: number;
  expenseRatio: number;
}

interface CapitalReport {
  type: "capital";
  entries: CapitalRow[];
}

type ReportResult = PnlReport | InventoryReport | KpiReport | CapitalReport;

const REPORT_TITLES: Record<ReportType, string> = {
  pnl: "Profit & Loss",
  inventory: "Inventory valuation",
  kpi: "KPI summary",
  capital: "Capital movements",
};

function TypeBadge({ value }: { value: string }) {
  const tones: Record<string, string> = {
    revenue: "bg-emerald-100 text-emerald-900",
    expense: "bg-rose-100 text-rose-900",
    loss: "bg-amber-100 text-amber-900",
    initial: "bg-violet-100 text-violet-900",
    investment: "bg-sky-100 text-sky-900",
    withdrawal: "bg-rose-100 text-rose-900",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
        tones[value] || "bg-slate-100 text-slate-700"
      }`}
    >
      {value}
    </span>
  );
}

function ReportTableShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-violet-900/10 bg-white shadow-[0_18px_50px_-36px_rgba(76,29,149,0.55)]">
      <div className="max-h-[560px] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          {children}
        </table>
      </div>
      {footer ? (
        <div className="border-t border-violet-900/10 bg-gradient-to-r from-violet-50/90 to-white px-4 py-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="bg-[linear-gradient(135deg,#4c1d95_0%,#7c3aed_55%,#a78bfa_100%)] text-white">
        {columns.map((column) => (
          <th
            key={column}
            className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] first:rounded-tl-2xl last:rounded-tr-2xl"
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>("pnl");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate(format: "json" | "csv") {
    setLoading(true);
    const params = new URLSearchParams({ type, format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/reports?${params.toString()}`);
    if (format === "csv") {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setLoading(false);
      return;
    }

    setResult((await res.json()) as ReportResult);
    setLoading(false);
  }

  const rangeLabel = useMemo(() => {
    if (!from && !to) return "All dates";
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    return `Until ${to}`;
  }, [from, to]);

  return (
    <AppShell
      title="Reports"
      subtitle="On-demand P&L, inventory valuation, and KPI exports"
    >
      <Panel title="Generate report">
        <div className="grid gap-4 md:grid-cols-4">
          <Select
            label="Report type"
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
          >
            <option value="pnl">Profit & Loss</option>
            <option value="inventory">Inventory valuation</option>
            <option value="kpi">KPI summary</option>
            <option value="capital">Capital movements</option>
          </Select>
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <div className="flex items-end gap-2">
            <Button disabled={loading} onClick={() => generate("json")}>
              {loading ? "Loading…" : "Preview"}
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => generate("csv")}
            >
              Excel/CSV
            </Button>
          </div>
        </div>
      </Panel>

      {result ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-violet-700/70">
                Report preview
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">
                {REPORT_TITLES[result.type]}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{rangeLabel}</p>
            </div>
          </div>

          {result.type === "pnl" ? <PnlPreview report={result} /> : null}
          {result.type === "inventory" ? (
            <InventoryPreview report={result} />
          ) : null}
          {result.type === "kpi" ? <KpiPreview report={result} /> : null}
          {result.type === "capital" ? <CapitalPreview report={result} /> : null}
        </div>
      ) : null}
    </AppShell>
  );
}

function PnlPreview({ report }: { report: PnlReport }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenue"
          value={formatPHP(report.revenue)}
          tone="good"
        />
        <StatCard
          label="Expenses"
          value={formatPHP(report.expenses)}
          tone="bad"
        />
        <StatCard
          label="Net profit"
          value={formatPHP(report.netProfit)}
          tone={report.netProfit >= 0 ? "good" : "bad"}
        />
      </div>

      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">
              {report.transactions.length} transaction
              {report.transactions.length === 1 ? "" : "s"}
            </span>
            <span className="font-semibold text-violet-950">
              Net {formatPHP(report.netProfit)}
            </span>
          </div>
        }
      >
        <TableHead
          columns={[
            "Date",
            "Type",
            "Category",
            "Description",
            "Payment",
            "Amount",
          ]}
        />
        <tbody>
          {report.transactions.map((tx, index) => (
            <tr
              key={tx._id || `${tx.date}-${index}`}
              className="transition hover:bg-violet-50/70"
            >
              <td className="whitespace-nowrap border-b border-violet-900/5 px-4 py-3 text-slate-600">
                {formatDatePH(tx.date)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3">
                <TypeBadge value={tx.type} />
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 capitalize text-slate-700">
                {tx.category || "—"}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-violet-950">
                {tx.description}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 capitalize text-slate-600">
                {tx.paymentMethod || "—"}
              </td>
              <td
                className={`border-b border-violet-900/5 px-4 py-3 text-right font-semibold tabular-nums ${
                  tx.type === "revenue" ? "text-emerald-800" : "text-rose-700"
                }`}
              >
                {tx.type === "revenue" ? "+" : "−"}
                {formatPHP(tx.amount)}
              </td>
            </tr>
          ))}
          {!report.transactions.length ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-slate-500"
              >
                No transactions in this range.
              </td>
            </tr>
          ) : null}
        </tbody>
      </ReportTableShell>
    </>
  );
}

function InventoryPreview({ report }: { report: InventoryReport }) {
  const retail = report.items.reduce(
    (sum, item) => sum + item.quantity * item.sellingPrice,
    0
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Stock value"
          value={formatPHP(report.totalValue)}
          hint="Qty × unit cost"
          tone="good"
        />
        <StatCard
          label="Retail value"
          value={formatPHP(retail)}
          hint="Qty × selling price"
        />
        <StatCard
          label="SKUs"
          value={String(report.items.length)}
          hint={`${report.items.filter((i) => i.lowStock).length} low stock`}
          tone={
            report.items.some((i) => i.lowStock) ? "warn" : "default"
          }
        />
      </div>

      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">
              {report.items.length} active SKUs
            </span>
            <span className="font-semibold text-violet-950">
              Valuation {formatPHP(report.totalValue)}
            </span>
          </div>
        }
      >
        <TableHead
          columns={[
            "SKU",
            "Item",
            "Category",
            "On hand",
            "Sold",
            "Unit cost",
            "Sell price",
            "Stock value",
            "Status",
          ]}
        />
        <tbody>
          {report.items.map((item) => (
            <tr
              key={item.sku}
              className="transition hover:bg-violet-50/70"
            >
              <td className="whitespace-nowrap border-b border-violet-900/5 px-4 py-3 font-mono text-xs text-violet-800">
                {item.sku}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 font-medium text-violet-950">
                {item.name}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-slate-600">
                {item.category}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums">
                {item.quantity}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-emerald-800">
                {item.sold || 0}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-slate-600">
                {formatPHP(item.unitCost)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-slate-600">
                {formatPHP(item.sellingPrice)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-right font-semibold tabular-nums text-violet-950">
                {formatPHP(item.stockValue)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3">
                {item.lowStock ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                    Low stock
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                    Healthy
                  </span>
                )}
              </td>
            </tr>
          ))}
          {!report.items.length ? (
            <tr>
              <td
                colSpan={9}
                className="px-4 py-12 text-center text-slate-500"
              >
                No inventory items found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </ReportTableShell>
    </>
  );
}

function KpiPreview({ report }: { report: KpiReport }) {
  const rows = [
    { label: "Revenue MTD", value: formatPHP(report.revenueMtd) },
    { label: "Revenue YTD", value: formatPHP(report.revenueYtd) },
    { label: "Expenses MTD", value: formatPHP(report.expensesMtd) },
    { label: "Net profit MTD", value: formatPHP(report.netProfitMtd) },
    { label: "Gross margin", value: formatPercent(report.grossMargin) },
    { label: "Net margin", value: formatPercent(report.netMargin) },
    { label: "Expense ratio", value: formatPercent(report.expenseRatio) },
    { label: "Inventory value", value: formatPHP(report.inventoryValue) },
    { label: "Active SKUs", value: String(report.inventoryCount) },
    { label: "Units sold", value: String(report.unitsSold || 0) },
    { label: "Low stock alerts", value: String(report.lowStockCount) },
    {
      label: "Inventory turnover",
      value: report.inventoryTurnover.toFixed(2),
    },
    { label: "Total capital", value: formatPHP(report.totalCapital) },
    { label: "Working capital", value: formatPHP(report.workingCapital) },
    { label: "Cash position", value: formatPHP(report.cashPosition) },
    { label: "ROI on capital", value: formatPercent(report.roiOnCapital) },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net profit MTD"
          value={formatPHP(report.netProfitMtd)}
          tone={report.netProfitMtd >= 0 ? "good" : "bad"}
        />
        <StatCard
          label="Gross margin"
          value={formatPercent(report.grossMargin)}
        />
        <StatCard
          label="Cash position"
          value={formatPHP(report.cashPosition)}
          tone={report.cashPosition >= 0 ? "default" : "bad"}
        />
        <StatCard
          label="ROI on capital"
          value={formatPercent(report.roiOnCapital)}
        />
      </div>

      <ReportTableShell>
        <TableHead columns={["Metric", "Value"]} />
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.label}
              className={`transition hover:bg-violet-50/70 ${
                index % 2 === 0 ? "bg-violet-50/30" : "bg-white"
              }`}
            >
              <td className="border-b border-violet-900/5 px-4 py-3.5 font-medium text-violet-950">
                {row.label}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3.5 text-right font-[family-name:var(--font-display)] text-lg tabular-nums text-violet-900">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </ReportTableShell>
    </>
  );
}

function CapitalPreview({ report }: { report: CapitalReport }) {
  const invested = report.entries
    .filter((e) => e.type === "initial" || e.type === "investment")
    .reduce((sum, e) => sum + e.amount, 0);
  const withdrawn = report.entries
    .filter((e) => e.type === "withdrawal")
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Invested" value={formatPHP(invested)} tone="good" />
        <StatCard label="Withdrawn" value={formatPHP(withdrawn)} tone="bad" />
        <StatCard
          label="Net capital"
          value={formatPHP(invested - withdrawn)}
        />
      </div>

      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">
              {report.entries.length} capital movement
              {report.entries.length === 1 ? "" : "s"}
            </span>
            <span className="font-semibold text-violet-950">
              Net {formatPHP(invested - withdrawn)}
            </span>
          </div>
        }
      >
        <TableHead columns={["Date", "Type", "Description", "Amount"]} />
        <tbody>
          {report.entries.map((entry, index) => (
            <tr
              key={entry._id || `${entry.date}-${index}`}
              className="transition hover:bg-violet-50/70"
            >
              <td className="whitespace-nowrap border-b border-violet-900/5 px-4 py-3 text-slate-600">
                {formatDatePH(entry.date)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3">
                <TypeBadge value={entry.type} />
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-violet-950">
                {entry.description}
              </td>
              <td
                className={`border-b border-violet-900/5 px-4 py-3 text-right font-semibold tabular-nums ${
                  entry.type === "withdrawal"
                    ? "text-rose-700"
                    : "text-emerald-800"
                }`}
              >
                {entry.type === "withdrawal" ? "−" : "+"}
                {formatPHP(entry.amount)}
              </td>
            </tr>
          ))}
          {!report.entries.length ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-12 text-center text-slate-500"
              >
                No capital entries found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </ReportTableShell>
    </>
  );
}
