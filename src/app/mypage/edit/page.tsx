// src/app/mypage/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export default function MyPageEdit() {
  const router = useRouter();
  const {
    loading: authLoading,
    isAuthenticated,
    profile,
    refreshProfile,
  } = useUser();

  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 認証状態に応じたガード
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // プロフィール情報から初期値をセット
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);
    setDone(false);

    try {
      // 1) profiles テーブルの更新
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
        })
        .eq("id", profile.id);

      if (updateError) {
        console.error(updateError);
        setError("プロフィールの更新に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      // 2) auth.user のメタデータ（display_name）も更新しておくと後で便利
      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          display_name: fullName || null,
        },
      });

      if (metaError) {
        // メタデータ更新失敗は致命的ではないのでログのみ
        console.error("auth.updateUser metadata error", metaError);
      }

      // 3) Context の profile を再取得
      await refreshProfile();

      setDone(true);
    } catch (e) {
      console.error(e);
      setError("予期せぬエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  // 認証チェック中
  if (authLoading || !profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <AppCard className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>プロフィール情報を読み込んでいます...</span>
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

        <div>
          <h1 className="text-xl font-bold text-slate-900">プロフィール編集</h1>
          <p className="mt-1 text-xs text-slate-600">
            表示されるお名前を編集できます。メールアドレスやアカウント種別は変更できません。
          </p>
        </div>

        {/* 完了メッセージ */}
        {done && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <div>
              <p>プロフィールを更新しました。</p>
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

        {/* 編集フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label
              htmlFor="full_name"
              className="text-xs font-semibold text-slate-800"
            >
              お名前
            </label>
            <input
              id="full_name"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="山田 太郎"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              マイページや将来の機能で表示されるお名前です。未入力の場合は「お名前未設定」と表示されます。
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-800">
              メールアドレス
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {profile.email ?? "-"}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              メールアドレスの変更は現在サポートしていません。
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-800">
              アカウント種別
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {profile.role ?? "-"}
            </div>
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
                  <span>保存中...</span>
                </span>
              ) : (
                "この内容で保存する"
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
