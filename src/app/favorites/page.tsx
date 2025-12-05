// src/app/favorites/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type {
  Pharmacist,
  Pharmacy,
  Patient,
  PatientType,
} from "@/types/supabase";
import { scorePharmacist } from "@/lib/matching/scorePharmacist";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { FavoriteButton } from "@/components/patient/FavoriteButton";

type VisibilityType = "public" | "members" | "other";

interface FavoriteItem {
  pharmacist: Pharmacist;
  pharmacy: Pharmacy | null;
  score: number | null;
}

const PATIENT_ID_KEY = "hito_yaku_patient_id";

export default function FavoritePharmacistsPage() {
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientType, setPatientType] = useState<PatientType | null>(null);
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [localPatientId, setLocalPatientId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初期ロード
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        if (typeof window === "undefined") {
          setLoading(false);
          return;
        }

        // --- 1) localStorage から patient_id 取得 ---
        const stored = window.localStorage.getItem(PATIENT_ID_KEY);
        if (!stored) {
          setLocalPatientId(null);
        } else {
          setLocalPatientId(stored);
        }

        // --- 2) 患者情報（診断結果） ---
        let loadedPatient: Patient | null = null;
        let loadedType: PatientType | null = null;

        if (stored) {
          const { data: p, error: pError } = await supabase
            .from("patients")
            .select("*")
            .eq("id", stored)
            .single<Patient>();

          if (pError) {
            console.error(pError);
          } else if (p) {
            loadedPatient = p;
            loadedType =
              (p.type as PatientType | null) ?? ("A" as PatientType);
          }
        }

        setPatient(loadedPatient);
        setPatientType(loadedType);

        // --- 3) ログインユーザー取得 ---
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError) {
          console.error(userError);
        }
        const authId = userData.user?.id ?? null;
        setAuthUserId(authId);

        // --- 4) お気に入り一覧（patient_favorites） ---
        type FavoriteRow = { pharmacist_id: string };

        let favQuery = supabase
          .from("patient_favorites")
          .select("pharmacist_id");

        // ログイン済みなら auth_user_id を優先
        if (authId) {
          favQuery = favQuery.eq("auth_user_id", authId);
        } else if (stored) {
          favQuery = favQuery.eq("patient_id", stored);
        } else {
          setItems([]);
          setLoading(false);
          return;
        }

        const { data: favRows, error: favError } =
          await favQuery.returns<FavoriteRow[]>();

        if (favError) {
          throw favError;
        }

        if (!favRows || favRows.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        const pharmacistIds = favRows.map((r) => r.pharmacist_id);

        // --- 5) 薬剤師情報 ---
        const { data: pharmacistsData, error: phError } = await supabase
          .from("pharmacists")
          .select("*")
          .in("id", pharmacistIds)
          .returns<Pharmacist[]>();

        if (phError) {
          throw phError;
        }

        // --- 6) 薬局情報 ---
        const { data: pharmaciesData, error: pmError } = await supabase
          .from("pharmacies")
          .select("*")
          .returns<Pharmacy[]>();

        if (pmError) {
          throw pmError;
        }

        const pharmacyMap = new Map<string, Pharmacy>();
        (pharmaciesData ?? []).forEach((phm) => {
          pharmacyMap.set(phm.id, phm);
        });

        // --- 7) マージ + 相性スコア計算 ---
        const merged: FavoriteItem[] = (pharmacistsData ?? []).map((ph) => {
          const pharmacy =
            ph.belongs_pharmacy_id && pharmacyMap.has(ph.belongs_pharmacy_id)
              ? pharmacyMap.get(ph.belongs_pharmacy_id)!
              : null;

          let score: number | null = null;
          if (loadedPatient && loadedType) {
            const { score: s } = scorePharmacist(
              loadedPatient,
              loadedType,
              ph,
              pharmacy
            );
            score = s;
          }

          return {
            pharmacist: ph,
            pharmacy,
            score,
          };
        });

        // スコア降順ソート（スコアが null のものは後ろに）
        merged.sort((a, b) => {
          if (a.score == null && b.score == null) return 0;
          if (a.score == null) return 1;
          if (b.score == null) return -1;
          return b.score - a.score;
        });

        setItems(merged);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "お気に入り薬剤師の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const handleGoDiagnosis = () => {
    router.push("/diagnosis");
  };

  const handleGoList = () => {
    if (localPatientId) {
      router.push(`/pharmacists?patientId=${localPatientId}`);
    } else {
      router.push("/pharmacists");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            気になる薬剤師一覧
          </h1>
          <p className="text-xs text-slate-600">
            顧問薬剤師診断や一覧ページで「気になる」に追加した薬剤師が表示されます。
            {patient &&
              "（診断結果に基づいて、相性スコアの高い順に並べています）"}
          </p>
          {!authUserId && (
            <p className="mt-1 text-[11px] text-slate-500">
              ※ 現在ログインしていません。この端末の診断結果に紐づくお気に入りのみ表示されています。
              ログイン後は、別の端末で登録したお気に入りも共有できるようになります。
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <AppButton size="sm" variant="outline" onClick={handleGoDiagnosis}>
            顧問薬剤師診断をやり直す
          </AppButton>
          <AppButton size="sm" variant="primary" onClick={handleGoList}>
            薬剤師一覧を見る
          </AppButton>
        </div>
      </div>

      {/* localStorage に patient_id がない場合の案内 */}
      {!loading && !localPatientId && (
        <AppCard className="space-y-3 p-4">
          <p className="text-sm text-slate-700">
            この端末には、まだ顧問薬剤師診断の結果が保存されていません。
            「気になる薬剤師」を登録するには、まず診断を実施してから薬剤師一覧をご覧ください。
          </p>
          <div className="flex flex-wrap gap-2">
            <AppButton variant="primary" onClick={handleGoDiagnosis}>
              顧問薬剤師診断をはじめる
            </AppButton>
            <AppButton variant="outline" onClick={handleGoList}>
              薬剤師一覧を見る
            </AppButton>
          </div>
        </AppCard>
      )}

      {/* ロード中 / エラー */}
      {loading ? (
        <div className="text-sm text-slate-600">読み込み中です...</div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* お気に入り一覧 */}
      {!loading && !error && (authUserId || localPatientId) && (
        <>
          {items.length === 0 ? (
            <AppCard className="p-4 text-sm text-slate-700 space-y-2">
              <p>現在、「気になる薬剤師」は登録されていません。</p>
              <p className="text-xs text-slate-500">
                顧問薬剤師診断の結果ページや薬剤師一覧ページから、「気になる」ボタンを押すとここに保存されます。
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <AppButton variant="primary" size="sm" onClick={handleGoList}>
                  薬剤師一覧から探す
                </AppButton>
                <AppButton
                  variant="outline"
                  size="sm"
                  onClick={handleGoDiagnosis}
                >
                  顧問薬剤師診断をやり直す
                </AppButton>
              </div>
            </AppCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ pharmacist, pharmacy, score }) => {
                const oneLine =
                  ((pharmacist as any).one_line_message as string | null) ??
                  ((pharmacist as any).short_message as string | null) ??
                  "";

                const visibilityRaw =
                  ((pharmacist as any).visibility as string | null) ??
                  "members";
                const visibility: VisibilityType =
                  visibilityRaw === "public"
                    ? "public"
                    : visibilityRaw === "members"
                    ? "members"
                    : "other";

                const years = pharmacist.years_of_experience ?? null;
                const gender = (pharmacist.gender as string | null) ?? null;
                const ageCategory =
                  (pharmacist.age_category as string | null) ?? null;

                const rawImageUrl =
                  ((pharmacist as any).image_url as string | null) ?? null;
                const imageUrl =
                  rawImageUrl || "/images/pharmacist-placeholder.png";

                const languages =
                  (pharmacist.language as string[] | null) ?? [];
                const specialties =
                  (pharmacist.specialty as string[] | null) ?? [];
                const experiences =
                  (pharmacist.experience_case as string[] | null) ?? [];

                const bookingUrl =
                  ((pharmacist as any).booking_url as string | null) ?? null;
                const lineUrl =
                  ((pharmacist as any).line_url as string | null) ?? null;

                const handleDetailClick = () => {
                  const base = `/pharmacists/${pharmacist.id}`;
                  if (localPatientId) {
                    router.push(`${base}?patientId=${localPatientId}`);
                  } else {
                    router.push(base);
                  }
                };

                return (
                  <AppCard
                    key={pharmacist.id}
                    className="flex flex-col p-3 sm:p-4 shadow-sm"
                  >
                    {/* 上部：丸型写真＋名前＋可視性＋お気に入り */}
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {/* 丸型アイコン（薬剤師一覧ページと揃える） */}
                        <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100 flex-shrink-0">
                          <img
                            src={imageUrl}
                            alt={pharmacist.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-slate-900">
                            {pharmacist.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                            {pharmacy?.name && <span>{pharmacy.name}</span>}
                            {pharmacy?.area && (
                              <span className="rounded-full border border-slate-200 px-1.5 py-0.5">
                                {pharmacy.area}
                              </span>
                            )}
                          </div>
                          {oneLine && (
                            <p className="text-[11px] text-slate-700">
                              {oneLine.length > 40
                                ? `${oneLine.slice(0, 40)}…`
                                : oneLine}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] border",
                            visibility === "public"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-slate-300 bg-slate-50 text-slate-700",
                          ].join(" ")}
                        >
                          {visibility === "public"
                            ? "一般公開"
                            : "登録ユーザー限定"}
                        </span>
                        <FavoriteButton
                          pharmacistId={pharmacist.id}
                          onChange={(isFavorite) => {
                            if (!isFavorite) {
                              setItems((prev) =>
                                prev.filter(
                                  (item) =>
                                    item.pharmacist.id !== pharmacist.id
                                )
                              );
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* タグ類 */}
                    <div className="mb-2 space-y-1 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1">
                        {years != null && (
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 border border-slate-200">
                            経験 {years} 年
                          </span>
                        )}
                        {gender && (
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 border border-slate-200">
                            性別: {gender}
                          </span>
                        )}
                        {ageCategory && (
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 border border-slate-200">
                            年代: {ageCategory}
                          </span>
                        )}
                        {patient && score != null && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-200">
                            マッチング {score} 点
                          </span>
                        )}
                      </div>

                      {/* 専門領域 */}
                      {specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {specialties.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-100"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 言語 */}
                      {languages.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {languages.map((l) => (
                            <span
                              key={l}
                              className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 border border-emerald-100"
                            >
                              {l.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 主な相談経験 */}
                      {experiences.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-[10px]">
                            主なご相談経験：
                          </span>
                          <span className="text-slate-700 text-[11px]">
                            {experiences.join(" / ")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 下部ボタン群 */}
                    <div className="mt-auto pt-2 border-t border-slate-200 space-y-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <AppButton
                          size="sm"
                          variant="primary"
                          className="w-full sm:w-auto"
                          onClick={handleDetailClick}
                        >
                          詳細を見る
                        </AppButton>

                        <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                          {bookingUrl && (
                            <AppButton
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto text-[11px]"
                              onClick={() =>
                                window.open(
                                  bookingUrl,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                            >
                              空き時間を予約
                            </AppButton>
                          )}
                          {lineUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                window.open(
                                  lineUrl,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              className="w-full rounded-md border border-[#06C755] bg-[#06C755] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 sm:w-auto"
                            >
                              LINEで相談
                            </button>
                          )}
                        </div>
                      </div>

                      {visibility === "members" && (
                        <p className="mt-1 text-[10px] text-slate-500">
                          ※ このプロフィールの一部情報は、将来的に登録ユーザー限定で表示予定です。
                        </p>
                      )}
                    </div>
                  </AppCard>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
