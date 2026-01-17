// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 認証不要ページは必ず素通し（自己ループ防止）
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/admin-login")
  ) {
    return NextResponse.next();
  }

  // まずレスポンス箱を作る（set-cookie を反映するため）
  const res = NextResponse.next();

  // Supabase SSR client（Edge向け：getAll / setAll でcookie同期）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          for (const cookie of cookies) {
            res.cookies.set(cookie);
          }
        },
      },
    }
  );

  // セッション取得（失敗時は安全側＝未ログイン扱い）
  let user: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    user = null;
  }

  // redirectTo（オープンリダイレクト防止：同一オリジンのパスだけ）
  const redirectTo = pathname + (search ?? "");

  // pharmacy 配下はログイン必須
  if (pathname.startsWith("/pharmacy")) {
    if (!user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectTo", redirectTo);
      return NextResponse.redirect(loginUrl);
    }
    return res;
  }

  // admin 配下もログイン必須（admin-login は上で素通し）
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const adminLoginUrl = new URL("/admin-login", req.url);
      return NextResponse.redirect(adminLoginUrl);
    }
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/pharmacy/:path*", "/admin/:path*"],
};
