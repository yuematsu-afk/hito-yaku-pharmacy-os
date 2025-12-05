// src/app/result/page.tsx
"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import type {
  Patient,
  Pharmacist,
  Pharmacy,
  PatientType,
} from "@/types/supabase";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { FavoriteButton } from "@/components/patient/FavoriteButton";

interface MatchCandidate {
  pharmacist: Pharmacist;
  pharmacy: Pharmacy | null;
  score: number;
  reasons: string[];
}

// /diagnosis 側と揃えた相談スタイルキー
type CareStyleKey =
  | "understanding"
  | "empathy"
  | "expert"
  | "support"
  | "family"
  | "second_opinion";

type IntentType = "spot_consult" | "mentor_candidate" | "save_for_later";

// 薬剤師マッチングのための予約タイプ用の型
type BookingType = "phone" | "online" | "in_person";

// ContactForm へのプレフィル情報
type ContactPrefill = {
  message: string;
  contactPlaceholder: string;
  highlight: boolean;
};

// 追加：スポット相談ボタン押下時に渡すオプション
type SpotConsultOptions = {
  fromBooking?: boolean;
  memo?: string | null;
  contactPlaceholder?: string | null;
};

type VisibilityType = "public" | "members" | "other";

/**
 * 患者の相談スタイル（6タイプ）と、
 * それに対して「どんな顧問薬剤師タイプが合いそうか」の説明
 */
const CARE_STYLE_INFO: Record<
  CareStyleKey,
  {
    label: string;
    description: string;
    advisorLabel: string;
    advisorDescription: string;
    imageCaption: string;
  }
> = {
  understanding: {
    label: "しっかり理解タイプ",
    description:
      "診断名や検査結果の意味をきちんと理解し、納得したうえで治療を進めたいタイプです。",
    advisorLabel: "ていねい解説タイプの顧問薬剤師",
    advisorDescription:
      "難しい専門用語をかみ砕いて説明し、治療の流れや選択肢を一緒に整理してくれる薬剤師が合いそうです。",
    imageCaption: "しっかり説明を聞いて納得したいタイプ",
  },
  empathy: {
    label: "気持ちケアタイプ",
    description:
      "不安やつらさなど、まず気持ちを受け止めてもらえると安心できるタイプです。",
    advisorLabel: "寄り添いサポートタイプの顧問薬剤師",
    advisorDescription:
      "じっくり話を聞き、気持ちに寄り添いながら現実的な対策を一緒に考えてくれる薬剤師が合いそうです。",
    imageCaption: "気持ちを受け止めてもらえると安心するタイプ",
  },
  expert: {
    label: "おまかせタイプ",
    description:
      "情報はほどよく押さえつつ、最終的な判断は信頼できる専門家に任せたいタイプです。",
    advisorLabel: "戦略プランナータイプの顧問薬剤師",
    advisorDescription:
      "ガイドラインやエビデンスを踏まえて全体の方針を組み立て、『この方向でいきましょう』と示してくれる薬剤師が合いそうです。",
    imageCaption: "信頼できる専門家に任せたいタイプ",
  },
  support: {
    label: "継続苦手タイプ",
    description:
      "続けることの大切さは分かっているものの、忙しさや気分の波で中断しがちなタイプです。",
    advisorLabel: "習慣づくりコーチタイプの顧問薬剤師",
    advisorDescription:
      "無理のないペースや工夫を一緒に考え、小さな成功体験を積み上げるサポートをしてくれる薬剤師が合いそうです。",
    imageCaption: "治療や習慣を続ける後押しがほしいタイプ",
  },
  family: {
    label: "家族サポートタイプ",
    description:
      "自分のことだけでなく、高齢の親や子どものことなど、家族全体の健康が気になるタイプです。",
    advisorLabel: "家族まるごとケアタイプの顧問薬剤師",
    advisorDescription:
      "本人だけでなく家族の背景も踏まえて、関わり方や声かけまで一緒に考えてくれる薬剤師が合いそうです。",
    imageCaption: "家族の健康も含めて相談したいタイプ",
  },
  second_opinion: {
    label: "比較検討タイプ",
    description:
      "今の治療が自分に本当に合っているか気になり、他の選択肢も知ったうえで決めたいタイプです。",
    advisorLabel: "整理＆選択肢ナビタイプの顧問薬剤師",
    advisorDescription:
      "情報を整理し、メリット・デメリットを一緒に比較しながら『自分で納得して決める』お手伝いをしてくれる薬剤師が合いそうです。",
    imageCaption: "いくつかの選択肢を比べて決めたいタイプ",
  },
};

const PATIENT_TYPE_LABEL: Record<PatientType, string> = {
  A: "タイプA：専門性重視タイプ",
  B: "タイプB：生活支援タイプ",
  C: "タイプC：メンタル×体質タイプ",
  D: "タイプD：外国語対応タイプ",
};

/**
 * A〜Dタイプと相談スタイルのざっくり相性マトリクス
 * ◎：特に相性がよい
 * ◯：相性はよい
 * △：状況によっては合う
 */
const TYPE_STYLE_MATCH: Record<
  PatientType,
  Record<CareStyleKey, "◎" | "◯" | "△">
> = {
  A: {
    // 専門性重視
    understanding: "◎",
    empathy: "△",
    expert: "◎",
    support: "◯",
    family: "◯",
    second_opinion: "◎",
  },
  B: {
    // 生活支援タイプ
    understanding: "◯",
    empathy: "◎",
    expert: "△",
    support: "◎",
    family: "◎",
    second_opinion: "◯",
  },
  C: {
    // メンタル×体質
    understanding: "◯",
    empathy: "◎",
    expert: "◯",
    support: "◎",
    family: "△",
    second_opinion: "◯",
  },
  D: {
    // 外国語対応（相談スタイルとは独立軸なので全体的に◯ベース）
    understanding: "◯",
    empathy: "◯",
    expert: "◯",
    support: "◯",
    family: "◯",
    second_opinion: "◯",
  },
};

export default function ResultContent() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-slate-600">
          画面を読み込んでいます…
        </div>
      }
    >
      <InnerNewResultPage />
    </Suspense>
  );
}

