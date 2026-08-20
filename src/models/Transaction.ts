import mongoose, { Schema, model } from "mongoose";
import { ExpenseCategory, TransactionType } from "@/types";

export interface ITransaction {
  _id: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  category?: ExpenseCategory | string;
  description: string;
  date: Date;
  paymentMethod?: string;
  reference?: string;
  source?: "pos" | "manual";
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
    category: { type: String, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    paymentMethod: { type: String, default: "cash" },
    reference: { type: String },
    source: {
      type: String,
      enum: ["pos", "manual"],
      default: "manual",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TransactionSchema.index({ type: 1, date: -1 });
TransactionSchema.index({ source: 1, type: 1, date: -1 });

function getTransactionModel() {
  const cached = mongoose.models.Transaction as
    | mongoose.Model<ITransaction>
    | undefined;

  if (cached && !cached.schema.path("source")) {
    delete mongoose.models.Transaction;
    delete mongoose.connection.models.Transaction;
  }

  return (
    (mongoose.models.Transaction as mongoose.Model<ITransaction>) ||
    model<ITransaction>("Transaction", TransactionSchema)
  );
}

export const Transaction = getTransactionModel();
