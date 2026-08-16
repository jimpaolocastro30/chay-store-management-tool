import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Alert } from "@/models/Alert";
import { requireSession } from "@/lib/api";

export async function GET() {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  await connectDB();
  const alerts = await Alert.find().sort({ createdAt: -1 }).limit(50);
  return NextResponse.json(alerts);
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  const body = await req.json();
  await connectDB();

  if (body.markAllRead) {
    await Alert.updateMany({ read: false }, { read: true });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const alert = await Alert.findByIdAndUpdate(
    body.id,
    { read: true },
    { new: true }
  );
  return NextResponse.json(alert);
}
