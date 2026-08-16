import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { requireSession } from "@/lib/api";

const schema = z.object({
  type: z.enum(["revenue", "expense", "loss"]).optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  description: z.string().min(2).optional(),
  date: z.string().optional(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("editTransactions");
  if (error) return error;

  try {
    const { id } = await params;
    const body = schema.parse(await req.json());
    await connectDB();

    const update: Record<string, unknown> = { ...body };
    if (body.date) update.date = new Date(body.date);

    const item = await Transaction.findByIdAndUpdate(id, update, {
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
  const item = await Transaction.findByIdAndDelete(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
