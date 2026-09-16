"use client";

import { FormEvent, use, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select } from "@/components/ui";
import { useMountQuery } from "@/hooks/useMountQuery";
import { ADJUSTMENT_REASONS } from "@/types/inventory";

interface CountItem {
  _id?: string;
  inventoryBatchId: string;
  sku: string;
  name: string;
  batchNumber: string;
  systemQuantity: number;
  physicalQuantity?: number;
  varianceQuantity?: number;
  reason?: string;
  remarks?: string;
}

interface CountDoc {
  _id: string;
  countNumber: string;
  status: string;
  items: CountItem[];
}

export default function StockCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [count, setCount] = useState<CountDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  async function fetchCount() {
    const res = await fetch(`/api/inventory/counts/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as CountDoc;
  }

  useMountQuery(fetchCount, setCount);

  const locked = count?.status === "POSTED";

  function updateItem(batchId: string, patch: Partial<CountItem>) {
    setCount((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          String(item.inventoryBatchId) === String(batchId)
            ? {
                ...item,
                ...patch,
                varianceQuantity:
                  patch.physicalQuantity !== undefined
                    ? patch.physicalQuantity - item.systemQuantity
                    : item.varianceQuantity,
              }
            : item
        ),
      };
    });
  }

  const summary = useMemo(() => {
    const items = count?.items || [];
    const counted = items.filter(
      (item) => item.physicalQuantity !== undefined && item.physicalQuantity !== null
    ).length;
    const variance = items.reduce(
      (sum, item) => sum + (item.varianceQuantity || 0),
      0
    );
    return { counted, total: items.length, variance };
  }, [count]);

  async function saveDraft(e: FormEvent) {
    e.preventDefault();
    if (!count) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/inventory/counts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: count.items
          .filter((item) => item.physicalQuantity !== undefined)
          .map((item) => ({
            inventoryBatchId: String(item.inventoryBatchId),
            physicalQuantity: Number(item.physicalQuantity),
            reason: item.reason,
            remarks: item.remarks,
          })),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setCount(data);
  }

  async function postCount() {
    if (!count) return;
    if (
      !confirm(
        "Post this stock count? Variances will create inventory adjustment transactions."
      )
    ) {
      return;
    }
    setPosting(true);
    setError("");
    await fetch(`/api/inventory/counts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: count.items
          .filter((item) => item.physicalQuantity !== undefined)
          .map((item) => ({
            inventoryBatchId: String(item.inventoryBatchId),
            physicalQuantity: Number(item.physicalQuantity),
            reason: item.reason,
            remarks: item.remarks,
          })),
      }),
    });
    const res = await fetch(`/api/inventory/counts/${id}?action=post`, {
      method: "POST",
    });
    const data = await res.json();
    setPosting(false);
    if (!res.ok) {
      setError(data.error || "Post failed");
      return;
    }
    setCount(data);
  }

  if (!count) {
    return (
      <AppShell title="Stock count" subtitle="Loading…">
        <p className="text-sm text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={count.countNumber}
      subtitle={`Status ${count.status} · ${summary.counted}/${summary.total} counted`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/inventory/count" className="text-sm text-violet-800 hover:underline">
          All counts
        </Link>
        <p className="text-sm text-slate-500">
          Net variance {summary.variance > 0 ? "+" : ""}
          {summary.variance}
        </p>
      </div>

      <Panel title="Physical count">
        <form onSubmit={saveDraft}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-violet-900/10 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 pr-3 font-medium">Batch</th>
                  <th className="py-2 pr-3 font-medium">System</th>
                  <th className="py-2 pr-3 font-medium">Physical</th>
                  <th className="py-2 pr-3 font-medium">Variance</th>
                  <th className="py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {count.items.map((item) => {
                  const physical = item.physicalQuantity;
                  const variance =
                    physical === undefined || physical === null
                      ? null
                      : physical - item.systemQuantity;
                  return (
                    <tr
                      key={String(item.inventoryBatchId)}
                      className="border-b border-violet-900/5"
                    >
                      <td className="py-3 pr-3">
                        <p className="font-medium text-violet-950">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.sku}</p>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">
                        {item.batchNumber}
                      </td>
                      <td className="py-3 pr-3">{item.systemQuantity}</td>
                      <td className="py-3 pr-3">
                        <Input
                          type="number"
                          min="0"
                          disabled={locked}
                          value={
                            physical === undefined || physical === null
                              ? ""
                              : String(physical)
                          }
                          onChange={(e) =>
                            updateItem(String(item.inventoryBatchId), {
                              physicalQuantity:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td
                        className={`py-3 pr-3 font-semibold ${
                          variance === null
                            ? "text-slate-400"
                            : variance < 0
                              ? "text-rose-700"
                              : variance > 0
                                ? "text-emerald-800"
                                : "text-slate-600"
                        }`}
                      >
                        {variance === null
                          ? "—"
                          : `${variance > 0 ? "+" : ""}${variance}`}
                      </td>
                      <td className="py-3 min-w-[12rem]">
                        {variance ? (
                          <Select
                            disabled={locked}
                            value={item.reason || "Counting Error"}
                            onChange={(e) =>
                              updateItem(String(item.inventoryBatchId), {
                                reason: e.target.value,
                              })
                            }
                          >
                            {ADJUSTMENT_REASONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
          {!locked ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving ? "Saving…" : "Save draft"}
              </Button>
              <Button type="button" disabled={posting} onClick={postCount}>
                {posting ? "Posting…" : "Post adjustments"}
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-emerald-800">
              Posted. Inventory batches and the ledger are updated.
            </p>
          )}
        </form>
      </Panel>
    </AppShell>
  );
}
