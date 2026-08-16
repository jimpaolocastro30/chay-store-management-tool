"use client";

import { useMemo, useState } from "react";
import { Button, Input, Panel, Select, StatCard } from "@/components/ui";
import { formatPHP, formatPercent, marginPercent, markupPercent } from "@/lib/utils";

interface Item {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
}

export function PriceManagement({
  items,
  isOwner,
  search,
  onSaved,
}: {
  items: Item[];
  isOwner: boolean;
  search: string;
  onSaved: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<
    Record<string, { unitCost: string; sellingPrice: string }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [percent, setPercent] = useState("10");
  const [field, setField] = useState<"sellingPrice" | "unitCost">("sellingPrice");
  const [bulkLoading, setBulkLoading] = useState(false);

  const stats = useMemo(() => {
    const retail = items.reduce(
      (sum, item) => sum + item.quantity * item.sellingPrice,
      0
    );
    const cost = items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );
    const belowCost = items.filter(
      (item) => item.sellingPrice > 0 && item.sellingPrice < item.unitCost
    ).length;
    const markups = items
      .filter((item) => item.unitCost > 0)
      .map((item) => markupPercent(item.unitCost, item.sellingPrice));
    const avgMarkup = markups.length
      ? markups.reduce((a, b) => a + b, 0) / markups.length
      : 0;
    return { retail, cost, belowCost, avgMarkup };
  }, [items]);

  function draftFor(item: Item) {
    return (
      drafts[item._id] || {
        unitCost: String(item.unitCost),
        sellingPrice: String(item.sellingPrice),
      }
    );
  }

  async function saveRow(item: Item) {
    const draft = draftFor(item);
    setSavingId(item._id);
    await fetch(`/api/inventory/${item._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitCost: Number(draft.unitCost),
        sellingPrice: Number(draft.sellingPrice),
      }),
    });
    setSavingId(null);
    setDrafts((current) => {
      const next = { ...current };
      delete next[item._id];
      return next;
    });
    await onSaved();
  }

  async function applyBulk() {
    const value = Number(percent);
    if (!Number.isFinite(value) || value === 0) return;
    if (
      !confirm(
        `Apply ${value}% to ${field === "sellingPrice" ? "selling prices" : "unit costs"} on ${items.length} listed item(s)?`
      )
    ) {
      return;
    }
    setBulkLoading(true);
    await fetch("/api/inventory/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        percent: value,
        field,
        q: search || undefined,
      }),
    });
    setBulkLoading(false);
    setDrafts({});
    await onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Retail value"
          value={formatPHP(stats.retail)}
          hint="Qty × selling price"
          tone="good"
        />
        <StatCard
          label="Cost value"
          value={formatPHP(stats.cost)}
          hint="Qty × unit cost"
        />
        <StatCard
          label="Avg markup"
          value={formatPercent(stats.avgMarkup)}
          hint="(Sell − cost) ÷ cost"
        />
        <StatCard
          label="Below cost"
          value={String(stats.belowCost)}
          hint="Selling price under unit cost"
          tone={stats.belowCost ? "warn" : "good"}
        />
      </div>

      {isOwner ? (
        <Panel title="Bulk price adjustment">
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              label="Percent change"
              type="number"
              step="0.1"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
            <Select
              label="Apply to"
              value={field}
              onChange={(e) =>
                setField(e.target.value as "sellingPrice" | "unitCost")
              }
            >
              <option value="sellingPrice">Selling price</option>
              <option value="unitCost">Unit cost</option>
            </Select>
            <div className="flex items-end">
              <Button
                type="button"
                disabled={bulkLoading || !items.length}
                onClick={applyBulk}
                className="w-full"
              >
                {bulkLoading ? "Applying…" : "Apply to listed items"}
              </Button>
            </div>
            <p className="self-end text-xs text-slate-500 md:pb-3">
              Uses the current search filter. Example: 10 raises ₱100 to ₱110.
            </p>
          </div>
        </Panel>
      ) : null}

      <Panel title="Price list">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-violet-900/10 text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Unit cost</th>
                <th className="py-2 pr-3 font-medium">Selling price</th>
                <th className="py-2 pr-3 font-medium">Markup</th>
                <th className="py-2 pr-3 font-medium">Margin</th>
                <th className="py-2 font-medium">Profit / unit</th>
                {isOwner ? (
                  <th className="py-2 pl-3 font-medium">Save</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const draft = draftFor(item);
                const cost = Number(draft.unitCost);
                const sell = Number(draft.sellingPrice);
                const below = sell > 0 && sell < cost;
                return (
                  <tr key={item._id} className="border-b border-violet-900/5">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-violet-950">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.sku} · {item.category}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      {isOwner ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-28 rounded-lg border border-violet-900/15 px-2 py-1.5"
                          value={draft.unitCost}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [item._id]: {
                                ...draft,
                                unitCost: e.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        formatPHP(item.unitCost)
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {isOwner ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={`w-28 rounded-lg border px-2 py-1.5 ${
                            below
                              ? "border-amber-400 bg-amber-50"
                              : "border-violet-900/15"
                          }`}
                          value={draft.sellingPrice}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [item._id]: {
                                ...draft,
                                sellingPrice: e.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        <span className={below ? "text-amber-800" : ""}>
                          {formatPHP(item.sellingPrice)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {formatPercent(markupPercent(cost, sell))}
                    </td>
                    <td className="py-3 pr-3">
                      {formatPercent(marginPercent(cost, sell))}
                    </td>
                    <td
                      className={`py-3 font-medium ${
                        sell - cost < 0 ? "text-rose-700" : "text-emerald-800"
                      }`}
                    >
                      {formatPHP(sell - cost)}
                      {below ? (
                        <p className="text-[11px] font-normal text-amber-800">
                          Below cost
                        </p>
                      ) : null}
                    </td>
                    {isOwner ? (
                      <td className="py-3 pl-3">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          disabled={savingId === item._id}
                          onClick={() => saveRow(item)}
                        >
                          {savingId === item._id ? "Saving…" : "Save"}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length ? (
            <p className="py-8 text-center text-slate-500">No items to price.</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
