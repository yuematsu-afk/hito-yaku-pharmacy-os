// src/app/reset-password/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";

type Status = "input" | "sending" | "done" | "error";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("input");
  const [error, setError] = useState<string | null>(null);
  const [lastRequestedAt, setLastRequestedAt] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const now = Date.now();
    if (lastRequestedAt && now - lastRequestedAt < 16_000) {
      // フロント側で連打を抑止
      setError(
        "短時間に複数回のリクエストが行われました。約20秒ほど時間をおいてから、再度お試しください。"
      );
      setStatus("error");
      return;
    }

    setStatus("sending");
    setError(null);

    try {
      if (typeof window === "undefined") {
        throw new Error("window is not available");
      }

      const origin = window.location.origin;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password/confirm`,
      });

      if (error) {
        console.error("[reset-password] resetPasswordForEmail error", error);
        const msg = error.message ?? "";

        if (
          msg.includes(
            "For security purposes, you can only request this after"
          )
        ) {
          setError(
            "短時間に複数回のリクエストが行われました。約20秒ほど時間をおいてから、再度お試しください。"
          );
        } else if (
          msg.toLowerCase().includes("invalid email") ||
          msg.toLowerCase().includes("email not found")
        ) {
          setError(
            "このメールアドレスのアカウントが見つかりませんでした。入力内容をご確認ください。"
          );
        } else {
          setError(
            "パスワード再設定メールの送信に失敗しました。時間をおいて再度お試しください。"
          );
        }

        setStatus("error");
        return;
      }

      // 成功
      setLastRequestedAt(now);
      setStatus("done");
    } catch (e) {
      console.error("[reset-password] unexpected error", e);
      setError(
        "パスワード再設定メールの送信中にエラーが発生しました。時間をおいて再度お試しください。"
      );
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <AppCard className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            パスワードをお忘れの方
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            登録済みのメールアドレスを入力すると、パスワード再設定用のリンクをメールでお送りします。
          </p>
        </div>

        {status === "done" ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
              パスワード再設定用のメールを送信しました。
              数分経ってもメールが届かない場合は、迷惑メールフォルダや入力したメールアドレスをご確認ください。
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 whitespace-pre-line">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <AppButton
                type="submit"
                className="w-full"
                disabled={status === "sending"}
              >
                {status === "sending"
                  ? "送信中..."
                  : "パスワード再設定メールを送信する"}
              </AppButton>
            </form>
          </>
        )}
      </AppCard>
    </div>
  );
}
