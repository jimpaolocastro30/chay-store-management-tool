import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/Category";
import { InventoryItem } from "@/models/InventoryItem";
import { Transaction } from "@/models/Transaction";
import { requireSession } from "@/lib/api";
import { escapeRegex } from "@/lib/categories";

const schema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("editInventory");
  if (error) return error;

  try {
    const { id } = await params;
    const body = schema.parse(await req.json());
    await connectDB();

    const current = await Category.findById(id);
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.name && body.name.toLowerCase() !== current.name.toLowerCase()) {
      const clash = await Category.findOne({
        _id: { $ne: current._id },
        name: { $regex: `^${escapeRegex(body.name)}$`, $options: "i" },
      });
      if (clash) {
        return NextResponse.json(
          { error: "That category already exists" },
          { status: 409 }
        );
      }

      await InventoryItem.updateMany(
        { category: current.name },
        { category: body.name }
      );
      await Transaction.updateMany(
        { type: "revenue", category: current.name },
        { category: body.name }
      );
      current.name = body.name;
    }

    if (typeof body.sortOrder === "number") {
      current.sortOrder = body.sortOrder;
    }

    await current.save();
    return NextResponse.json(current);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("editInventory");
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const current = await Category.findById(id);
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inUse = await InventoryItem.countDocuments({
    active: true,
    category: current.name,
  });
  if (inUse > 0) {
    return NextResponse.json(
      {
        error: `${inUse} inventory item${inUse === 1 ? "" : "s"} still use this category. Reassign them first.`,
      },
      { status: 409 }
    );
  }

  await current.deleteOne();
  return NextResponse.json({ ok: true });
}
