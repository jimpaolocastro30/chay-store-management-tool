"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PriceManagement } from "@/components/PriceManagement";
import { Button, Input } from "@/components/ui";
import { useMountQuery } from "@/hooks/useMountQuery";

interface Item {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  specialPrice?: number;
}

export default function PricesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isOwner = session?.user?.role === "owner";
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");

  async function fetchItems(search = q) {
    const res = await fetch(
      `/api/inventory${search ? `?q=${encodeURIComponent(search)}` : ""}`
    );
    if (!res.ok) return [] as Item[];
    return res.json() as Promise<Item[]>;
  }

  async function load(search = q) {
    setItems(await fetchItems(search));
  }

  useMountQuery(
    () => fetchItems(),
    setItems,
    status !== "loading" && isOwner
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!isOwner) {
      router.replace("/");
    }
  }, [status, isOwner, router]);

  if (!isOwner) {
    return (
      <AppShell title="Price management" subtitle="Owner access only">
        <p className="text-sm text-slate-600">Redirecting…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Price management"
      subtitle="Set unit cost, selling price, special/promo price, and bulk adjustments"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Search SKU / name / category"
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
      <PriceManagement
        items={items}
        isOwner
        search={q}
        onSaved={() => load()}
      />
    </AppShell>
  );
}
