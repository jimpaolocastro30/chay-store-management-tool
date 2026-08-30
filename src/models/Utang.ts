import mongoose, { Schema, models, model } from "mongoose";
import { UtangStatus } from "@/types";

export interface IUtang {
  _id: mongoose.Types.ObjectId;
  loanerName: string;
  contact?: string;
  direction: "receivable" | "payable";
  amount: number;
  committedPayment: number;
  dueDate: Date;
  notes?: string;
  status: UtangStatus;
  saleId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UtangSchema = new Schema<IUtang>(
  {
    loanerName: { type: String, required: true, trim: true, index: true },
    contact: { type: String, trim: true },
    direction: {
      type: String,
      enum: ["receivable", "payable"],
      default: "receivable",
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    committedPayment: { type: Number, required: true, min: 0, default: 0 },
    dueDate: { type: Date, required: true, index: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "partial", "paid", "overdue"],
      default: "pending",
      index: true,
    },
    saleId: { type: Schema.Types.ObjectId, ref: "Transaction", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

UtangSchema.index({ status: 1, dueDate: 1 });

export function computeUtangStatus(
  amount: number,
  committedPayment: number,
  dueDate: Date
): UtangStatus {
  const balance = Math.max(0, amount - committedPayment);
  if (balance <= 0) return "paid";
  if (committedPayment > 0) {
    return dueDate < new Date() ? "overdue" : "partial";
  }
  return dueDate < new Date() ? "overdue" : "pending";
}

export function utangBalance(amount: number, committedPayment: number) {
  return Math.max(0, amount - committedPayment);
}

export const Utang = models.Utang || model<IUtang>("Utang", UtangSchema);
