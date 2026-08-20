import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const path = req.nextUrl.pathname;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    if (path !== "/") {
      loginUrl.searchParams.set("callbackUrl", path);
    }
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string | undefined;

  if (path.startsWith("/users") && role !== "owner") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (path.startsWith("/prices") && role !== "owner") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (path.startsWith("/categories") && role !== "owner") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (path.startsWith("/pos") && role !== "owner") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (path.startsWith("/capital") && role === "staff") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/sales/:path*",
    "/revenue/:path*",
    "/expenses/:path*",
    "/inventory/:path*",
    "/categories/:path*",
    "/prices/:path*",
    "/pos/:path*",
    "/capital/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/alerts/:path*",
    "/settings/:path*",
  ],
};
