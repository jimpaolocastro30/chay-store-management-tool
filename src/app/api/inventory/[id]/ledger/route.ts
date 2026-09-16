import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { InventoryItem } from "@/models/InventoryItem";
import { InventoryTxn } from "@/models/InventoryTxn";
import { requireSession } from "@/lib/api";
import { ensureOpeningBatch } from "@/lib/inventoryStock";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const product = await InventoryItem.findById(id);
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureOpeningBatch(product);

  const ledger = await InventoryTxn.find({ productId: id }).sort({
    createdAt: 1,
  });
  return NextResponse.json(ledger);
}
