import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI!);
  const res = await fetch("http://localhost:3000/api/seed", {
    method: "POST",
  }).catch(() => null);

  if (res?.ok) {
    console.log(await res.json());
    await mongoose.disconnect();
    return;
  }

  // Standalone seed if app server is not running
  const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: String,
    active: { type: Boolean, default: true },
  });
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  await User.deleteMany({});
  const password = await bcrypt.hash("password123", 10);
  await User.create([
    { name: "Maria Santos", email: "owner@chay.ph", password, role: "owner" },
    {
      name: "Juan Dela Cruz",
      email: "manager@chay.ph",
      password,
      role: "manager",
    },
    { name: "Ana Reyes", email: "staff@chay.ph", password, role: "staff" },
  ]);
  console.log("Minimal users seeded. Prefer POST /api/seed with the app running for full demo data.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
