import { connectDB } from "@/lib/db";
import { Transaction, ITransaction } from "@/models/Transaction";
import { InventoryItem, IInventoryItem } from "@/models/InventoryItem";
import { CapitalEntry, ICapitalEntry } from "@/models/CapitalEntry";
import { Alert, IAlert } from "@/models/Alert";
import { startOfMonth, startOfYear } from "@/lib/utils";
import {
  ChartPoint,
  DashboardKpis,
  ExpenseBreakdown,
} from "@/types";

type TxLean = Pick<ITransaction, "type" | "amount" | "category" | "date">;
type InvLean = Pick<
  IInventoryItem,
  "_id" | "name" | "sku" | "quantity" | "reorderLevel" | "unitCost"
>;
type CapLean = Pick<ICapitalEntry, "type" | "amount">;
type AlertLean = IAlert;

function sumByType(rows: TxLean[], type: string) {
  return rows
    .filter((r) => r.type === type)
    .reduce((acc, r) => acc + r.amount, 0);
}

export async function getDashboardData() {
  await connectDB();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [monthTx, yearTx, inventory, capital, recentAlerts, trendTx] =
    await Promise.all([
      Transaction.find({ date: { $gte: monthStart } }).lean<TxLean[]>(),
      Transaction.find({ date: { $gte: yearStart } }).lean<TxLean[]>(),
      InventoryItem.find({ active: true }).lean<InvLean[]>(),
      CapitalEntry.find().lean<CapLean[]>(),
      Alert.find().sort({ createdAt: -1 }).limit(8).lean<AlertLean[]>(),
      Transaction.find({ date: { $gte: sixMonthsAgo } }).lean<TxLean[]>(),
    ]);

  const revenueMtd = sumByType(monthTx, "revenue");
  const expensesMtd =
    sumByType(monthTx, "expense") + sumByType(monthTx, "loss");
  const cogsMtd = monthTx
    .filter((t) => t.type === "expense" && t.category === "cogs")
    .reduce((acc, t) => acc + t.amount, 0);
  const revenueYtd = sumByType(yearTx, "revenue");
  const netProfitMtd = revenueMtd - expensesMtd;

  const inventoryValue = inventory.reduce(
    (acc, item) => acc + item.quantity * item.unitCost,
    0
  );
  const lowStock = inventory.filter((i) => i.quantity <= i.reorderLevel);

  const invested = capital
    .filter((c) => c.type === "initial" || c.type === "investment")
    .reduce((acc, c) => acc + c.amount, 0);
  const withdrawn = capital
    .filter((c) => c.type === "withdrawal")
    .reduce((acc, c) => acc + c.amount, 0);
  const totalCapital = invested - withdrawn;
  const cashPosition = totalCapital + netProfitMtd;
  const workingCapital = cashPosition + inventoryValue;

  const avgInventory = inventoryValue || 1;
  const inventoryTurnover = cogsMtd / avgInventory;
  const grossMargin =
    revenueMtd > 0 ? ((revenueMtd - cogsMtd) / revenueMtd) * 100 : 0;
  const netMargin = revenueMtd > 0 ? (netProfitMtd / revenueMtd) * 100 : 0;
  const expenseRatio = revenueMtd > 0 ? (expensesMtd / revenueMtd) * 100 : 0;
  const roiOnCapital =
    totalCapital > 0 ? (netProfitMtd / totalCapital) * 100 : 0;

  const kpis: DashboardKpis = {
    revenueMtd,
    revenueYtd,
    expensesMtd,
    netProfitMtd,
    grossMargin,
    netMargin,
    inventoryValue,
    inventoryCount: inventory.length,
    lowStockCount: lowStock.length,
    inventoryTurnover,
    totalCapital,
    workingCapital,
    cashPosition,
    roiOnCapital,
    expenseRatio,
  };

  const monthMap = new Map<string, ChartPoint>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-PH", {
      month: "short",
      year: "2-digit",
    });
    monthMap.set(`${d.getFullYear()}-${d.getMonth()}`, {
      label,
      revenue: 0,
      expense: 0,
      profit: 0,
    });
  }

  for (const tx of trendTx) {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const point = monthMap.get(key);
    if (!point) continue;
    if (tx.type === "revenue") point.revenue += tx.amount;
    if (tx.type === "expense" || tx.type === "loss") point.expense += tx.amount;
  }

  const trend: ChartPoint[] = Array.from(monthMap.values()).map((p) => ({
    ...p,
    profit: p.revenue - p.expense,
  }));

  const expenseBreakdownMap = new Map<string, number>();
  for (const tx of monthTx) {
    if (tx.type !== "expense" && tx.type !== "loss") continue;
    const cat = tx.category || "other";
    expenseBreakdownMap.set(
      cat,
      (expenseBreakdownMap.get(cat) || 0) + tx.amount
    );
  }

  const expenseBreakdown: ExpenseBreakdown[] = Array.from(
    expenseBreakdownMap.entries()
  ).map(([category, amount]) => ({ category, amount }));

  // Refresh low-stock alerts (idempotent upsert by relatedId)
  for (const item of lowStock) {
    const relatedId = String(item._id);
    const existing = await Alert.findOne({
      type: "low_stock",
      relatedId,
      read: false,
    });
    if (!existing) {
      await Alert.create({
        type: "low_stock",
        title: "Low stock alert",
        message: `${item.name} (${item.sku}) is at ${item.quantity} units — reorder level is ${item.reorderLevel}.`,
        severity: item.quantity === 0 ? "high" : "medium",
        relatedId,
      });
    }
  }

  if (cashPosition < 0) {
    const existing = await Alert.findOne({
      type: "negative_cash",
      read: false,
    });
    if (!existing) {
      await Alert.create({
        type: "negative_cash",
        title: "Negative cash position",
        message: `Cash position is ₱${cashPosition.toFixed(2)}. Review expenses and capital.`,
        severity: "high",
      });
    }
  }

  const alerts = await Alert.find().sort({ createdAt: -1 }).limit(8).lean();

  return {
    kpis,
    trend,
    expenseBreakdown,
    lowStock,
    alerts: alerts.length ? alerts : recentAlerts,
  };
}
