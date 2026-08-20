import mongoose, { Schema, model } from "mongoose";

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
  specialPrice: number;
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
    specialPrice: { type: Number, required: true, min: 0, default: 0 },
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

function getInventoryModel() {
  const cached = mongoose.models.InventoryItem as
    | mongoose.Model<IInventoryItem>
    | undefined;

  // Next.js keeps the first compiled model in memory. If specialPrice is
  // missing from that cached schema, updates are silently ignored.
  if (cached && !cached.schema.path("specialPrice")) {
    delete mongoose.models.InventoryItem;
    delete mongoose.connection.models.InventoryItem;
  }

  return (
    (mongoose.models.InventoryItem as mongoose.Model<IInventoryItem>) ||
    model<IInventoryItem>("InventoryItem", InventoryItemSchema)
  );
}

export const InventoryItem = getInventoryModel();
