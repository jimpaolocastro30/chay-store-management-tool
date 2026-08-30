import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import {
  Utang,
  computeUtangStatus,
  utangBalance,
  IUtang,
} from "@/models/Utang";
import { requireSession } from "@/lib/api";

const schema = z.object({
  loanerName: z.string().min(2).optional(),
  contact: z.string().optional(),
  direction: z.enum(["receivable", "payable"]).optional(),
  amount: z.number().min(0).optional(),
  committedPayment: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

function serialize(item: IUtang) {
  return {
    _id: String(item._id),
    loanerName: item.loanerName,
    contact: item.contact || "",
    direction: item.direction,
    amount: item.amount,
    committedPayment: item.committedPayment,
    balance: utangBalance(item.amount, item.committedPayment),
    dueDate: item.dueDate,
    notes: item.notes || "",
    status: item.status,
    saleId: item.saleId ? String(item.saleId) : "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession("manageTransactions");
  if (error) return error;

  try {
    const { id } = await params;
    const body = schema.parse(await req.json());
    await connectDB();

    const existing = await Utang.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const amount = body.amount ?? existing.amount;
    const committedPayment =
      body.committedPayment ?? existing.committedPayment;
    if (committedPayment > amount) {
      return NextResponse.json(
        { error: "Committed payment cannot exceed total amount" },
        { status: 400 }
      );
    }

    const dueDate = body.dueDate ? new Date(body.dueDate) : existing.dueDate;
    const update: Record<string, unknown> = {
      amount,
      committedPayment,
      dueDate,
      status: computeUtangStatus(amount, committedPayment, dueDate),
    };

    if (body.loanerName !== undefined) {
      update.loanerName = body.loanerName.trim();
    }
    if (body.contact !== undefined) update.contact = body.contact.trim();
    if (body.direction !== undefined) update.direction = body.direction;
    if (body.notes !== undefined) update.notes = body.notes.trim();

    const item = await Utang.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serialize(item));
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
  const item = await Utang.findByIdAndDelete(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
