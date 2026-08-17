import mongoose, { Schema, models, model } from "mongoose";

export interface IInventoryItem {
  _id: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  sold: number;
  reorderLevel: number;
  unitCost: number;
  sellingPrice: number;
  location?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    sold: { type: Number, required: true, min: 0, default: 0 },
    reorderLevel: { type: Number, required: true, min: 0, default: 5 },
    unitCost: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    location: { type: String, default: "Main Store" },
    notes: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryItemSchema.virtual("isLowStock").get(function (this: IInventoryItem) {
  return this.quantity <= this.reorderLevel;
});

InventoryItemSchema.virtual("stockValue").get(function (this: IInventoryItem) {
  return this.quantity * this.unitCost;
});

InventoryItemSchema.set("toJSON", { virtuals: true });
InventoryItemSchema.set("toObject", { virtuals: true });

export const InventoryItem =
  models.InventoryItem ||
  model<IInventoryItem>("InventoryItem", InventoryItemSchema);
