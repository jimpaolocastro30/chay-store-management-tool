import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/users") && role !== "owner") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (path.startsWith("/capital") && role === "staff") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (path.startsWith("/login")) return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/revenue/:path*",
    "/expenses/:path*",
    "/inventory/:path*",
    "/capital/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/alerts/:path*",
  ],
};
