import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { InventoryItem } from "@/models/InventoryItem";
import { CapitalEntry } from "@/models/CapitalEntry";
import { getDashboardData } from "@/lib/kpis";
import { requireSession } from "@/lib/api";
import { toCsv } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error } = await requireSession("exportReports");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "pnl";
  const format = searchParams.get("format") || "json";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await connectDB();

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  if (type === "pnl") {
    const filter = Object.keys(dateFilter).length
      ? { date: dateFilter }
      : {};
    const txs = await Transaction.find(filter).sort({ date: -1 }).lean();
    const revenue = txs
      .filter((t) => t.type === "revenue")
      .reduce((a, t) => a + t.amount, 0);
    const expenses = txs
      .filter((t) => t.type === "expense" || t.type === "loss")
      .reduce((a, t) => a + t.amount, 0);

    const report = {
      type: "pnl",
      from,
      to,
      revenue,
      expenses,
      netProfit: revenue - expenses,
      transactions: txs,
    };

    if (format === "csv") {
      const csv = toCsv(
        txs.map((t) => ({
          date: new Date(t.date).toISOString().slice(0, 10),
          type: t.type,
          category: t.category || "",
          description: t.description,
          amount: t.amount,
        }))
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="pnl-report.csv"',
        },
      });
    }

    return NextResponse.json(report);
  }

  if (type === "inventory") {
    const items = await InventoryItem.find({ active: true }).lean();
    const valuation = items.map((i) => ({
      sku: i.sku,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      unitCost: i.unitCost,
      sellingPrice: i.sellingPrice,
      stockValue: i.quantity * i.unitCost,
      lowStock: i.quantity <= i.reorderLevel,
    }));

    if (format === "csv") {
      const csv = toCsv(valuation);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition":
            'attachment; filename="inventory-valuation.csv"',
        },
      });
    }

    return NextResponse.json({
      type: "inventory",
      totalValue: valuation.reduce((a, i) => a + i.stockValue, 0),
      items: valuation,
    });
  }

  if (type === "kpi") {
    const data = await getDashboardData();
    if (format === "csv") {
      const csv = toCsv([data.kpis as unknown as Record<string, unknown>]);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="kpi-summary.csv"',
        },
      });
    }
    return NextResponse.json({ type: "kpi", ...data.kpis });
  }

  if (type === "capital") {
    const entries = await CapitalEntry.find().sort({ date: -1 }).lean();
    if (format === "csv") {
      const csv = toCsv(
        entries.map((e) => ({
          date: new Date(e.date).toISOString().slice(0, 10),
          type: e.type,
          description: e.description,
          amount: e.amount,
        }))
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="capital-report.csv"',
        },
      });
    }
    return NextResponse.json({ type: "capital", entries });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
