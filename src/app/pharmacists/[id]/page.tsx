// src/app/pharmacists/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
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

type CareStyleKey =
  | "understanding"
  | "empathy"
  | "expert"
  | "support"
  | "family"
  | "second_opinion";

const CARE_STYLE_OPTIONS: { key: CareStyleKey; label: string }[] = [
  { key: "understanding", label: "しっかり理解タイプ" },
  { key: "empathy", label: "気持ちケアタイプ" },
  { key: "expert", label: "おまかせタイプ" },
  { key: "support", label: "継続苦手タイプ" },
  { key: "family", label: "家族サポートタイプ" },
  { key: "second_opinion", label: "比較タイプ" },
];

// Supabase から取得する薬剤師の拡張型
type ExtendedPharmacist = Pharmacist & {
  visibility?: "public" | "members" | null;
  one_line_message?: string | null;
  gender?: "" | "女性" | "男性" | "その他" | null;
  gender_other?: string | null;
  birth_date?: string | null;
  age_category?: "20代" | "30代" | "40代" | "50代" | "60代" | "70代以上" | null;
  license_number?: string | null;
  web_links?: string[] | null;
  sns_links?: string[] | null;
  image_urls?: string[] | null;
  image_url?: string | null;
  care_role?: CareStyleKey[] | null;
};

interface PharmacistWithPharmacy {
  pharmacist: ExtendedPharmacist;
  pharmacy: Pharmacy | null;
}

type VisibilityType = "public" | "members" | "other";

