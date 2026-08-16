import mongoose, { Schema, models, model } from "mongoose";
import { AlertType } from "@/types";

export interface IAlert {
  _id: mongoose.Types.ObjectId;
  type: AlertType;
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  read: boolean;
  relatedId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    type: {
      type: String,
      enum: ["low_stock", "negative_cash", "kpi_threshold", "info"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    read: { type: Boolean, default: false },
    relatedId: { type: String },
  },
  { timestamps: true }
);

export const Alert = models.Alert || model<IAlert>("Alert", AlertSchema);
