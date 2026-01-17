// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = req.nextUrl;

  /**
   * Supabase のセッション判定
   * sb-access-token / sb-refresh-token が無ければ未ログインとみなす
   */
  const hasSupabaseSession =
    req.cookies.get("sb-access-token") ||
    req.cookies.get("sb-refresh-token");

  // ① /admin 保護
  if (pathname.startsWith("/admin")) {
    if (!hasSupabaseSession) {
      url.pathname = "/admin-login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ② /pharmacy 保護
  if (pathname.startsWith("/pharmacy")) {
    if (!hasSupabaseSession) {
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ③ それ以外は素通し
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/admin", "/pharmacy/:path*", "/pharmacy"],
};
