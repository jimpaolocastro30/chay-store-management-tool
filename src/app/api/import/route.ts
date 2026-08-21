import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db";
import { Transaction } from "@/models/Transaction";
import { InventoryItem } from "@/models/InventoryItem";
import { CapitalEntry } from "@/models/CapitalEntry";
import { Category } from "@/models/Category";
import { requireSession } from "@/lib/api";
import { can, Permission } from "@/lib/utils";
import { UserRole } from "@/types";

type ImportKind =
  | "auto"
  | "backup"
  | "pricing"
  | "inventory"
  | "transactions"
  | "capital"
  | "categories";

type Counts = Record<string, number>;

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return undefined;
}

function asString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(
        Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S)
      );
    }
  }
  const raw = asString(value);
  if (!raw) return new Date();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeSheetName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

function sheetKind(name: string): ImportKind | null {
  const key = normalizeSheetName(name);
  if (key.includes("pric")) return "pricing";
  if (key.includes("invent")) return "inventory";
  if (key.includes("trans") || key.includes("sale")) return "transactions";
  if (key.includes("capit")) return "capital";
  if (key.includes("categ")) return "categories";
  if (key.includes("backup") || key.includes("summary")) return null;
  return null;
}

async function importInventory(rows: Record<string, unknown>[]) {
  let upserted = 0;
  for (const row of rows) {
    const sku = asString(cell(row, "sku", "SKU")).toUpperCase();
    const name = asString(cell(row, "name", "Name"));
    if (!sku) continue;

    const update: Record<string, unknown> = {
      sku,
      unitCost: asNumber(cell(row, "unitCost", "UnitCost", "unit_cost")),
      sellingPrice: asNumber(
        cell(row, "sellingPrice", "SellingPrice", "selling_price")
      ),
      specialPrice: asNumber(
        cell(row, "specialPrice", "SpecialPrice", "special_price")
      ),
    };

    const category = asString(cell(row, "category", "Category"));
    if (category) update.category = category;
    if (cell(row, "quantity", "Quantity") !== undefined) {
      update.quantity = asNumber(cell(row, "quantity", "Quantity"));
    }
    if (cell(row, "sold", "Sold") !== undefined) {
      update.sold = asNumber(cell(row, "sold", "Sold"));
    }
    if (cell(row, "reorderLevel", "ReorderLevel") !== undefined) {
      update.reorderLevel = asNumber(
        cell(row, "reorderLevel", "ReorderLevel")
      );
    }
    const location = asString(cell(row, "location", "Location"));
    if (location) update.location = location;
    const notes = asString(cell(row, "notes", "Notes"));
    if (notes) update.notes = notes;
    if (cell(row, "active", "Active") !== undefined) {
      const active = cell(row, "active", "Active");
      update.active =
        active === true ||
        active === 1 ||
        asString(active).toLowerCase() === "true";
    } else {
      update.active = true;
    }

    if (!name) {
      const existing = await InventoryItem.findOne({ sku });
      if (!existing) continue;
      await InventoryItem.updateOne({ sku }, { $set: update });
    } else {
      update.name = name;
      if (!update.category) update.category = "General";
      await InventoryItem.findOneAndUpdate(
        { sku },
        { $set: update },
        { upsert: true, new: true }
      );
    }
    upserted += 1;
  }
  return upserted;
}

async function importPricing(rows: Record<string, unknown>[]) {
  let updated = 0;
  for (const row of rows) {
    const sku = asString(cell(row, "sku", "SKU")).toUpperCase();
    if (!sku) continue;

    const patch: Record<string, unknown> = {};
    if (cell(row, "unitCost", "UnitCost") !== undefined) {
      patch.unitCost = asNumber(cell(row, "unitCost", "UnitCost"));
    }
    if (cell(row, "sellingPrice", "SellingPrice") !== undefined) {
      patch.sellingPrice = asNumber(cell(row, "sellingPrice", "SellingPrice"));
    }
    if (cell(row, "specialPrice", "SpecialPrice") !== undefined) {
      patch.specialPrice = asNumber(cell(row, "specialPrice", "SpecialPrice"));
    }
    if (!Object.keys(patch).length) continue;

    const result = await InventoryItem.updateOne({ sku }, { $set: patch });
    if (result.matchedCount) updated += 1;
  }
  return updated;
}

async function importTransactions(
  rows: Record<string, unknown>[],
  userId?: string
) {
  let created = 0;
  for (const row of rows) {
    const type = asString(cell(row, "type", "Type")).toLowerCase();
    const amount = asNumber(cell(row, "amount", "Amount"));
    const description = asString(
      cell(row, "description", "Description"),
      `${type} import`
    );
    if (!["revenue", "expense", "loss"].includes(type) || amount <= 0) {
      continue;
    }

    const reference = asString(cell(row, "reference", "Reference"));
    if (reference) {
      const existing = await Transaction.findOne({ reference, amount, type });
      if (existing) continue;
    }

    await Transaction.create({
      type,
      amount,
      category: asString(cell(row, "category", "Category"), "other"),
      description,
      date: asDate(cell(row, "date", "Date")),
      paymentMethod: asString(
        cell(row, "paymentMethod", "PaymentMethod"),
        "cash"
      ),
      source: asString(cell(row, "source", "Source"), "manual") || "manual",
      reference: reference || undefined,
      createdBy: userId,
    });
    created += 1;
  }
  return created;
}

