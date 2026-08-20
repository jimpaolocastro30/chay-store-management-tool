"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button, Input, Panel, Select } from "@/components/ui";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useMountQuery } from "@/hooks/useMountQuery";
import {
  formatPHP,
  hasSpecialPrice,
  unitPriceForSale,
} from "@/lib/utils";

interface CatalogItem {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  sold?: number;
  sellingPrice: number;
  specialPrice?: number;
}

interface CartLine {
  item: CatalogItem;
  quantity: number;
  useSpecial: boolean;
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
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      lineTotal: number;
      usedSpecial?: boolean;
    }>;
    paymentMethod: string;
  } | null>(null);

  async function fetchCatalog(search = q) {
    const res = await fetch(
      `/api/inventory${search ? `?q=${encodeURIComponent(search)}` : ""}`
    );
    if (!res.ok) return [] as CatalogItem[];
    const items: CatalogItem[] = await res.json();
    return items.filter((item) => item.sellingPrice > 0);
  }

  async function load(search = q) {
    setCatalog(await fetchCatalog(search));
  }

  useMountQuery(
    () => fetchCatalog(),
    setCatalog,
    status !== "loading" && isOwner
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!isOwner) {
      router.replace("/");
    }
  }, [status, isOwner, router]);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, line) =>
          sum +
          unitPriceForSale(
            line.item.sellingPrice,
            line.item.specialPrice,
            line.useSpecial
          ) *
            line.quantity,
        0
      ),
    [cart]
  );

  const sellingPriceTotal = useMemo(
    () =>
      cart.reduce(
        (sum, line) => sum + line.item.sellingPrice * line.quantity,
        0
      ),
    [cart]
  );

  const specialSavings = Math.max(0, sellingPriceTotal - total);

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

  function addToCart(item: CatalogItem, useSpecial = false) {
    if (useSpecial && !hasSpecialPrice(item.specialPrice)) return;
    setError("");
    setReceipt(null);
    setCart((current) => {
      const totalForItem = current
        .filter((line) => line.item._id === item._id)
        .reduce((sum, line) => sum + line.quantity, 0);
      if (totalForItem + 1 > item.quantity) return current;

      const existing = current.find(
        (line) => line.item._id === item._id && line.useSpecial === useSpecial
      );
      if (existing) {
        return current.map((line) =>
          line.item._id === item._id && line.useSpecial === useSpecial
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [...current, { item, quantity: 1, useSpecial }];
    });
  }

  function setQty(id: string, useSpecial: boolean, quantity: number) {
    setCart((current) => {
      const target = current.find(
        (line) => line.item._id === id && line.useSpecial === useSpecial
      );
      if (!target) return current;

      const otherQty = current
        .filter(
          (line) =>
            line.item._id === id && line.useSpecial !== useSpecial
        )
        .reduce((sum, line) => sum + line.quantity, 0);
      const next = Math.min(
        Math.max(0, quantity),
        Math.max(0, target.item.quantity - otherQty)
      );

      return current
        .map((line) => {
          if (line.item._id !== id || line.useSpecial !== useSpecial) return line;
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0);
    });
  }

  function toggleSpecial(id: string, useSpecial: boolean) {
    setCart((current) => {
      const line = current.find(
        (row) => row.item._id === id && row.useSpecial === useSpecial
      );
      if (!line || !hasSpecialPrice(line.item.specialPrice)) return current;

      const nextUseSpecial = !useSpecial;
      const other = current.find(
        (row) => row.item._id === id && row.useSpecial === nextUseSpecial
      );

      const without = current.filter(
        (row) => !(row.item._id === id && row.useSpecial === useSpecial)
      );

      if (other) {
        const mergedQty = Math.min(
          line.item.quantity,
          other.quantity + line.quantity
        );
        return without.map((row) =>
          row.item._id === id && row.useSpecial === nextUseSpecial
            ? { ...row, quantity: mergedQty }
            : row
        );
      }

      return [...without, { ...line, useSpecial: nextUseSpecial }];
    });
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
          useSpecial: line.useSpecial,
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
      subtitle="Ring up items at regular or special price, then update stock"
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
              href="/prices"
              className="text-sm text-violet-800 hover:underline"
            >
              Set special prices
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCatalog.map((item) => {
              const inCart = cart
                .filter((line) => line.item._id === item._id)
                .reduce((sum, line) => sum + line.quantity, 0);
              const soldOut = item.quantity <= 0;
              const special = hasSpecialPrice(item.specialPrice);
              return (
                <div
                  key={item._id}
                  className="min-h-[7.5rem] rounded-2xl border border-violet-900/10 bg-white p-4 text-left shadow-sm"
                >
                  <p className="font-medium text-violet-950">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.sku} · {item.category}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="font-[family-name:var(--font-display)] text-xl text-violet-900">
                        {formatPHP(item.sellingPrice)}
                      </p>
                      {special ? (
                        <p className="text-xs font-semibold text-amber-700">
                          Special {formatPHP(item.specialPrice || 0)}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-right text-xs text-slate-500">
                      {soldOut
                        ? "Out of stock"
                        : `${item.quantity} in stock`}
                      {(item.sold || 0) > 0 ? ` · ${item.sold} sold` : ""}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={soldOut || inCart >= item.quantity}
                      onClick={() => addToCart(item, false)}
                    >
                      Add regular
                    </Button>
                    {special ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        disabled={soldOut || inCart >= item.quantity}
                        onClick={() => addToCart(item, true)}
                      >
                        Add special
                      </Button>
                    ) : null}
                  </div>
                </div>
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
                {cart.map((line) => {
                  const price = unitPriceForSale(
                    line.item.sellingPrice,
                    line.item.specialPrice,
                    line.useSpecial
                  );
                  const lineTotal = price * line.quantity;
                  const canToggle = hasSpecialPrice(line.item.specialPrice);
                  return (
                    <div
                      key={`${line.item._id}-${line.useSpecial ? "s" : "r"}`}
                      className="rounded-xl border border-violet-900/10 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-violet-950">
                            {line.item.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatPHP(price)} each
                            {line.useSpecial ? " · special" : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-sm font-semibold text-violet-950">
                            {formatPHP(lineTotal)}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="min-h-11 min-w-11 rounded-xl border border-violet-900/15"
                              onClick={() =>
                                setQty(
                                  line.item._id,
                                  line.useSpecial,
                                  line.quantity - 1
                                )
                              }
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              className="min-h-11 min-w-11 rounded-xl border border-violet-900/15"
                              onClick={() =>
                                setQty(
                                  line.item._id,
                                  line.useSpecial,
                                  line.quantity + 1
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      {canToggle ? (
                        <button
                          type="button"
                          className="mt-2 text-xs font-medium text-amber-800 hover:underline"
                          onClick={() =>
                            toggleSpecial(line.item._id, line.useSpecial)
                          }
                        >
                          {line.useSpecial
                            ? "Switch to regular price"
                            : `Use special ${formatPHP(line.item.specialPrice || 0)}`}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {!cart.length ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Tap a product to add it to the cart.
                  </p>
                ) : null}
              </div>

              <div className="mt-4 space-y-3 border-t border-violet-900/10 pt-4">
                <div className="space-y-2 text-sm">
                  <p className="flex items-center justify-between text-slate-600">
                    <span>Selling price</span>
                    <span>{formatPHP(sellingPriceTotal)}</span>
                  </p>
                  {specialSavings > 0 ? (
                    <p className="flex items-center justify-between text-amber-800">
                      <span>Special discount</span>
                      <span>−{formatPHP(specialSavings)}</span>
                    </p>
                  ) : null}
                </div>
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
                      <li
                        key={`${row.sku}-${row.usedSpecial ? "s" : "r"}`}
                        className="flex justify-between"
                      >
                        <span>
                          {row.name} × {row.quantity}
                          {row.usedSpecial ? " (special)" : ""}
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
