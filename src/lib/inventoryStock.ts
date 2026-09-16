import mongoose, { HydratedDocument } from "mongoose";
import { InventoryItem, IInventoryItem } from "@/models/InventoryItem";
import { InventoryBatch, IInventoryBatch } from "@/models/InventoryBatch";
import { InventoryTxn } from "@/models/InventoryTxn";
import { nextSequence } from "@/models/Counter";
import {
  InventoryBatchStatus,
  InventoryTxnType,
} from "@/types/inventory";

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeBatchStatus(
  batch: Pick<
    IInventoryBatch,
    "currentQuantity" | "expiryDate" | "status" | "blockedReason"
  >,
  reorderLevel: number
): InventoryBatchStatus {
  if (batch.status === "BLOCKED" || batch.blockedReason) return "BLOCKED";
  if (batch.expiryDate && batch.expiryDate < todayStart()) return "EXPIRED";
  if (batch.currentQuantity <= 0) return "DEPLETED";
  if (batch.currentQuantity <= reorderLevel) return "LOW_STOCK";
  return "AVAILABLE";
}

export function isSellableBatch(batch: IInventoryBatch) {
  const status = computeBatchStatus(batch, 0);
  return (
    batch.currentQuantity > 0 &&
    status !== "EXPIRED" &&
    status !== "BLOCKED" &&
    status !== "DEPLETED"
  );
}

export async function nextInventoryId() {
  return `INV-${await nextSequence("inventory_batch", 7)}`;
}

export async function nextCountNumber() {
  return `COUNT-${await nextSequence("inventory_count", 5)}`;
}

export async function nextAdjustmentId() {
  return `ADJ-${await nextSequence("inventory_adjustment", 6)}`;
}

export async function refreshExpiredBatches(productId?: string) {
  const now = todayStart();
  const filter: Record<string, unknown> = {
    expiryDate: { $lt: now },
    currentQuantity: { $gt: 0 },
    status: { $nin: ["EXPIRED", "BLOCKED"] },
  };
  if (productId) filter.productId = productId;
  await InventoryBatch.updateMany(filter, {
    $set: { status: "EXPIRED", lastUpdatedAt: new Date() },
  });
}

export async function syncProductTotals(productId: string | mongoose.Types.ObjectId) {
  const batches = await InventoryBatch.find({ productId });
  const quantity = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
  const sold = batches.reduce((sum, b) => sum + b.soldQuantity, 0);
  const latestCost = [...batches]
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .find((b) => b.currentQuantity > 0);

  const update: Record<string, unknown> = { quantity, sold };
  if (latestCost) update.unitCost = latestCost.unitCost;

  await InventoryItem.findByIdAndUpdate(productId, { $set: update });
  return { quantity, sold };
}

async function persistBatchStatus(
  batch: HydratedDocument<IInventoryBatch>,
  reorderLevel: number,
  userId?: string
) {
  const status = computeBatchStatus(batch, reorderLevel);
  batch.status = status;
  batch.lastUpdatedAt = new Date();
  if (userId) batch.updatedBy = new mongoose.Types.ObjectId(userId);
  if (batch.currentQuantity <= 0 && !batch.depletedAt) {
    batch.depletedAt = new Date();
  }
  if (batch.currentQuantity > 0) {
    batch.depletedAt = undefined;
  }
  await batch.save();
  return status;
}

export async function appendTxn(params: {
  batch: HydratedDocument<IInventoryBatch>;
  type: InventoryTxnType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  userId?: string;
  referenceType?: string;
  referenceId?: string;
  remarks?: string;
  reason?: string;
}) {
  return InventoryTxn.create({
    inventoryBatchId: params.batch._id,
    productId: params.batch.productId,
    transactionType: params.type,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    quantity: params.quantity,
    quantityBefore: params.quantityBefore,
    quantityAfter: params.quantityAfter,
    unitCost: params.batch.unitCost,
    transactionDate: new Date(),
    performedBy: params.userId,
    remarks: params.remarks,
    reason: params.reason,
  });
}

