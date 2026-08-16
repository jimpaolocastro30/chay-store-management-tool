import mongoose, { Schema, models, model } from "mongoose";
import { CapitalType } from "@/types";

export interface ICapitalEntry {
  _id: mongoose.Types.ObjectId;
  type: CapitalType;
  amount: number;
  description: string;
  date: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CapitalEntrySchema = new Schema<ICapitalEntry>(
  {
    type: {
      type: String,
      enum: ["initial", "investment", "withdrawal"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const CapitalEntry =
  models.CapitalEntry || model<ICapitalEntry>("CapitalEntry", CapitalEntrySchema);
