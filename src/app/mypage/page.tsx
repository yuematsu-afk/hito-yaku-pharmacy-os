// src/app/mypage/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Patient, Pharmacist } from "@/types/supabase";
import { useUser } from "@/hooks/useUser";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import {
  Loader2,
  UserCircle2,
  Star,
  Heart,
  Trash2,
  AlertCircle,
} from "lucide-react";

type PatientWithDiagnosis = Patient & {
  patient_type?: string | null; // A/B/C/D を想定
  care_style?: string | null;
  created_at?: string;
};

type FavoriteRow = {
  id: string;
  created_at: string;
  pharmacists: Pharmacist | null;
};

const PATIENT_ID_KEY = "hito_yaku_patient_id";

// 診断タイプ表示
function formatPatientTypeLabel(type?: string | null): string {
  if (!type) return "未分類タイプ";
  switch (type) {
    case "A":
      return "Aタイプ（専門性重視）";
    case "B":
      return "Bタイプ（生活支援）";
    case "C":
      return "Cタイプ（メンタル×体質）";
    case "D":
      return "Dタイプ（多言語対応）";
    default:
      return `${type}タイプ`;
  }
}

// 相談スタイル表示
function formatCareStyleLabel(style?: string | null): string {
  if (!style) return "未設定";
  switch (style) {
    case "understanding":
      return "しっかり理解タイプ";
    case "empathy":
      return "気持ちケアタイプ";
    case "expert":
      return "おまかせタイプ";
    case "support":
      return "継続苦手タイプ";
    case "family":
      return "家族サポートタイプ";
    case "second_opinion":
      return "比較検討タイプ";
    default:
      return style;
  }
}

// 言語コード → 日本語
function formatLanguage(code?: string | null): string {
  if (!code) return "未設定";
  switch (code) {
    case "ja":
      return "日本語";
    case "en":
      return "英語";
    case "zh":
      return "中国語";
    case "vi":
      return "ベトナム語";
    case "ko":
      return "韓国語";
    default:
      return code;
  }
}

