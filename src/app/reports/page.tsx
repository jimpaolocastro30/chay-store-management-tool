"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, StatCard } from "@/components/ui";
import {
  formatDatePH,
  formatPercent,
  formatPHP,
} from "@/lib/utils";

type ReportType =
  | "sales"
  | "inventory"
  | "pricing"
  | "pnl"
  | "kpi"
  | "capital"
  | "backup";

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

interface SaleRow {
  _id?: string;
  amount: number;
  category?: string;
  description: string;
  date: string;
  paymentMethod?: string;
  reference?: string;
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
  retailValue?: number;
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

interface SalesReport {
  type: "sales";
  from?: string | null;
  to?: string | null;
  total: number;
  salesCount: number;
  averageTicket: number;
  paymentBreakdown: { paymentMethod: string; amount: number }[];
  categoryBreakdown: { category: string; amount: number }[];
  sales: SaleRow[];
}

interface InventoryReport {
  type: "inventory";
  totalValue: number;
  retailValue?: number;
  unitsOnHand?: number;
  unitsSold?: number;
  lowStockCount?: number;
  items: InventoryRow[];
}

interface PricingRow {
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  sellingPrice: number;
  specialPrice: number;
  markupPercent: number;
  marginPercent: number;
  specialMarkupPercent?: number;
  hasSpecial: boolean;
}

interface PricingReport {
  type: "pricing";
  skuCount: number;
  withSpecialPrice: number;
  averageMarkupPercent: number;
  averageMarginPercent: number;
  items: PricingRow[];
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

interface BackupReport {
  type: "backup";
  exportedAt: string;
  counts: {
    transactions: number;
    inventory: number;
    pricing?: number;
    capital: number;
    categories: number;
  };
}

type ReportResult =
  | SalesReport
  | InventoryReport
  | PricingReport
  | PnlReport
  | KpiReport
  | CapitalReport
  | BackupReport;

const REPORT_TITLES: Record<ReportType, string> = {
  sales: "Sales report",
  inventory: "Inventory report",
  pricing: "Pricing report",
  pnl: "Profit & Loss",
  kpi: "KPI summary",
  capital: "Capital movements",
  backup: "Full data backup",
};

const DATED_REPORTS: ReportType[] = ["sales", "pnl"];

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
  const [type, setType] = useState<ReportType>("sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [importKind, setImportKind] = useState("auto");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function buildParams(format: "json" | "csv" | "xlsx") {
    const params = new URLSearchParams({ type, format });
    if (DATED_REPORTS.includes(type)) {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return params;
  }

  async function downloadFile(format: "csv" | "xlsx") {
    setExporting(format);
    try {
      const res = await fetch(`/api/reports?${buildParams(format).toString()}`);
      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ||
        `${type}-${format === "csv" ? "export.csv" : "export.xlsx"}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?${buildParams("json").toString()}`);
      setResult((await res.json()) as ReportResult);
    } finally {
      setLoading(false);
    }
  }

  async function onImport(file: File) {
    setImporting(true);
    setImportMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", importKind);
      const res = await fetch("/api/import", { method: "POST", body });
      const data = (await res.json()) as {
        ok?: boolean;
        created?: number;
        counts?: Record<string, number>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }
      const parts = Object.entries(data.counts || {})
        .filter(([, n]) => n > 0)
        .map(([key, n]) => `${n} ${key}`);
      setImportMessage(
        parts.length
          ? `Restored ${data.created || 0} record${data.created === 1 ? "" : "s"} (${parts.join(", ")})`
          : `Import finished with ${data.created || 0} changes.`
      );
      if (type === "backup" || type === "pricing" || type === "inventory") {
        await generate();
      }
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const rangeLabel = useMemo(() => {
    if (type === "backup") return "Complete store snapshot";
    if (type === "inventory" || type === "pricing") {
      return "Current catalog snapshot";
    }
    if (!DATED_REPORTS.includes(type)) return "All dates";
    if (!from && !to) return "All dates";
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    return `Until ${to}`;
  }, [from, to, type]);

  const busy = loading || exporting !== null || importing;
  const showDates = DATED_REPORTS.includes(type);

  return (
    <AppShell
      title="Reports"
      subtitle="Sales, inventory, pricing, exports, backups, and restore"
    >
      <Panel title="Generate report">
        <div className="grid gap-4 md:grid-cols-4">
          <Select
            label="Report type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as ReportType);
              setResult(null);
            }}
          >
            <option value="sales">Sales report</option>
            <option value="inventory">Inventory report</option>
            <option value="pricing">Pricing report</option>
            <option value="pnl">Profit & Loss</option>
            <option value="kpi">KPI summary</option>
            <option value="capital">Capital movements</option>
            <option value="backup">Full data backup</option>
          </Select>
          <Input
            label="From"
            type="date"
            value={from}
            disabled={!showDates}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={to}
            disabled={!showDates}
            onChange={(e) => setTo(e.target.value)}
          />
          <div className="flex items-end">
            <Button className="w-full" disabled={busy} onClick={generate}>
              {loading ? "Loading…" : "Preview"}
            </Button>
          </div>
        </div>
      </Panel>

