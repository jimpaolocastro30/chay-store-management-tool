"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, TextArea } from "@/components/ui";
import { useMountQuery } from "@/hooks/useMountQuery";
import { todayInputDate } from "@/lib/utils";

interface Product {
  _id: string;
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  location?: string;
}

export default function ReceiveStockPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Receive stock" subtitle="Loading…">
          <p className="text-sm text-slate-500">Loading…</p>
        </AppShell>
      }
    >
      <ReceiveStockForm />
    </Suspense>
  );
}

function ReceiveStockForm() {
  const search = useSearchParams();
  const presetId = search.get("productId") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({
    productId: presetId,
    batchNumber: "",
    quantity: "",
    unitCost: "",
    expiryDate: "",
    manufacturingDate: "",
    receivedAt: todayInputDate(),
    supplier: "",
    warehouse: "Main Store",
    location: "",
    purchaseOrder: "",
    deliveryReceipt: "",
    remarks: "",
  });

  useMountQuery(async () => {
    const res = await fetch("/api/inventory");
    const data = await res.json();
    return Array.isArray(data) ? (data as Product[]) : [];
  }, (items) => {
    setProducts(items);
    const preset = items.find((item) => item._id === presetId);
    if (preset) {
      setForm((current) => ({
        ...current,
        productId: preset._id,
        unitCost: String(preset.unitCost || ""),
        location: preset.location || "",
      }));
    }
  });

  const selected = useMemo(
    () => products.find((item) => item._id === form.productId),
    [products, form.productId]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    const res = await fetch("/api/inventory/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: form.productId,
        batchNumber: form.batchNumber,
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost),
        expiryDate: form.expiryDate || undefined,
        manufacturingDate: form.manufacturingDate || undefined,
        receivedAt: form.receivedAt || undefined,
        supplier: form.supplier || undefined,
        warehouse: form.warehouse || undefined,
        location: form.location || undefined,
        purchaseOrder: form.purchaseOrder || undefined,
        deliveryReceipt: form.deliveryReceipt || undefined,
        remarks: form.remarks || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Receive failed");
      return;
    }
    setOk(`Received batch ${form.batchNumber.toUpperCase()} for ${selected?.sku}.`);
    setForm((current) => ({
      ...current,
      batchNumber: "",
      quantity: "",
      remarks: "",
    }));
  }

  return (
    <AppShell
      title="Receive stock"
      subtitle="Create an inventory batch with lot, cost, and expiry — posted to the ledger"
    >
      <div className="mb-4">
        <Link href="/inventory" className="text-sm text-violet-800 hover:underline">
          Back to inventory
        </Link>
      </div>
      <div className="max-w-2xl">
        <Panel title="New inventory batch">
          <form onSubmit={onSubmit} className="space-y-3">
            <Select
              label="Product"
              required
              value={form.productId}
              onChange={(e) => {
                const next = products.find((item) => item._id === e.target.value);
                setForm({
                  ...form,
                  productId: e.target.value,
                  unitCost: next ? String(next.unitCost) : form.unitCost,
                  location: next?.location || form.location,
                });
              }}
            >
              <option value="">Select product</option>
              {products.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </Select>
            <Input
              label="Batch / lot number"
              required
              value={form.batchNumber}
              onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
              placeholder="B20260915"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Received quantity"
                type="number"
                min="1"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <Input
                label="Unit cost (PHP)"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Received date"
                type="date"
                required
                value={form.receivedAt}
                onChange={(e) => setForm({ ...form, receivedAt: e.target.value })}
              />
              <Input
                label="Expiry date"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </div>
            <Input
              label="Manufacturing date"
              type="date"
              value={form.manufacturingDate}
              onChange={(e) =>
                setForm({ ...form, manufacturingDate: e.target.value })
              }
            />
            <Input
              label="Supplier"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Warehouse"
                value={form.warehouse}
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
              />
              <Input
                label="Storage location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Purchase order"
                value={form.purchaseOrder}
                onChange={(e) =>
                  setForm({ ...form, purchaseOrder: e.target.value })
                }
              />
              <Input
                label="Delivery receipt"
                value={form.deliveryReceipt}
                onChange={(e) =>
                  setForm({ ...form, deliveryReceipt: e.target.value })
                }
              />
            </div>
            <TextArea
              label="Remarks"
              rows={3}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {ok ? <p className="text-sm text-emerald-800">{ok}</p> : null}
            <Button type="submit" disabled={saving || !form.productId} className="w-full">
              {saving ? "Posting…" : "Post receiving"}
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
