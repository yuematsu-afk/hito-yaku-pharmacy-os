// src/app/auth/logout/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST() {
  // Server Component 用 Supabase クライアント取得（cookies 読み込み済）
  const supabase = await createSupabaseServerClient();

  // セッション削除（ログアウト）
  await supabase.auth.signOut();

  // TOP ページへ返す
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
}
