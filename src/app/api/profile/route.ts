import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireSession } from "@/lib/api";

const schema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().email().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6).optional(),
  })
  .refine(
    (value) =>
      !value.newPassword ||
      (value.currentPassword && value.currentPassword.length > 0),
    { message: "Current password is required to set a new password" }
  );

function publicUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  active: boolean;
}) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
  };
}

async function findCurrentUser(session: {
  user: { id?: string; email?: string | null };
}) {
  const id = session.user.id;
  const email = session.user.email?.toLowerCase();

  if (id && mongoose.isValidObjectId(id)) {
    const byId = await User.findById(id);
    if (byId) return byId;
  }

  if (email) {
    return User.findOne({ email });
  }

  return null;
}

export async function GET() {
  const { error, session } = await requireSession();
  if (error || !session) return error;

  await connectDB();
  const user = await findCurrentUser(session);
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(publicUser(user));
}

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireSession();
  if (error || !session) return error;

  try {
    const body = schema.parse(await req.json());
    await connectDB();

    const user = await findCurrentUser(session);
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (body.name) user.name = body.name;

    if (body.email) {
      const nextEmail = body.email.toLowerCase();
      if (nextEmail !== user.email) {
        const taken = await User.findOne({
          email: nextEmail,
          _id: { $ne: user._id },
        });
        if (taken) {
          return NextResponse.json(
            { error: "That email is already in use" },
            { status: 409 }
          );
        }
        user.email = nextEmail;
      }
    }

    if (body.newPassword) {
      const valid = await bcrypt.compare(
        body.currentPassword || "",
        user.password
      );
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }
      user.password = await bcrypt.hash(body.newPassword, 10);
    }

    await user.save();
    return NextResponse.json(publicUser(user));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