      <div className="mt-4">
        <Panel
          title="Backup & export"
          action={
            <span className="text-xs text-slate-500">
              {type === "backup"
                ? "Transactions, inventory, pricing, capital, categories"
                : REPORT_TITLES[type]}
            </span>
          }
        >
          <p className="mb-4 text-sm text-slate-600">
            Download a portable copy for records or disaster recovery. Excel keeps
            multiple sheets; CSV is a single flat file.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => downloadFile("csv")}
            >
              <FileText className="h-4 w-4" />
              {exporting === "csv" ? "Preparing CSV…" : "Export CSV"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => downloadFile("xlsx")}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exporting === "xlsx" ? "Preparing Excel…" : "Export Excel"}
            </Button>
            {type !== "backup" ? (
              <Button
                disabled={busy}
                onClick={() => {
                  setType("backup");
                  setResult(null);
                }}
              >
                <Download className="h-4 w-4" />
                Switch to full backup
              </Button>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Import / restore">
          <p className="mb-4 text-sm text-slate-600">
            Restore from a Chay Ops backup Excel/CSV, or import pricing,
            inventory, transactions, capital, or categories.
          </p>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <Select
              label="Import type"
              value={importKind}
              onChange={(e) => setImportKind(e.target.value)}
            >
              <option value="auto">Auto-detect / full backup</option>
              <option value="backup">Full backup restore</option>
              <option value="pricing">Pricing only</option>
              <option value="inventory">Inventory</option>
              <option value="transactions">Transactions</option>
              <option value="capital">Capital</option>
              <option value="categories">Categories</option>
            </Select>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImport(file);
              }}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importing…" : "Choose file"}
            </Button>
          </div>
          {importMessage ? (
            <p className="mt-3 text-sm text-violet-900">{importMessage}</p>
          ) : null}
        </Panel>
      </div>

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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => downloadFile("csv")}
              >
                <FileText className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => downloadFile("xlsx")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>

          {result.type === "sales" ? <SalesPreview report={result} /> : null}
          {result.type === "inventory" ? (
            <InventoryPreview report={result} />
          ) : null}
          {result.type === "pricing" ? (
            <PricingPreview report={result} />
          ) : null}
          {result.type === "pnl" ? <PnlPreview report={result} /> : null}
          {result.type === "kpi" ? <KpiPreview report={result} /> : null}
          {result.type === "capital" ? <CapitalPreview report={result} /> : null}
          {result.type === "backup" ? <BackupPreview report={result} /> : null}
        </div>
      ) : null}
    </AppShell>
  );
}

