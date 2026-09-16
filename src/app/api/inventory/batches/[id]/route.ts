import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { InventoryBatch } from "@/models/InventoryBatch";
import { InventoryItem } from "@/models/InventoryItem";
import { InventoryTxn } from "@/models/InventoryTxn";
import { requireSession } from "@/lib/api";
import { computeBatchStatus } from "@/lib/inventoryStock";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const batch = await InventoryBatch.findById(id);
  if (!batch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const product = await InventoryItem.findById(batch.productId);
  const ledger = await InventoryTxn.find({ inventoryBatchId: batch._id }).sort({
    createdAt: 1,
  });

  return NextResponse.json({
    batch: {
      ...batch.toObject(),
      status: computeBatchStatus(batch, product?.reorderLevel ?? 5),
    },
    product,
    ledger,
  });
}
