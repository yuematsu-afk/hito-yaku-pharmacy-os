// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 環境変数が入っていない場合は、起動時にすぐ気づけるようにする
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase 環境変数が設定されていません。NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を確認してください。"
  );
}

// Supabaseクライアント（フロントエンド用）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // ログイン状態をローカルに保持
    autoRefreshToken: true,    // アクセストークンの自動更新
    detectSessionInUrl: true,  // パスワードリセットなどのURLからセッションを自動検出
  },
});
