import mongoose, { Schema, models, model } from "mongoose";
import { ExpenseCategory, TransactionType } from "@/types";

export interface ITransaction {
  _id: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  category?: ExpenseCategory;
  description: string;
  date: Date;
  paymentMethod?: string;
  reference?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    type: {
      type: String,
      enum: ["revenue", "expense", "loss"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: [
        "cogs",
        "rent",
        "utilities",
        "payroll",
        "marketing",
        "supplies",
        "transport",
        "damage",
        "other",
      ],
    },
    description: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    paymentMethod: { type: String, default: "cash" },
    reference: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TransactionSchema.index({ type: 1, date: -1 });

export const Transaction =
  models.Transaction || model<ITransaction>("Transaction", TransactionSchema);
