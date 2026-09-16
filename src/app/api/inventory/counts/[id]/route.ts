import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { InventoryCount } from "@/models/InventoryCount";
import { requireSession } from "@/lib/api";
import { ADJUSTMENT_REASONS } from "@/types/inventory";
import { adjustBatch } from "@/lib/inventoryStock";

const itemSchema = z.object({
  inventoryBatchId: z.string(),
  physicalQuantity: z.number().min(0),
  reason: z.string().optional(),
  remarks: z.string().optional(),
});

const patchSchema = z.object({
  remarks: z.string().optional(),
  items: z.array(itemSchema).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const count = await InventoryCount.findById(id);
  if (!count) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(count);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("manageInventory");
  if (error) return error;

  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    await connectDB();
    const count = await InventoryCount.findById(id);
    if (!count) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (count.status === "POSTED") {
      return NextResponse.json(
        { error: "Posted counts cannot be edited" },
        { status: 400 }
      );
    }

    if (body.remarks !== undefined) count.remarks = body.remarks;
    if (body.items) {
      const updates = new Map(
        body.items.map((item) => [item.inventoryBatchId, item])
      );
      for (const row of count.items) {
        const next = updates.get(String(row.inventoryBatchId));
        if (!next) continue;
        row.physicalQuantity = next.physicalQuantity;
        row.varianceQuantity = next.physicalQuantity - row.systemQuantity;
        if (next.reason) row.reason = next.reason;
        if (next.remarks !== undefined) row.remarks = next.remarks;
      }
      count.status = "SUBMITTED";
    }

    await count.save();
    return NextResponse.json(count);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireSession("manageInventory");
  if (error || !session) return error;

  try {
    const { id } = await params;
    const action = new URL(req.url).searchParams.get("action");
    if (action !== "post") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    await connectDB();
    const count = await InventoryCount.findById(id);
    if (!count) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (count.status === "POSTED") {
      return NextResponse.json({ error: "Already posted" }, { status: 400 });
    }

    for (const row of count.items) {
      if (row.physicalQuantity === undefined || row.physicalQuantity === null) {
        continue;
      }
      const variance = row.physicalQuantity - row.systemQuantity;
      if (variance === 0) continue;
      if (variance !== 0 && !row.reason) {
        return NextResponse.json(
          {
            error: `Reason required for ${row.sku} batch ${row.batchNumber} (variance ${variance})`,
          },
          { status: 400 }
        );
      }
      const reason = ADJUSTMENT_REASONS.includes(
        row.reason as (typeof ADJUSTMENT_REASONS)[number]
      )
        ? (row.reason as (typeof ADJUSTMENT_REASONS)[number])
        : "Counting Error";

      await adjustBatch({
        batchId: String(row.inventoryBatchId),
        physicalQuantity: row.physicalQuantity,
        reason,
        remarks: row.remarks || `Stock count ${count.countNumber}`,
        userId: session.user.id,
        referenceType: "count",
        referenceId: count.countNumber,
      });
      row.varianceQuantity = variance;
    }

    count.status = "POSTED";
    count.approvedBy = session.user.id as unknown as typeof count.approvedBy;
    count.approvedAt = new Date();
    await count.save();
    return NextResponse.json(count);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Post failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
