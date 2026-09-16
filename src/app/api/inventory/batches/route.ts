import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { InventoryItem } from "@/models/InventoryItem";
import { InventoryBatch } from "@/models/InventoryBatch";
import { requireSession } from "@/lib/api";
import {
  computeBatchStatus,
  ensureOpeningBatch,
  productStatus,
  refreshExpiredBatches,
} from "@/lib/inventoryStock";

export async function GET(req: NextRequest) {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  await connectDB();
  await refreshExpiredBatches();

  const productId = new URL(req.url).searchParams.get("productId");
  const filter: Record<string, unknown> = {};
  if (productId) filter.productId = productId;

  if (productId) {
    const product = await InventoryItem.findById(productId);
    if (product) await ensureOpeningBatch(product);
  }

  const batches = await InventoryBatch.find(filter).sort({
    expiryDate: 1,
    receivedAt: 1,
  });
  const products = await InventoryItem.find({
    _id: { $in: batches.map((b) => b.productId) },
  });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return NextResponse.json(
    batches.map((batch) => {
      const product = productMap.get(String(batch.productId));
      const reorder = product?.reorderLevel ?? 5;
      return {
        ...batch.toObject(),
        sku: product?.sku,
        name: product?.name,
        category: product?.category,
        reorderLevel: reorder,
        status: computeBatchStatus(batch, reorder),
        productStatus: product
          ? productStatus(product.quantity, product.reorderLevel)
          : undefined,
      };
    })
  );
}
