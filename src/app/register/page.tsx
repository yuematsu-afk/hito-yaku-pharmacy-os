// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";

type Status = "idle" | "loading" | "done" | "error";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // 患者アカウント固定
  const defaultRole: "patient" = "patient";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    if (password !== passwordConfirm) {
      setError("パスワードと確認用パスワードが一致しません。");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      // ① Supabase にユーザー登録
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            role: defaultRole,
            display_name: name || null,
          },
        },
      });

      console.log("[register] signUp result", { data, signUpError });

      if (signUpError) {
        const msg = signUpError.message?.toLowerCase() ?? "";
        console.error("[register] signUpError", signUpError);

        if (
          msg.includes("user already registered") ||
          msg.includes("already registered")
        ) {
          setError(
            "このメールアドレスはすでに登録されています。ログイン画面からログインするか、パスワード再設定を行ってください。"
          );
        } else if (msg.includes("invalid email")) {
          setError(
            "メールアドレスの形式が正しくないか、利用できないアドレスです。"
          );
        } else {
          setError("登録に失敗しました。時間をおいて再度お試しください。");
        }

        setStatus("error");
        return;
      }

      const user = data.user;
      if (user) {
        (async () => {
          try {
            const { error: profilesError } = await supabase
              .from("profiles")
              .upsert(
                {
                  id: user.id, // auth.users.id と合わせる
                  email: normalizedEmail,
                  full_name: name || null,
                  role: defaultRole,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "id" } // id = PK/UNIQUE 前提
              );

            if (profilesError) {
              console.error("[register] profiles upsert error", profilesError);
            } else {
              console.log("[register] profiles upsert success");
            }
          } catch (unexpected) {
            console.error("[register] profiles unexpected error", unexpected);
          }
        })();
      }

      // ③ ここまで来たら Supabase 側ではユーザー作成済み
      setStatus("done");
    } catch (err) {
      console.error("[register] unexpected error", err);
      setError("予期せぬエラーが発生しました。");
      setStatus("error");
    }
  };

  const handleGoLogin = () => {
    router.push("/login");
  };

  const isSubmitting = status === "loading";

  return (
    <div className="mx-auto flex max-w-md px-4 py-6 sm:py-10">
      <AppCard className="w-full space-y-5 sm:space-y-6">
        {/* ヘッダー説明部分 */}
        <div className="space-y-1.5 sm:space-y-2">
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
            新規登録
          </h1>
          <p className="text-[11px] leading-relaxed text-slate-600 sm:text-xs">
            ヒトヤクを利用するための患者アカウントを作成します。
            登録後、ログインして「気になる薬剤師」やマイページ機能を
            ご利用いただけます。
          </p>
        </div>

        {/* 完了画面 */}
        {status === "done" ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-800">
              アカウント登録が完了しました。
              <br />
              登録したメールアドレスとパスワードでログインしてください。
            </div>
            <AppButton className="w-full" onClick={handleGoLogin}>
              ログイン画面へ進む
            </AppButton>
          </div>
        ) : (
          // 入力フォーム
          <form
            onSubmit={handleRegister}
            className="space-y-3.5 text-sm sm:space-y-4"
          >
            <div className="space-y-1">
              <label
                htmlFor="name"
                className="text-xs font-semibold text-slate-800"
              >
                お名前（任意）
              </label>
              <input
                id="name"
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                placeholder="山田 太郎"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-xs font-semibold text-slate-800"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-slate-800"
              >
                パスワード
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                placeholder="6文字以上で入力してください"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="passwordConfirm"
                className="text-xs font-semibold text-slate-800"
              >
                パスワード（確認用）
              </label>
              <input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                placeholder="確認のためもう一度入力してください"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-[11px] whitespace-pre-line text-red-600">
                {error}
              </p>
            )}

            <AppButton
              type="submit"
              className="w-full"
              disabled={
                !email || !password || !passwordConfirm || isSubmitting
              }
            >
              {isSubmitting ? "登録中..." : "アカウントを作成する"}
            </AppButton>
          </form>
        )}

        {/* ログイン導線（完了前のみ表示） */}
        {status !== "done" && (
          <div className="pt-2 text-center text-[11px] text-slate-600 sm:text-xs">
            すでにアカウントをお持ちの方は{" "}
            <button
              type="button"
              onClick={handleGoLogin}
              className="text-emerald-700 underline underline-offset-2"
            >
              ログインはこちら
            </button>
          </div>
        )}

        {/* 補足情報 */}
        <div className="mt-2 border-t pt-3 text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">
          <p>※ 現在は患者向けアカウントのみ自己登録できます。</p>
          <p>※ 薬局・法人アカウントは、ヒトヤク運営から個別にご案内します。</p>
        </div>
      </AppCard>
    </div>
  );
}
