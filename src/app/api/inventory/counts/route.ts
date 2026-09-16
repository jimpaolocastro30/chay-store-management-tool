import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { InventoryItem } from "@/models/InventoryItem";
import { InventoryBatch } from "@/models/InventoryBatch";
import { InventoryCount } from "@/models/InventoryCount";
import { requireSession } from "@/lib/api";
import {
  ensureOpeningBatch,
  nextCountNumber,
  refreshExpiredBatches,
} from "@/lib/inventoryStock";

const createSchema = z.object({
  category: z.string().optional(),
  remarks: z.string().optional(),
});

export async function GET() {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  await connectDB();
  const counts = await InventoryCount.find().sort({ createdAt: -1 }).limit(50);
  return NextResponse.json(counts);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession("manageInventory");
  if (error || !session) return error;

  try {
    const body = createSchema.parse(await req.json());
    await connectDB();
    await refreshExpiredBatches();

    const productFilter: Record<string, unknown> = { active: true };
    if (body.category) productFilter.category = body.category;
    const products = await InventoryItem.find(productFilter);
    for (const product of products) {
      await ensureOpeningBatch(product, session.user.id);
    }

    const batches = await InventoryBatch.find({
      productId: { $in: products.map((p) => p._id) },
    }).sort({ expiryDate: 1, receivedAt: 1 });

    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const items = batches.map((batch) => {
      const product = productMap.get(String(batch.productId));
      return {
        productId: batch.productId,
        inventoryBatchId: batch._id,
        sku: product?.sku || "",
        name: product?.name || "",
        batchNumber: batch.batchNumber,
        systemQuantity: batch.currentQuantity,
        physicalQuantity: undefined,
        varianceQuantity: undefined,
      };
    });

    const count = await InventoryCount.create({
      countNumber: await nextCountNumber(),
      countDate: new Date(),
      status: "DRAFT",
      category: body.category,
      countedBy: session.user.id,
      remarks: body.remarks,
      items,
    });

    return NextResponse.json(count, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Count failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