function formatLanguageLabel(code: string): string {
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

export default function PharmacistDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = searchParams.get("patientId") ?? null;
  const pharmacistId = params?.id as string | undefined;

  const [data, setData] = useState<PharmacistWithPharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 診断経由で開かれた場合の患者情報＆マッチング結果
  const [patient, setPatient] = useState<Patient | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchReasons, setMatchReasons] = useState<string[]>([]);

  useEffect(() => {
    if (!pharmacistId) {
      setError("薬剤師IDが指定されていません。");
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      setPatient(null);
      setMatchScore(null);
      setMatchReasons([]);

      try {
        // 1) 薬剤師本体
        const { data: ph, error: phError } = await supabase
          .from("pharmacists")
          .select("*")
          .eq("id", pharmacistId)
          .maybeSingle<ExtendedPharmacist>();

        if (phError) throw phError;
        if (!ph) {
          setError("指定された薬剤師が見つかりませんでした。");
          setLoading(false);
          return;
        }

        // 2) 薬局
        let pharmacy: Pharmacy | null = null;
        if (ph.belongs_pharmacy_id) {
          const { data: pm } = await supabase
            .from("pharmacies")
            .select("*")
            .eq("id", ph.belongs_pharmacy_id)
            .maybeSingle<Pharmacy>();
          pharmacy = pm ?? null;
        }

        setData({ pharmacist: ph, pharmacy });

        // 3) patientId があれば患者情報を取得してマッチングスコアを計算
        if (patientId) {
          const { data: p, error: pError } = await supabase
            .from("patients")
            .select("*")
            .eq("id", patientId)
            .maybeSingle<Patient>();

          if (!pError && p) {
            const effectiveType: PatientType =
              (p.type as PatientType | null) ?? ("A" as PatientType);

            setPatient(p);

            const { score, reasons } = scorePharmacist(
              p,
              effectiveType,
              ph,
              pharmacy
            );
            setMatchScore(score);
            setMatchReasons(reasons);
          } else {
            console.error(pError);
            setPatient(null);
            setMatchScore(null);
            setMatchReasons([]);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "薬剤師情報の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [pharmacistId, patientId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-slate-600">
        読み込み中です...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-3">
        <p className="text-sm text-red-700">
          {error ?? "データが見つかりません。"}
        </p>
        <AppButton
          size="sm"
          variant="outline"
          onClick={() => router.push("/pharmacists")}
        >
          薬剤師一覧にもどる
        </AppButton>
      </div>
    );
  }

  const { pharmacist, pharmacy } = data;

  const oneLineMessage = pharmacist.one_line_message ?? "";
  const visibilityRaw = pharmacist.visibility ?? "members";
  const visibility: VisibilityType =
    visibilityRaw === "public"
      ? "public"
      : visibilityRaw === "members"
      ? "members"
      : "other";

  const mainImageUrl = pharmacist.image_url ?? null;
  const subImages =
    (pharmacist.image_urls ?? []).filter((url) => url !== mainImageUrl) ?? [];

  const years = pharmacist.years_of_experience ?? null;
  const gender = pharmacist.gender ?? "";
  const genderOther = pharmacist.gender_other ?? "";
  const ageCategory = pharmacist.age_category ?? null;
  const licenseNumber = pharmacist.license_number ?? null;

  const languages = pharmacist.language ?? [];
  const specialties = pharmacist.specialty ?? [];
  const careRoles = (pharmacist.care_role as CareStyleKey[] | null) ?? [];
  const experiences = pharmacist.experience_case ?? [];

  const personality = pharmacist.personality ?? "";
  const consultationStyle = pharmacist.consultation_style ?? "";

  const webLinks = pharmacist.web_links ?? [];
  const snsLinks = pharmacist.sns_links ?? [];

  const bookingUrl = (pharmacist as any).booking_url as string | null;
  const lineUrl = (pharmacist as any).line_url as string | null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      {/* 上部ヘッダー */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            {pharmacist.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            {pharmacy?.name && <span>{pharmacy.name}</span>}
            {pharmacy?.area && (
              <span className="rounded-full border border-slate-200 px-2 py-0.5">
                {pharmacy.area}
              </span>
            )}
            {visibility === "public" ? (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                一般公開
              </span>
            ) : (
              <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-700">
                登録ユーザー限定（将来的に制御予定）
              </span>
            )}
          </div>
          {oneLineMessage && (
            <p className="text-sm text-slate-700">{oneLineMessage}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* お気に入りボタン：patientId は不要（localStorage 利用） */}
          <FavoriteButton pharmacistId={pharmacist.id} />
          <AppButton
            size="sm"
            variant="outline"
            onClick={() => {
              if (patientId) {
                router.push(`/pharmacists?patientId=${patientId}`);
              } else {
                router.push("/pharmacists");
              }
            }}
          >
            一覧にもどる
          </AppButton>
        </div>
      </div>

      {/* プロフィール本体 */}
      <AppCard className="space-y-4 p-4">
        {/* 写真＋基本情報 */}
        <div className="flex flex-col gap-4 sm:flex-row">
          {(mainImageUrl || subImages.length > 0) && (
            <div className="sm:w-44 space-y-2">
              {mainImageUrl && (
                <div className="h-40 w-40 overflow-hidden rounded-lg bg-slate-100">
                  <img
                    src={mainImageUrl}
                    alt={pharmacist.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              {subImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subImages.slice(0, 4).map((url) => (
                    <div
                      key={url}
                      className="h-12 w-12 overflow-hidden rounded-md bg-slate-100"
                    >
                      <img
                        src={url}
                        alt={`${pharmacist.name} サブ画像`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 space-y-3 text-sm text-slate-700">
            <div className="flex flex-wrap gap-2 text-[11px]">
              {years != null && (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200">
                  経験年数：{years} 年
                </span>
              )}
              {gender && (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200">
                  性別：
                  {gender === "その他" && genderOther
                    ? `その他（${genderOther}）`
                    : gender}
                </span>
              )}
              {ageCategory && (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700 border border-slate-200">
                  年代：{ageCategory}
                </span>
              )}
              {/* 診断経由で patient があるときだけスコア表示 */}
              {patient && matchScore != null && (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 border border-sky-200">
                  マッチング {matchScore} 点
                </span>
              )}
            </div>

            {specialties.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-800">
                  専門領域
                </p>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 border border-sky-100"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {languages.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-800">
                  対応言語
                </p>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {languages.map((l) => (
                    <span
                      key={l}
                      className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-100"
                    >
                      {formatLanguageLabel(l)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {careRoles.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-800">
                  得意な相談スタイル
                </p>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {careRoles.map((c) => {
                    const label =
                      CARE_STYLE_OPTIONS.find((o) => o.key === c)?.label ?? c;
                    return (
                      <span
                        key={c}
                        className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700 border border-orange-100"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {licenseNumber && (
              <div className="space-y-0.5 text-[11px] text-slate-500">
                <span>薬剤師免許番号：{licenseNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* 性格・相談スタイルの説明 */}
        {(personality || consultationStyle) && (
          <div className="space-y-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {personality && (
              <div>
                <p className="text-xs font-semibold text-slate-800 mb-1">
                  性格・スタイル
                </p>
                <p className="whitespace-pre-wrap text-xs">{personality}</p>
              </div>
            )}
            {consultationStyle && (
              <div>
                <p className="text-xs font-semibold text-slate-800 mb-1">
                  相談の進め方
                </p>
                <p className="whitespace-pre-wrap text-xs">
                  {consultationStyle}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 診断結果に基づくマッチング情報 */}
        {patient && matchScore != null && (
          <div className="space-y-2 rounded-md bg-sky-50 p-3 text-sm text-slate-700">
            <p className="text-xs font-semibold text-sky-800">
              あなたの診断結果にもとづくマッチング評価
            </p>
            <p className="text-xs md:text-sm">
              この薬剤師さんは、あなたとのマッチングスコアが{" "}
              <span className="font-semibold text-sky-700">
                {matchScore} 点
              </span>
              でした。
            </p>
            {matchReasons.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs space-y-1">
                {matchReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 主な相談経験 */}
        {experiences.length > 0 && (
          <div className="space-y-1 text-sm text-slate-700">
            <p className="text-xs font-semibold text-slate-800">
              主なご相談経験
            </p>
            <p className="text-xs">{experiences.join(" / ")}</p>
          </div>
        )}

        {/* Webリンク / SNSリンク */}
        {(webLinks.length > 0 || snsLinks.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2 text-xs text-slate-700">
            {webLinks.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-800">
                  関連リンク
                </p>
                <ul className="space-y-1">
                  {webLinks.map((url, idx) => (
                    <li key={url + idx}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 underline break-all"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {snsLinks.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-800">
                  SNSアカウント
                </p>
                <ul className="space-y-1">
                  {snsLinks.map((url, idx) => (
                    <li key={url + idx}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 underline break-all"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 薬局情報 */}
        {pharmacy && (
          <div className="space-y-1 text-sm text-slate-700">
            <p className="text-xs font-semibold text-slate-800">所属薬局</p>
            <p className="text-xs">
              {pharmacy.name}
              {pharmacy.area && `（エリア：${pharmacy.area}）`}
            </p>
          </div>
        )}

        {/* 予約・連絡ボタン */}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {bookingUrl && (
              <AppButton
                size="sm"
                variant="primary"
                onClick={() =>
                  window.open(bookingUrl, "_blank", "noopener,noreferrer")
                }
              >
                空き時間を予約する（Googleカレンダー）
              </AppButton>
            )}
            {lineUrl && (
              <button
                type="button"
                onClick={() =>
                  window.open(lineUrl, "_blank", "noopener,noreferrer")
                }
                className="rounded-md border border-[#06C755] bg-[#06C755] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                LINEで相談する
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-500">
            ※ 「登録ユーザー限定」プロフィールについては、今後ログイン有無による表示制御を行う予定です。
          </p>
        </div>
      </AppCard>
    </div>
  );
}
