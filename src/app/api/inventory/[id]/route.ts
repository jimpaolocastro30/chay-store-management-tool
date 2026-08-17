import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { InventoryItem } from "@/models/InventoryItem";
import { requireSession } from "@/lib/api";
import { can } from "@/lib/utils";
import { UserRole } from "@/types";

const ownerSchema = z.object({
  sku: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  quantity: z.number().min(0).optional(),
  sold: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

const qtySchema = z.object({
  quantity: z.number().min(0).optional(),
  sold: z.number().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireSession("manageInventory");
  if (error || !session) return error;

  try {
    const { id } = await params;
    const json = await req.json();
    const isOwner = can(session.user.role as UserRole, "editInventory");
    const body = isOwner ? ownerSchema.parse(json) : qtySchema.parse(json);
    await connectDB();

    const update = {
      ...body,
      ...("sku" in body && body.sku ? { sku: body.sku.toUpperCase() } : {}),
    };

    const item = await InventoryItem.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("deleteRecords");
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const item = await InventoryItem.findByIdAndUpdate(
    id,
    { active: false },
    { new: true }
  );
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
