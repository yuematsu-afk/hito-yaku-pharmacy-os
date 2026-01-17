// src/middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 認証不要（自己ループ防止）
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password")
  ) {
    return NextResponse.next();
  }

  const role = req.cookies.get("hito_yaku_role")?.value ?? null;

  // pharmacy 配下は role ベースで判定
  if (pathname.startsWith("/pharmacy")) {
    if (role !== "pharmacy_company" && role !== "admin") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "redirectTo",
        pathname + (search ?? "")
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  // admin 配下
  if (pathname.startsWith("/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/pharmacy/:path*", "/admin/:path*"],
};
