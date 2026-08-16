import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/kpis";
import { requireSession } from "@/lib/api";

export async function GET() {
  const { error } = await requireSession("viewDashboard");
  if (error) return error;

  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load KPIs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
