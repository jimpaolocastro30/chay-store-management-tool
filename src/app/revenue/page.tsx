"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, TextArea } from "@/components/ui";
import { formatPHP } from "@/lib/utils";

interface Tx {
  _id: string;
  amount: number;
  description: string;
  date: string;
  paymentMethod?: string;
  reference?: string;
}

export default function RevenuePage() {
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash",
    reference: "",
  });

  async function load() {
    const res = await fetch("/api/transactions?type=revenue");
    setItems(await res.json());
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
        type: "revenue",
        amount: Number(form.amount),
        description: form.description,
        date: form.date,
        paymentMethod: form.paymentMethod,
        reference: form.reference || undefined,
      }),
    });
    setForm((f) => ({
      ...f,
      amount: "",
      description: "",
      reference: "",
    }));
    setLoading(false);
    await load();
  }

  const total = items.reduce((a, i) => a + i.amount, 0);

  return (
    <AppShell
      title="Revenue"
      subtitle="Enter daily sales and track collections"
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="New revenue entry" action={<span className="text-sm text-slate-500">Total listed {formatPHP(total)}</span>}>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Amount (PHP)"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
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
            <Select
              label="Payment method"
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({ ...form, paymentMethod: e.target.value })
              }
            >
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="card">Card</option>
              <option value="bank">Bank transfer</option>
            </Select>
            <Input
              label="Reference (optional)"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving…" : "Save revenue"}
            </Button>
          </form>
        </Panel>

        <div className="lg:col-span-3">
          <Panel title="Recent revenue">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-teal-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Method</th>
                    <th className="py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-b border-teal-900/5">
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString("en-PH")}
                      </td>
                      <td className="py-3 pr-3">{item.description}</td>
                      <td className="py-3 pr-3 capitalize">
                        {item.paymentMethod || "—"}
                      </td>
                      <td className="py-3 font-medium text-emerald-800">
                        {formatPHP(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length ? (
                <p className="py-8 text-center text-slate-500">No revenue yet.</p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
