"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, TextArea } from "@/components/ui";
import { formatDatePH, formatPHP, todayInputDate, toInputDate } from "@/lib/utils";

interface Tx {
  _id: string;
  amount: number;
  description: string;
  date: string;
  paymentMethod?: string;
  reference?: string;
}

const emptyForm = {
  amount: "",
  description: "",
  date: todayInputDate(),
  paymentMethod: "cash",
  reference: "",
};

export default function RevenuePage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const res = await fetch("/api/transactions?type=revenue");
    setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(item: Tx) {
    setEditingId(item._id);
    setForm({
      amount: String(item.amount),
      description: item.description,
      date: toInputDate(item.date),
      paymentMethod: item.paymentMethod || "cash",
      reference: item.reference || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...emptyForm, date: todayInputDate() });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      type: "revenue",
      amount: Number(form.amount),
      description: form.description,
      date: form.date,
      paymentMethod: form.paymentMethod,
      reference: form.reference || undefined,
    };

    const res = editingId
      ? await fetch(`/api/transactions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setLoading(false);
    if (!res.ok) return;
    cancelEdit();
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this revenue entry?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await load();
  }

  const total = items.reduce((a, i) => a + i.amount, 0);

  return (
    <AppShell
      title="Revenue"
      subtitle="Enter daily sales and track collections"
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          title={editingId ? "Edit revenue entry" : "New revenue entry"}
          action={
            <span className="text-sm text-slate-500">
              Total listed {formatPHP(total)}
            </span>
          }
        >
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
              {loading ? "Saving…" : editingId ? "Update revenue" : "Save revenue"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={cancelEdit}
              >
                Cancel edit
              </Button>
            ) : null}
          </form>
        </Panel>

        <div className="lg:col-span-3">
          <Panel title="Recent revenue">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Method</th>
                    <th className="py-2 font-medium">Amount</th>
                    {isOwner ? (
                      <th className="py-2 pl-3 font-medium">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-b border-violet-900/5">
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {formatDatePH(item.date)}
                      </td>
                      <td className="py-3 pr-3">{item.description}</td>
                      <td className="py-3 pr-3 capitalize">
                        {item.paymentMethod || "—"}
                      </td>
                      <td className="py-3 font-medium text-emerald-800">
                        {formatPHP(item.amount)}
                      </td>
                      {isOwner ? (
                        <td className="py-3 pl-3">
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-3 py-1.5 text-xs"
                              onClick={() => startEdit(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              className="px-3 py-1.5 text-xs"
                              onClick={() => remove(item._id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      ) : null}
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
