// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = req.nextUrl;

  // ① /admin 用の保護（既存ロジックを明示的にブロックに）
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("admin_token")?.value;

    // 未ログイン → /admin-login へリダイレクト
    if (!token) {
      url.pathname = "/admin-login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ② /pharmacy 用の保護を追加
  if (pathname.startsWith("/pharmacy")) {
    const role = req.cookies.get("hito_yaku_role")?.value;

    // ロールが pharmacy_company または admin 以外なら /login へ
    if (role !== "pharmacy_company" && role !== "admin") {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ③ それ以外は素通し
  return NextResponse.next();
}

// matcher を /pharmacy にも適用
export const config = {
  matcher: ["/admin/:path*", "/admin", "/pharmacy/:path*", "/pharmacy"],
};
