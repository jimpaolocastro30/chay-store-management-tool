import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/api";
import { ADJUSTMENT_REASONS } from "@/types/inventory";
import { adjustBatch } from "@/lib/inventoryStock";

const schema = z.object({
  batchId: z.string().min(1),
  physicalQuantity: z.number().min(0).optional(),
  delta: z.number().int().optional(),
  reason: z.enum(ADJUSTMENT_REASONS),
  remarks: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession("manageInventory");
  if (error || !session) return error;

  try {
    const body = schema.parse(await req.json());
    if (body.physicalQuantity === undefined && body.delta === undefined) {
      return NextResponse.json(
        { error: "Provide physicalQuantity or delta" },
        { status: 400 }
      );
    }
    await connectDB();
    const batch = await adjustBatch({
      ...body,
      userId: session.user.id,
    });
    return NextResponse.json(batch);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Adjustment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
