import mongoose, { Schema, model } from "mongoose";
import { InventoryTxnType } from "@/types/inventory";

export interface IInventoryTxn {
  _id: mongoose.Types.ObjectId;
  inventoryBatchId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  transactionType: InventoryTxnType;
  referenceType?: string;
  referenceId?: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number;
  transactionDate: Date;
  performedBy?: mongoose.Types.ObjectId;
  remarks?: string;
  reason?: string;
  createdAt: Date;
}

const InventoryTxnSchema = new Schema<IInventoryTxn>(
  {
    inventoryBatchId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryBatch",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },
    transactionType: { type: String, required: true, index: true },
    referenceType: { type: String, trim: true },
    referenceId: { type: String, trim: true, index: true },
    quantity: { type: Number, required: true },
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0, default: 0 },
    transactionDate: { type: Date, required: true, index: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    remarks: { type: String, trim: true },
    reason: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

InventoryTxnSchema.index({ productId: 1, transactionDate: -1 });
InventoryTxnSchema.index({ inventoryBatchId: 1, createdAt: 1 });

function getModel() {
  return (
    (mongoose.models.InventoryTxn as mongoose.Model<IInventoryTxn>) ||
    model<IInventoryTxn>("InventoryTxn", InventoryTxnSchema)
  );
}

export const InventoryTxn = getModel();