// care_role を日本語に
const CARE_ROLE_LABEL: Record<string, string> = {
  understanding: "しっかり理解タイプ",
  empathy: "気持ちケアタイプ",
  expert: "おまかせタイプ",
  support: "継続苦手タイプ",
  family: "家族サポートタイプ",
  second_opinion: "比較検討タイプ",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyPage() {
  const router = useRouter();

  // 認証 + プロフィール（useUser フックから）
  const {
    loading: authLoading,
    isAuthenticated,
    role,
    user
  } = useUser();

  // 診断情報 / お気に入り
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientWithDiagnosis | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // 0) ログインしていなければ /login に飛ばす（ガード）
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // 1) ローカルストレージから patient_id を取得
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PATIENT_ID_KEY);
    if (stored) {
      setPatientId(stored);
    } else {
      setPatientId(null);
      setDataLoading(false);
    }
  }, []);

  // 2) patientId があれば Supabase から患者情報＋お気に入り薬剤師を取得
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    const fetchData = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const [patientRes, favRes] = await Promise.all([
          supabase
            .from("patients")
            .select("*")
            .eq("id", patientId)
            .maybeSingle<PatientWithDiagnosis>(),
          supabase
            .from("patient_favorites")
            .select("id, created_at, pharmacists(*)")
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false }) as any,
        ]);

        if (cancelled) return;

        if (patientRes.error) {
          console.error(patientRes.error);
          setError("患者情報の取得に失敗しました。");
        } else {
          setPatient(patientRes.data ?? null);
        }

        if (favRes.error) {
          console.error(favRes.error);
          setError((prev) => prev ?? "お気に入り薬剤師の取得に失敗しました。");
        } else {
          setFavorites((favRes.data ?? []) as FavoriteRow[]);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError("データの取得中にエラーが発生しました。");
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const handleRemoveFavorite = async (favoriteId: string) => {
    setRemovingId(favoriteId);
    try {
      const { error: deleteError } = await supabase
        .from("patient_favorites")
        .delete()
        .eq("id", favoriteId);

      if (deleteError) {
        console.error(deleteError);
        setError("お気に入りの削除に失敗しました。");
        return;
      }

      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
    } finally {
      setRemovingId(null);
    }
  };

  const handleResetLocalPatientId = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PATIENT_ID_KEY);
      setPatientId(null);
      setPatient(null);
      setFavorites([]);
    }
  };

  const handleGoResult = () => {
    if (!patientId) {
      alert(
        "まだこの端末に診断結果が保存されていません。先に診断を行ってください。"
      );
      return;
    }
    router.push(`/result?patientId=${patientId}`);
  };

  // 🔹 ログアウト処理
  const handleLogout = async () => {
    try {
      // Supabase セッションを破棄
      await supabase.auth.signOut();

      // middleware 用の role Cookie を削除
      document.cookie =
        "hito_yaku_role=; path=/; max-age=0; SameSite=Lax";

      // この端末に紐づけていた診断IDも削除
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PATIENT_ID_KEY);
      }

      // ログイン画面へ
      router.push("/login");
    } catch (e) {
      console.error("[mypage] logout error", e);
      alert("ログアウト中にエラーが発生しました。時間をおいて再度お試しください。");
    }
  };

  // 認証状態を待っている間
  if (authLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>マイページを読み込んでいます...</span>
        </div>
      </div>
    );
  }

  // 認証ガード発動中（/login へリダイレクト済み）
  if (!isAuthenticated) {
    return null;
  }

  // この端末に patient_id が保存されていない場合（診断前）
  if (!dataLoading && !patientId) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">マイページ</h1>

        {/* アカウント情報ブロック */}
        <AppCard className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <UserCircle2 className="h-7 w-7 text-slate-500" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                アカウント情報
              </p>
              <p className="text-sm text-slate-900">
                {(user?.user_metadata?.display_name ??
                  user?.user_metadata?.full_name ??
                  user?.email ??
                  "お名前未設定")}
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                メールアドレス
              </div>
              <div className="mt-1 text-sm">{user?.email ?? "-"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                アカウント種別
              </div>
              <div className="mt-1 text-sm">{role ?? "-"}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <AppButton
              className="w-full sm:w-auto"
              onClick={() => router.push("/mypage/edit")}
            >
              プロフィールを編集する
            </AppButton>
            <AppButton
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.push("/mypage/password")}
            >
              パスワードを変更する
            </AppButton>
            <AppButton
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleLogout}
            >
              ログアウト
            </AppButton>
          </div>
        </AppCard>

        {/* 診断未実施の案内 */}
        <AppCard className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm text-slate-800">
                この端末には、まだ診断結果が保存されていません。
              </p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                顧問薬剤師診断を完了すると、この端末に診断結果とマッチング結果が紐づき、
                <br />
                いつでもこのページから確認できるようになります。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/diagnosis">
              <AppButton>診断をはじめる</AppButton>
            </Link>
          </div>
        </AppCard>
      </div>
    );
  }

  // 通常表示（診断結果 + お気に入り + アカウント情報）
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">マイページ</h1>
        <p className="text-sm text-slate-500">
          アカウント情報と、この端末で実施した診断結果、「気になる薬剤師」の一覧を確認できます。
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* アカウント情報ブロック */}
      <AppCard className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <UserCircle2 className="h-7 w-7 text-slate-500" />
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              アカウント情報
            </span>
            <span className="text-sm text-slate-900">
              {(user?.user_metadata?.display_name ??
                user?.user_metadata?.full_name ??
                user?.email ??
                "お名前未設定")}
            </span>
          </div>
        </div>

        <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              メールアドレス
            </div>
            <div className="mt-1 text-sm">{user?.email ?? "-"}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              アカウント種別
            </div>
            <div className="mt-1 text-sm">{role ?? "-"}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <AppButton
            className="w-full sm:w-auto"
            onClick={() => router.push("/mypage/edit")}
          >
            プロフィールを編集する
          </AppButton>
          <AppButton
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => router.push("/mypage/password")}
          >
            パスワードを変更する
          </AppButton>
          <AppButton
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleLogout}
          >
            ログアウト
          </AppButton>
        </div>
      </AppCard>

      {/* 診断結果ブロック */}
      <AppCard className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <UserCircle2 className="h-7 w-7 text-sky-500" />
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              診断結果
            </span>
            <span className="text-sm text-slate-900">
              {patient
                ? `${formatPatientTypeLabel(
                    patient.patient_type
                  )} ／ ${formatCareStyleLabel(
                    (patient as any).care_style
                  )}`
                : "診断結果が見つかりません"}
            </span>
          </div>
        </div>

        <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              言語
            </div>
            <div className="mt-1 text-sm">
              {formatLanguage((patient as any)?.language)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              診断日
            </div>
            <div className="mt-1 text-sm">
              {patient?.created_at ? formatDate(patient.created_at) : "-"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <AppButton variant="outline" size="sm" onClick={handleGoResult}>
            最新のマッチング結果を確認する
          </AppButton>
          <Link href="/diagnosis">
            <AppButton variant="secondary" size="sm">
              もう一度診断をやり直す
            </AppButton>
          </Link>
          <button
            type="button"
            onClick={handleResetLocalPatientId}
            className="ml-auto text-xs text-slate-400 underline underline-offset-2"
          >
            この端末との紐づけを解除する
          </button>
        </div>
      </AppCard>

      {/* お気に入り薬剤師一覧 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500" />
          <h2 className="text-base font-semibold text-slate-900">
            気になる薬剤師
          </h2>
          <span className="text-xs text-slate-400">
            {favorites.length} / 30件
          </span>
        </div>

        {dataLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>お気に入り薬剤師を読み込んでいます...</span>
          </div>
        )}

        {!dataLoading && favorites.length === 0 && (
          <AppCard className="flex flex-col gap-2 text-xs text-slate-500">
            <p>まだ「気になる薬剤師」は登録されていません。</p>
            <p>
              診断結果ページのマッチング一覧から、
              <br />
              気になる薬剤師のカード右上の「♡」ボタンを押すと、ここに保存されます。
            </p>
          </AppCard>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {favorites.map((fav) => {
            const pharmacist = fav.pharmacists;
            if (!pharmacist) return null;

            const languages = (pharmacist.language ?? []) as string[];
            const careRoles = (pharmacist.care_role ?? []) as string[];

            return (
              <AppCard
                key={fav.id}
                className="flex h-full flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <span className="text-sm font-semibold text-slate-500">
                      {pharmacist.name?.charAt(0) ?? "薬"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">
                          {pharmacist.name ?? "名前未設定"}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {pharmacist.specialty?.join("・") ??
                            "専門領域 未設定"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-600">
                      {languages.length > 0 && (
                        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700">
                          {languages
                            .map((code) => formatLanguage(code))
                            .join(" / ")}
                        </span>
                      )}
                      {careRoles.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-slate-700">
                          <Star className="h-3 w-3" />
                          {careRoles
                            .map((r) => CARE_ROLE_LABEL[r] ?? r)
                            .join("・")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    登録日：{formatDate(fav.created_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link href={`/pharmacists/${pharmacist.id}`}>
                      <AppButton variant="outline" size="sm">
                        詳細を見る
                      </AppButton>
                    </Link>
                    <AppButton
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveFavorite(fav.id)}
                      disabled={removingId === fav.id}
                      className="px-2"
                    >
                      {removingId === fav.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-slate-400" />
                      )}
                    </AppButton>
                  </div>
                </div>
              </AppCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