function InnerNewResultPage() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");
  const PATIENT_ID_KEY = "hito_yaku_patient_id";
  const typeParam = searchParams.get("type") as PatientType | null;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [type, setType] = useState<PatientType | null>(typeParam);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [mainCandidate, setMainCandidate] = useState<MatchCandidate | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLinkedPatient, setIsLinkedPatient] = useState<boolean>(false);

  // 次のステップ用の状態
  const [selectedPharmacist, setSelectedPharmacist] =
    useState<Pharmacist | null>(null);
  const [intent, setIntent] = useState<IntentType>("spot_consult");

  // ContactForm へのプレフィル情報
  const [contactPrefill, setContactPrefill] = useState<ContactPrefill>({
    message: "",
    contactPlaceholder: "",
    highlight: false,
  });

  useEffect(() => {
    if (!patientId) {
      setError("診断情報が見つかりませんでした。最初からやり直してください。");
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        // ① ログイン中ユーザーを取得
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const currentAuthUserId = user?.id ?? null;

        // ② 患者情報
        const { data: patientData, error: patientError } = await supabase
          .from("patients")
          .select("*")
          .eq("id", patientId)
          .single<Patient>();

        if (patientError || !patientData) {
          console.error(patientError);
          setError("患者情報の取得に失敗しました。");
          setLoading(false);
          return;
        }

        // 患者レコードに auth_user_id が未設定で、ログイン中なら紐づける
        let linkedAuthUserId =
          ((patientData as any).auth_user_id as string | null) ?? null;

        if (currentAuthUserId && !linkedAuthUserId) {
          const { error: linkError } = await supabase
            .from("patients")
            .update({ auth_user_id: currentAuthUserId })
            .eq("id", patientData.id);

          if (linkError) {
            console.error("patients.auth_user_id の更新に失敗しました", linkError);
          } else {
            linkedAuthUserId = currentAuthUserId;
          }
        }

        const isLinked =
          !!currentAuthUserId && linkedAuthUserId === currentAuthUserId;
        setIsLinkedPatient(isLinked);

        // state にも反映
        setPatient({
          ...patientData,
          ...(linkedAuthUserId ? { auth_user_id: linkedAuthUserId } : {}),
        } as Patient);

        const effectiveType =
          (typeParam as PatientType | null) ??
          ((patientData.type as PatientType | null) ?? "A");
        setType(effectiveType);

        const mainPharmacistId =
          ((patientData as any).main_pharmacist_id as string | null) ?? null;

        // ③ 薬剤師 & 薬局情報
        const { data: pharmacistsData, error: phError } = await supabase
          .from("pharmacists")
          .select("*")
          .returns<Pharmacist[]>();

        if (phError || !pharmacistsData) {
          console.error(phError);
          setError("薬剤師情報の取得に失敗しました。");
          setLoading(false);
          return;
        }

        const { data: pharmaciesData, error: phmError } = await supabase
          .from("pharmacies")
          .select("*")
          .returns<Pharmacy[]>();

        if (phmError || !pharmaciesData) {
          console.error(phmError);
          setError("薬局情報の取得に失敗しました。");
          setLoading(false);
          return;
        }

        // ④ access_scope に基づくフィルタリング
        //    - public: すべてのユーザーに表示
        //    - registered_only: ログイン & この患者と紐づいている場合のみ表示
        const filteredPharmacists = pharmacistsData.filter((ph) => {
          const rawScope =
            ((ph as any).access_scope as string | null) ?? "public";
          const scope =
            rawScope === "registered_only" || rawScope === "members"
              ? "registered_only"
              : "public";

          if (scope === "public") return true;
          return isLinked; // registered_only はリンク済み患者のみ
        });

        const merged: MatchCandidate[] = filteredPharmacists.map((ph) => {
          const pharmacy =
            pharmaciesData.find((p) => p.id === ph.belongs_pharmacy_id) ?? null;
          const { score, reasons } = scorePharmacist(
            patientData,
            effectiveType,
            ph,
            pharmacy
          );
          return { pharmacist: ph, pharmacy, score, reasons };
        });

        // 担当薬剤師がいれば、その候補を控えておく（スコアに関係なく）
        let mainCandidate: MatchCandidate | null = null;
        if (mainPharmacistId) {
          mainCandidate =
            merged.find((m) => m.pharmacist.id === mainPharmacistId) ?? null;
        }

        const sorted = merged
          .filter((m) => m.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        setCandidates(sorted);
        setMainCandidate(mainCandidate ?? null);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("結果の計算中にエラーが発生しました。");
        setLoading(false);
      }
    };

    void run();
  }, [patientId, typeParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!patient?.id) return;

    try {
      window.localStorage.setItem(PATIENT_ID_KEY, patient.id);
    } catch (e) {
      console.error("Failed to save patient id to localStorage", e);
    }
  }, [patient?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p>診断結果を計算しています...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-3">
        <p className="text-red-700 text-sm">{error}</p>
        <a
          href="/diagnosis"
          className="text-sm text-sky-600 underline underline-offset-2"
        >
          顧問薬剤師診断にもどる
        </a>
      </div>
    );
  }

  if (!patient || !type) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-3">
        <p className="text-sm text-slate-700">
          診断情報が見つかりませんでした。お手数ですが、最初から診断をやり直してください。
        </p>
        <a
          href="/diagnosis"
          className="text-sm text-sky-600 underline underline-offset-2"
        >
          顧問薬剤師診断をやり直す
        </a>
      </div>
    );
  }

  // 患者の相談スタイル（care_style）があれば取得
  const careStyle = (patient.care_style as CareStyleKey | null) ?? null;
  const careInfo = careStyle ? CARE_STYLE_INFO[careStyle] : null;

  // 相談スタイルごとのイラスト画像パス
  const careStyleImage = careStyle
    ? `/illustrations/care-style-${careStyle}.png`
    : "/illustrations/care-style-default.png";

  const defaultContactPlaceholder =
    "メールアドレスや、連絡がつきやすい手段を入力してください";

  const effectiveContactPlaceholder =
    contactPrefill.contactPlaceholder &&
    contactPrefill.contactPlaceholder.length > 0
      ? contactPrefill.contactPlaceholder
      : defaultContactPlaceholder;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      {/* 上部ヘッダー + 戻るボタン + 薬剤師一覧リンク */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">診断結果</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            あなたの相談スタイルと、相性が良さそうな顧問薬剤師のタイプ・候補をご案内します。
          </p>
        </div>

        <div className="mt-1 flex flex-col gap-2 w-full sm:w-auto">
          <AppButton
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => (window.location.href = "/diagnosis")}
          >
            診断をやり直す
          </AppButton>

          <AppButton
            variant="primary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() =>
              (window.location.href = `/pharmacists?patientId=${patient.id}`)
            }
          >
            薬剤師一覧から探す
          </AppButton>

          <AppButton
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => (window.location.href = "/favorites")}
          >
            気になる薬剤師一覧
          </AppButton>
        </div>
      </div>

      {/* ① 顧問薬剤師タイプ（A〜D） */}
      <AppCard className="space-y-2">
        <p className="text-sm text-slate-700">
          あなたの顧問薬剤師タイプ（全体の傾向）は
          <span className="font-bold text-sky-700 mx-1">タイプ {type}</span>
          です。
        </p>
        <ResultTypeDescription type={type} />
      </AppCard>

      {/* 担当薬剤師（main_pharmacist_id がある場合） */}
      {mainCandidate && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">あなたの担当薬剤師</h2>
          <AppCard className="flex flex-col gap-2 p-3 sm:p-4">
            <p className="text-xs text-slate-700">
              この方が、ヒトヤク上での「担当薬剤師」として登録されています。
            </p>
            <div className="grid gap-3 sm:grid-cols-[auto,1fr] items-center">
              <div className="h-14 w-14 overflow-hidden rounded-full bg-slate-100">
                {(() => {
                  const rawImageUrl =
                    ((mainCandidate.pharmacist as any)
                      .image_url as string | null) ?? null;
                  const displayImageSrc =
                    rawImageUrl || "/images/pharmacist-placeholder.png";
                  const isExternalImage =
                    displayImageSrc.startsWith("http://") ||
                    displayImageSrc.startsWith("https://");
                  if (isExternalImage) {
                    return (
                      <img
                        src={displayImageSrc}
                        alt={`${mainCandidate.pharmacist.name}の写真`}

                        className="h-full w-full object-cover"
                      />
                    );
                  }
                  return (
                    <Image
                      src={displayImageSrc}
                      alt={`${mainCandidate.pharmacist.name}の写真`}
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  );
                })()}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {mainCandidate.pharmacist.name}
                </p>
                {mainCandidate.pharmacy && (
                  <p className="text-[11px] text-slate-600">
                    {mainCandidate.pharmacy.name}（
                    {mainCandidate.pharmacy.area || "エリア未設定"}）
                  </p>
                )}
                <p className="text-[11px] text-slate-600">
                  担当薬剤師として、継続的な相談やフォローを想定したポジションです。
                  スポット相談から、関係づくりを進めていくこともできます。
                </p>
              </div>
            </div>
          </AppCard>
        </section>
      )}

      {/* ② 相談スタイル（6タイプ）＋レーダー＋顧問薬剤師タイプ ＋ 相関図 */}
      {careInfo && careStyle && (
        <>
          <section className="rounded-xl border bg-white p-5 md:p-6 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* 左側：テキスト */}
              <div className="flex-1 space-y-3">
                <p className="text-xs font-semibold text-sky-700 tracking-wide">
                  相談スタイル診断の結果
                </p>

                <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">
                  あなたのタイプは「{careInfo.label}」です
                </h2>

                <p className="text-sm md:text-base text-slate-700 leading-relaxed">
                  {careInfo.description}
                </p>
              </div>

              {/* 右側：レーダー + イラスト */}
              <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
                {/* イラスト */}
                <div className="flex flex-col items-center gap-2 order-2 md:order-1">
                  <div className="relative h-24 w-24 md:h-32 md:w-32 rounded-full bg-slate-50 overflow-hidden border border-slate-200">
                    <Image
                      src={careStyleImage}
                      alt={careInfo.label}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 max-w-[140px] text-center leading-snug">
                    {careInfo.imageCaption}
                  </p>
                </div>

                {/* レーダー（モバイルで少し大きめに表示） */}
                <div className="order-1 md:order-2">
                  <RadarChartCareStyle activeKey={careStyle} />
                </div>
              </div>
            </div>

            {/* 顧問薬剤師タイプ説明 */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 border border-slate-200">
              <p className="text-[11px] font-semibold text-emerald-700 tracking-wide">
                あなたに合いそうな顧問薬剤師のタイプ
              </p>

              <h3 className="text-base md:text-lg font-semibold text-emerald-800">
                {careInfo.advisorLabel}
              </h3>

              <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                {careInfo.advisorDescription}
              </p>
            </div>
          </section>

          {/* ②-2 A〜Dタイプと相談スタイルの関係図（PC=表 / スマホ=カード） */}
          <TypeStyleRelation type={type} careStyle={careStyle} />
        </>
      )}

      {/* ③ マッチしそうな薬剤師カード */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">あなたに合いそうな薬剤師</h2>
        <p className="text-xs text-slate-600">
          気になる薬剤師がいれば、「LINEで相談する」または「この薬剤師にスポット相談を申し込む」から、下のフォーム経由で連絡先を送信できます。
        </p>
        {!isLinkedPatient && (
          <p className="text-[11px] text-slate-500">
            ※ログインして担当患者として登録されると、「登録患者限定」の薬剤師も表示されるようになります。
          </p>
        )}
        {candidates.length === 0 && (
          <p className="text-sm text-slate-600">
            条件に合う薬剤師がまだ登録されていません。サービス準備中のため、順次追加予定です。
          </p>
        )}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((c) => (
            <PharmacistCard
              key={c.pharmacist.id}
              candidate={c}
              patient={patient}
              type={type}
              onSpotConsultClick={(options?: SpotConsultOptions) => {
                setSelectedPharmacist(c.pharmacist);
                setIntent("spot_consult");

                if (options?.fromBooking) {
                  setContactPrefill({
                    message: options.memo ?? "",
                    contactPlaceholder:
                      options.contactPlaceholder ?? "電話番号を入力してください",
                    highlight: true,
                  });
                } else {
                  setContactPrefill({
                    message: "",
                    contactPlaceholder: "",
                    highlight: false,
                  });
                }

                const el = document.getElementById("contact-section");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* ④ 次のステップ案内 + 連絡先フォーム */}
      <section id="contact-section" className="mt-4 scroll-mt-24">
        <AppCard
          className={[
            "space-y-4 transition-shadow transition-colors",
            contactPrefill.highlight
              ? "ring-2 ring-emerald-400 ring-offset-2"
              : "",
          ].join(" ")}
        >
          <div className="space-y-2">
            <h2 className="text-base font-semibold">
              次のステップを選んで、連絡先を登録する
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              いただいた連絡先をもとに、ヒトヤク運営または担当薬剤師からご連絡します。
              まずは「スポット相談（1回のオンライン相談）」を前提に、
              気になる薬剤師とお話していきます。
            </p>
          </div>

          <ContactForm
            patient={patient}
            selectedPharmacist={selectedPharmacist}
            intent={intent}
            onIntentChange={setIntent}
            contactPrefill={{
              message: contactPrefill.message,
              contactPlaceholder: effectiveContactPlaceholder,
              highlight: contactPrefill.highlight,
            }}
          />
        </AppCard>
      </section>
    </div>
  );
}

/* ============================
 *   マッチングロジック本体
 * ============================ */

function scorePharmacist(
  patient: Patient,
  type: PatientType,
  pharmacist: Pharmacist,
  pharmacy: Pharmacy | null
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const specialties = pharmacist.specialty ?? [];
  const languages = pharmacist.language ?? [];
  const experiences = pharmacist.experience_case ?? [];

  // pharmacy.services は text[] / text / null の可能性があるので安全に配列化
  const rawServices = pharmacy?.services as unknown;
  const services: string[] = Array.isArray(rawServices)
    ? (rawServices as string[])
    : typeof rawServices === "string"
    ? rawServices
        .split(/[、,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const patientLanguage = patient.language ?? "ja";
  const valuePref = patient.value_preference ?? "";
  const severity = patient.severity ?? "";
  const area = patient.area ?? "";
  const symptomScore =
    (patient.symptom_score as Record<string, number> | null) ?? {};
  const lifestyleScore =
    (patient.lifestyle_score as Record<string, number> | null) ?? {};

  // 相談スタイル（care_style）と薬剤師側のテキスト情報
  const careStyle = (patient.care_style as CareStyleKey | null) ?? null;
  const styleText = (pharmacist.consultation_style ?? "") as string;
  const personality = (pharmacist.personality ?? "") as string;
  const years = pharmacist.years_of_experience ?? 0;

  // 薬剤師が登録している「得意な相談スタイル」の配列
  const careRoles = (pharmacist.care_role as string[] | null) ?? [];

  /* --- 1. 言語マッチ（最重要） --- */
  if (languages.includes(patientLanguage)) {
    score += 40;
    reasons.push("希望する言語で相談できる薬剤師です。");

    // Dタイプ（外国語重視）の場合はさらに加点
    if (type === "D") {
      score += 10;
      reasons.push("外国語対応タイプの診断結果と一致しています。");
    }
  } else if (patientLanguage !== "ja") {
    // 外国語希望だが完全一致しない場合は軽く減点
    score -= 10;
  }

  /* --- 2. 症状 × 専門性 --- */
  const mainSymptom = getMainSymptom(symptomScore);

  if (mainSymptom === "ibs_skin") {
    if (
      specialties.includes("漢方") ||
      specialties.includes("体質改善") ||
      experiences.includes("IBS") ||
      experiences.includes("皮膚")
    ) {
      score += 25;
      reasons.push("IBS・皮膚トラブルや体質改善の支援経験があります。");
    }
  }

  if (mainSymptom === "cancer") {
    if (specialties.includes("がん") || experiences.includes("がん")) {
      score += 30;
      reasons.push("がん治療中・治療後の薬物療法支援に慣れています。");
    }
  }

  if (mainSymptom === "mental") {
    if (
      specialties.includes("メンタル") ||
      experiences.includes("不眠") ||
      experiences.includes("自律神経失調") ||
      experiences.includes("不安障害")
    ) {
      score += 25;
      reasons.push("メンタル・睡眠・自律神経の相談を多く担当しています。");
    }
  }

  if (mainSymptom === "lifestyle") {
    if (specialties.includes("在宅") || specialties.includes("高齢者ケア")) {
      score += 20;
      reasons.push("在宅・生活習慣病・高齢者ケアの支援が得意です。");
    }
  }

  if (lifestyleScore["support_homecare"] === 1) {
    if (specialties.includes("在宅") || services.includes("在宅")) {
      score += 15;
      reasons.push("在宅医療や訪問対応を重視するニーズに合致しています。");
    }
  }

  /* --- 3. 価値観 × 性格・スタイル --- */
  if (valuePref === "expertise") {
    score += Math.min(years * 2, 20);
    reasons.push(
      `経験年数が比較的長く（${years}年）、専門性を重視する方に向いています。`
    );
  }

  if (valuePref === "empathy") {
    if (
      styleText.includes("丁寧") ||
      styleText.includes("じっくり") ||
      personality.includes("やさ") ||
      personality.includes("穏やか") ||
      personality.includes("共感")
    ) {
      score += 20;
      reasons.push("じっくり話を聞き、共感してくれるスタイルの薬剤師です。");
    }
  }

  if (valuePref === "lifestyle_support") {
    if (
      specialties.includes("在宅") ||
      services.includes("在宅") ||
      services.includes("オンライン相談")
    ) {
      score += 15;
      reasons.push(
        "生活や仕事との両立を含めた現実的な相談に乗ることを得意としています。"
      );
    }
  }

  if (valuePref === "multilingual") {
    if (languages.length > 1) {
      score += 15;
      reasons.push("複数言語でのコミュニケーションに対応できます。");
    }
  }

  /* --- 3-b. 相談スタイル（care_style）との相性 --- */
  if (careStyle) {
    switch (careStyle) {
      case "understanding": {
        const good =
          styleText.includes("丁寧") ||
          styleText.includes("わかりやす") ||
          styleText.includes("説明") ||
          years >= 5;
        if (good) {
          score += 18;
          reasons.push(
            "診断や薬の内容を、わかりやすく丁寧に説明してくれるスタイルです。"
          );
        }
        break;
      }
      case "empathy": {
        const good =
          styleText.includes("じっくり") ||
          styleText.includes("話を聞く") ||
          personality.includes("やさ") ||
          personality.includes("穏やか") ||
          personality.includes("共感");
        if (good) {
          score += 18;
          reasons.push(
            "不安やつらさなどの気持ちも含めて、じっくり寄り添ってくれる薬剤師です。"
          );
        }
        break;
      }
      case "expert": {
        const good =
          years >= 7 ||
          specialties.length >= 2 ||
          styleText.includes("提案") ||
          styleText.includes("方針");
        if (good) {
          score += 18;
          reasons.push(
            "ガイドラインや経験をふまえて、全体の方針を一緒に決めてくれるタイプです。"
          );
        }
        break;
      }
      case "support": {
        const good =
          styleText.includes("伴走") ||
          styleText.includes("一緒に") ||
          styleText.includes("フォロー") ||
          services.includes("オンライン相談") ||
          services.includes("在宅");
        if (good) {
          score += 18;
          reasons.push(
            "続けやすい工夫やペースづくりを、一緒に考えてくれる薬剤師です。"
          );
        }
        break;
      }
      case "family": {
        const good =
          experiences.includes("小児") ||
          experiences.includes("高齢者") ||
          specialties.includes("在宅") ||
          services.includes("在宅") ||
          styleText.includes("家族");
        if (good) {
          score += 18;
          reasons.push(
            "ご自身だけでなく、ご家族の薬や通院も含めて相談しやすい薬剤師です。"
          );
        }
        break;
      }
      case "second_opinion": {
        const good =
          styleText.includes("整理") ||
          styleText.includes("選択肢") ||
          styleText.includes("セカンド") ||
          specialties.length >= 2 ||
          years >= 5;
        if (good) {
          score += 18;
          reasons.push(
            "治療の選択肢やメリット・デメリットを整理しながら、一緒に考えてくれる薬剤師です。"
          );
        }
        break;
      }
    }

    // ★ 患者の相談スタイル と 薬剤師の care_role が一致している場合の強い加点
    if (careRoles.includes(careStyle)) {
      const info = CARE_STYLE_INFO[careStyle];
      score += 12;
      reasons.push(
        `この薬剤師は、まさに「${info.label}」タイプの患者さんを得意とするケアロールとして登録されています。`
      );
    }
  }

  /* --- 4. 顧問薬剤師タイプ（A〜D）による微調整 --- */
  if (type === "A") {
    if (specialties.length >= 2) {
      score += 10;
      reasons.push("複数の専門領域を持つオールラウンダーです。");
    }
  }

  if (type === "B") {
    if (specialties.includes("在宅") || services.includes("在宅")) {
      score += 10;
      reasons.push("生活や在宅ケアを含めた継続支援が得意です。");
    }
  }

  if (type === "C") {
    if (
      specialties.includes("漢方") ||
      specialties.includes("体質改善") ||
      specialties.includes("メンタル")
    ) {
      score += 10;
      reasons.push("漢方・体質改善やメンタル面のケアを重視するタイプです。");
    }
  }

  /* --- 5. 通いやすさ（エリア） --- */
  if (area && pharmacy?.area) {
    if (
      pharmacy.area.includes(area) ||
      area.replace(/\s/g, "").includes(pharmacy.area.replace(/\s/g, ""))
    ) {
      score += 10;
      reasons.push("お住まいのエリアと近い薬局に所属しています。");
    }
  }

  /* --- 6. 重症度に応じて専門性寄りに --- */
  if (severity === "severe") {
    score += Math.min(years * 1.5, 15);
  }

  /* --- 7. スコア正規化 & 理由の整理 --- */

  // スコアを 0〜100 にクリップ
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  // 理由の重複を削除し、最大 3 つまでに絞る
  const uniqueReasons = Array.from(new Set(reasons)).slice(0, 3);

  return { score: normalizedScore, reasons: uniqueReasons };
}

/**
 * 診断画面側で分割した複数の症状キーを、
 * マッチングロジック用のグループスコアにまとめる
 */
function getMainSymptom(scores: Record<string, number>): string | null {
  const groupScores: Record<string, number> = {
    ibs_skin:
      (scores.ibs ?? 0) +
      (scores.skin ?? 0) +
      (scores.ibs_skin ?? 0),
    cancer: scores.cancer ?? 0,
    mental:
      (scores.mental ?? 0) +
      (scores.mental_sleep ?? 0) +
      (scores.mental_mood ?? 0) +
      (scores.mental_autonomic ?? 0),
    pain: scores.pain ?? 0,
    cold_edema: scores.cold_edema ?? 0,
    other_body: scores.other_body ?? 0,
  };

  let maxKey: string | null = null;
  let maxVal = -1;
  for (const [key, val] of Object.entries(groupScores)) {
    if (val > maxVal) {
      maxVal = val;
      maxKey = key;
    }
  }
  if (maxVal <= 0) return null;
  return maxKey;
}

/* ============================
 *   UI 用コンポーネント
 * ============================ */

function ResultTypeDescription({ type }: { type: PatientType }) {
  const map: Record<PatientType, { title: string; body: string }> = {
    A: {
      title: "タイプA：専門性重視タイプ",
      body:
        "特定の症状や疾患に対する専門性・症例経験を重視するタイプです。がん・皮膚・漢方など、専門領域に強みを持つ薬剤師との相性が良い傾向があります。",
    },
    B: {
      title: "タイプB：生活支援タイプ",
      body:
        "在宅医療や高齢者ケア、子育てや仕事との両立など、生活全体を見ながら一緒に考えてくれる薬剤師を求めるタイプです。",
    },
    C: {
      title: "タイプC：メンタル×体質タイプ",
      body:
        "メンタル・睡眠・自律神経や体質など、はっきりした病名がつかない不調をトータルで見てくれる薬剤師との相性が良いタイプです。",
    },
    D: {
      title: "タイプD：外国語対応タイプ",
      body:
        "日本語以外の言語でのサポートや、文化・習慣の違いも理解してくれる薬剤師を重視するタイプです。多言語対応の薬剤師や薬局との相性が良い傾向があります。",
    },
  };

  const info = map[type];

  return (
    <div className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
      <div className="font-semibold mb-1">{info.title}</div>
      <p className="text-xs leading-relaxed">{info.body}</p>
    </div>
  );
}

/**
 * 相談スタイルのレーダー風チャート（スマホで見やすいよう、SVGをCSSで拡大）
 */
function RadarChartCareStyle({ activeKey }: { activeKey: CareStyleKey }) {
  const size = 180;
  const center = size / 2;
  const padding = 40;
  const radius = center - padding;
  const maxValue = 5;

  const CARE_STYLE_KEYS: CareStyleKey[] = [
    "understanding",
    "empathy",
    "expert",
    "support",
    "family",
    "second_opinion",
  ];

  const LABELS: Record<CareStyleKey, string> = {
    understanding: "理解タイプ",
    empathy: "気持ちタイプ",
    expert: "おまかせタイプ",
    support: "継続苦手タイプ",
    family: "家族タイプ",
    second_opinion: "比較タイプ",
  };

  const values = CARE_STYLE_KEYS.map((key) =>
    key === activeKey ? 5 : 2
  );

  const points = values
    .map((value, i) => {
      const angle =
        (-90 + (360 / CARE_STYLE_KEYS.length) * i) * (Math.PI / 180);
      const r = (radius * value) / maxValue;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-[220px] h-[220px] sm:w-[200px] sm:h-[200px] text-slate-300"
      >
        {/* 軸 */}
        {CARE_STYLE_KEYS.map((key, i) => {
          const angle =
            (-90 + (360 / CARE_STYLE_KEYS.length) * i) * (Math.PI / 180);
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={`axis-${key}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={0.5}
              strokeDasharray="2 2"
            />
          );
        })}

        {/* 外枠 */}
        <polygon
          points={CARE_STYLE_KEYS.map((_, i) => {
            const angle =
              (-90 + (360 / CARE_STYLE_KEYS.length) * i) *
              (Math.PI / 180);
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return `${x},${y}`;
          }).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.5}
        />

        {/* アクティブ値 */}
        <polygon
          points={points}
          fill="rgba(56, 189, 248, 0.25)"
          stroke="#0284c7"
          strokeWidth={1}
        />

        {/* ラベル */}
        {CARE_STYLE_KEYS.map((key, i) => {
          const angle =
            (-90 + (360 / CARE_STYLE_KEYS.length) * i) * (Math.PI / 180);
          const labelRadius = radius + 14;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);

          return (
            <text
              key={`label-${key}`}
              x={x}
              y={y}
              fontSize={10}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#475569"
            >
              {LABELS[key]}
            </text>
          );
        })}
      </svg>
      <div className="text-[10px] text-slate-500">
        各頂点がタイプの方向性を表したイメージ図です
      </div>
    </div>
  );
}

/**
 * A〜Dタイプ と 相談スタイル（6タイプ）の関係図
 * PC: 表形式 / スマホ: 自分のタイプに絞ったカード表示
 */
function TypeStyleRelation({
  type,
  careStyle,
}: {
  type: PatientType;
  careStyle: CareStyleKey;
}) {
  const styleOrder: CareStyleKey[] = [
    "understanding",
    "empathy",
    "expert",
    "support",
    "family",
    "second_opinion",
  ];

  const styleLabelShort: Record<CareStyleKey, string> = {
    understanding: "理解タイプ",
    empathy: "気持ちタイプ",
    expert: "おまかせタイプ",
    support: "継続苦手タイプ",
    family: "家族タイプ",
    second_opinion: "比較タイプ",
  };

  const typeLabel = PATIENT_TYPE_LABEL[type];

  return (
    <section className="rounded-xl border bg-white p-4 md:p-5 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-sky-700 tracking-wide">
          A〜Dタイプと相談スタイルの関係
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">
          あなたの全体タイプ「{typeLabel}」と、相談スタイル「
          {styleLabelShort[careStyle]}
          」の位置づけを、他の組み合わせとあわせて図にしました。
          ◎は特に相性の良い組み合わせ、◯は相性の良い組み合わせ、△は状況によって合う組み合わせのイメージです。
        </p>
      </div>

      {/* PC向け：フルテーブル */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-[11px] border-collapse">
          <thead>
            <tr>
              <th className="border-b border-slate-200 px-2 py-2 text-left bg-slate-50 sticky left-0 z-10">
                相談スタイル
              </th>
              {(["A", "B", "C", "D"] as PatientType[]).map((t) => (
                <th
                  key={t}
                  className={`border-b border-slate-200 px-2 py-2 text-center whitespace-nowrap ${
                    t === type ? "bg-sky-50 text-sky-800 font-semibold" : "bg-slate-50"
                  }`}
                >
                  {PATIENT_TYPE_LABEL[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {styleOrder.map((s) => (
              <tr key={s}>
                {/* 左端：相談スタイルラベル */}
                <th
                  className={`border-t border-slate-100 px-2 py-1.5 text-left font-normal text-slate-700 bg-white sticky left-0 z-10 ${
                    s === careStyle ? "bg-emerald-50 font-semibold" : ""
                  }`}
                >
                  {styleLabelShort[s]}
                </th>
                {/* 各タイプとの相性 */}
                {(["A", "B", "C", "D"] as PatientType[]).map((t) => {
                  const mark = TYPE_STYLE_MATCH[t][s];
                  const isActiveCell = t === type && s === careStyle;

                  return (
                    <td
                      key={t}
                      className={`border-t border-slate-100 px-2 py-1.5 text-center ${
                        isActiveCell
                          ? "bg-sky-100 text-sky-900 font-semibold"
                          : "bg-white text-slate-700"
                      }`}
                    >
                      {mark}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* スマホ向け：自分のタイプ列だけをカードで表示 */}
      <div className="md:hidden space-y-2">
        <div className="rounded-md bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
          <p className="font-semibold mb-0.5">
            あなたの顧問薬剤師タイプ：{typeLabel}
          </p>
          <p className="text-[10px]">
            下の一覧では、このタイプと各相談スタイルの相性をまとめています。
          </p>
        </div>

        {styleOrder.map((s) => {
          const mark = TYPE_STYLE_MATCH[type][s];
          const isActive = s === careStyle;

          return (
            <div
              key={s}
              className={`rounded-md border px-3 py-2 text-[11px] flex items-center justify-between ${
                isActive ? "bg-emerald-50 border-emerald-200" : "bg-white"
              }`}
            >
              <div>
                <p
                  className={`font-semibold ${
                    isActive ? "text-emerald-800" : "text-slate-800"
                  }`}
                >
                  {styleLabelShort[s]}
                  {isActive && "（あなたのスタイル）"}
                </p>
              </div>
              <div
                className={`text-xs font-semibold ${
                  mark === "◎"
                    ? "text-sky-700"
                    : mark === "◯"
                    ? "text-slate-700"
                    : "text-slate-500"
                }`}
              >
                {mark}
              </div>
            </div>
          );
        })}

        <div className="text-[10px] text-slate-500 mt-1">
          ◎…特に相性が良い／◯…相性が良い／△…状況によって合うことがある
        </div>
      </div>
    </section>
  );
}

/**
 * 薬剤師カード
 * - 顔写真・性別・年代・一言メッセージ・visibility / access_scope を一覧ページと揃える
 * - LINE相談 / Googleカレンダー予約 / スポット相談フォーム連携
 */
function PharmacistCard({
  candidate,
  patient,
  type,
  onSpotConsultClick,
}: {
  candidate: MatchCandidate;
  patient: Patient;
  type: PatientType;
  onSpotConsultClick?: (options?: SpotConsultOptions) => void;
}) {
  const { pharmacist, pharmacy, score, reasons } = candidate;
  const specialties = pharmacist.specialty ?? [];
  const languages = pharmacist.language ?? [];
  const experiences = pharmacist.experience_case ?? [];
  const careRoles = (pharmacist.care_role as string[] | null) ?? [];

  // visibility / 一言メッセージ
  const oneLine =
    ((pharmacist as any).one_line_message as string | null) ??
    ((pharmacist as any).short_message as string | null) ??
    "";
  const rawAccessScope =
    ((pharmacist as any).access_scope as string | null) ??
    ((pharmacist as any).visibility as string | null) ??
    "public";
  const visibility: VisibilityType =
    rawAccessScope === "public"
      ? "public"
      : rawAccessScope === "registered_only" || rawAccessScope === "members"
      ? "members"
      : "other";

  // 画像URL（Supabaseなどの外部URL or ローカルプレースホルダー）
  const rawImageUrl = ((pharmacist as any).image_url as string | null) ?? null;
  const displayImageSrc =
    rawImageUrl || "/images/pharmacist-placeholder.png";
  const isExternalImage =
    displayImageSrc.startsWith("http://") ||
    displayImageSrc.startsWith("https://");

  const years = pharmacist.years_of_experience ?? null;
  const gender = (pharmacist.gender as string | null) ?? null;
  const ageCategory = (pharmacist.age_category as string | null) ?? null;

  // pharmacy.services の安全な配列化
  const rawServices = pharmacy?.services as unknown;
  const services: string[] = Array.isArray(rawServices)
    ? (rawServices as string[])
    : typeof rawServices === "string"
    ? rawServices
        .split(/[、,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // LINE / Googleカレンダー予約のURL
  const lineUrl = (pharmacist as any).line_url as string | null | undefined;
  const bookingUrl = (pharmacist as any).booking_url as
    | string
    | null
    | undefined;

  // 予約フォーム用の状態
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingType, setBookingType] = useState<BookingType | "">("");
  const [bookingMemo, setBookingMemo] = useState("");
  const [bookingStatus, setBookingStatus] =
    useState<"idle" | "saving" | "done" | "error">("idle");
  const [bookingError, setBookingError] = useState<string | null>(null);

  const handleLineClick = () => {
    if (!lineUrl) return;
    window.open(lineUrl, "_blank", "noopener,noreferrer");
  };

  // 「空き時間を予約する」ボタンを押したとき：まずフォームの表示/非表示だけ切り替える
  const handleBookingButtonClick = () => {
    if (!bookingUrl) return;
    setShowBookingForm((prev) => !prev);
  };

  // フォーム送信：appointments にログを残してから、電話/店舗なら連絡先フォームへ、オンラインならカレンダーへ
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingType) return;

    setBookingStatus("saving");
    setBookingError(null);

    try {
      // まずログだけ保存（contact はまだ空）
      await supabase.from("appointments").insert({
        patient_id: patient.id,
        pharmacist_id: pharmacist.id,
        booking_type: bookingType,
        memo: bookingMemo || null,
        booking_url: bookingUrl || null,
        opened_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      setBookingError("ログの保存に失敗しました");
    }

    // ① 電話相談 / 店舗相談 → 下の連絡先フォームに誘導
    if (bookingType === "phone" || bookingType === "in_person") {
      if (typeof onSpotConsultClick === "function") {
        onSpotConsultClick({
          fromBooking: true,
          memo: bookingMemo || "",
          contactPlaceholder: "電話番号を入力してください",
        });
      }

      const el = document.getElementById("contact-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });

      setBookingStatus("done");
      return;
    }

    // ② オンライン相談 → Googleカレンダーへ遷移
    if (bookingType === "online" && bookingUrl) {
      window.open(bookingUrl, "_blank", "noopener,noreferrer");
      setBookingStatus("done");
      return;
    }
  };

  // care_role ラベル
  const careRoleLabels = careRoles.map((c) => {
    const k = c as CareStyleKey;
    return CARE_STYLE_INFO[k]?.label ?? c;
  });

  return (
    <AppCard className="flex flex-col p-3 sm:p-4 shadow-sm">
      {/* 上部：顔写真アイコン＋名前＋可視性＋お気に入り */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          {/* 顔写真アイコン（丸） */}
          <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100 flex-shrink-0">
            {isExternalImage ? (
              <img
                src={displayImageSrc}
                alt={`${pharmacist.name}の写真`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={displayImageSrc}
                alt={`${pharmacist.name}の写真`}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            )}
          </div>

          {/* 名前・薬局名など */}
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
                {oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {/* visibility バッジ */}
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[10px] border",
              visibility === "public"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : visibility === "members"
                ? "border-slate-300 bg-slate-50 text-slate-700"
                : "border-slate-300 bg-slate-50 text-slate-700",
            ].join(" ")}
          >
            {visibility === "public"
              ? "一般公開"
              : visibility === "members"
              ? "登録患者限定"
              : "限定公開"}
          </span>
          <FavoriteButton pharmacistId={pharmacist.id} />
        </div>
      </div>

      {/* 真ん中：タグ類 */}
      <div className="mb-2 space-y-2 text-[11px]">
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
          {/* マッチングスコア */}
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-200">
            マッチング {score.toFixed(0)} 点
          </span>
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

        {/* 相談スタイル（care_role） */}
        {careRoleLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {careRoleLabels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-700 border border-orange-100"
              >
                得意: {label}
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

      {/* 薬局情報 */}
      {pharmacy && (
        <div className="mb-2 border-t pt-2 space-y-1">
          <div className="text-[11px] font-semibold">{pharmacy.name}</div>
          <div className="text-[11px] text-slate-600">
            エリア：{pharmacy.area || "（未設定）"}
          </div>
          <div className="flex flex-wrap gap-1">
            {services.length > 0 ? (
              services.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 border border-slate-100"
                >
                  {s}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-slate-500">
                （サービス未設定）
              </span>
            )}

            {pharmacy?.has_multilingual_support && (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] text-purple-700 border border-purple-100">
                多言語対応あり
              </span>
            )}
          </div>
        </div>
      )}

      {/* 下部：スコア理由 / ボタン群 */}
      <div className="mt-auto pt-2 border-t space-y-2">
        <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700">
          {reasons.slice(0, 3).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        <div className="mt-2
 flex flex-col gap-1">
          {/* Googleカレンダー予約（事前フォーム付き） */}
          {bookingUrl && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleBookingButtonClick}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-50"
              >
                空き時間を予約する（Googleカレンダー）
              </button>

              {showBookingForm && (
                <form
                  onSubmit={handleBookingSubmit}
                  className="mt-1 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <p className="text-[11px] text-slate-700">
                    予約方法と一言メモを入力してから、予約処理を進めます。
                  </p>

                  {/* 予約の種別 */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-800">
                      予約の方法
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setBookingType("phone")}
                        className={[
                          "rounded-md border px-2 py-1 text-[11px]",
                          bookingType === "phone"
                            ? "border-sky-500 bg-sky-50 text-sky-800"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                        ].join(" ")}
                      >
                        電話相談
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingType("online")}
                        className={[
                          "rounded-md border px-2 py-1 text-[11px]",
                          bookingType === "online"
                            ? "border-sky-500 bg-sky-50 text-sky-800"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                        ].join(" ")}
                      >
                        オンライン相談
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingType("in_person")}
                        className={[
                          "rounded-md border px-2 py-1 text-[11px]",
                          bookingType === "in_person"
                            ? "border-sky-500 bg-sky-50 text-sky-800"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                        ].join(" ")}
                      >
                        店舗相談
                      </button>
                    </div>
                  </div>

                  {/* 希望メモ */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-800">
                      希望メモ（任意）
                    </p>
                    <textarea
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] min-h-[60px]"
                      placeholder="例：平日の18時以降が希望です／まずは現在の薬の整理を相談したい、など"
                      value={bookingMemo}
                      onChange={(e) => setBookingMemo(e.target.value)}
                    />
                  </div>

                  {bookingError && (
                    <p className="text-[11px] text-red-600">{bookingError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={!bookingType || bookingStatus === "saving"}
                    className="w-full rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bookingStatus === "saving"
                      ? "保存中..."
                      : "この内容で予約処理を進める"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* LINE相談 */}
          {lineUrl && (
            <button
              type="button"
              onClick={handleLineClick}
              className="w-full rounded-md border border-[#06C755] bg-[#06C755] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90"
            >
              LINEで相談する
            </button>
          )}

          {/* 従来のスポット相談フォーム連携 */}
          {onSpotConsultClick && (
            <button
              type="button"
              onClick={() => onSpotConsultClick()}
              className="w-full rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700"
            >
              この薬剤師にスポット相談を申し込む
            </button>
          )}
        </div>
      </div>
    </AppCard>
  );
}

/* ============================
 *   連絡先登録フォーム
 * ============================ */

function ContactForm({
  patient,
  selectedPharmacist,
  intent,
  onIntentChange,
  contactPrefill,
}: {
  patient: Patient;
  selectedPharmacist: Pharmacist | null;
  intent: IntentType;
  onIntentChange: (intent: IntentType) => void;
  contactPrefill: ContactPrefill;
}) {
  const [contact, setContact] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const defaultPlaceholder =
    "メールアドレスや、連絡がつきやすい手段を入力してください";
  const [contactPlaceholder, setContactPlaceholder] =
    useState<string>(defaultPlaceholder);

  // 電話／店舗相談などから遷移してきたときに、メモやプレースホルダを反映
  useEffect(() => {
    const ph =
      contactPrefill.contactPlaceholder &&
      contactPrefill.contactPlaceholder.length > 0
        ? contactPrefill.contactPlaceholder
        : defaultPlaceholder;
    setContactPlaceholder(ph);

    if (contactPrefill.message && contactPrefill.message.length > 0) {
      setMessage(contactPrefill.message);
    }
  }, [contactPrefill]);

  const intentLabel: Record<IntentType, string> = {
    spot_consult: "【スポット相談希望】",
    mentor_candidate: "【顧問候補として相談】",
    save_for_later: "【あとで連絡希望】",
  };

  const intentDescription: Record<IntentType, string> = {
    spot_consult:
      "まずは1回、オンラインで具体的な相談をしてみたい方向けです。",
    mentor_candidate:
      "将来的に顧問薬剤師として関係を持つことも視野に入れて、話を聞いてみたい方向けです。",
    save_for_later:
      "今すぐ相談はしないものの、診断結果や連絡手段を残しておきたい方向けです。（将来的にLINE連携も予定しています）",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;
    setStatus("saving");
    setError(null);

    try {
      // ① これまで通り patients.note に追記
      const notePrefix = patient.note ? `${patient.note}\n` : "";

      const intentTag = intentLabel[intent];
      const pharmacistTag = selectedPharmacist
        ? `（希望薬剤師: ${selectedPharmacist.name}）`
        : "";
      const messageTag = message ? `\n[相談したいことメモ] ${message}` : "";

      const newLine = `${intentTag}${pharmacistTag} 連絡先: ${contact}${messageTag}`;
      const newNote = `${notePrefix}${newLine}`;

      const { error: updateError } = await supabase
        .from("patients")
        .update({ note: newNote })
        .eq("id", patient.id);

      if (updateError) {
        console.error(updateError);
        setError("連絡先の保存に失敗しました。");
        setStatus("error");
        return;
      }

      // ② 直近の appointments レコードにも contact を反映
      //    （同じ患者 ＋ 同じ薬剤師 の最新 opened_at を対象にする）
      if (selectedPharmacist) {
        const { data: latestAppt, error: latestError } = await supabase
          .from("appointments")
          .select("id")
          .eq("patient_id", patient.id)
          .eq("pharmacist_id", selectedPharmacist.id)
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestError && latestAppt) {
          const { error: contactError } = await supabase
            .from("appointments")
            .update({ contact })
            .eq("id", latestAppt.id);

          if (contactError) {
            console.error(
              "appointments.contact の更新に失敗しました",
              contactError
            );
            // 患者側には保存済みなので、ここではエラー表示まではしない
          }
        }
      }

      setStatus("done");
    } catch (e) {
      console.error(e);
      setError("予期せぬエラーが発生しました。");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <p className="text-sm text-emerald-700">
        連絡先を保存しました。担当者より後日ご連絡いたします。ありがとうございました。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {/* 電話／店舗相談から遷移してきた場合の案内メッセージ */}
      {contactPrefill.highlight && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
          「電話相談」または「店舗相談」で選択した内容を、下のフォームに引き継ぎました。
          連絡のつきやすい電話番号を入力し、「この内容で連絡先を送信する」を押してください。
        </div>
      )}

      {/* 目的の選択 */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-800">
          ご希望のステップをお選びください
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer hover:bg-slate-50">
            <input
              type="radio"
              className="mt-0.5"
              checked={intent === "spot_consult"}
              onChange={() => onIntentChange("spot_consult")}
            />
            <span>
              <span className="block font-semibold mb-0.5">
                スポット相談（1回）
              </span>
              <span className="text-[11px] text-slate-600">
                {intentDescription.spot_consult}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer hover:bg-slate-50">
            <input
              type="radio"
              className="mt-0.5"
              checked={intent === "mentor_candidate"}
              onChange={() => onIntentChange("mentor_candidate")}
            />
            <span>
              <span className="block font-semibold mb-0.5">
                顧問候補として相談
              </span>
              <span className="text-[11px] text-slate-600">
                {intentDescription.mentor_candidate}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer hover:bg-slate-50">
            <input
              type="radio"
              className="mt-0.5"
              checked={intent === "save_for_later"}
              onChange={() => onIntentChange("save_for_later")}
            />
            <span>
              <span className="block font-semibold mb-0.5">
                あとで連絡したい
              </span>
              <span className="text-[11px] text-slate-600">
                {intentDescription.save_for_later}
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* 選択中の薬剤師 */}
      <div className="space-y-1 text-xs text-slate-700">
        <p className="font-semibold">相談を希望する薬剤師</p>
        {selectedPharmacist ? (
          <p>
            現在の選択：
            <span className="font-semibold">{selectedPharmacist.name}</span>
          </p>
        ) : (
          <p className="text-slate-500">
            まだ薬剤師が選択されていません。上の「あなたに合いそうな薬剤師」から気になる方の
            「スポット相談」ボタンを押すと、ここに反映されます。
          </p>
        )}
      </div>

      {/* 連絡先 */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-800">連絡先</p>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder={contactPlaceholder}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </div>

      {/* 簡単な相談内容（任意） */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-800">
          相談したいこと（任意）
        </p>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[80px]"
          placeholder="今気になっていることを、1〜2行ほどで書いていただけるとスムーズです。"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!contact || status === "saving"}
        className="rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "saving" ? "送信中..." : "この内容で連絡先を送信する"}
      </button>
    </form>
  );
}
