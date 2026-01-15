// src/app/mypage/password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  LockKeyhole,
} from "lucide-react";

export default function MyPagePassword() {
  const router = useRouter();
  const {
    loading: authLoading,
    isAuthenticated,
    user,
  } = useUser();

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 認証状態に応じたガード
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!newPassword || !newPasswordConfirm) {
      setError("新しいパスワードを入力してください。");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError("新しいパスワードと確認用パスワードが一致しません。");
      return;
    }

    if (newPassword.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      return;
    }

    setSaving(true);
    setError(null);
    setDone(false);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error(updateError);
        setError(
          updateError.message ||
            "パスワードの変更に失敗しました。時間をおいて再度お試しください。"
        );
        return;
      }

      setDone(true);
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (e) {
      console.error(e);
      setError("予期せぬエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  // 認証チェック中
  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <AppCard className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>パスワード変更画面を読み込んでいます...</span>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <AppCard className="space-y-5">
        {/* ヘッダー */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/mypage")}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3 w-3" />
            マイページに戻る
          </button>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
            <LockKeyhole className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">パスワード変更</h1>
            <p className="mt-1 text-xs text-slate-600">
              ログインに使用するパスワードを変更します。
              現在のパスワードがわからない場合は、ログイン画面の
              「パスワードをお忘れの方」から再設定してください。
            </p>
          </div>
        </div>

        {/* 完了メッセージ */}
        {done && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <div>
              <p>パスワードを変更しました。</p>
              <p className="mt-0.5">
                セキュリティ向上のため、他のサービスと同じパスワードの使い回しは避けてください。
              </p>
            </div>
          </div>
        )}

        {/* エラーメッセージ */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* 現在のメールアドレス（参考表示） */}
        <div className="space-y-1 text-sm">
          <p className="text-xs font-semibold text-slate-800">
            ログイン中のメールアドレス
          </p>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {user?.email ?? "-"}
          </div>
        </div>

        {/* パスワード変更フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label
              htmlFor="new_password"
              className="text-xs font-semibold text-slate-800"
            >
              新しいパスワード
            </label>
            <input
              id="new_password"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="6文字以上で入力してください"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              半角英数字・記号を組み合わせた推測されにくいパスワードをおすすめします。
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="new_password_confirm"
              className="text-xs font-semibold text-slate-800"
            >
              新しいパスワード（確認用）
            </label>
            <input
              id="new_password_confirm"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="確認のためもう一度入力してください"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <AppButton
              type="submit"
              className="w-full"
              disabled={saving}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>変更中...</span>
                </span>
              ) : (
                "パスワードを変更する"
              )}
            </AppButton>

            <AppButton
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push("/mypage")}
            >
              キャンセルしてマイページに戻る
            </AppButton>
          </div>
        </form>
      </AppCard>
    </div>
  );
}
