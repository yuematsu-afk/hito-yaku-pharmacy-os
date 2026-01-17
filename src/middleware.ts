import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // login 系は必ず素通し（自己ループ防止）
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password")
  ) {
    return NextResponse.next();
  }

  // admin 保護
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/admin-login", req.url));
    }
    return NextResponse.next();
  }

  // pharmacy 保護
  if (pathname.startsWith("/pharmacy")) {
    const hasSession =
      req.cookies.get("sb-access-token") ||
      req.cookies.get("sb-refresh-token");

    // 🔴 未ログイン
    if (!hasSession) {
      // ★ 自己ループ防止：すでに redirectTo が付いていたら login に直行
      const redirectTo =
        pathname + (search ? search : "");

      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectTo", redirectTo);

      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/pharmacy/:path*"],
};