export async function applyQuantityChange(params: {
  batch: HydratedDocument<IInventoryBatch>;
  product: IInventoryItem;
  type: InventoryTxnType;
  delta: number;
  userId?: string;
  referenceType?: string;
  referenceId?: string;
  remarks?: string;
  reason?: string;
  soldDelta?: number;
  adjustmentDelta?: number;
  writeOffDelta?: number;
}) {
  const before = params.batch.currentQuantity;
  const after = before + params.delta;
  if (after < 0) {
    throw new Error(
      `Insufficient stock for ${params.product.sku} batch ${params.batch.batchNumber}. Available: ${before}.`
    );
  }

  params.batch.currentQuantity = after;
  if (params.soldDelta) {
    params.batch.soldQuantity = Math.max(
      0,
      params.batch.soldQuantity + params.soldDelta
    );
  }
  if (params.adjustmentDelta) {
    params.batch.adjustmentQuantity += params.adjustmentDelta;
  }
  if (params.writeOffDelta) {
    params.batch.writeOffQuantity = Math.max(
      0,
      params.batch.writeOffQuantity + params.writeOffDelta
    );
  }

  await persistBatchStatus(params.batch, params.product.reorderLevel, params.userId);
  await appendTxn({
    batch: params.batch,
    type: params.type,
    quantity: params.delta,
    quantityBefore: before,
    quantityAfter: after,
    userId: params.userId,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    remarks: params.remarks,
    reason: params.reason,
  });
  await syncProductTotals(params.product._id);
  return params.batch;
}

export async function ensureOpeningBatch(
  product: IInventoryItem,
  userId?: string
) {
  const existing = await InventoryBatch.countDocuments({
    productId: product._id,
  });
  if (existing > 0) return;

  const current = Math.max(0, product.quantity || 0);
  const sold = Math.max(0, product.sold || 0);
  const received = current + sold;
  if (received <= 0 && current <= 0) return;

  const batch = await InventoryBatch.create({
    inventoryId: await nextInventoryId(),
    productId: product._id,
    batchNumber: `OPEN-${product.sku}`,
    receivedQuantity: received,
    soldQuantity: sold,
    adjustmentQuantity: 0,
    writeOffQuantity: 0,
    currentQuantity: current,
    unitCost: product.unitCost || 0,
    receivedAt: product.createdAt || new Date(),
    lastUpdatedAt: new Date(),
    warehouse: product.location || "Main Store",
    location: product.location,
    createdBy: userId,
    updatedBy: userId,
  });

  await persistBatchStatus(batch, product.reorderLevel, userId);
  if (received > 0) {
    await appendTxn({
      batch,
      type: "OPENING_BALANCE",
      quantity: received,
      quantityBefore: 0,
      quantityAfter: received,
      userId,
      remarks: "Migrated opening stock from product record",
    });
    if (sold > 0) {
      await appendTxn({
        batch,
        type: "SALE",
        quantity: -sold,
        quantityBefore: received,
        quantityAfter: current,
        userId,
        remarks: "Historical sold quantity at migration",
      });
    }
  }
}

export async function receiveStock(params: {
  productId: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  expiryDate?: string;
  manufacturingDate?: string;
  receivedAt?: string;
  supplier?: string;
  warehouse?: string;
  location?: string;
  purchaseOrder?: string;
  deliveryReceipt?: string;
  userId?: string;
  remarks?: string;
}) {
  const product = await InventoryItem.findById(params.productId);
  if (!product || !product.active) {
    throw new Error("Product not found");
  }
  await ensureOpeningBatch(product, params.userId);

  const batchNumber = params.batchNumber.trim().toUpperCase();
  const existing = await InventoryBatch.findOne({
    productId: product._id,
    batchNumber,
  });
  if (existing) {
    throw new Error(`Batch ${batchNumber} already exists for ${product.sku}.`);
  }

  const qty = params.quantity;
  const receivedAt = params.receivedAt ? new Date(params.receivedAt) : new Date();
  const batch = await InventoryBatch.create({
    inventoryId: await nextInventoryId(),
    productId: product._id,
    batchNumber,
    receivedQuantity: qty,
    soldQuantity: 0,
    adjustmentQuantity: 0,
    writeOffQuantity: 0,
    currentQuantity: qty,
    unitCost: params.unitCost,
    manufacturingDate: params.manufacturingDate
      ? new Date(params.manufacturingDate)
      : undefined,
    expiryDate: params.expiryDate ? new Date(params.expiryDate) : undefined,
    receivedAt,
    lastUpdatedAt: new Date(),
    supplier: params.supplier,
    warehouse: params.warehouse || product.location || "Main Store",
    location: params.location || product.location,
    purchaseOrder: params.purchaseOrder,
    deliveryReceipt: params.deliveryReceipt,
    createdBy: params.userId,
    updatedBy: params.userId,
  });

  await persistBatchStatus(batch, product.reorderLevel, params.userId);
  await appendTxn({
    batch,
    type: "RECEIVING",
    quantity: qty,
    quantityBefore: 0,
    quantityAfter: qty,
    userId: params.userId,
    remarks: params.remarks || `Received batch ${batchNumber}`,
  });
  await syncProductTotals(product._id);
  return batch;
}

