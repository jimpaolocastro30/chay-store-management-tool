import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { InventoryItem } from "@/models/InventoryItem";
import { Transaction } from "@/models/Transaction";
import { Utang, computeUtangStatus } from "@/models/Utang";
import { requireSession } from "@/lib/api";
import { hasSpecialPrice, unitPriceForSale } from "@/lib/utils";
import {
  availableQuantity,
  consumeForSale,
  ensureOpeningBatch,
} from "@/lib/inventoryStock";

const schema = z
  .object({
    paymentMethod: z.enum(["cash", "gcash", "maya", "card", "bank", "utang"]),
    reference: z.string().optional(),
    loanerName: z.string().optional(),
    loanerContact: z.string().optional(),
    dueDate: z.string().optional(),
    downPayment: z.number().min(0).optional(),
    lines: z
      .array(
        z.object({
          itemId: z.string().min(1),
          quantity: z.number().int().positive(),
          useSpecial: z.boolean().optional(),
        })
      )
      .min(1),
  })
  .superRefine((body, ctx) => {
    if (body.paymentMethod === "utang" && !body.loanerName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Loaner name is required for utang sales.",
        path: ["loanerName"],
      });
    }
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
      usedSpecial: boolean;
    }> = [];
    const pending: Array<{
      item: InstanceType<typeof InventoryItem>;
      quantity: number;
    }> = [];
    let revenue = 0;
    let cogs = 0;
    const reserved = new Map<string, number>();

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
      if (line.useSpecial && !hasSpecialPrice(item.specialPrice)) {
        return NextResponse.json(
          { error: `${item.sku} has no special price set.` },
          { status: 400 }
        );
      }

      await ensureOpeningBatch(item, session.user.id);
      const available = await availableQuantity(String(item._id));
      const alreadyReserved = reserved.get(String(item._id)) || 0;
      if (available < alreadyReserved + line.quantity) {
        return NextResponse.json(
          {
            error: `Not enough sellable stock for ${item.sku}. Available: ${available}.`,
          },
          { status: 400 }
        );
      }
      reserved.set(String(item._id), alreadyReserved + line.quantity);

      const useSpecial = Boolean(line.useSpecial);
      const unitPrice = unitPriceForSale(
        item.sellingPrice,
        item.specialPrice,
        useSpecial
      );

      pending.push({ item, quantity: line.quantity });
      const lineTotal = unitPrice * line.quantity;
      revenue += lineTotal;
      sold.push({
        sku: item.sku,
        name: item.name,
        quantity: line.quantity,
        unitPrice,
        lineTotal,
        usedSpecial: useSpecial,
      });
    }

    const saleId = new mongoose.Types.ObjectId();
    const allocations: Array<{
      sku: string;
      batchNumber: string;
      quantity: number;
    }> = [];

    for (const row of pending) {
      const result = await consumeForSale({
        product: row.item,
        quantity: row.quantity,
        userId: session.user.id,
        saleId: String(saleId),
      });
      cogs += result.cogs;
      for (const alloc of result.allocations) {
        allocations.push({
          sku: row.item.sku,
          batchNumber: alloc.batchNumber,
          quantity: alloc.quantity,
        });
      }
    }

    const summary = sold
      .map(
        (row) =>
          `${row.sku} x${row.quantity}${row.usedSpecial ? " (special)" : ""}`
      )
      .join(", ");

    const categories = [
      ...new Set(pending.map((row) => row.item.category).filter(Boolean)),
    ];
    const saleCategory =
      categories.length === 1 ? String(categories[0]) : "Mixed";

    const sale = await Transaction.create({
      _id: saleId,
      type: "revenue",
      amount: Math.round(revenue * 100) / 100,
      category: saleCategory,
      description: `POS sale: ${summary}`,
      date: new Date(),
      paymentMethod: body.paymentMethod,
      reference: body.reference || undefined,
      source: "pos",
      createdBy: session.user.id,
    });

    let utangId: string | undefined;
    if (body.paymentMethod === "utang") {
      const amount = sale.amount;
      const committedPayment = Math.min(
        amount,
        Math.max(0, body.downPayment || 0)
      );
      const dueDate = body.dueDate
        ? new Date(body.dueDate)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const utang = await Utang.create({
        loanerName: body.loanerName!.trim(),
        contact: body.loanerContact?.trim(),
        direction: "receivable",
        amount,
        committedPayment,
        dueDate,
        notes: `POS sale on credit — ${summary}`,
        status: computeUtangStatus(amount, committedPayment, dueDate),
        saleId: sale._id,
        createdBy: session.user.id,
      });
      utangId = String(utang._id);
    }

    if (cogs > 0) {
      await Transaction.create({
        type: "expense",
        category: "cogs",
        amount: Math.round(cogs * 100) / 100,
        description: `POS COGS: ${summary}`,
        date: new Date(),
        source: "pos",
        createdBy: session.user.id,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        saleId: sale._id,
        utangId,
        total: sale.amount,
        cogs: Math.round(cogs * 100) / 100,
        items: sold,
        batches: allocations,
        paymentMethod: body.paymentMethod,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
