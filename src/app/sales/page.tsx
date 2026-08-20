"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/AppShell";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button, Input, Panel, Select, StatCard } from "@/components/ui";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useMountQuery } from "@/hooks/useMountQuery";
import {
  formatDateTimePH,
  formatPHP,
  toInputDate,
  todayInputDate,
} from "@/lib/utils";

interface Sale {
  _id: string;
  amount: number;
  category?: string;
  description: string;
  date: string;
  paymentMethod?: string;
  reference?: string;
  source?: string;
}

export default function SalesPage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";
  const managedCategories = useProductCategories();
  const [items, setItems] = useState<Sale[]>([]);
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function fetchSales(params?: {
    from?: string;
    to?: string;
    paymentMethod?: string;
  }) {
    const query = new URLSearchParams({
      type: "revenue",
      source: "pos",
    });
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.paymentMethod) query.set("paymentMethod", params.paymentMethod);

    const res = await fetch(`/api/transactions?${query.toString()}`);
    const data = await res.json();
    return Array.isArray(data) ? (data as Sale[]) : [];
  }

  async function load() {
    setItems(
      await fetchSales({
        from: from || undefined,
        to: to || undefined,
        paymentMethod: paymentMethod || undefined,
      })
    );
  }

  useMountQuery(() => fetchSales(), setItems);

  async function remove(id: string) {
    if (!confirm("Delete this POS sale from the report?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    await load();
  }

  const categoryOptions = useMemo(() => {
    const base = [...managedCategories];
    if (!base.includes("Mixed")) base.push("Mixed");
    const extra = items
      .map((item) => item.category)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .filter((value) => !base.includes(value));
    return [...base, ...Array.from(new Set(extra))];
  }, [items, managedCategories]);

  const visibleItems = useMemo(
    () => (category ? items.filter((item) => item.category === category) : items),
    [items, category]
  );

  const total = visibleItems.reduce((sum, item) => sum + item.amount, 0);
  const avgTicket = visibleItems.length ? total / visibleItems.length : 0;
  const todayKey = todayInputDate();
  const todayTotal = useMemo(
    () =>
      visibleItems
        .filter((item) => toInputDate(item.date) === todayKey)
        .reduce((sum, item) => sum + item.amount, 0),
    [visibleItems, todayKey]
  );

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of visibleItems) {
      const method = item.paymentMethod || "cash";
      map.set(method, (map.get(method) || 0) + item.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [visibleItems]);

  return (
    <AppShell
      title="Sales"
      subtitle="POS sales report — every completed checkout from Point of Sale"
    >
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales total"
          value={formatPHP(total)}
          hint={`${visibleItems.length} POS sale${visibleItems.length === 1 ? "" : "s"}`}
          tone="good"
        />
        <StatCard
          label="Average ticket"
          value={formatPHP(avgTicket)}
          hint="Total ÷ number of sales"
        />
        <StatCard
          label="Top payment"
          value={
            paymentBreakdown[0]
              ? paymentBreakdown[0][0].toUpperCase()
              : "—"
          }
          hint={
            paymentBreakdown[0]
              ? formatPHP(paymentBreakdown[0][1])
              : "No sales yet"
          }
        />
        <StatCard
          label="Today"
          value={formatPHP(todayTotal)}
          hint="POS sales dated today (PH time)"
        />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
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
        <Select
          label="Payment method"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="">All methods</option>
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="maya">Maya</option>
          <option value="card">Card</option>
          <option value="bank">Bank transfer</option>
        </Select>
        <div className="flex items-end gap-2">
          <Button type="button" onClick={load} className="w-full">
            Apply filters
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CategoryFilter
          value={category}
          options={categoryOptions}
          onChange={setCategory}
        />
        <Link href="/pos" className="text-sm text-violet-800 hover:underline">
          Open POS
        </Link>
      </div>

      {paymentBreakdown.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {paymentBreakdown.map(([method, amount]) => (
            <span
              key={method}
              className="rounded-full border border-violet-900/10 bg-white px-3 py-1.5 text-xs text-violet-900"
            >
              {method.toUpperCase()} · {formatPHP(amount)}
            </span>
          ))}
        </div>
      ) : null}

      <Panel
        title="POS sales"
        action={
          <span className="text-sm text-slate-500">
            Listed {formatPHP(total)}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-violet-900/10 text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Date & time</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Items</th>
                <th className="py-2 pr-3 font-medium">Payment</th>
                <th className="py-2 pr-3 font-medium">Reference</th>
                <th className="py-2 font-medium">Amount</th>
                {isOwner ? (
                  <th className="py-2 pl-3 font-medium">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item._id} className="border-b border-violet-900/5">
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {formatDateTimePH(item.date)}
                  </td>
                  <td className="py-3 pr-3">{item.category || "—"}</td>
                  <td className="py-3 pr-3">
                    {item.description.replace(/^POS sale:\s*/i, "")}
                  </td>
                  <td className="py-3 pr-3 capitalize">
                    {item.paymentMethod || "—"}
                  </td>
                  <td className="py-3 pr-3 text-slate-500">
                    {item.reference || "—"}
                  </td>
                  <td className="py-3 font-medium text-emerald-800">
                    {formatPHP(item.amount)}
                  </td>
                  {isOwner ? (
                    <td className="py-3 pl-3">
                      <Button
                        type="button"
                        variant="danger"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => remove(item._id)}
                      >
                        Delete
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleItems.length ? (
            <p className="py-8 text-center text-slate-500">
              {items.length
                ? "No POS sales in this category."
                : "No POS sales yet. Complete a checkout in Point of Sale."}
            </p>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}
