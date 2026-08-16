import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/Category";
import { InventoryItem } from "@/models/InventoryItem";
import { requireSession } from "@/lib/api";
import { escapeRegex } from "@/lib/categories";
import { ensureDefaultCategories } from "@/lib/ensureCategories";

const schema = z.object({
  name: z.string().trim().min(2).max(40),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  await connectDB();
  await ensureDefaultCategories();

  const [categories, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1, name: 1 }),
    InventoryItem.aggregate<{ _id: string; count: number }>([
      { $match: { active: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  const countByName = new Map(counts.map((row) => [row._id, row.count]));

  return NextResponse.json(
    categories.map((category) => ({
      _id: category._id,
      name: category.name,
      sortOrder: category.sortOrder,
      itemCount: countByName.get(category.name) || 0,
    }))
  );
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession("editInventory");
  if (error) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();
    await ensureDefaultCategories();

    const existing = await Category.findOne({
      name: { $regex: `^${escapeRegex(body.name)}$`, $options: "i" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "That category already exists" },
        { status: 409 }
      );
    }

    const last = await Category.findOne().sort({ sortOrder: -1 });
    const item = await Category.create({
      name: body.name,
      sortOrder: body.sortOrder ?? (last?.sortOrder || 0) + 10,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
