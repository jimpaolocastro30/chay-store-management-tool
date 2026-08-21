import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { InventoryItem } from "@/models/InventoryItem";
import { CapitalEntry } from "@/models/CapitalEntry";
import { Category } from "@/models/Category";
import { getDashboardData } from "@/lib/kpis";
import { requireSession } from "@/lib/api";
import { rowsToCsvResponse, sheetsToXlsxResponse } from "@/lib/export";
import { marginPercent, markupPercent } from "@/lib/utils";

type ExportFormat = "json" | "csv" | "xlsx";

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { error } = await requireSession("exportReports");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "pnl";
  const format = (searchParams.get("format") || "json") as ExportFormat;
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

    const rows = txs.map((t) => ({
      date: new Date(t.date).toISOString().slice(0, 10),
      type: t.type,
      category: t.category || "",
      description: t.description,
      paymentMethod: t.paymentMethod || "",
      source: t.source || "manual",
      amount: t.amount,
    }));

    if (format === "csv") {
      return rowsToCsvResponse(rows, `pnl-report-${stamp()}.csv`);
    }
    if (format === "xlsx") {
      return sheetsToXlsxResponse(
        [
          {
            name: "Summary",
            rows: [
              {
                from: from || "",
                to: to || "",
                revenue,
                expenses,
                netProfit: revenue - expenses,
                transactions: rows.length,
              },
            ],
          },
          { name: "Transactions", rows },
        ],
        `pnl-report-${stamp()}.xlsx`
      );
    }

    return NextResponse.json({
      type: "pnl",
      from,
      to,
      revenue,
      expenses,
      netProfit: revenue - expenses,
      transactions: txs,
    });
  }

  if (type === "sales") {
    const posFilter: Record<string, unknown> = {
      type: "revenue",
      $or: [{ source: "pos" }, { description: { $regex: /^POS sale:/i } }],
    };
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      posFilter.date = range;
    }

    const sales = await Transaction.find(posFilter).sort({ date: -1 }).lean();
    const total = sales.reduce((a, t) => a + t.amount, 0);
    const paymentBreakdown: Record<string, number> = {};
    const categoryBreakdown: Record<string, number> = {};
    for (const sale of sales) {
      const method = sale.paymentMethod || "cash";
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + sale.amount;
      const category = sale.category || "Uncategorized";
      categoryBreakdown[category] =
        (categoryBreakdown[category] || 0) + sale.amount;
    }

    const rows = sales.map((t) => ({
      date: new Date(t.date).toISOString().slice(0, 10),
      time: new Date(t.date).toISOString().slice(11, 19),
      category: t.category || "",
      description: t.description,
      paymentMethod: t.paymentMethod || "cash",
      reference: t.reference || "",
      amount: t.amount,
    }));

    if (format === "csv") {
      return rowsToCsvResponse(rows, `sales-report-${stamp()}.csv`);
    }
    if (format === "xlsx") {
      return sheetsToXlsxResponse(
        [
          {
            name: "Summary",
            rows: [
              {
                from: from || "",
                to: to || "",
                salesCount: rows.length,
                total,
                averageTicket: rows.length ? total / rows.length : 0,
              },
            ],
          },
          {
            name: "By payment",
            rows: Object.entries(paymentBreakdown).map(
              ([paymentMethod, amount]) => ({ paymentMethod, amount })
            ),
          },
          {
            name: "By category",
            rows: Object.entries(categoryBreakdown).map(
              ([category, amount]) => ({ category, amount })
            ),
          },
          { name: "Sales", rows },
        ],
        `sales-report-${stamp()}.xlsx`
      );
    }

    return NextResponse.json({
      type: "sales",
      from,
      to,
      total,
      salesCount: sales.length,
      averageTicket: sales.length ? total / sales.length : 0,
      paymentBreakdown: Object.entries(paymentBreakdown).map(
        ([paymentMethod, amount]) => ({ paymentMethod, amount })
      ),
      categoryBreakdown: Object.entries(categoryBreakdown).map(
        ([category, amount]) => ({ category, amount })
      ),
      sales,
    });
  }

  if (type === "inventory") {
    const items = await InventoryItem.find({ active: true }).lean();
    const valuation = items.map((i) => ({
      sku: i.sku,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      sold: i.sold || 0,
      reorderLevel: i.reorderLevel,
      unitCost: i.unitCost,
      sellingPrice: i.sellingPrice,
      specialPrice: i.specialPrice || 0,
      location: i.location || "",
      stockValue: i.quantity * i.unitCost,
      retailValue: i.quantity * i.sellingPrice,
      lowStock: i.quantity <= i.reorderLevel,
    }));
    const totalValue = valuation.reduce((a, i) => a + i.stockValue, 0);
    const retailValue = valuation.reduce((a, i) => a + i.retailValue, 0);
    const unitsOnHand = valuation.reduce((a, i) => a + i.quantity, 0);
    const unitsSold = valuation.reduce((a, i) => a + (i.sold || 0), 0);
    const lowStockCount = valuation.filter((i) => i.lowStock).length;

    if (format === "csv") {
      return rowsToCsvResponse(valuation, `inventory-report-${stamp()}.csv`);
    }
    if (format === "xlsx") {
      return sheetsToXlsxResponse(
        [
          {
            name: "Summary",
            rows: [
              {
                skus: valuation.length,
                unitsOnHand,
                unitsSold,
                stockValue: totalValue,
                retailValue,
                lowStockCount,
              },
            ],
          },
          { name: "Inventory", rows: valuation },
          {
            name: "Low stock",
            rows: valuation.filter((i) => i.lowStock),
          },
        ],
        `inventory-report-${stamp()}.xlsx`
      );
    }

    return NextResponse.json({
      type: "inventory",
      totalValue,
      retailValue,
      unitsOnHand,
      unitsSold,
      lowStockCount,
      items: valuation,
    });
  }

  if (type === "pricing") {
    const items = await InventoryItem.find({ active: true })
      .sort({ category: 1, name: 1 })
      .lean();
    const rows = items.map((i) => {
      const unitCost = Number(i.unitCost || 0);
      const sellingPrice = Number(i.sellingPrice || 0);
      const specialPrice = Number(i.specialPrice || 0);
      return {
        sku: i.sku,
        name: i.name,
        category: i.category,
        unitCost,
        sellingPrice,
        specialPrice,
        markupPercent: Number(markupPercent(unitCost, sellingPrice).toFixed(2)),
        marginPercent: Number(marginPercent(unitCost, sellingPrice).toFixed(2)),
        specialMarkupPercent: specialPrice
          ? Number(markupPercent(unitCost, specialPrice).toFixed(2))
          : 0,
        hasSpecial: specialPrice > 0,
      };
    });
    const withSpecial = rows.filter((r) => r.hasSpecial).length;
    const avgMarkup = rows.length
      ? rows.reduce((a, r) => a + r.markupPercent, 0) / rows.length
      : 0;
    const avgMargin = rows.length
      ? rows.reduce((a, r) => a + r.marginPercent, 0) / rows.length
      : 0;

    if (format === "csv") {
      return rowsToCsvResponse(rows, `pricing-report-${stamp()}.csv`);
    }
    if (format === "xlsx") {
      return sheetsToXlsxResponse(
        [
          {
            name: "Summary",
            rows: [
              {
                skus: rows.length,
                withSpecialPrice: withSpecial,
                averageMarkupPercent: Number(avgMarkup.toFixed(2)),
                averageMarginPercent: Number(avgMargin.toFixed(2)),
              },
            ],
          },
          { name: "Pricing", rows },
        ],
        `pricing-report-${stamp()}.xlsx`
      );
    }

    return NextResponse.json({
      type: "pricing",
      skuCount: rows.length,
      withSpecialPrice: withSpecial,
      averageMarkupPercent: Number(avgMarkup.toFixed(2)),
      averageMarginPercent: Number(avgMargin.toFixed(2)),
      items: rows,
    });
  }

  if (type === "kpi") {
    const data = await getDashboardData();
    const kpiRow = data.kpis as unknown as Record<string, unknown>;

    if (format === "csv") {
      return rowsToCsvResponse([kpiRow], `kpi-summary-${stamp()}.csv`);
    }
    if (format === "xlsx") {
      return sheetsToXlsxResponse(
        [
          {
            name: "KPIs",
            rows: Object.entries(kpiRow).map(([metric, value]) => ({
              metric,
              value,
            })),
          },
        ],
        `kpi-summary-${stamp()}.xlsx`
      );
    }
    return NextResponse.json({ type: "kpi", ...data.kpis });
  }

  if (type === "capital") {
    const entries = await CapitalEntry.find().sort({ date: -1 }).lean();
    const rows = entries.map((e) => ({
      date: new Date(e.date).toISOString().slice(0, 10),
      type: e.type,
      description: e.description,
      amount: e.amount,
    }));

    if (format === "csv") {
      return rowsToCsvResponse(rows, `capital-report-${stamp()}.csv`);
    }
    if (format === "xlsx") {
      return sheetsToXlsxResponse(
        [{ name: "Capital", rows }],
        `capital-report-${stamp()}.xlsx`
      );
    }
    return NextResponse.json({ type: "capital", entries });
  }

  if (type === "backup") {
    const [txs, items, capital, categories] = await Promise.all([
      Transaction.find().sort({ date: -1 }).lean(),
      InventoryItem.find().sort({ sku: 1 }).lean(),
      CapitalEntry.find().sort({ date: -1 }).lean(),
      Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    const transactionRows = txs.map((t) => ({
      date: new Date(t.date).toISOString().slice(0, 10),
      type: t.type,
      category: t.category || "",
      description: t.description,
      paymentMethod: t.paymentMethod || "",
      source: t.source || "manual",
      reference: t.reference || "",
      amount: t.amount,
    }));

    const inventoryRows = items.map((i) => ({
      sku: i.sku,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      sold: i.sold || 0,
      reorderLevel: i.reorderLevel,
      unitCost: i.unitCost,
      sellingPrice: i.sellingPrice,
      specialPrice: i.specialPrice || 0,
      location: i.location || "",
      notes: i.notes || "",
      active: i.active,
      stockValue: i.quantity * i.unitCost,
    }));

    const pricingRows = items.map((i) => {
      const unitCost = Number(i.unitCost || 0);
      const sellingPrice = Number(i.sellingPrice || 0);
      const specialPrice = Number(i.specialPrice || 0);
      return {
        sku: i.sku,
        name: i.name,
        category: i.category,
        unitCost,
        sellingPrice,
        specialPrice,
        markupPercent: Number(markupPercent(unitCost, sellingPrice).toFixed(2)),
        marginPercent: Number(marginPercent(unitCost, sellingPrice).toFixed(2)),
      };
    });

    const capitalRows = capital.map((e) => ({
      date: new Date(e.date).toISOString().slice(0, 10),
      type: e.type,
      description: e.description,
      amount: e.amount,
    }));

    const categoryRows = categories.map((c) => ({
      name: c.name,
      sortOrder: c.sortOrder,
    }));

    const summaryRows = [
      {
        exportedAt: new Date().toISOString(),
        transactions: transactionRows.length,
        inventoryItems: inventoryRows.length,
        pricingItems: pricingRows.length,
        capitalEntries: capitalRows.length,
        categories: categoryRows.length,
      },
    ];

    if (format === "xlsx") {
      return sheetsToXlsxResponse(
        [
          { name: "Summary", rows: summaryRows },
          { name: "Transactions", rows: transactionRows },
          { name: "Inventory", rows: inventoryRows },
          { name: "Pricing", rows: pricingRows },
          { name: "Capital", rows: capitalRows },
          { name: "Categories", rows: categoryRows },
        ],
        `chay-ops-backup-${stamp()}.xlsx`
      );
    }

    if (format === "csv") {
      // Single CSV with a dataset column so all tables restore from one file.
      const rows: Record<string, unknown>[] = [
        ...transactionRows.map((row) => ({ dataset: "transactions", ...row })),
        ...inventoryRows.map((row) => ({ dataset: "inventory", ...row })),
        ...pricingRows.map((row) => ({ dataset: "pricing", ...row })),
        ...capitalRows.map((row) => ({ dataset: "capital", ...row })),
        ...categoryRows.map((row) => ({ dataset: "categories", ...row })),
      ];
      return rowsToCsvResponse(rows, `chay-ops-backup-${stamp()}.csv`);
    }

    return NextResponse.json({
      type: "backup",
      exportedAt: new Date().toISOString(),
      counts: {
        transactions: transactionRows.length,
        inventory: inventoryRows.length,
        pricing: pricingRows.length,
        capital: capitalRows.length,
        categories: categoryRows.length,
      },
      transactions: transactionRows,
      inventory: inventoryRows,
      pricing: pricingRows,
      capital: capitalRows,
      categories: categoryRows,
    });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
