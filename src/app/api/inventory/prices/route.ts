import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { InventoryItem } from "@/models/InventoryItem";
import { requireSession } from "@/lib/api";

const schema = z.object({
  percent: z.number(),
  field: z.enum(["sellingPrice", "unitCost"]).default("sellingPrice"),
  q: z.string().optional(),
  category: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireSession("editInventory");
  if (error) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();

    const filter: Record<string, unknown> = { active: true };
    if (body.q) {
      filter.$or = [
        { name: { $regex: body.q, $options: "i" } },
        { sku: { $regex: body.q, $options: "i" } },
        { category: { $regex: body.q, $options: "i" } },
      ];
    }
    if (body.category) {
      filter.category = { $regex: `^${body.category}$`, $options: "i" };
    }

    const items = await InventoryItem.find(filter);
    const factor = 1 + body.percent / 100;
    let updated = 0;

    for (const item of items) {
      const current = Number(item[body.field] || 0);
      const next = Math.max(0, Math.round(current * factor * 100) / 100);
      item[body.field] = next;
      await item.save();
      updated += 1;
    }

    return NextResponse.json({ ok: true, updated, percent: body.percent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
