import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireSession } from "@/lib/api";
import { receiveStock } from "@/lib/inventoryStock";

const schema = z.object({
  productId: z.string().min(1),
  batchNumber: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().min(0),
  expiryDate: z.string().optional(),
  manufacturingDate: z.string().optional(),
  receivedAt: z.string().optional(),
  supplier: z.string().optional(),
  warehouse: z.string().optional(),
  location: z.string().optional(),
  purchaseOrder: z.string().optional(),
  deliveryReceipt: z.string().optional(),
  remarks: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession("manageInventory");
  if (error || !session) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();
    const batch = await receiveStock({
      ...body,
      userId: session.user.id,
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Receive failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
