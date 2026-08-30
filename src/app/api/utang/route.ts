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
  loanerName: z.string().min(2),
  contact: z.string().optional(),
  direction: z.enum(["receivable", "payable"]).default("receivable"),
  amount: z.number().min(0),
  committedPayment: z.number().min(0).default(0),
  dueDate: z.string(),
  notes: z.string().optional(),
  saleId: z.string().optional(),
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

export async function GET(req: NextRequest) {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  const saleId = new URL(req.url).searchParams.get("saleId");
  await connectDB();
  const filter = saleId ? { saleId } : {};
  const items = await Utang.find(filter).sort({ dueDate: 1, loanerName: 1 });
  return NextResponse.json(items.map(serialize));
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession("manageTransactions");
  if (error || !session) return error;

  try {
    const body = schema.parse(await req.json());
    if (body.committedPayment > body.amount) {
      return NextResponse.json(
        { error: "Committed payment cannot exceed total amount" },
        { status: 400 }
      );
    }

    await connectDB();
    const dueDate = new Date(body.dueDate);
    const status = computeUtangStatus(
      body.amount,
      body.committedPayment,
      dueDate
    );

    const item = await Utang.create({
      loanerName: body.loanerName.trim(),
      contact: body.contact?.trim(),
      direction: body.direction,
      amount: body.amount,
      committedPayment: body.committedPayment,
      dueDate,
      notes: body.notes?.trim(),
      status,
      saleId: body.saleId || undefined,
      createdBy: session.user.id,
    });

    return NextResponse.json(serialize(item), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
