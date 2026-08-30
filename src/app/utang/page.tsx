"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel, Select, StatCard, TextArea } from "@/components/ui";
import { useMountQuery } from "@/hooks/useMountQuery";
import {
  formatDatePH,
  formatPHP,
  todayInputDate,
  toInputDate,
} from "@/lib/utils";
import { UtangStatus } from "@/types";

interface UtangEntry {
  _id: string;
  loanerName: string;
  contact?: string;
  direction: "receivable" | "payable";
  amount: number;
  committedPayment: number;
  balance: number;
  dueDate: string;
  notes?: string;
  status: UtangStatus;
  saleId?: string;
}

const emptyForm = {
  loanerName: "",
  contact: "",
  direction: "receivable",
  amount: "",
  committedPayment: "",
  dueDate: todayInputDate(),
  notes: "",
};

const STATUS_LABELS: Record<UtangStatus, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

function StatusBadge({ status }: { status: UtangStatus }) {
  const styles: Record<UtangStatus, string> = {
    pending: "bg-slate-100 text-slate-700",
    partial: "bg-amber-100 text-amber-900",
    paid: "bg-emerald-100 text-emerald-900",
    overdue: "bg-rose-100 text-rose-900",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function UtangPage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";
  const [items, setItems] = useState<UtangEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDirection, setFilterDirection] = useState("");

  async function fetchItems() {
    const res = await fetch("/api/utang");
    if (!res.ok) return [] as UtangEntry[];
    return res.json() as Promise<UtangEntry[]>;
  }

  async function load() {
    setItems(await fetchItems());
  }

  useMountQuery(fetchItems, setItems);

  function startEdit(item: UtangEntry) {
    setEditingId(item._id);
    setForm({
      loanerName: item.loanerName,
      contact: item.contact || "",
      direction: item.direction,
      amount: String(item.amount),
      committedPayment: String(item.committedPayment),
      dueDate: toInputDate(item.dueDate),
      notes: item.notes || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...emptyForm, dueDate: todayInputDate() });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      loanerName: form.loanerName.trim(),
      contact: form.contact.trim() || undefined,
      direction: form.direction as "receivable" | "payable",
      amount: Number(form.amount),
      committedPayment: Number(form.committedPayment || 0),
      dueDate: form.dueDate,
      notes: form.notes.trim() || undefined,
    };

    const res = editingId
      ? await fetch(`/api/utang/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/utang", {
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
    if (!confirm("Delete this utang record?")) return;
    await fetch(`/api/utang/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await load();
  }

  async function recordPayment(item: UtangEntry) {
    const raw = prompt(
      `Record payment from ${item.loanerName}\nBalance: ${formatPHP(item.balance)}`,
      ""
    );
    if (!raw) return;
    const payment = Number(raw);
    if (!Number.isFinite(payment) || payment <= 0) return;

    const committedPayment = Math.min(
      item.amount,
      item.committedPayment + payment
    );

    await fetch(`/api/utang/${item._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ committedPayment }),
    });
    await load();
  }

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterDirection && item.direction !== filterDirection) return false;
      return true;
    });
  }, [items, filterStatus, filterDirection]);

  const receivableBalance = items
    .filter((i) => i.direction === "receivable")
    .reduce((sum, i) => sum + i.balance, 0);
  const payableBalance = items
    .filter((i) => i.direction === "payable")
    .reduce((sum, i) => sum + i.balance, 0);
  const overdueCount = items.filter((i) => i.status === "overdue").length;
  const activeCount = items.filter((i) => i.status !== "paid").length;

  const formBalance = Math.max(
    0,
    Number(form.amount || 0) - Number(form.committedPayment || 0)
  );

  return (
    <AppShell
      title="Utang Tracker"
      subtitle="Monitor loaners, amounts owed, and committed payments — linked to POS sales"
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collectible (utang sa atin)"
          value={formatPHP(receivableBalance)}
          hint={`${items.filter((i) => i.direction === "receivable" && i.balance > 0).length} open accounts`}
          tone={receivableBalance > 0 ? "warn" : "good"}
        />
        <StatCard
          label="Payable (utang natin)"
          value={formatPHP(payableBalance)}
          hint={`${items.filter((i) => i.direction === "payable" && i.balance > 0).length} open accounts`}
          tone={payableBalance > 0 ? "bad" : "default"}
        />
        <StatCard
          label="Active utang"
          value={String(activeCount)}
          hint={`${overdueCount} overdue`}
          tone={overdueCount > 0 ? "bad" : "default"}
        />
        <StatCard
          label="Net position"
          value={formatPHP(receivableBalance - payableBalance)}
          hint="Receivable minus payable"
          tone={receivableBalance >= payableBalance ? "good" : "warn"}
        />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Select
          label="Status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </Select>
        <Select
          label="Type"
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value)}
        >
          <option value="">All types</option>
          <option value="receivable">Collectible (they owe us)</option>
          <option value="payable">Payable (we owe them)</option>
        </Select>
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              setFilterStatus("");
              setFilterDirection("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <Panel title={editingId ? "Edit utang" : "Add utang"}>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Loaner name"
              required
              value={form.loanerName}
              onChange={(e) => setForm({ ...form, loanerName: e.target.value })}
              placeholder="Customer or supplier name"
            />
            <Input
              label="Contact"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Phone or email"
            />
            <Select
              label="Type"
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
            >
              <option value="receivable">Collectible — they owe us</option>
              <option value="payable">Payable — we owe them</option>
            </Select>
            <Input
              label="Total amount (PHP)"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <Input
              label="Committed payment (PHP)"
              type="number"
              min="0"
              step="0.01"
              value={form.committedPayment}
              onChange={(e) =>
                setForm({ ...form, committedPayment: e.target.value })
              }
              placeholder="Amount paid or promised so far"
            />
            <p className="text-xs text-slate-500">
              Balance:{" "}
              <span className="font-medium text-violet-950">
                {formatPHP(formBalance)}
              </span>
            </p>
            <Input
              label="Due date"
              type="date"
              required
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <TextArea
              label="Notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Terms, items bought on credit, reminders…"
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving…" : editingId ? "Update utang" : "Save utang"}
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
          <Panel
            title="Utang ledger"
            action={
              <span className="text-sm text-slate-500">
                {visibleItems.length} record
                {visibleItems.length === 1 ? "" : "s"}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-violet-900/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Loaner</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Committed</th>
                    <th className="py-2 pr-3 font-medium">Balance</th>
                    <th className="py-2 pr-3 font-medium">Due</th>
                    <th className="py-2 pr-3 font-medium">Linked sale</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item._id} className="border-b border-violet-900/5">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-violet-950">
                          {item.loanerName}
                        </p>
                        {item.contact ? (
                          <p className="text-xs text-slate-500">{item.contact}</p>
                        ) : null}
                        {item.notes ? (
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                            {item.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 capitalize text-slate-600">
                        {item.direction === "receivable"
                          ? "Collectible"
                          : "Payable"}
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        {formatPHP(item.amount)}
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-emerald-800">
                        {formatPHP(item.committedPayment)}
                      </td>
                      <td className="py-3 pr-3 font-semibold tabular-nums text-violet-950">
                        {formatPHP(item.balance)}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-slate-600">
                        {formatDatePH(item.dueDate)}
                      </td>
                      <td className="py-3 pr-3">
                        {item.saleId ? (
                          <Link
                            href="/sales"
                            className="text-sm font-medium text-violet-800 hover:underline"
                          >
                            View POS sale
                          </Link>
                        ) : (
                          <span className="text-slate-400">Manual entry</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {item.balance > 0 ? (
                            <Button
                              type="button"
                              className="px-3 py-1.5 text-xs"
                              onClick={() => recordPayment(item)}
                            >
                              Record payment
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </Button>
                          {isOwner ? (
                            <Button
                              type="button"
                              variant="danger"
                              className="px-3 py-1.5 text-xs"
                              onClick={() => remove(item._id)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleItems.length ? (
                <p className="py-8 text-center text-slate-500">
                  {items.length
                    ? "No utang matches these filters."
                    : "No utang records yet. Add a loaner to start tracking."}
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
