import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { InventoryItem } from "@/models/InventoryItem";
import { Transaction } from "@/models/Transaction";
import { requireSession } from "@/lib/api";

const schema = z.object({
  paymentMethod: z.enum(["cash", "gcash", "maya", "card", "bank"]),
  reference: z.string().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession("usePos");
  if (error || !session) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();

    const sold: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];
    const pending: Array<{
      item: InstanceType<typeof InventoryItem>;
      quantity: number;
    }> = [];
    let revenue = 0;
    let cogs = 0;

    for (const line of body.lines) {
      const item = await InventoryItem.findOne({
        _id: line.itemId,
        active: true,
      });
      if (!item) {
        return NextResponse.json(
          { error: "An item in the cart is no longer available." },
          { status: 400 }
        );
      }
      if (item.sellingPrice <= 0) {
        return NextResponse.json(
          { error: `${item.sku} is not for sale.` },
          { status: 400 }
        );
      }
      if (item.quantity < line.quantity) {
        return NextResponse.json(
          {
            error: `Not enough stock for ${item.sku}. Available: ${item.quantity}.`,
          },
          { status: 400 }
        );
      }

      pending.push({ item, quantity: line.quantity });
      const lineTotal = item.sellingPrice * line.quantity;
      revenue += lineTotal;
      cogs += item.unitCost * line.quantity;
      sold.push({
        sku: item.sku,
        name: item.name,
        quantity: line.quantity,
        unitPrice: item.sellingPrice,
        lineTotal,
      });
    }

    for (const row of pending) {
      row.item.quantity -= row.quantity;
      row.item.sold = (row.item.sold || 0) + row.quantity;
      await row.item.save();
    }

    const summary = sold
      .map((row) => `${row.sku} x${row.quantity}`)
      .join(", ");

    const categories = [
      ...new Set(pending.map((row) => row.item.category).filter(Boolean)),
    ];
    const saleCategory =
      categories.length === 1 ? String(categories[0]) : "Mixed";

    const sale = await Transaction.create({
      type: "revenue",
      amount: Math.round(revenue * 100) / 100,
      category: saleCategory,
      description: `POS sale: ${summary}`,
      date: new Date(),
      paymentMethod: body.paymentMethod,
      reference: body.reference || undefined,
      createdBy: session.user.id,
    });

    if (cogs > 0) {
      await Transaction.create({
        type: "expense",
        category: "cogs",
        amount: Math.round(cogs * 100) / 100,
        description: `POS COGS: ${summary}`,
        date: new Date(),
        createdBy: session.user.id,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        saleId: sale._id,
        total: sale.amount,
        cogs: Math.round(cogs * 100) / 100,
        items: sold,
        paymentMethod: body.paymentMethod,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
