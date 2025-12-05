// src/app/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";

type Status = "idle" | "loading" | "error";

// アプリ内で扱うロール
type AppRole = "patient" | "pharmacy_company" | "admin";

// profiles.role に保存するロール（DB側）
// 互換性のため "pharmacy" も含めるが、今後は "pharmacy_company" を正とする
type DbProfileRole = "patient" | "pharmacy" | "pharmacy_company" | "admin";

// profile_users.role に保存するロール（DB側）
type DbProfileUsersRole = "patient" | "pharmacy_company" | "admin";

// DBロール → アプリロール
function dbRoleToAppRole(dbRole: string | null | undefined): AppRole {
  if (dbRole === "admin") return "admin";

  // 旧 "pharmacy" も新 "pharmacy_company" も、アプリ上は同じ扱い
  if (dbRole === "pharmacy" || dbRole === "pharmacy_company") {
    return "pharmacy_company";
  }

  // デフォルトは patient
  return "patient";
}

// アプリロール → profiles.role
function appRoleToProfilesRole(appRole: AppRole): DbProfileRole {
  if (appRole === "admin") return "admin";
  if (appRole === "pharmacy_company") return "pharmacy_company";
  return "patient";
}

// アプリロール → profile_users.role
function appRoleToProfileUsersRole(appRole: AppRole): DbProfileUsersRole {
  if (appRole === "admin") return "admin";
  if (appRole === "pharmacy_company") return "pharmacy_company";
  return "patient";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    setStatus("loading");
    setError(null);

    try {
      // ① サインイン
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (signInError || !data.session || !data.user) {
        console.error("[login] signInError", signInError);

        const msg = signInError?.message ?? "";
        if (
          msg.includes("Invalid login credentials") ||
          msg.includes("Invalid login") ||
          signInError?.status === 400
        ) {
          setError("メールアドレスまたはパスワードが正しくありません。");
        } else if (
          msg.toLowerCase().includes("email not confirmed") ||
          msg.toLowerCase().includes("email_not_confirmed")
        ) {
          setError(
            "まだメールアドレスが確認されていません。登録時に届いたメールのリンクをクリックしてからログインしてください。"
          );
        } else {
          setError(
            "ログインに失敗しました。時間をおいて再度お試しください。"
          );
        }

        setStatus("error");
        return;
      }

      const user = data.user;

      // ② profiles を取得（あればそれを優先してロールを決定）
      let profileRow: any | null = null;

      try {
        const { data: profileData, error: profileFetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profileFetchError) {
          console.error("[login] profiles fetch error", profileFetchError);
        } else {
          profileRow = profileData ?? null;
        }
      } catch (fetchUnexpected) {
        console.error(
          "[login] profiles fetch unexpected error",
          fetchUnexpected
        );
      }

      const dbRoleFromProfile =
        (profileRow?.role as string | undefined | null) ?? null;

      // user_metadata の role からも拾う（古い "pharmacy" / 新しい "pharmacy_company" 両対応）
      const rawMetaRole =
        (user.user_metadata?.role as string | undefined | null) ?? null;

      let dbRoleFromMeta: DbProfileRole | null = null;
      if (rawMetaRole === "admin") {
        dbRoleFromMeta = "admin";
      } else if (
        rawMetaRole === "pharmacy" ||
        rawMetaRole === "pharmacy_company"
      ) {
        // 古い "pharmacy" も新しい "pharmacy_company" も、DB では "pharmacy_company" に正規化
        dbRoleFromMeta = "pharmacy_company";
      } else if (rawMetaRole === "patient") {
        dbRoleFromMeta = "patient";
      }

      // ✅ 最終的に DB の profiles.role に使うロール
      const dbProfileRole: DbProfileRole =
        (dbRoleFromProfile as DbProfileRole | null) ||
        dbRoleFromMeta ||
        "patient";

      // ✅ アプリ側で扱うロール（Cookie・遷移先など）
      const appRole: AppRole = dbRoleToAppRole(dbProfileRole);

      // 表示名は「profiles.full_name → metadata.display_name → null」の優先順位
      const displayName: string | null =
        (profileRow?.full_name as string | null | undefined) ??
        ((user.user_metadata?.display_name as string | null | undefined) ??
          null);

      // ③ middleware 用の role Cookie をセット（アプリ側ロールで保存）
      document.cookie = `hito_yaku_role=${encodeURIComponent(
        appRole
      )}; path=/; max-age=604800; SameSite=Lax`;

      // ④ profiles を補完 / 更新
      //    既存レコードがある場合は role を触らずにその他だけ更新
      try {
        if (!profileRow) {
          const roleForProfile = appRoleToProfilesRole(appRole);

          const { error: profilesInsertError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: user.email,
              full_name: displayName,
              role: roleForProfile,
              updated_at: new Date().toISOString(),
            });

          if (profilesInsertError) {
            console.error(
              "[login] profiles insert error",
              profilesInsertError
            );
          } else {
            console.log("[login] profiles insert success");
          }
        } else {
          const { error: profilesUpdateError } = await supabase
            .from("profiles")
            .update({
              email: user.email,
              full_name: displayName,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          if (profilesUpdateError) {
            console.error(
              "[login] profiles update error",
              profilesUpdateError
            );
          } else {
            console.log("[login] profiles update success");
          }
        }
      } catch (profilesUnexpected) {
        console.error(
          "[login] profiles unexpected error",
          profilesUnexpected
        );
      }

      // ⑤ profile_users を補完（こちらは appRole を正としつつ、DB に合わせて変換）
      try {
        const dbProfileUsersRole = appRoleToProfileUsersRole(appRole);
        const accountType = `${appRole}_user`; // patient_user / pharmacy_company_user / admin_user

        const { error: profileUsersError } = await supabase
          .from("profile_users")
          .upsert(
            {
              auth_user_id: user.id,
              role: dbProfileUsersRole,
              display_name: displayName,
              account_type: accountType,
              // related_patient_id / related_pharmacy_id は現時点では null のまま
            },
            { onConflict: "auth_user_id" }
          );

        if (profileUsersError) {
          console.error(
            "[login] profile_users upsert error",
            profileUsersError
          );
        } else {
          console.log("[login] profile_users upsert success");
        }
      } catch (profileUsersUnexpected) {
        console.error(
          "[login] profile_users unexpected error",
          profileUsersUnexpected
        );
      }

      // ⑥ role に応じて遷移先を切り替え（アプリロールベース）
      if (appRole === "pharmacy_company") {
        router.push("/pharmacy/dashboard");
      } else if (appRole === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/mypage");
      }
    } catch (e) {
      console.error("[login] unexpected error", e);
      setError(
        "予期せぬエラーが発生しました。時間をおいて再度お試しください。"
      );
      setStatus("error");
    } finally {
      // 画面に留まるケース用に idle に戻しておく
      setStatus((prev) => (prev === "loading" ? "idle" : prev));
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <AppCard className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ログイン</h1>
          <p className="mt-1 text-xs text-slate-600">
            登録しているメールアドレスとパスワードを入力してください。
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3 text-sm">
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
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="●●●●●●●●"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 whitespace-pre-line">
              {error}
            </p>
          )}

          <AppButton
            type="submit"
            className="w-full"
            disabled={!email || !password || status === "loading"}
          >
            {status === "loading" ? "ログイン中..." : "ログイン"}
          </AppButton>
        </form>

        {/* 下部リンク類 */}
        <div className="mt-2 border-t pt-3 text-[11px] text-slate-500 space-y-1">
          <p>
            アカウントをお持ちでない方は{" "}
            <Link
              href="/register"
              className="text-emerald-700 underline underline-offset-2"
            >
              新規登録はこちら
            </Link>
          </p>
          <p>
            パスワードをお忘れの方は{" "}
            <Link
              href="/reset-password"
              className="text-emerald-700 underline underline-offset-2"
            >
              パスワード再設定はこちら
            </Link>
          </p>
          <p className="mt-1">
            ※ 将来的に患者マイページや薬局アカウントの管理に利用します。
          </p>
        </div>
      </AppCard>
    </div>
  );
}
