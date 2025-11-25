// src/app/api/admin-login/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: "missing password" }, { status: 400 });
  }

  const correctPassword = process.env.ADMIN_PASSWORD;

  if (!correctPassword) {
    // 環境変数が設定されていない場合の保険
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500 }
    );
  }

  if (password !== correctPassword) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  // レスポンスを先に作る
  const res = NextResponse.json({ ok: true });

  // Cookie にトークンを保存（1日有効）
  res.cookies.set("admin_token", "true", {
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24h
    path: "/",
  });

  return res;
}
