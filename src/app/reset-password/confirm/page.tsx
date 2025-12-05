// src/app/reset-password/confirm/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";

type Status = "input" | "saving" | "done" | "error";

export default function ResetPasswordConfirmPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("input");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      // ① URL から access_token / refresh_token を取り出す
      let accessToken: string | null = null;
      let refreshToken: string | null = null;

      if (typeof window !== "undefined") {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);

        accessToken = hashParams.get("access_token");
        refreshToken = hashParams.get("refresh_token");
      }

      if (!accessToken || !refreshToken) {
        setError(
          "パスワード再設定リンクの情報が見つかりませんでした。リンクの有効期限が切れている可能性があります。お手数ですが、もう一度パスワード再設定メールの送信からやり直してください。"
        );
        setStatus("error");
        return;
      }

      // ② トークンから一度セッションを張る
      const { data: sessionData, error: setSessionError } =
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

      console.log("[reset-password/confirm] setSession:", {
        setSessionError,
        session: sessionData?.session,
      });

      if (setSessionError || !sessionData.session) {
        setError(
          "パスワード再設定リンクの有効なログイン情報を取得できませんでした。お手数ですが、もう一度パスワード再設定メールの送信からお試しください。"
        );
        setStatus("error");
        return;
      }

      // ③ セッションが張れた状態でパスワード更新
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      console.log("[reset-password/confirm] updateUser:", { updateError });

      if (updateError) {
        const msg = updateError.message ?? "";
        console.error("[reset-password/confirm] updateUser error", msg);

        if (msg.includes("Password should be at least")) {
          setError("パスワードは6文字以上で入力してください。");
        } else if (
          msg.toLowerCase().includes("jwt") ||
          msg.toLowerCase().includes("session") ||
          msg.toLowerCase().includes("token") ||
          msg.toLowerCase().includes("recovery")
        ) {
          setError(
            "パスワード再設定リンクの有効期限が切れているか、無効なリンクです。お手数ですが、もう一度パスワード再設定メールの送信からやり直してください。"
          );
        } else {
          setError(
            "パスワードの更新に失敗しました。時間をおいて再度お試しください。"
          );
        }

        setStatus("error");
        return;
      }

      // ④ 成功
      setStatus("done");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (e) {
      console.error("[reset-password/confirm] unexpected error", e);
      setError(
        "パスワード更新処理中にエラーが発生しました。時間をおいて再度お試しください。"
      );
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <AppCard className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            新しいパスワードを設定
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            メール内のリンクから開いたこのページで、新しいパスワードを設定してください。
          </p>
        </div>

        {status === "done" ? (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            パスワードを更新しました。数秒後にログイン画面へ移動します。
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
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-800"
                >
                  新しいパスワード
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="新しいパスワードを入力してください（6文字以上）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <AppButton
                type="submit"
                className="w-full"
                disabled={status === "saving"}
              >
                {status === "saving"
                  ? "更新中..."
                  : "このパスワードで設定する"}
              </AppButton>
            </form>
          </>
        )}
      </AppCard>
    </div>
  );
}
