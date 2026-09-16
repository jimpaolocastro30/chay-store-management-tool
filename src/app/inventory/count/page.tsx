"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button, Panel, Select } from "@/components/ui";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useMountQuery } from "@/hooks/useMountQuery";
import { formatDateTimePH } from "@/lib/utils";

interface CountRow {
  _id: string;
  countNumber: string;
  countDate: string;
  status: string;
  category?: string;
  items: unknown[];
}

export default function StockCountListPage() {
  const categories = useProductCategories();
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [category, setCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function fetchCounts() {
    const res = await fetch("/api/inventory/counts");
    const data = await res.json();
    return Array.isArray(data) ? (data as CountRow[]) : [];
  }

  useMountQuery(fetchCounts, setCounts);

  async function startCount(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/inventory/counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category || undefined }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "Could not start count");
      return;
    }
    window.location.href = `/inventory/count/${data._id}`;
  }

  return (
    <AppShell
      title="Stock count"
      subtitle="Compare system quantity to physical count, then post a ledger adjustment"
    >
      <div className="mb-4">
        <Link href="/inventory" className="text-sm text-violet-800 hover:underline">
          Back to inventory
        </Link>
      </div>

      <div className="mb-6 max-w-xl">
        <Panel title="New inventory count">
          <form onSubmit={startCount} className="space-y-3">
            <Select
              label="Category (optional)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All products</option>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <Button type="submit" disabled={creating} className="w-full">
              {creating ? "Loading batches…" : "Start stock count"}
            </Button>
          </form>
        </Panel>
      </div>

      <Panel title="Count history">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-violet-900/10 text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Count #</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Lines</th>
                <th className="py-2 font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((count) => (
                <tr key={count._id} className="border-b border-violet-900/5">
                  <td className="py-3 pr-3 font-medium text-violet-950">
                    {count.countNumber}
                  </td>
                  <td className="py-3 pr-3">{formatDateTimePH(count.countDate)}</td>
                  <td className="py-3 pr-3 uppercase">{count.status}</td>
                  <td className="py-3 pr-3">{count.items?.length || 0}</td>
                  <td className="py-3">
                    <Link href={`/inventory/count/${count._id}`}>
                      <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs">
                        Open
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!counts.length ? (
            <p className="py-8 text-center text-slate-500">No stock counts yet.</p>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}
