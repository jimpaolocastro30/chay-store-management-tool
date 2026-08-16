"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, TextArea } from "@/components/ui";
import { formatPHP } from "@/lib/utils";

interface Tx {
  _id: string;
  type: string;
  amount: number;
  category?: string;
  description: string;
  date: string;
}

const categories = [
  "cogs",
  "rent",
  "utilities",
  "payroll",
  "marketing",
  "supplies",
  "transport",
  "damage",
  "other",
];

export default function ExpensesPage() {
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category: "cogs",
    description: "",
    date: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    const [expenses, losses] = await Promise.all([
      fetch("/api/transactions?type=expense").then((r) => r.json()),
      fetch("/api/transactions?type=loss").then((r) => r.json()),
    ]);
    setItems(
      [...expenses, ...losses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        amount: Number(form.amount),
        category: form.category,
        description: form.description,
        date: form.date,
      }),
    });
    setForm((f) => ({ ...f, amount: "", description: "" }));
    setLoading(false);
    await load();
  }

  return (
    <AppShell
      title="Expenses & Losses"
      subtitle="Categorize operating costs, COGS, and inventory losses"
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="New entry">
          <form onSubmit={onSubmit} className="space-y-3">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="expense">Expense</option>
              <option value="loss">Loss / damage</option>
            </Select>
            <Input
              label="Amount (PHP)"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </Select>
            <TextArea
              label="Description"
              required
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <Input
              label="Date"
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving…" : "Save entry"}
            </Button>
          </form>
        </Panel>

        <div className="lg:col-span-3">
          <Panel title="Expense & loss ledger">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-teal-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-b border-teal-900/5">
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString("en-PH")}
                      </td>
                      <td className="py-3 pr-3 capitalize">{item.type}</td>
                      <td className="py-3 pr-3 uppercase text-xs">
                        {item.category}
                      </td>
                      <td className="py-3 pr-3">{item.description}</td>
                      <td className="py-3 font-medium text-rose-700">
                        {formatPHP(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
