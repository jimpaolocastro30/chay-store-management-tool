"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button, Input, Panel, Select } from "@/components/ui";
import { useProductCategories } from "@/hooks/useProductCategories";
import { formatPHP } from "@/lib/utils";

interface CatalogItem {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  sold?: number;
  sellingPrice: number;
}

interface CartLine {
  item: CatalogItem;
  quantity: number;
}

export default function PosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isOwner = session?.user?.role === "owner";
  const managedCategories = useProductCategories();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    total: number;
    items: Array<{ sku: string; name: string; quantity: number; lineTotal: number }>;
    paymentMethod: string;
  } | null>(null);

  async function load(search = q) {
    const res = await fetch(
      `/api/inventory${search ? `?q=${encodeURIComponent(search)}` : ""}`
    );
    if (!res.ok) return;
    const items: CatalogItem[] = await res.json();
    setCatalog(items.filter((item) => item.sellingPrice > 0));
  }

  useEffect(() => {
    if (status === "loading") return;
    if (!isOwner) {
      router.replace("/");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isOwner]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.item.sellingPrice * line.quantity, 0),
    [cart]
  );

  const categoryOptions = useMemo(() => {
    const extra = catalog
      .map((item) => item.category)
      .filter((value) => value && !managedCategories.includes(value));
    return [...managedCategories, ...Array.from(new Set(extra))];
  }, [catalog, managedCategories]);

  const visibleCatalog = useMemo(
    () => (category ? catalog.filter((item) => item.category === category) : catalog),
    [catalog, category]
  );

  function addToCart(item: CatalogItem) {
    setError("");
    setReceipt(null);
    setCart((current) => {
      const existing = current.find((line) => line.item._id === item._id);
      const nextQty = (existing?.quantity || 0) + 1;
      if (nextQty > item.quantity) return current;
      if (existing) {
        return current.map((line) =>
          line.item._id === item._id ? { ...line, quantity: nextQty } : line
        );
      }
      return [...current, { item, quantity: 1 }];
    });
  }

  function setQty(id: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.item._id !== id) return line;
          const next = Math.min(line.item.quantity, Math.max(0, quantity));
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0)
    );
  }

  async function checkout() {
    if (!cart.length) return;
    setCheckingOut(true);
    setError("");
    const res = await fetch("/api/pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod,
        reference: reference || undefined,
        lines: cart.map((line) => ({
          itemId: line.item._id,
          quantity: line.quantity,
        })),
      }),
    });
    const data = await res.json();
    setCheckingOut(false);
    if (!res.ok) {
      setError(data.error || "Checkout failed");
      await load();
      return;
    }
    setReceipt({
      total: data.total,
      items: data.items,
      paymentMethod: data.paymentMethod,
    });
    setCart([]);
    setReference("");
    await load();
  }

  if (!isOwner) {
    return (
      <AppShell title="POS" subtitle="Owner access only">
        <p className="text-sm text-slate-600">Redirecting…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Point of sale"
      subtitle="Ring up items, collect payment, and update stock"
    >
      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Search products"
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <CategoryFilter
              value={category}
              options={categoryOptions}
              onChange={setCategory}
            />
            <Link
              href="/categories"
              className="text-sm text-violet-800 hover:underline"
            >
              Manage categories
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCatalog.map((item) => {
              const inCart =
                cart.find((line) => line.item._id === item._id)?.quantity || 0;
              const soldOut = item.quantity <= 0;
              return (
                <button
                  key={item._id}
                  type="button"
                  disabled={soldOut || inCart >= item.quantity}
                  onClick={() => addToCart(item)}
                  className="min-h-[7.5rem] rounded-2xl border border-violet-900/10 bg-white p-4 text-left shadow-sm transition hover:border-violet-700/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="font-medium text-violet-950">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.sku} · {item.category}
                  </p>
                  <div className="mt-3 flex items-end justify-between">
                    <p className="font-[family-name:var(--font-display)] text-xl text-violet-900">
                      {formatPHP(item.sellingPrice)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {soldOut
                        ? "Out of stock"
                        : `${item.quantity} in stock`}
                      {(item.sold || 0) > 0 ? ` · ${item.sold} sold` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {!visibleCatalog.length ? (
            <p className="rounded-2xl border border-violet-900/10 bg-white p-8 text-center text-slate-500">
              {catalog.length
                ? "No items in this category."
                : "No sellable items. Set a selling price in Prices first."}
            </p>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <div className="md:sticky md:top-24">
          <Panel
            title="Cart"
            action={
              cart.length ? (
                <button
                  type="button"
                  className="text-sm text-violet-800 hover:underline"
                  onClick={() => setCart([])}
                >
                  Clear
                </button>
              ) : null
            }
          >
            <div className="space-y-3">
              {cart.map((line) => (
                <div
                  key={line.item._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-violet-900/10 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-violet-950">
                      {line.item.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatPHP(line.item.sellingPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="min-h-11 min-w-11 rounded-xl border border-violet-900/15"
                      onClick={() => setQty(line.item._id, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="min-h-11 min-w-11 rounded-xl border border-violet-900/15"
                      onClick={() => setQty(line.item._id, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              {!cart.length ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Tap a product to add it to the cart.
                </p>
              ) : null}
            </div>

            <div className="mt-4 space-y-3 border-t border-violet-900/10 pt-4">
              <p className="flex items-center justify-between font-[family-name:var(--font-display)] text-2xl text-violet-950">
                <span>Total</span>
                <span>{formatPHP(total)}</span>
              </p>
              <Select
                label="Payment method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
                <option value="card">Card</option>
                <option value="bank">Bank transfer</option>
              </Select>
              <Input
                label="Reference (optional)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              {error ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
              <Button
                type="button"
                className="w-full"
                disabled={!cart.length || checkingOut}
                onClick={checkout}
              >
                {checkingOut ? "Processing…" : "Complete sale"}
              </Button>
            </div>
          </Panel>

          {receipt ? (
            <div className="mt-4">
              <Panel title="Last sale">
                <p className="text-sm text-slate-600">
                  Paid with {receipt.paymentMethod}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {receipt.items.map((row) => (
                    <li key={row.sku} className="flex justify-between">
                      <span>
                        {row.name} × {row.quantity}
                      </span>
                      <span>{formatPHP(row.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between font-semibold text-violet-950">
                  <span>Total</span>
                  <span>{formatPHP(receipt.total)}</span>
                </p>
              </Panel>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
