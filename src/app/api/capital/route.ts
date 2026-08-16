import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { CapitalEntry } from "@/models/CapitalEntry";
import { requireSession } from "@/lib/api";

const schema = z.object({
  type: z.enum(["initial", "investment", "withdrawal"]),
  amount: z.number().positive(),
  description: z.string().min(2),
  date: z.string(),
});

export async function GET() {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  await connectDB();
  const items = await CapitalEntry.find().sort({ date: -1 });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession("manageCapital");
  if (error || !session) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();
    const item = await CapitalEntry.create({
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