async function importCapital(rows: Record<string, unknown>[], userId?: string) {
  let created = 0;
  for (const row of rows) {
    const type = asString(cell(row, "type", "Type")).toLowerCase();
    const amount = asNumber(cell(row, "amount", "Amount"));
    const description = asString(cell(row, "description", "Description"));
    if (!["initial", "investment", "withdrawal"].includes(type) || amount <= 0) {
      continue;
    }

    await CapitalEntry.create({
      type,
      amount,
      description: description || `${type} import`,
      date: asDate(cell(row, "date", "Date")),
      createdBy: userId,
    });
    created += 1;
  }
  return created;
}

async function importCategories(rows: Record<string, unknown>[]) {
  let upserted = 0;
  for (const row of rows) {
    const name = asString(cell(row, "name", "Name"));
    if (!name) continue;
    await Category.findOneAndUpdate(
      { name },
      {
        name,
        sortOrder: asNumber(cell(row, "sortOrder", "SortOrder"), 0),
      },
      { upsert: true, new: true }
    );
    upserted += 1;
  }
  return upserted;
}

async function importRows(
  kind: ImportKind,
  rows: Record<string, unknown>[],
  userId?: string
) {
  if (!rows.length) return 0;
  switch (kind) {
    case "pricing":
      return importPricing(rows);
    case "inventory":
      return importInventory(rows);
    case "transactions":
      return importTransactions(rows, userId);
    case "capital":
      return importCapital(rows, userId);
    case "categories":
      return importCategories(rows);
    default:
      return 0;
  }
}

function requiredPermission(kind: ImportKind): Permission {
  if (kind === "pricing" || kind === "inventory") return "manageInventory";
  if (kind === "capital") return "manageCapital";
  if (kind === "backup" || kind === "auto") return "exportReports";
  return "manageTransactions";
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireSession();
  if (error || !session) return error;

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    let kind = String(form.get("kind") || "auto") as ImportKind;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const role = session.user.role as UserRole;
    const permission = requiredPermission(kind);
    if (!can(role, permission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const counts: Counts = {};
    let total = 0;

    const isMultiSheetBackup =
      kind === "backup" ||
      kind === "auto" ||
      workbook.SheetNames.some((name) =>
        ["transactions", "inventory", "pricing", "capital", "categories"].includes(
          normalizeSheetName(name)
        )
      );

    if (isMultiSheetBackup && (kind === "backup" || kind === "auto")) {
      if (!can(role, "exportReports")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      for (const sheetName of workbook.SheetNames) {
        const mapped = sheetKind(sheetName);
        if (!mapped) continue;
        if (mapped === "capital" && !can(role, "manageCapital")) continue;
        if (
          (mapped === "inventory" || mapped === "pricing") &&
          !can(role, "manageInventory")
        ) {
          continue;
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const n = await importRows(mapped, rows, session.user.id);
        counts[mapped] = (counts[mapped] || 0) + n;
        total += n;
      }

      // Flat CSV backup with dataset column (single sheet).
      if (!total && workbook.SheetNames.length === 1) {
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const hasDataset = rows.some((row) => cell(row, "dataset", "Dataset"));
        if (hasDataset) {
          const groups: Record<string, Record<string, unknown>[]> = {};
          for (const row of rows) {
            const dataset = asString(
              cell(row, "dataset", "Dataset")
            ).toLowerCase();
            if (!dataset) continue;
            (groups[dataset] ||= []).push(row);
          }
          for (const [dataset, groupRows] of Object.entries(groups)) {
            const mapped = sheetKind(dataset) || (dataset as ImportKind);
            if (
              !["pricing", "inventory", "transactions", "capital", "categories"].includes(
                mapped
              )
            ) {
              continue;
            }
            if (mapped === "capital" && !can(role, "manageCapital")) continue;
            if (
              (mapped === "inventory" || mapped === "pricing") &&
              !can(role, "manageInventory")
            ) {
              continue;
            }
            const n = await importRows(mapped, groupRows, session.user.id);
            counts[mapped] = (counts[mapped] || 0) + n;
            total += n;
          }
        }
      }

      return NextResponse.json({ ok: true, kind: "backup", created: total, counts });
    }

    if (kind === "auto") {
      const first = sheetKind(workbook.SheetNames[0] || "") || "transactions";
      kind = first;
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const created = await importRows(kind, rows, session.user.id);
    counts[kind] = created;

    return NextResponse.json({ ok: true, kind, created, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
