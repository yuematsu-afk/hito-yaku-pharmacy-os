// src/lib/supabaseClient.ts
import { createBrowserClient } from "@supabase/ssr";

/**
 * ブラウザ用 Supabase Client
 * - セッションを Cookie に保存する（middleware の createServerClient と整合）
 * - これにより middleware で supabase.auth.getUser() が成立する
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase 環境変数が設定されていません。NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を確認してください。"
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
