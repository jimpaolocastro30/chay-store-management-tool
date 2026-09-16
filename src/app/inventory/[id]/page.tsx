"use client";

import { FormEvent, use, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, StatCard, TextArea } from "@/components/ui";
import { useMountQuery } from "@/hooks/useMountQuery";
import { formatDatePH, formatDateTimePH, formatPHP } from "@/lib/utils";
import { ADJUSTMENT_REASONS } from "@/types/inventory";

interface Batch {
  _id: string;
  inventoryId: string;
  batchNumber: string;
  receivedQuantity: number;
  soldQuantity: number;
  adjustmentQuantity: number;
  writeOffQuantity: number;
  currentQuantity: number;
  unitCost: number;
  expiryDate?: string;
  receivedAt: string;
  lastUpdatedAt: string;
  depletedAt?: string;
  lastCountedAt?: string;
  supplier?: string;
  status: string;
}

interface LedgerRow {
  _id: string;
  transactionType: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  transactionDate: string;
  remarks?: string;
  reason?: string;
  referenceId?: string;
}

interface Product {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  sold: number;
  reorderLevel: number;
  unitCost: number;
  sellingPrice: number;
  inventoryStatus?: string;
}

export default function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [physical, setPhysical] = useState("");
  const [reason, setReason] = useState<(typeof ADJUSTMENT_REASONS)[number]>(
    "Counting Error"
  );
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchDetail() {
    const res = await fetch(`/api/inventory/${id}`);
    if (!res.ok) return { product: null, batches: [], ledger: [] };
    const data = await res.json();
    return {
      product: data.item as Product,
      batches: (data.batches || []) as Batch[],
      ledger: (data.ledger || []) as LedgerRow[],
    };
  }

  useMountQuery(fetchDetail, (data) => {
    setProduct(data.product);
    setBatches(data.batches);
    setLedger(data.ledger);
  });

  async function reload() {
    const data = await fetchDetail();
    setProduct(data.product);
    setBatches(data.batches);
    setLedger(data.ledger);
  }

  async function onAdjust(e: FormEvent) {
    e.preventDefault();
    if (!adjusting) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: adjusting,
        physicalQuantity: Number(physical),
        reason,
        remarks: remarks || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Adjustment failed");
      return;
    }
    setAdjusting(null);
    setPhysical("");
    setRemarks("");
    await reload();
  }

  if (!product) {
    return (
      <AppShell title="Inventory" subtitle="Loading product…">
        <p className="text-sm text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={product.name}
      subtitle={`${product.sku} · ${product.category}`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/inventory">
          <Button type="button" variant="secondary">
            Back to inventory
          </Button>
        </Link>
        <Link href={`/inventory/receive?productId=${product._id}`}>
          <Button type="button">Receive stock</Button>
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current stock" value={String(product.quantity)} />
        <StatCard
          label="Received / sold"
          value={`${batches.reduce((s, b) => s + b.receivedQuantity, 0)} / ${product.sold}`}
        />
        <StatCard
          label="Stock value"
          value={formatPHP(product.quantity * product.unitCost)}
        />
        <StatCard
          label="Status"
          value={(product.inventoryStatus || "AVAILABLE").replaceAll("_", " ")}
          tone={
            product.quantity <= 0
              ? "bad"
              : product.quantity <= product.reorderLevel
                ? "warn"
                : "good"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Panel title="Batches">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Batch</th>
                    <th className="py-2 pr-3 font-medium">Expiry</th>
                    <th className="py-2 pr-3 font-medium">Received</th>
                    <th className="py-2 pr-3 font-medium">Sold</th>
                    <th className="py-2 pr-3 font-medium">Adj</th>
                    <th className="py-2 pr-3 font-medium">On hand</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch._id}
                      className="border-b border-violet-900/5"
                    >
                      <td className="py-3 pr-3">
                        <p className="font-medium text-violet-950">
                          {batch.batchNumber}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {batch.inventoryId}
                          {batch.supplier ? ` · ${batch.supplier}` : ""}
                        </p>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {batch.expiryDate
                          ? formatDatePH(batch.expiryDate)
                          : "—"}
                      </td>
                      <td className="py-3 pr-3">{batch.receivedQuantity}</td>
                      <td className="py-3 pr-3">{batch.soldQuantity}</td>
                      <td className="py-3 pr-3">{batch.adjustmentQuantity}</td>
                      <td className="py-3 pr-3 font-semibold">
                        {batch.currentQuantity}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase">
                            {batch.status.replaceAll("_", " ")}
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => {
                              setAdjusting(batch._id);
                              setPhysical(String(batch.currentQuantity));
                            }}
                          >
                            Adjust
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!batches.length ? (
                <p className="py-8 text-center text-slate-500">
                  No batches yet. Receive stock to create the first lot.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-2">
          {adjusting ? (
            <Panel title="Inventory adjustment">
              <form onSubmit={onAdjust} className="space-y-3">
                <p className="text-sm text-slate-600">
                  Physical counts never overwrite history. A ledger transaction
                  is posted for the variance.
                </p>
                <Input
                  label="Physical quantity"
                  type="number"
                  min="0"
                  required
                  value={physical}
                  onChange={(e) => setPhysical(e.target.value)}
                />
                <Select
                  label="Reason"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value as (typeof ADJUSTMENT_REASONS)[number])
                  }
                >
                  {ADJUSTMENT_REASONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
                <TextArea
                  label="Remarks"
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                {error ? (
                  <p className="text-sm text-rose-700">{error}</p>
                ) : null}
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? "Posting…" : "Post adjustment"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setAdjusting(null)}
                >
                  Cancel
                </Button>
              </form>
            </Panel>
          ) : (
            <Panel title="Timestamps">
              {batches[0] ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Received</dt>
                    <dd>{formatDatePH(batches[0].receivedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Last updated</dt>
                    <dd>{formatDateTimePH(batches[0].lastUpdatedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Last counted</dt>
                    <dd>
                      {batches[0].lastCountedAt
                        ? formatDatePH(batches[0].lastCountedAt)
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Depleted</dt>
                    <dd>
                      {batches[0].depletedAt
                        ? formatDateTimePH(batches[0].depletedAt)
                        : "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">No batch timestamps yet.</p>
              )}
            </Panel>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Panel title="Inventory ledger">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-violet-900/10 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Before</th>
                  <th className="py-2 pr-3 font-medium">After</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row._id} className="border-b border-violet-900/5">
                    <td className="py-3 pr-3 whitespace-nowrap text-slate-600">
                      {formatDateTimePH(row.transactionDate)}
                    </td>
                    <td className="py-3 pr-3 font-medium text-violet-950">
                      {row.transactionType.replaceAll("_", " ")}
                    </td>
                    <td
                      className={`py-3 pr-3 tabular-nums font-semibold ${
                        row.quantity < 0 ? "text-rose-700" : "text-emerald-800"
                      }`}
                    >
                      {row.quantity > 0 ? "+" : ""}
                      {row.quantity}
                    </td>
                    <td className="py-3 pr-3">{row.quantityBefore}</td>
                    <td className="py-3 pr-3">{row.quantityAfter}</td>
                    <td className="py-3 text-slate-600">
                      {[row.reason, row.remarks, row.referenceId]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ledger.length ? (
              <p className="py-8 text-center text-slate-500">
                No inventory movements yet.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
