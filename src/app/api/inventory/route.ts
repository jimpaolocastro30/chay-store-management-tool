import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { InventoryItem } from "@/models/InventoryItem";
import { requireSession } from "@/lib/api";

const schema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(2),
  quantity: z.number().min(0),
  sold: z.number().min(0).optional(),
  reorderLevel: z.number().min(0),
  unitCost: z.number().min(0),
  sellingPrice: z.number().min(0),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const category = searchParams.get("category");
  const lowStock = searchParams.get("lowStock") === "true";

  const filter: Record<string, unknown> = { active: true };
  if (category) filter.category = category;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { sku: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
    ];
  }

  let items = await InventoryItem.find(filter).sort({ name: 1 });
  if (lowStock) {
    items = items.filter((i) => i.quantity <= i.reorderLevel);
  }

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession("manageInventory");
  if (error) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();
    const item = await InventoryItem.create({
      ...body,
      sku: body.sku.toUpperCase(),
      sold: body.sold ?? 0,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
