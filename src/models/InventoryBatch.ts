import mongoose, { Schema, model } from "mongoose";
import { InventoryBatchStatus } from "@/types/inventory";

export interface IInventoryBatch {
  _id: mongoose.Types.ObjectId;
  inventoryId: string;
  productId: mongoose.Types.ObjectId;
  batchNumber: string;
  receivedQuantity: number;
  soldQuantity: number;
  adjustmentQuantity: number;
  writeOffQuantity: number;
  currentQuantity: number;
  unitCost: number;
  manufacturingDate?: Date;
  expiryDate?: Date;
  receivedAt: Date;
  lastCountedAt?: Date;
  lastUpdatedAt: Date;
  depletedAt?: Date;
  supplier?: string;
  warehouse?: string;
  location?: string;
  purchaseOrder?: string;
  deliveryReceipt?: string;
  status: InventoryBatchStatus;
  blockedReason?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryBatchSchema = new Schema<IInventoryBatch>(
  {
    inventoryId: { type: String, required: true, unique: true, index: true },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },
    batchNumber: { type: String, required: true, trim: true, uppercase: true },
    receivedQuantity: { type: Number, required: true, min: 0, default: 0 },
    soldQuantity: { type: Number, required: true, min: 0, default: 0 },
    adjustmentQuantity: { type: Number, required: true, default: 0 },
    writeOffQuantity: { type: Number, required: true, min: 0, default: 0 },
    currentQuantity: { type: Number, required: true, min: 0, default: 0 },
    unitCost: { type: Number, required: true, min: 0, default: 0 },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date, index: true },
    receivedAt: { type: Date, required: true, index: true },
    lastCountedAt: { type: Date },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
    depletedAt: { type: Date },
    supplier: { type: String, trim: true },
    warehouse: { type: String, trim: true, default: "Main Store" },
    location: { type: String, trim: true },
    purchaseOrder: { type: String, trim: true },
    deliveryReceipt: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        "AVAILABLE",
        "LOW_STOCK",
        "OUT_OF_STOCK",
        "DEPLETED",
        "EXPIRED",
        "BLOCKED",
      ],
      default: "AVAILABLE",
      index: true,
    },
    blockedReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

InventoryBatchSchema.index({ productId: 1, batchNumber: 1 }, { unique: true });
InventoryBatchSchema.index({ productId: 1, status: 1, expiryDate: 1 });

function getModel() {
  return (
    (mongoose.models.InventoryBatch as mongoose.Model<IInventoryBatch>) ||
    model<IInventoryBatch>("InventoryBatch", InventoryBatchSchema)
  );
}

export const InventoryBatch = getModel();
