import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";
import { InventoryItem } from "@/models/InventoryItem";
import { CapitalEntry } from "@/models/CapitalEntry";
import { Alert } from "@/models/Alert";

export async function POST() {
  const allowed =
    process.env.ALLOW_SEED === "true" ||
    process.env.NODE_ENV !== "production";

  if (!allowed) {
    return NextResponse.json(
      { error: "Seeding disabled in production" },
      { status: 403 }
    );
  }

  try {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      Transaction.deleteMany({}),
      InventoryItem.deleteMany({}),
      CapitalEntry.deleteMany({}),
      Alert.deleteMany({}),
    ]);

    const password = await bcrypt.hash("password123", 10);

    const [owner] = await User.create([
      {
        name: "Maria Santos",
        email: "owner@chay.ph",
        password,
        role: "owner",
      },
      {
        name: "Juan Dela Cruz",
        email: "manager@chay.ph",
        password,
        role: "manager",
      },
      {
        name: "Ana Reyes",
        email: "staff@chay.ph",
        password,
        role: "staff",
      },
    ]);

    const now = new Date();
    const monthsAgo = (n: number, day = 10) =>
      new Date(now.getFullYear(), now.getMonth() - n, day);

    await CapitalEntry.create([
      {
        type: "initial",
        amount: 500000,
        description: "Initial store capital",
        date: monthsAgo(6, 1),
        createdBy: owner._id,
      },
      {
        type: "investment",
        amount: 100000,
        description: "Additional working capital",
        date: monthsAgo(2, 5),
        createdBy: owner._id,
      },
      {
        type: "withdrawal",
        amount: 25000,
        description: "Owner draw",
        date: monthsAgo(1, 15),
        createdBy: owner._id,
      },
    ]);

    await InventoryItem.create([
      {
        sku: "TEA-001",
        name: "Jasmine Green Tea 250g",
        category: "Tea",
        quantity: 42,
        reorderLevel: 15,
        unitCost: 180,
        sellingPrice: 280,
      },
      {
        sku: "TEA-002",
        name: "Earl Grey Loose Leaf 250g",
        category: "Tea",
        quantity: 8,
        reorderLevel: 12,
        unitCost: 220,
        sellingPrice: 350,
      },
      {
        sku: "SNK-010",
        name: "Pandesa Cookies Box",
        category: "Snacks",
        quantity: 55,
        reorderLevel: 20,
        unitCost: 95,
        sellingPrice: 150,
      },
      {
        sku: "BEV-020",
        name: "Bottled Cold Brew 350ml",
        category: "Beverages",
        quantity: 3,
        reorderLevel: 24,
        unitCost: 45,
        sellingPrice: 89,
      },
      {
        sku: "MER-030",
        name: "Chay Ceramic Mug",
        category: "Merchandise",
        quantity: 18,
        reorderLevel: 10,
        unitCost: 120,
        sellingPrice: 249,
      },
      {
        sku: "SUP-040",
        name: "Paper Cups 12oz (50pcs)",
        category: "Supplies",
        quantity: 6,
        reorderLevel: 10,
        unitCost: 160,
        sellingPrice: 0,
      },
    ]);

    const revenueDescriptions = [
      "Walk-in tea sales",
      "Cafe beverage sales",
      "Gift set orders",
      "Corporate catering",
      "Weekend promo sales",
    ];

    const txs = [];
    for (let m = 5; m >= 0; m--) {
      for (let i = 0; i < 6; i++) {
        txs.push({
          type: "revenue",
          amount: 12000 + Math.round(Math.random() * 18000),
          description: revenueDescriptions[i % revenueDescriptions.length],
          date: monthsAgo(m, 3 + i * 4),
          paymentMethod: i % 2 === 0 ? "cash" : "gcash",
          createdBy: owner._id,
        });
      }

      txs.push(
        {
          type: "expense",
          category: "cogs",
          amount: 18000 + Math.round(Math.random() * 8000),
          description: "Inventory replenishment",
          date: monthsAgo(m, 8),
          createdBy: owner._id,
        },
        {
          type: "expense",
          category: "rent",
          amount: 25000,
          description: "Store rent",
          date: monthsAgo(m, 1),
          createdBy: owner._id,
        },
        {
          type: "expense",
          category: "utilities",
          amount: 4500 + Math.round(Math.random() * 1500),
          description: "Electricity & water",
          date: monthsAgo(m, 12),
          createdBy: owner._id,
        },
        {
          type: "expense",
          category: "payroll",
          amount: 48000,
          description: "Staff salaries",
          date: monthsAgo(m, 28),
          createdBy: owner._id,
        }
      );
    }

    txs.push({
      type: "loss",
      category: "damage",
      amount: 2200,
      description: "Damaged bottled drinks from delivery",
      date: monthsAgo(0, 6),
      createdBy: owner._id,
    });

    await Transaction.insertMany(txs);

    await Alert.create({
      type: "info",
      title: "Welcome to Chay Ops",
      message:
        "Demo data loaded. Use owner@chay.ph / password123 to explore the platform.",
      severity: "low",
    });

    return NextResponse.json({
      ok: true,
      accounts: [
        { email: "owner@chay.ph", role: "owner", password: "password123" },
        { email: "manager@chay.ph", role: "manager", password: "password123" },
        { email: "staff@chay.ph", role: "staff", password: "password123" },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
