// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getRedirectTo(req: NextRequest) {
  // 元のURL（pathname + search）を保持
  const { pathname, search } = req.nextUrl;
  return `${pathname}${search ?? ""}`;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = req.nextUrl;

  // ① /admin（既存の admin_token ガードを維持）
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("admin_token")?.value;
    if (!token) {
      url.pathname = "/admin-login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ② /pharmacy（Supabaseのセッションで判定する）
  if (pathname.startsWith("/pharmacy")) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 環境変数が無い場合は安全側に倒してログインへ
    if (!supabaseUrl || !supabaseAnonKey) {
      url.pathname = "/login";
      url.searchParams.set("redirectTo", getRedirectTo(req));
      return NextResponse.redirect(url);
    }

    const res = NextResponse.next();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // middleware での cookie 更新を response に反映
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();

    // 未ログイン or 取得失敗 → /login へ
    if (error || !data?.user) {
      url.pathname = "/login";
      url.searchParams.set("redirectTo", getRedirectTo(req));
      return NextResponse.redirect(url);
    }

    // ログイン済みなら通す（role判定はクライアント(useUser)に任せる）
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/admin", "/pharmacy/:path*", "/pharmacy"],
};
