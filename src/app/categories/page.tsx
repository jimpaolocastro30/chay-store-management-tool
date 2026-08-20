"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel } from "@/components/ui";
import { useMountQuery } from "@/hooks/useMountQuery";

interface CategoryItem {
  _id: string;
  name: string;
  sortOrder: number;
  itemCount: number;
}

const empty = {
  name: "",
  sortOrder: "",
};

export default function CategoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isOwner = session?.user?.role === "owner";
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchItems() {
    const res = await fetch("/api/categories");
    if (!res.ok) return [] as CategoryItem[];
    return res.json() as Promise<CategoryItem[]>;
  }

  async function load() {
    setItems(await fetchItems());
  }

  useMountQuery(
    fetchItems,
    setItems,
    status !== "loading" && isOwner
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!isOwner) {
      router.replace("/");
    }
  }, [status, isOwner, router]);

  function startEdit(item: CategoryItem) {
    setEditingId(item._id);
    setError("");
    setForm({
      name: item.name,
      sortOrder: String(item.sortOrder),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      ...(form.sortOrder === "" ? {} : { sortOrder: Number(form.sortOrder) }),
    };

    const res = editingId
      ? await fetch(`/api/categories/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not save category");
      return;
    }
    cancelEdit();
    await load();
  }

  async function remove(item: CategoryItem) {
    if (!confirm(`Delete category “${item.name}”?`)) return;
    setError("");
    const res = await fetch(`/api/categories/${item._id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not delete category");
      return;
    }
    if (editingId === item._id) cancelEdit();
    await load();
  }

  if (!isOwner) {
    return (
      <AppShell title="Categories" subtitle="Owner access only">
        <p className="text-sm text-slate-600">Redirecting…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Categories"
      subtitle="Manage product categories used on POS, inventory, and sales"
    >
      <div className="grid gap-6 md:grid-cols-5">
        <Panel title={editingId ? "Edit category" : "Add category"}>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Name"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Sort order (optional)"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
            {error ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? "Saving…"
                : editingId
                  ? "Update category"
                  : "Add category"}
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
          <Panel title="Product categories">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Items</th>
                    <th className="py-2 pr-3 font-medium">Order</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-b border-violet-900/5">
                      <td className="py-3 pr-3 font-medium text-violet-950">
                        {item.name}
                      </td>
                      <td className="py-3 pr-3">{item.itemCount}</td>
                      <td className="py-3 pr-3">{item.sortOrder}</td>
                      <td className="py-3">
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
                            onClick={() => remove(item)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length ? (
                <p className="py-8 text-center text-slate-500">
                  No categories yet.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
