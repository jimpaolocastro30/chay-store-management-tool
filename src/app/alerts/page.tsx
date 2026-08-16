"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Panel } from "@/components/ui";

interface AlertItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  read: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  async function load() {
    const res = await fetch("/api/alerts");
    setAlerts(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function markAll() {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    await load();
  }

  return (
    <AppShell
      title="Alerts"
      subtitle="Low stock, cash flow, and KPI threshold notifications"
    >
      <Panel
        title="Notification center"
        action={
          <Button variant="secondary" onClick={markAll}>
            Mark all read
          </Button>
        }
      >
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert._id}
              className={`rounded-2xl border px-4 py-3 ${
                alert.read
                  ? "border-slate-200 bg-white"
                  : "border-teal-200 bg-teal-50/70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-teal-950">{alert.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                    {alert.type} · {alert.severity} ·{" "}
                    {new Date(alert.createdAt).toLocaleString("en-PH")}
                  </p>
                </div>
                {!alert.read ? (
                  <Button variant="secondary" onClick={() => markRead(alert._id)}>
                    Mark read
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!alerts.length ? (
            <p className="py-8 text-center text-slate-500">No alerts.</p>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}
