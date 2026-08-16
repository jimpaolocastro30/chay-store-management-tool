"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select } from "@/components/ui";
import { formatPHP } from "@/lib/utils";

export default function ReportsPage() {
  const [type, setType] = useState("pnl");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
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

    setResult(await res.json());
    setLoading(false);
  }

  async function exportExcelLike() {
    // CSV opens cleanly in Excel — same endpoint
    await generate("csv");
  }

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
            onChange={(e) => setType(e.target.value)}
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
              Preview
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={exportExcelLike}
            >
              Excel/CSV
            </Button>
          </div>
        </div>
      </Panel>

      {result ? (
        <div className="mt-6">
          <Panel title="Preview">
            {"revenue" in result ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="text-xl font-semibold">
                    {formatPHP(Number(result.revenue || 0))}
                  </p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-xs text-slate-500">Expenses</p>
                  <p className="text-xl font-semibold">
                    {formatPHP(Number(result.expenses || 0))}
                  </p>
                </div>
                <div className="rounded-xl bg-teal-50 p-3">
                  <p className="text-xs text-slate-500">Net profit</p>
                  <p className="text-xl font-semibold">
                    {formatPHP(Number(result.netProfit || 0))}
                  </p>
                </div>
              </div>
            ) : null}
            {"totalValue" in result ? (
              <p className="mb-3 text-sm text-slate-600">
                Total inventory value:{" "}
                <strong>{formatPHP(Number(result.totalValue || 0))}</strong>
              </p>
            ) : null}
            <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-teal-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Panel>
        </div>
      ) : null}
    </AppShell>
  );
}