export async function sellableBatches(productId: string | mongoose.Types.ObjectId) {
  await refreshExpiredBatches(String(productId));
  const batches = await InventoryBatch.find({
    productId,
    currentQuantity: { $gt: 0 },
    status: { $nin: ["BLOCKED", "EXPIRED", "DEPLETED"] },
  });

  const now = todayStart();
  return batches
    .filter((b) => !b.expiryDate || b.expiryDate >= now)
    .sort((a, b) => {
      const aExp = a.expiryDate ? a.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
      const bExp = b.expiryDate ? b.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
      if (aExp !== bExp) return aExp - bExp;
      return a.receivedAt.getTime() - b.receivedAt.getTime();
    });
}

export async function availableQuantity(productId: string) {
  const batches = await sellableBatches(productId);
  return batches.reduce((sum, b) => sum + b.currentQuantity, 0);
}

export async function consumeForSale(params: {
  product: IInventoryItem;
  quantity: number;
  userId?: string;
  saleId?: string;
}) {
  await ensureOpeningBatch(params.product, params.userId);
  const batches = await sellableBatches(params.product._id);
  const available = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
  if (available < params.quantity) {
    throw new Error(
      `Not enough sellable stock for ${params.product.sku}. Available: ${available}.`
    );
  }

  let remaining = params.quantity;
  let cogs = 0;
  const allocations: Array<{
    batchId: string;
    batchNumber: string;
    quantity: number;
    unitCost: number;
  }> = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.currentQuantity, remaining);
    cogs += take * batch.unitCost;
    await applyQuantityChange({
      batch,
      product: params.product,
      type: "SALE",
      delta: -take,
      soldDelta: take,
      userId: params.userId,
      referenceType: "sale",
      referenceId: params.saleId,
      remarks: `POS sale ${params.saleId || ""}`.trim(),
    });
    allocations.push({
      batchId: String(batch._id),
      batchNumber: batch.batchNumber,
      quantity: take,
      unitCost: batch.unitCost,
    });
    remaining -= take;
  }

  return { allocations, cogs };
}

export async function adjustBatch(params: {
  batchId: string;
  physicalQuantity?: number;
  delta?: number;
  reason: string;
  remarks?: string;
  userId?: string;
  referenceType?: string;
  referenceId?: string;
}) {
  const batch = await InventoryBatch.findById(params.batchId);
  if (!batch) throw new Error("Batch not found");
  const product = await InventoryItem.findById(batch.productId);
  if (!product) throw new Error("Product not found");

  if (params.referenceType === "count") {
    batch.lastCountedAt = new Date();
  }

  const delta =
    params.delta !== undefined
      ? params.delta
      : (params.physicalQuantity ?? batch.currentQuantity) - batch.currentQuantity;

  if (delta === 0) {
    if (params.referenceType === "count") await batch.save();
    return batch;
  }
  if (batch.currentQuantity + delta < 0) {
    throw new Error("Adjustment would make quantity negative");
  }

  const writeOff =
    delta < 0 &&
    ["Damaged", "Spoilage", "Expired", "Theft/Shrinkage"].includes(params.reason)
      ? Math.abs(delta)
      : 0;

  let type: InventoryTxnType = delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
  if (params.reason === "Damaged") type = "DAMAGE";
  if (params.reason === "Expired") type = "EXPIRY";

  const adjId = params.referenceId || (await nextAdjustmentId());
  await applyQuantityChange({
    batch,
    product,
    type,
    delta,
    adjustmentDelta: delta,
    writeOffDelta: writeOff,
    userId: params.userId,
    referenceType: params.referenceType || "adjustment",
    referenceId: adjId,
    remarks: params.remarks,
    reason: params.reason,
  });
  return batch;
}

export function productStatus(
  quantity: number,
  reorderLevel: number
): InventoryBatchStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= reorderLevel) return "LOW_STOCK";
  return "AVAILABLE";
}
