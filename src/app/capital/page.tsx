"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, TextArea } from "@/components/ui";
import { formatDatePH, formatPHP, todayInputDate, toInputDate } from "@/lib/utils";

interface Entry {
  _id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
}

const emptyForm = {
  type: "investment",
  amount: "",
  description: "",
  date: todayInputDate(),
};

export default function CapitalPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const res = await fetch("/api/capital");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(item: Entry) {
    setEditingId(item._id);
    setForm({
      type: item.type,
      amount: String(item.amount),
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
      ...form,
      amount: Number(form.amount),
    };

    const res = editingId
      ? await fetch(`/api/capital/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/capital", {
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
    if (!confirm("Delete this capital entry?")) return;
    await fetch(`/api/capital/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await load();
  }

  const invested = items
    .filter((i) => i.type === "initial" || i.type === "investment")
    .reduce((a, i) => a + i.amount, 0);
  const withdrawn = items
    .filter((i) => i.type === "withdrawal")
    .reduce((a, i) => a + i.amount, 0);

  return (
    <AppShell
      title="Capital"
      subtitle="Track initial capital, investments, and withdrawals"
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Panel title="Invested">
          <p className="font-[family-name:var(--font-display)] text-3xl text-violet-950">
            {formatPHP(invested)}
          </p>
        </Panel>
        <Panel title="Withdrawn">
          <p className="font-[family-name:var(--font-display)] text-3xl text-rose-700">
            {formatPHP(withdrawn)}
          </p>
        </Panel>
        <Panel title="Net capital">
          <p className="font-[family-name:var(--font-display)] text-3xl text-emerald-800">
            {formatPHP(invested - withdrawn)}
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <Panel
          title={editingId ? "Edit capital movement" : "Record capital movement"}
        >
          <form onSubmit={onSubmit} className="space-y-3">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="initial">Initial capital</option>
              <option value="investment">Additional investment</option>
              <option value="withdrawal">Withdrawal</option>
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

        <div className="md:col-span-3">
          <Panel title="Capital ledger">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 pl-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-b border-violet-900/5">
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {formatDatePH(item.date)}
                      </td>
                      <td className="py-3 pr-3 capitalize">{item.type}</td>
                      <td className="py-3 pr-3">{item.description}</td>
                      <td className="py-3 font-medium">
                        {formatPHP(item.amount)}
                      </td>
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
