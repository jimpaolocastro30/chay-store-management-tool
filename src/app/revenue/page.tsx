"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button, Input, Panel, Select, TextArea } from "@/components/ui";
import { useProductCategories } from "@/hooks/useProductCategories";
import { formatDatePH, formatPHP, todayInputDate, toInputDate } from "@/lib/utils";

interface Tx {
  _id: string;
  amount: number;
  category?: string;
  description: string;
  date: string;
  paymentMethod?: string;
  reference?: string;
}

const emptyForm = {
  amount: "",
  category: "Tea",
  description: "",
  date: todayInputDate(),
  paymentMethod: "cash",
  reference: "",
};

export default function RevenuePage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";
  const managedCategories = useProductCategories();
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const res = await fetch("/api/transactions?type=revenue");
    setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (editingId || !managedCategories.length) return;
    setForm((current) =>
      managedCategories.includes(current.category)
        ? current
        : { ...current, category: managedCategories[0] }
    );
  }, [managedCategories, editingId]);

  function startEdit(item: Tx) {
    setEditingId(item._id);
    setForm({
      amount: String(item.amount),
      category: item.category || "Tea",
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
      category: form.category,
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

  const formCategories = useMemo(() => {
    if (form.category && !categoryOptions.includes(form.category)) {
      return [...categoryOptions, form.category];
    }
    return categoryOptions;
  }, [categoryOptions, form.category]);

  const total = visibleItems.reduce((a, i) => a + i.amount, 0);

  return (
    <AppShell
      title="Revenue"
      subtitle="Enter daily sales and track collections"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CategoryFilter
          value={category}
          options={categoryOptions}
          onChange={setCategory}
        />
        {isOwner ? (
          <Link
            href="/categories"
            className="text-sm text-violet-800 hover:underline"
          >
            Manage categories
          </Link>
        ) : null}
      </div>
      <div className="grid gap-6 md:grid-cols-5">
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
            <Select
              label="Category"
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {formCategories.map((option) => (
                <option key={option} value={option}>
                  {option}
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

        <div className="md:col-span-3">
          <Panel title="Recent revenue">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Method</th>
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
                        {formatDatePH(item.date)}
                      </td>
                      <td className="py-3 pr-3">{item.category || "—"}</td>
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
              {!visibleItems.length ? (
                <p className="py-8 text-center text-slate-500">
                  {items.length ? "No revenue in this category." : "No revenue yet."}
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
