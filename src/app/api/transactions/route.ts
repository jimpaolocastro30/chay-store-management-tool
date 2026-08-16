import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { requireSession } from "@/lib/api";

const schema = z.object({
  type: z.enum(["revenue", "expense", "loss"]),
  amount: z.number().positive(),
  category: z
    .enum([
      "cogs",
      "rent",
      "utilities",
      "payroll",
      "marketing",
      "supplies",
      "transport",
      "damage",
      "other",
    ])
    .optional(),
  description: z.string().min(2),
  date: z.string(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, Date>).$gte = new Date(from);
    if (to) (filter.date as Record<string, Date>).$lte = new Date(to);
  }

  const items = await Transaction.find(filter).sort({ date: -1 }).limit(200);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession("manageTransactions");
  if (error || !session) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();

    if ((body.type === "expense" || body.type === "loss") && !body.category) {
      return NextResponse.json(
        { error: "Category is required for expenses and losses" },
        { status: 400 }
      );
    }

    const item = await Transaction.create({
      ...body,
      date: new Date(body.date),
      createdBy: session.user.id,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireSession("deleteRecords");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await connectDB();
  await Transaction.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
