import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireSession } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["owner", "manager", "staff"]),
});

export async function GET() {
  const { error } = await requireSession("manageUsers");
  if (error) return error;

  await connectDB();
  const users = await User.find()
    .select("-password")
    .sort({ createdAt: -1 });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession("manageUsers");
  if (error) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();

    const existing = await User.findOne({ email: body.email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      ...body,
      email: body.email.toLowerCase(),
      password: hashed,
    });

    return NextResponse.json(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
