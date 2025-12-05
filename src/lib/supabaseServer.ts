// src/lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * App Router（/app）用の Supabase Server Client
 * - cookies() が Promise の型になっている Next.js 環境でも動く
 * - layout.tsx や page.tsx（Server Component）や Route Handler 両方で使用可能
 */
export async function createSupabaseServerClient() {
  // 一部の Next.js 型では cookies() が Promise 扱い → await で統一
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value ?? null;
        },
        /**
         * Route Handler / Server Action では cookie を更新できる。
         * Server Component では cookie 更新は無視される（正しい挙動）。
         */
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Component から呼ばれた場合など、set が禁止されているケースでは無視
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", maxAge: 0, ...options });
          } catch {
            // 同上
          }
        },
      },
    }
  );
}
