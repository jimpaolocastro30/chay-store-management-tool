import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { InventoryItem } from "@/models/InventoryItem";
import { requireSession } from "@/lib/api";

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession("manageTransactions");
  if (error || !session) return error;

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = String(form.get("kind") || "transactions");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    await connectDB();
    let created = 0;

    if (kind === "inventory") {
      for (const row of rows) {
        const sku = String(row.sku || row.SKU || "").trim();
        const name = String(row.name || row.Name || "").trim();
        if (!sku || !name) continue;

        await InventoryItem.findOneAndUpdate(
          { sku: sku.toUpperCase() },
          {
            sku: sku.toUpperCase(),
            name,
            category: String(row.category || row.Category || "General"),
            quantity: Number(row.quantity || row.Quantity || 0),
            sold: Number(row.sold || row.Sold || 0),
            reorderLevel: Number(row.reorderLevel || row.ReorderLevel || 5),
            unitCost: Number(row.unitCost || row.UnitCost || 0),
            sellingPrice: Number(row.sellingPrice || row.SellingPrice || 0),
            specialPrice: Number(row.specialPrice || row.SpecialPrice || 0),
            location: String(row.location || row.Location || "Main Store"),
            active: true,
          },
          { upsert: true, new: true }
        );
        created += 1;
      }
    } else {
      for (const row of rows) {
        const type = String(row.type || row.Type || "").toLowerCase();
        const amount = Number(row.amount || row.Amount || 0);
        const description = String(
          row.description || row.Description || ""
        ).trim();
        if (!["revenue", "expense", "loss"].includes(type) || !amount) {
          continue;
        }

        await Transaction.create({
          type,
          amount,
          category: row.category || row.Category || "other",
          description: description || `${type} import`,
          date: new Date(
            String(row.date || row.Date || new Date().toISOString())
          ),
          paymentMethod: String(row.paymentMethod || "cash"),
          createdBy: session.user.id,
        });
        created += 1;
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