function SalesPreview({ report }: { report: SalesReport }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales total"
          value={formatPHP(report.total)}
          hint={`${report.salesCount} POS sale${report.salesCount === 1 ? "" : "s"}`}
          tone="good"
        />
        <StatCard
          label="Average ticket"
          value={formatPHP(report.averageTicket)}
        />
        <StatCard
          label="Payment methods"
          value={String(report.paymentBreakdown.length)}
          hint={
            report.paymentBreakdown[0]
              ? `Top: ${report.paymentBreakdown[0].paymentMethod}`
              : undefined
          }
        />
        <StatCard
          label="Categories"
          value={String(report.categoryBreakdown.length)}
        />
      </div>

      {report.paymentBreakdown.length ? (
        <ReportTableShell>
          <TableHead columns={["Payment method", "Amount", "Share"]} />
          <tbody>
            {report.paymentBreakdown
              .slice()
              .sort((a, b) => b.amount - a.amount)
              .map((row) => (
                <tr
                  key={row.paymentMethod}
                  className="transition hover:bg-violet-50/70"
                >
                  <td className="border-b border-violet-900/5 px-4 py-3 capitalize text-violet-950">
                    {row.paymentMethod}
                  </td>
                  <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-emerald-800">
                    {formatPHP(row.amount)}
                  </td>
                  <td className="border-b border-violet-900/5 px-4 py-3 text-right tabular-nums text-slate-600">
                    {report.total
                      ? formatPercent((row.amount / report.total) * 100)
                      : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </ReportTableShell>
      ) : null}

      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">
              {report.sales.length} POS sale
              {report.sales.length === 1 ? "" : "s"}
            </span>
            <span className="font-semibold text-violet-950">
              Total {formatPHP(report.total)}
            </span>
          </div>
        }
      >
        <TableHead
          columns={[
            "Date",
            "Category",
            "Description",
            "Payment",
            "Reference",
            "Amount",
          ]}
        />
        <tbody>
          {report.sales.map((sale, index) => (
            <tr
              key={sale._id || `${sale.date}-${index}`}
              className="transition hover:bg-violet-50/70"
            >
              <td className="whitespace-nowrap border-b border-violet-900/5 px-4 py-3 text-slate-600">
                {formatDatePH(sale.date)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 capitalize text-slate-700">
                {sale.category || "—"}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-violet-950">
                {sale.description}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 capitalize text-slate-600">
                {sale.paymentMethod || "cash"}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 font-mono text-xs text-slate-500">
                {sale.reference || "—"}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-right font-semibold tabular-nums text-emerald-800">
                {formatPHP(sale.amount)}
              </td>
            </tr>
          ))}
          {!report.sales.length ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-slate-500"
              >
                No POS sales in this range.
              </td>
            </tr>
          ) : null}
        </tbody>
      </ReportTableShell>
    </>
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
  const retail =
    report.retailValue ??
    report.items.reduce(
      (sum, item) => sum + item.quantity * item.sellingPrice,
      0
    );
  const unitsOnHand =
    report.unitsOnHand ??
    report.items.reduce((sum, item) => sum + item.quantity, 0);
  const unitsSold =
    report.unitsSold ??
    report.items.reduce((sum, item) => sum + (item.sold || 0), 0);
  const lowStockCount =
    report.lowStockCount ?? report.items.filter((i) => i.lowStock).length;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          label="Units on hand"
          value={String(unitsOnHand)}
          hint={`${unitsSold} sold all-time`}
        />
        <StatCard
          label="SKUs"
          value={String(report.items.length)}
          hint={`${lowStockCount} low stock`}
          tone={lowStockCount > 0 ? "warn" : "default"}
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

function PricingPreview({ report }: { report: PricingReport }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="SKUs" value={String(report.skuCount)} tone="good" />
        <StatCard
          label="Avg markup"
          value={formatPercent(report.averageMarkupPercent)}
        />
        <StatCard
          label="Avg margin"
          value={formatPercent(report.averageMarginPercent)}
        />
        <StatCard
          label="Special prices"
          value={String(report.withSpecialPrice)}
          tone={report.withSpecialPrice ? "warn" : "default"}
        />
      </div>

      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">
              {report.items.length} priced SKUs
            </span>
            <span className="font-semibold text-violet-950">
              {report.withSpecialPrice} with special price
            </span>
          </div>
        }
      >
        <TableHead
          columns={[
            "SKU",
            "Item",
            "Category",
            "Cost",
            "Sell",
            "Special",
            "Markup",
            "Margin",
          ]}
        />
        <tbody>
          {report.items.map((item) => (
            <tr key={item.sku} className="transition hover:bg-violet-50/70">
              <td className="whitespace-nowrap border-b border-violet-900/5 px-4 py-3 font-mono text-xs text-violet-800">
                {item.sku}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 font-medium text-violet-950">
                {item.name}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-slate-600">
                {item.category}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-slate-600">
                {formatPHP(item.unitCost)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-violet-950">
                {formatPHP(item.sellingPrice)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-amber-800">
                {item.hasSpecial ? formatPHP(item.specialPrice) : "—"}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-slate-600">
                {formatPercent(item.markupPercent)}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-right tabular-nums text-slate-600">
                {formatPercent(item.marginPercent)}
              </td>
            </tr>
          ))}
          {!report.items.length ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-12 text-center text-slate-500"
              >
                No pricing data found.
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

function BackupPreview({ report }: { report: BackupReport }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Transactions"
          value={String(report.counts.transactions)}
          tone="good"
        />
        <StatCard
          label="Inventory"
          value={String(report.counts.inventory)}
        />
        <StatCard
          label="Pricing"
          value={String(report.counts.pricing ?? report.counts.inventory)}
        />
        <StatCard
          label="Capital"
          value={String(report.counts.capital)}
        />
        <StatCard
          label="Categories"
          value={String(report.counts.categories)}
        />
      </div>

      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">
              Snapshot ready for CSV or Excel download / restore
            </span>
            <span className="font-semibold text-violet-950">
              Exported {formatDatePH(report.exportedAt)}
            </span>
          </div>
        }
      >
        <TableHead columns={["Dataset", "Records", "Notes"]} />
        <tbody>
          {[
            {
              dataset: "Transactions",
              records: report.counts.transactions,
              notes: "Sales, expenses, and losses",
            },
            {
              dataset: "Inventory",
              records: report.counts.inventory,
              notes: "Stock levels, costs, and item details",
            },
            {
              dataset: "Pricing",
              records: report.counts.pricing ?? report.counts.inventory,
              notes: "Unit cost, sell price, special price, markup",
            },
            {
              dataset: "Capital",
              records: report.counts.capital,
              notes: "Initial, investment, and withdrawals",
            },
            {
              dataset: "Categories",
              records: report.counts.categories,
              notes: "Product category list",
            },
          ].map((row) => (
            <tr key={row.dataset} className="transition hover:bg-violet-50/70">
              <td className="border-b border-violet-900/5 px-4 py-3 font-medium text-violet-950">
                {row.dataset}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 tabular-nums text-violet-900">
                {row.records}
              </td>
              <td className="border-b border-violet-900/5 px-4 py-3 text-slate-600">
                {row.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </ReportTableShell>
    </>
  );
}
