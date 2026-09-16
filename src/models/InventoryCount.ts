import mongoose, { Schema, model } from "mongoose";
import { InventoryCountStatus } from "@/types/inventory";

export interface IInventoryCountItem {
  productId: mongoose.Types.ObjectId;
  inventoryBatchId: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  batchNumber: string;
  systemQuantity: number;
  physicalQuantity?: number;
  varianceQuantity?: number;
  reason?: string;
  remarks?: string;
}

export interface IInventoryCount {
  _id: mongoose.Types.ObjectId;
  countNumber: string;
  countDate: Date;
  status: InventoryCountStatus;
  category?: string;
  countedBy?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  remarks?: string;
  items: IInventoryCountItem[];
  createdAt: Date;
  updatedAt: Date;
}

const CountItemSchema = new Schema<IInventoryCountItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    inventoryBatchId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryBatch",
      required: true,
    },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    batchNumber: { type: String, required: true },
    systemQuantity: { type: Number, required: true, min: 0 },
    physicalQuantity: { type: Number, min: 0 },
    varianceQuantity: { type: Number },
    reason: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { _id: true }
);

const InventoryCountSchema = new Schema<IInventoryCount>(
  {
    countNumber: { type: String, required: true, unique: true, index: true },
    countDate: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "POSTED"],
      default: "DRAFT",
      index: true,
    },
    category: { type: String, trim: true },
    countedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    remarks: { type: String, trim: true },
    items: { type: [CountItemSchema], default: [] },
  },
  { timestamps: true }
);

function getModel() {
  return (
    (mongoose.models.InventoryCount as mongoose.Model<IInventoryCount>) ||
    model<IInventoryCount>("InventoryCount", InventoryCountSchema)
  );
}

export const InventoryCount = getModel();
