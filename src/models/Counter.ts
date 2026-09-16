import mongoose, { Schema, model } from "mongoose";

interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

function getCounterModel() {
  return (
    (mongoose.models.Counter as mongoose.Model<ICounter>) ||
    model<ICounter>("Counter", CounterSchema)
  );
}

export const Counter = getCounterModel();

export async function nextSequence(name: string, pad = 7) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seq = doc?.seq || 1;
  return String(seq).padStart(pad, "0");
}
