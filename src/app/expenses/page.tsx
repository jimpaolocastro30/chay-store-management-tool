"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, TextArea } from "@/components/ui";
import { formatDatePH, formatPHP, todayInputDate, toInputDate } from "@/lib/utils";

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

const emptyForm = {
  type: "expense",
  amount: "",
  category: "cogs",
  description: "",
  date: todayInputDate(),
};

export default function ExpensesPage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  function startEdit(item: Tx) {
    setEditingId(item._id);
    setForm({
      type: item.type || "expense",
      amount: String(item.amount),
      category: item.category || "other",
      description: item.description,
      date: toInputDate(item.date),
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
      type: form.type,
      amount: Number(form.amount),
      category: form.category,
      description: form.description,
      date: form.date,
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
    if (!confirm("Delete this expense or loss entry?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await load();
  }

  return (
    <AppShell
      title="Expenses & Losses"
      subtitle="Categorize operating costs, COGS, and inventory losses"
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title={editingId ? "Edit entry" : "New entry"}>
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
              {loading ? "Saving…" : editingId ? "Update entry" : "Save entry"}
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
          <Panel title="Expense & loss ledger">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
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
                      <td className="py-3 pr-3 capitalize">{item.type}</td>
                      <td className="py-3 pr-3 uppercase text-xs">
                        {item.category}
                      </td>
                      <td className="py-3 pr-3">{item.description}</td>
                      <td className="py-3 font-medium text-rose-700">
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
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
