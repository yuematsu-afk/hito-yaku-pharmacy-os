"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";

/**
 * Supabase からのマジックリンクで戻ってきたあとに叩かれるページ。
 * - セッション / ユーザー情報を取得
 * - profiles テーブルに upsert
 * - その後 /favorites （将来は /mypage）へリダイレクト
 */
export default function LoginCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // 1) セッション / ユーザー情報を取得
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError || !userData.user) {
          console.error(userError);
          setError(
            "ログイン情報の取得に失敗しました。お手数ですが、もう一度ログインをお試しください。"
          );
          return;
        }

        const user = userData.user;

        // 2) profiles テーブルに upsert（なければ作る／あれば更新）
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id, // auth.users.id と一致させる
              role: "patient",
              email: user.email ?? null,
              display_name: user.email
                ? user.email.split("@")[0]
                : "患者ユーザー",
            },
            {
              onConflict: "id",
            }
          );

        if (profileError) {
          console.error(profileError);
          // プロフィール作成に失敗しても、とりあえずログインは続行
        }

        // 3) ログイン後の遷移先
        // まずは「気になる薬剤師一覧」へ飛ばす
        router.replace("/favorites");
      } catch (e) {
        console.error(e);
        setError(
          "予期せぬエラーが発生しました。お手数ですが、もう一度ログインをお試しください。"
        );
      }
    };

    void run();
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <AppCard className="space-y-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            ログイン処理をしています…
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            そのまましばらくお待ちください。自動的に画面が切り替わります。
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 whitespace-pre-line">{error}</p>
        )}
      </AppCard>
    </div>
  );
}
