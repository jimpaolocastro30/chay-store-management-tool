"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button, Input, Panel, Select } from "@/components/ui";
import { useProductCategories } from "@/hooks/useProductCategories";
import { formatPHP } from "@/lib/utils";

interface Item {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  sellingPrice: number;
  location?: string;
}

const empty = {
  sku: "",
  name: "",
  category: "Tea",
  quantity: "0",
  reorderLevel: "5",
  unitCost: "",
  sellingPrice: "",
  location: "Main Store",
};

export default function InventoryPage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";
  const managedCategories = useProductCategories();
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function load(search = q) {
    const res = await fetch(
      `/api/inventory${search ? `?q=${encodeURIComponent(search)}` : ""}`
    );
    setItems(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editingId || !managedCategories.length) return;
    setForm((current) =>
      managedCategories.includes(current.category)
        ? current
        : { ...current, category: managedCategories[0] }
    );
  }, [managedCategories, editingId]);

  function startEdit(item: Item) {
    setEditingId(item._id);
    setForm({
      sku: item.sku,
      name: item.name,
      category: item.category,
      quantity: String(item.quantity),
      reorderLevel: String(item.reorderLevel),
      unitCost: String(item.unitCost),
      sellingPrice: String(item.sellingPrice),
      location: item.location || "Main Store",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      sku: form.sku,
      name: form.name,
      category: form.category,
      quantity: Number(form.quantity),
      reorderLevel: Number(form.reorderLevel),
      unitCost: Number(form.unitCost),
      sellingPrice: Number(form.sellingPrice),
      location: form.location,
    };

    const res = editingId
      ? await fetch(`/api/inventory/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setLoading(false);
    if (!res.ok) return;
    cancelEdit();
    await load();
  }

  async function adjustQty(id: string, quantity: number) {
    await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this inventory item?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await load();
  }

  const categoryOptions = useMemo(() => {
    const extra = items
      .map((item) => item.category)
      .filter((value) => value && !managedCategories.includes(value));
    return [...managedCategories, ...Array.from(new Set(extra))];
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

  async function onImport(file: File) {
    setImporting(true);
    const body = new FormData();
    body.append("file", file);
    body.append("kind", "inventory");
    await fetch("/api/import", { method: "POST", body });
    setImporting(false);
    await load();
  }

  return (
    <AppShell
      title="Inventory"
      subtitle="SKU management, stock levels, and reorder alerts"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Search SKU / name / category"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load(q);
            }}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => load(q)}>
          Search
        </Button>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-violet-900/15 bg-white px-4 py-2.5 text-sm font-medium text-violet-900">
          {importing ? "Importing…" : "Import CSV/XLSX"}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
            }}
          />
        </label>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title={editingId ? "Edit item" : "Add item"}>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="SKU"
              required
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Qty"
                type="number"
                min="0"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <Input
                label="Reorder at"
                type="number"
                min="0"
                required
                value={form.reorderLevel}
                onChange={(e) =>
                  setForm({ ...form, reorderLevel: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Unit cost"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              />
              <Input
                label="Sell price"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.sellingPrice}
                onChange={(e) =>
                  setForm({ ...form, sellingPrice: e.target.value })
                }
              />
            </div>
            <Input
              label="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? "Saving…"
                : editingId
                  ? "Update item"
                  : "Add inventory item"}
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
          <Panel title="Stock list">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 pr-3 font-medium">Qty</th>
                    <th className="py-2 pr-3 font-medium">Value</th>
                    <th className="py-2 font-medium">Adjust</th>
                    {isOwner ? (
                      <th className="py-2 pl-3 font-medium">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const low = item.quantity <= item.reorderLevel;
                    return (
                      <tr key={item._id} className="border-b border-violet-900/5">
                        <td className="py-3 pr-3">
                          <p className="font-medium text-violet-950">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.sku} · {item.category}
                          </p>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={
                              low
                                ? "rounded-lg bg-amber-100 px-2 py-1 text-amber-900"
                                : ""
                            }
                          >
                            {item.quantity}
                          </span>
                          <p className="text-[11px] text-slate-500">
                            reorder {item.reorderLevel}
                          </p>
                        </td>
                        <td className="py-3 pr-3">
                          {formatPHP(item.quantity * item.unitCost)}
                          <p className="text-[11px] text-slate-500">
                            sell {formatPHP(item.sellingPrice)}
                          </p>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <button
                              className="rounded-lg border border-violet-900/15 px-2 py-1"
                              onClick={() =>
                                adjustQty(item._id, Math.max(0, item.quantity - 1))
                              }
                            >
                              −
                            </button>
                            <button
                              className="rounded-lg border border-violet-900/15 px-2 py-1"
                              onClick={() =>
                                adjustQty(item._id, item.quantity + 1)
                              }
                            >
                              +
                            </button>
                          </div>
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
                    );
                  })}
                </tbody>
              </table>
              {!visibleItems.length ? (
                <p className="py-8 text-center text-slate-500">
                  {items.length
                    ? "No items in this category."
                    : "No inventory items yet."}
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
