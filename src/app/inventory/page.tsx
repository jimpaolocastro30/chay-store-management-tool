"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button, Input, Panel, Select } from "@/components/ui";
import { useProductCategories } from "@/hooks/useProductCategories";
import { resolveCategory, useMountQuery } from "@/hooks/useMountQuery";
import { formatPHP } from "@/lib/utils";

interface Item {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  sold: number;
  reorderLevel: number;
  unitCost: number;
  sellingPrice: number;
  specialPrice?: number;
  location?: string;
  inventoryStatus?: string;
}

const empty = {
  sku: "",
  name: "",
  category: "Tea",
  quantity: "0",
  reorderLevel: "5",
  unitCost: "",
  sellingPrice: "",
  specialPrice: "0",
  location: "Main Store",
};

function StatusBadge({ status, low }: { status?: string; low: boolean }) {
  const value = status || (low ? "LOW_STOCK" : "AVAILABLE");
  const styles: Record<string, string> = {
    AVAILABLE: "bg-emerald-100 text-emerald-900",
    LOW_STOCK: "bg-amber-100 text-amber-900",
    OUT_OF_STOCK: "bg-slate-200 text-slate-700",
    DEPLETED: "bg-slate-200 text-slate-700",
    EXPIRED: "bg-rose-100 text-rose-900",
    BLOCKED: "bg-violet-100 text-violet-900",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
        styles[value] || "bg-slate-100 text-slate-700"
      }`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

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
  const [formOpen, setFormOpen] = useState(false);

  async function fetchItems(search = q) {
    const res = await fetch(
      `/api/inventory${search ? `?q=${encodeURIComponent(search)}` : ""}`
    );
    const data = await res.json();
    return Array.isArray(data) ? (data as Item[]) : [];
  }

  async function load(search = q) {
    setItems(await fetchItems(search));
  }

  useMountQuery(() => fetchItems(), setItems);

  function startEdit(item: Item) {
    setEditingId(item._id);
    setFormOpen(true);
    setForm({
      sku: item.sku,
      name: item.name,
      category: item.category,
      quantity: String(item.quantity),
      reorderLevel: String(item.reorderLevel),
      unitCost: String(item.unitCost),
      sellingPrice: String(item.sellingPrice),
      specialPrice: String(item.specialPrice || 0),
      location: item.location || "Main Store",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
    setFormOpen(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload: Record<string, unknown> = {
      sku: form.sku,
      name: form.name,
      category: resolveCategory(
        form.category,
        managedCategories,
        Boolean(editingId)
      ),
      reorderLevel: Number(form.reorderLevel),
      unitCost: Number(form.unitCost),
      sellingPrice: Number(form.sellingPrice),
      specialPrice: Number(form.specialPrice || 0),
      location: form.location,
    };
    if (!editingId) {
      payload.quantity = Number(form.quantity);
      payload.sold = 0;
    }

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
    () =>
      category ? items.filter((item) => item.category === category) : items,
    [items, category]
  );

  const formCategory = resolveCategory(
    form.category,
    managedCategories,
    Boolean(editingId)
  );

  const formCategories = useMemo(() => {
    if (formCategory && !categoryOptions.includes(formCategory)) {
      return [...categoryOptions, formCategory];
    }
    return categoryOptions;
  }, [categoryOptions, formCategory]);

  const totalSold = visibleItems.reduce((sum, item) => sum + (item.sold || 0), 0);
  const totalOnHand = visibleItems.reduce((sum, item) => sum + item.quantity, 0);

  async function onImport(file: File) {
    setImporting(true);
    const body = new FormData();
    body.append("file", file);
    body.append("kind", "inventory");
    await fetch("/api/import", { method: "POST", body });
    setImporting(false);
    await load();
  }

  const formPanel = (
    <Panel title={editingId ? "Edit product" : "Add product"}>
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
          value={formCategory}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {formCategories.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          {!editingId ? (
            <Input
              label="Opening qty"
              type="number"
              min="0"
              required
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          ) : null}
          <Input
            label="Reorder at"
            type="number"
            min="0"
            required
            value={form.reorderLevel}
            onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
          />
        </div>
        <p className="text-xs text-slate-500">
          Stock on hand is updated by receiving, POS sales, and stock counts —
          not by overwriting quantity.
        </p>
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
            onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
          />
        </div>
        <Input
          label="Special price (0 = none)"
          type="number"
          min="0"
          step="0.01"
          value={form.specialPrice}
          onChange={(e) => setForm({ ...form, specialPrice: e.target.value })}
        />
        <Input
          label="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? "Saving…"
            : editingId
              ? "Update product"
              : "Add product"}
        </Button>
        {editingId || formOpen ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={cancelEdit}
          >
            Cancel
          </Button>
        ) : null}
      </form>
    </Panel>
  );

  return (
    <AppShell
      title="Inventory"
      subtitle="Batches, stock counts, and an auditable movement ledger"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-violet-900/10 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            On hand
          </p>
          <p className="font-[family-name:var(--font-display)] text-2xl text-violet-950">
            {totalOnHand}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-emerald-800">
            Sold
          </p>
          <p className="font-[family-name:var(--font-display)] text-2xl text-emerald-900">
            {totalSold}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/inventory/receive">
          <Button type="button">Receive stock</Button>
        </Link>
        <Link href="/inventory/count">
          <Button type="button" variant="secondary">
            Stock count
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
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
        <div className="grid grid-cols-2 gap-3 md:flex">
          <Button type="button" variant="secondary" onClick={() => load(q)}>
            Search
          </Button>
          <Button
            type="button"
            className="lg:hidden"
            onClick={() => setFormOpen((open) => !open)}
          >
            {formOpen || editingId ? "Hide form" : "Add item"}
          </Button>
          <label className="col-span-2 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-violet-900/15 bg-white px-4 py-2.5 text-sm font-medium text-violet-900 md:col-span-1">
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
            className="inline-flex min-h-11 items-center text-sm text-violet-800 hover:underline"
          >
            Manage categories
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div
          className={`${
            formOpen || editingId ? "block" : "hidden"
          } lg:col-span-2 lg:block`}
        >
          {formPanel}
        </div>

        <div className="lg:col-span-3">
          <Panel title="Stock list">
            <div className="space-y-3 lg:hidden">
              {visibleItems.map((item) => {
                const low = item.quantity <= item.reorderLevel;
                return (
                  <article
                    key={item._id}
                    className="rounded-2xl border border-violet-900/10 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-violet-950">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          {item.sku} · {item.category}
                        </p>
                      </div>
                      <StatusBadge status={item.inventoryStatus} low={low} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <p className={low ? "font-semibold text-amber-800" : ""}>
                        On hand {item.quantity}
                        <span className="block text-[11px] font-normal text-slate-500">
                          sold {item.sold || 0} · reorder {item.reorderLevel}
                        </span>
                      </p>
                      <p>
                        {formatPHP(item.quantity * item.unitCost)}
                        <span className="block text-[11px] text-slate-500">
                          sell {formatPHP(item.sellingPrice)}
                        </span>
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/inventory/${item._id}`}>
                        <Button type="button" variant="secondary">
                          View / history
                        </Button>
                      </Link>
                      {isOwner ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => remove(item._id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 pr-3 font-medium">On hand</th>
                    <th className="py-2 pr-3 font-medium">Sold</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const low = item.quantity <= item.reorderLevel;
                    return (
                      <tr
                        key={item._id}
                        className="border-b border-violet-900/5"
                      >
                        <td className="py-3 pr-3">
                          <p className="font-medium text-violet-950">
                            {item.name}
                          </p>
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
                        </td>
                        <td className="py-3 pr-3">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                            {item.sold || 0}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <StatusBadge
                            status={item.inventoryStatus}
                            low={low}
                          />
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/inventory/${item._id}`}>
                              <Button
                                type="button"
                                variant="secondary"
                                className="px-3 py-1.5 text-xs"
                              >
                                View
                              </Button>
                            </Link>
                            {isOwner ? (
                              <>
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
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!visibleItems.length ? (
              <p className="py-8 text-center text-slate-500">
                {items.length
                  ? "No items in this category."
                  : "No inventory items yet."}
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
