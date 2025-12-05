// src/app/diagnosis/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Patient } from "@/types/supabase";

type CareStyleKey =
  | "understanding"
  | "empathy"
  | "expert"
  | "support"
  | "family"
  | "second_opinion";

type CommStyleKey =
  | "calm"
  | "direct"
  | "visual"
  | "empathy"
  | "collaborative"
  | "logical";

type Severity = "mild" | "moderate" | "severe";

type ValuePreference =
  | "expertise"
  | "empathy"
  | "lifestyle_support"
  | "multilingual"
  | "";

type FollowupFrequency = "spot" | "monthly" | "regular" | "";
type ChannelPreference = "chat" | "video" | "in_person" | "";

// 症状・生活のスコアキー
type SymptomKey =
  | "ibs"
  | "skin"
  | "cancer"
  | "mental_sleep"
  | "mental_mood"
  | "mental_autonomic"
  | "pain"
  | "cold_edema"
  | "other_body";
type LifestyleKey =
  | "support_homecare"
  | "metabolic"
  | "diet_exercise"
  | "child_care"
  | "elder_care"
  | "other_life";

interface DiagnosisState {
  // Step1
  language: string;
  area: string;
  severity: Severity | "";
  value_preference: ValuePreference;

  // Step2
  care_style: CareStyleKey | "";

  // Step3
  comm_style: CommStyleKey[];
  explanation_depth: "" | "simple" | "evidence";

  // Step4
  symptom_score: Record<SymptomKey, number>;
  lifestyle_score: Record<LifestyleKey, number>;

  // Step5
  followup_frequency: FollowupFrequency;
  channel_preference: ChannelPreference;
}

const INITIAL_STATE: DiagnosisState = {
  language: "ja",
  area: "",
  severity: "",
  value_preference: "",

  care_style: "",

  comm_style: [],
  explanation_depth: "",

  symptom_score: {
    ibs: 0,
    skin: 0,
    cancer: 0,
    mental_sleep: 0,
    mental_mood: 0,
    mental_autonomic: 0,
    pain: 0,
    cold_edema: 0,
    other_body: 0,
  },
  lifestyle_score: {
    support_homecare: 0,
    metabolic: 0,
    diet_exercise: 0,
    child_care: 0,
    elder_care: 0,
    other_life: 0,
  },

  followup_frequency: "",
  channel_preference: "",
};

export default function DiagnosisPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [state, setState] = useState<DiagnosisState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goNext = () => setStep((s) => Math.min(s + 1, 5));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Patient> = {
        language: state.language,
        area: state.area || null,
        severity: state.severity || null,
        value_preference: state.value_preference || null,
        care_style: state.care_style || null,
        comm_style: state.comm_style.length > 0 ? state.comm_style : null,
        explanation_depth: state.explanation_depth || null,
        followup_frequency: state.followup_frequency || null,
        channel_preference: state.channel_preference || null,
        symptom_score: state.symptom_score,
        lifestyle_score: state.lifestyle_score,

        // A〜Dタイプが未決の場合の簡易デフォルト
        type: "A",
      };

      const { data, error: insertError } = await supabase
        .from("patients")
        .insert(payload)
        .select("*")
        .single<Patient>();

      if (insertError || !data) {
        console.error(insertError);
        setError("診断結果の保存に失敗しました。時間をおいて再度お試しください。");
        setSaving(false);
        return;
      }

      router.push(`/result?patientId=${data.id}`);
    } catch (e) {
      console.error(e);
      setError("予期せぬエラーが発生しました。");
      setSaving(false);
    }
  };

  const canNext = (() => {
    if (step === 1) {
      return !!state.severity;
    }
    if (step === 2) {
      return !!state.care_style;
    }
    if (step === 3) {
      return state.comm_style.length > 0;
    }
    if (step === 4) {
      // どこか1つ以上は選んでいてほしい
      const sumBody = Object.values(state.symptom_score).reduce(
        (a, b) => a + b,
        0
      );
      const sumLife = Object.values(state.lifestyle_score).reduce(
        (a, b) => a + b,
        0
      );
      return sumBody + sumLife > 0;
    }
    if (step === 5) {
      return !!state.followup_frequency && !!state.channel_preference;
    }
    return true;
  })();

  return (
    <div className="mx-auto max-w-3xl px-2 sm:px-0 space-y-5 sm:space-y-6">
      <header className="space-y-1.5 sm:space-y-2">
        <h1 className="text-xl font-bold leading-tight sm:text-2xl">
          顧問薬剤師タイプ診断
        </h1>
        <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
          あなたの「相談スタイル」と「今の不安」に合う顧問薬剤師タイプを診断します。
          すべて選択式で、1〜2分ほどで終わります。
        </p>
        {/* ▼ すでに診断済みの人向けマイページ導線 */}
        <p className="text-[11px] text-slate-500">
          以前の診断結果や「気になる薬剤師」は{" "}
          <Link
            href="/mypage"
            className="text-sky-700 underline underline-offset-2"
          >
            マイページ
          </Link>
          からいつでも見返すことができます。
        </p>
      </header>

      {/* ステップインジケータ */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={[
                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                s === step
                  ? "border-sky-600 bg-sky-600 text-white"
                  : s < step
                  ? "border-sky-400 bg-sky-50 text-sky-700"
                  : "border-slate-300 bg-white text-slate-400",
              ].join(" ")}
            >
              {s}
            </div>
            {s < 5 && <div className="h-[1px] w-6 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* ステップ本体 */}
      <div className="space-y-4 rounded-xl border bg-white p-3 sm:p-4 md:p-5 sm:space-y-5">
        {step === 1 && <Step1Basic state={state} setState={setState} />}
        {step === 2 && <Step2CareStyle state={state} setState={setState} />}
        {step === 3 && <Step3Comm state={state} setState={setState} />}
        {step === 4 && <Step4Symptom state={state} setState={setState} />}
        {step === 5 && <Step5Followup state={state} setState={setState} />}

        {error && (
          <p className="mt-1 text-[11px] text-red-600 sm:text-xs">{error}</p>
        )}

        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1 || saving}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
          >
            戻る
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext || saving}
              className="rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              次へ進む
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canNext || saving}
              className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              {saving ? "診断結果を保存中..." : "診断結果を見る"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================
 *   Step1：基本情報
 * ============================ */

function Step1Basic({
  state,
  setState,
}: {
  state: DiagnosisState;
  setState: React.Dispatch<React.SetStateAction<DiagnosisState>>;
}) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <h2 className="text-base font-semibold sm:text-lg">
        1. まずは簡単な情報を教えてください
      </h2>

      <div className="space-y-1.5 text-sm">
        <label className="block text-xs font-medium text-slate-700">
          普段、医療者と話すときに使う言語
        </label>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
          value={state.language}
          onChange={(e) =>
            setState((prev) => ({ ...prev, language: e.target.value }))
          }
        >
          <option value="ja">日本語</option>
          <option value="en">英語</option>
          <option value="zh">中国語</option>
          <option value="vi">ベトナム語</option>
          <option value="ko">韓国語</option>
        </select>
        <p className="text-[11px] text-slate-500">
          顧問薬剤師と話したい言語を選んでください。
        </p>
      </div>

      <div className="space-y-1.5 text-sm">
        <label className="block text-xs font-medium text-slate-700">
          お住まいのエリア（市区町村など）
        </label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
          placeholder="例：京都市中京区"
          value={state.area}
          onChange={(e) =>
            setState((prev) => ({ ...prev, area: e.target.value }))
          }
        />
        <p className="text-[11px] text-slate-500">
          通える範囲の薬局や、在宅対応の参考に使います。
        </p>
      </div>

      <div className="space-y-1.5 text-sm">
        <label className="block text-xs font-medium text-slate-700">
          いまの体調・状況のイメージ
        </label>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
          <RadioCard
            label="気になることはあるが、そこまで重くはない"
            checked={state.severity === "mild"}
            onClick={() =>
              setState((prev) => ({ ...prev, severity: "mild" }))
            }
          />
          <RadioCard
            label="日常生活に少し支障が出ている"
            checked={state.severity === "moderate"}
            onClick={() =>
              setState((prev) => ({ ...prev, severity: "moderate" }))
            }
          />
          <RadioCard
            label="かなりつらく、しっかり相談したい"
            checked={state.severity === "severe"}
            onClick={() =>
              setState((prev) => ({ ...prev, severity: "severe" }))
            }
          />
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <label className="block text-xs font-medium text-slate-700">
          顧問薬剤師に特に期待したいこと
        </label>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
          <RadioCard
            label="専門性・知識を重視したい"
            checked={state.value_preference === "expertise"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                value_preference: "expertise",
              }))
            }
          />
          <RadioCard
            label="気持ちに寄り添ってほしい"
            checked={state.value_preference === "empathy"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                value_preference: "empathy",
              }))
            }
          />
          <RadioCard
            label="生活や仕事との両立を一緒に考えてほしい"
            checked={state.value_preference === "lifestyle_support"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                value_preference: "lifestyle_support",
              }))
            }
          />
          <RadioCard
            label="外国語で相談したい"
            checked={state.value_preference === "multilingual"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                value_preference: "multilingual",
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ============================
 *   Step2：相談スタイル（6タイプ）
 * ============================ */

function Step2CareStyle({
  state,
  setState,
}: {
  state: DiagnosisState;
  setState: React.Dispatch<React.SetStateAction<DiagnosisState>>;
}) {
  const options: { key: CareStyleKey; title: string; body: string }[] = [
    {
      key: "understanding",
      title: "しっかり理解したい",
      body: "診断名や検査結果の意味をきちんと理解し、納得したうえで治療を進めたい。",
    },
    {
      key: "empathy",
      title: "気持ちを支えてほしい",
      body: "不安やつらさなど、まず気持ちを聞いてもらえると安心できる。",
    },
    {
      key: "expert",
      title: "おまかせしたい",
      body: "自分だけで判断するのは不安で、信頼できる専門家に方針を決めてほしい。",
    },
    {
      key: "support",
      title: "続けるのを支えてほしい",
      body: "治療や薬の大切さは分かっているが、『続けること』がいちばん大変に感じる。",
    },
    {
      key: "family",
      title: "家族のことを相談したい",
      body: "自分だけでなく、高齢の親や子どものことなど、家族の健康について相談したい。",
    },
    {
      key: "second_opinion",
      title: "選択肢を比較して決めたい",
      body: "今の治療方針が自分に合っているか気になり、他の選択肢も知った上で決めたい。",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <h2 className="text-base font-semibold sm:text-lg">
        2. 顧問薬剤師にどんな相談のしかたを望みますか？
      </h2>
      <p className="text-xs text-slate-600">
        一番しっくりくるものを1つ選んでください。
      </p>
      <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() =>
              setState((prev) => ({ ...prev, care_style: opt.key }))
            }
            className={[
              "flex w-full flex-col items-start rounded-md border px-3 py-2 text-left text-xs transition sm:text-sm",
              state.care_style === opt.key
                ? "border-sky-500 bg-sky-50"
                : "border-slate-200 bg-white hover:bg-slate-50",
            ].join(" ")}
          >
            <div className="mb-1 text-xs font-semibold sm:text-sm">
              {opt.title}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 sm:text-xs">
              {opt.body}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================
 *   Step3：コミュニケーションの好み
 * ============================ */

function Step3Comm({
  state,
  setState,
}: {
  state: DiagnosisState;
  setState: React.Dispatch<React.SetStateAction<DiagnosisState>>;
}) {
  const toggleComm = (key: CommStyleKey) => {
    setState((prev) => {
      const exists = prev.comm_style.includes(key);
      return {
        ...prev,
        comm_style: exists
          ? prev.comm_style.filter((k) => k !== key)
          : [...prev.comm_style, key],
      };
    });
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <h2 className="text-base font-semibold sm:text-lg">
        3. 話し方やコミュニケーションの好みを教えてください
      </h2>

      <div className="space-y-2 text-sm">
        <div className="text-xs font-medium text-slate-700">
          話し方・コミュニケーションのスタイル（複数選択可）
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
          <CheckboxCard
            label="落ち着いた口調でゆっくり話してほしい"
            checked={state.comm_style.includes("calm")}
            onClick={() => toggleComm("calm")}
          />
          <CheckboxCard
            label="結論からはっきり伝えてほしい"
            checked={state.comm_style.includes("direct")}
            onClick={() => toggleComm("direct")}
          />
          <CheckboxCard
            label="例え話や図を使って分かりやすく説明してほしい"
            checked={state.comm_style.includes("visual")}
            onClick={() => toggleComm("visual")}
          />
          <CheckboxCard
            label="気持ちに寄り添いながら聞いてほしい"
            checked={state.comm_style.includes("empathy")}
            onClick={() => toggleComm("empathy")}
          />
          <CheckboxCard
            label="一緒に考えながら方針を決めたい"
            checked={state.comm_style.includes("collaborative")}
            onClick={() => toggleComm("collaborative")}
          />
          <CheckboxCard
            label="根拠やデータも踏まえて説明してほしい"
            checked={state.comm_style.includes("logical")}
            onClick={() => toggleComm("logical")}
          />
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="text-xs font-medium text-slate-700">
          説明の深さについて
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
          <RadioCard
            label="専門用語はあまり使わず、ざっくり分かれば十分"
            checked={state.explanation_depth === "simple"}
            onClick={() =>
              setState((prev) => ({ ...prev, explanation_depth: "simple" }))
            }
          />
          <RadioCard
            label="できれば根拠やガイドラインも踏まえて詳しく知りたい"
            checked={state.explanation_depth === "evidence"}
            onClick={() =>
              setState((prev) => ({ ...prev, explanation_depth: "evidence" }))
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ============================
 *   Step4：相談したい内容（症状・生活）
 * ============================ */

function Step4Symptom({
  state,
  setState,
}: {
  state: DiagnosisState;
  setState: React.Dispatch<React.SetStateAction<DiagnosisState>>;
}) {
  const toggleSymptom = (key: SymptomKey) => {
    setState((prev) => ({
      ...prev,
      symptom_score: {
        ...prev.symptom_score,
        [key]: prev.symptom_score[key] === 1 ? 0 : 1,
      },
    }));
  };

  const toggleLife = (key: LifestyleKey) => {
    setState((prev) => ({
      ...prev,
      lifestyle_score: {
        ...prev.lifestyle_score,
        [key]: prev.lifestyle_score[key] === 1 ? 0 : 1,
      },
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <h2 className="text-base font-semibold sm:text-lg">
        4. 今とくに相談したい内容を教えてください
      </h2>
      <p className="text-xs text-slate-600">
        当てはまるものをいくつでも選んでください。（あとから変わっても大丈夫です）
      </p>

      {/* 身体の不調 */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-700">
          身体の不調について（複数選択可）
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2 text-sm">
          <CheckboxCard
            label="胃腸・お腹の不調（IBS／便秘／下痢など）"
            checked={state.symptom_score.ibs === 1}
            onClick={() => toggleSymptom("ibs")}
          />
          <CheckboxCard
            label="皮膚のトラブル（湿疹／アトピーなど）"
            checked={state.symptom_score.skin === 1}
            onClick={() => toggleSymptom("skin")}
          />
          <CheckboxCard
            label="がん・治療中／治療後のケア"
            checked={state.symptom_score.cancer === 1}
            onClick={() => toggleSymptom("cancer")}
          />
          <CheckboxCard
            label="慢性的な痛み（頭痛・腰痛など）"
            checked={state.symptom_score.pain === 1}
            onClick={() => toggleSymptom("pain")}
          />
          <CheckboxCard
            label="冷え・だるさ・むくみ"
            checked={state.symptom_score.cold_edema === 1}
            onClick={() => toggleSymptom("cold_edema")}
          />
          <CheckboxCard
            label="その他の身体の不調"
            checked={state.symptom_score.other_body === 1}
            onClick={() => toggleSymptom("other_body")}
          />
        </div>
      </div>

      {/* こころ・体質 */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-700">
          こころ・体質について（複数選択可）
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2 text-sm">
          <CheckboxCard
            label="眠れない、眠りが浅い"
            checked={state.symptom_score.mental_sleep === 1}
            onClick={() => toggleSymptom("mental_sleep")}
          />
          <CheckboxCard
            label="不安・落ち込みが続いている"
            checked={state.symptom_score.mental_mood === 1}
            onClick={() => toggleSymptom("mental_mood")}
          />
          <CheckboxCard
            label="自律神経の乱れ（動悸・息苦しさなど）"
            checked={state.symptom_score.mental_autonomic === 1}
            onClick={() => toggleSymptom("mental_autonomic")}
          />
        </div>
      </div>

      {/* 生活・家族 */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-700">
          生活や家族のことについて（複数選択可）
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2 text-sm">
          <CheckboxCard
            label="高血圧・糖尿病・コレステロールなどが心配"
            checked={state.lifestyle_score.metabolic === 1}
            onClick={() => toggleLife("metabolic")}
          />
          <CheckboxCard
            label="ダイエット／運動不足をなんとかしたい"
            checked={state.lifestyle_score.diet_exercise === 1}
            onClick={() => toggleLife("diet_exercise")}
          />
          <CheckboxCard
            label="子どもの薬や体調が心配"
            checked={state.lifestyle_score.child_care === 1}
            onClick={() => toggleLife("child_care")}
          />
          <CheckboxCard
            label="高齢の親の薬や通院について相談したい"
            checked={state.lifestyle_score.elder_care === 1}
            onClick={() => toggleLife("elder_care")}
          />
          <CheckboxCard
            label="在宅医療・訪問診療について知りたい"
            checked={state.lifestyle_score.support_homecare === 1}
            onClick={() => toggleLife("support_homecare")}
          />
          <CheckboxCard
            label="その他の生活上の不安"
            checked={state.lifestyle_score.other_life === 1}
            onClick={() => toggleLife("other_life")}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================
 *   Step5：相談頻度・チャネル
 * ============================ */

function Step5Followup({
  state,
  setState,
}: {
  state: DiagnosisState;
  setState: React.Dispatch<React.SetStateAction<DiagnosisState>>;
}) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <h2 className="text-base font-semibold sm:text-lg">
        5. 相談の頻度や方法について教えてください
      </h2>

      <div className="space-y-2 text-sm">
        <div className="text-xs font-medium text-slate-700">
          どのくらいの頻度で顧問薬剤師に相談したいですか？
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
          <RadioCard
            label="何かあったときだけ、スポットで相談できれば十分"
            checked={state.followup_frequency === "spot"}
            onClick={() =>
              setState((prev) => ({ ...prev, followup_frequency: "spot" }))
            }
          />
          <RadioCard
            label="月1回くらい、様子を確認してもらえると安心"
            checked={state.followup_frequency === "monthly"}
            onClick={() =>
              setState((prev) => ({ ...prev, followup_frequency: "monthly" }))
            }
          />
          <RadioCard
            label="定期的にしっかりフォローしてほしい"
            checked={state.followup_frequency === "regular"}
            onClick={() =>
              setState((prev) => ({ ...prev, followup_frequency: "regular" }))
            }
          />
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="text-xs font-medium text-slate-700">
          相談の方法について
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
          <RadioCard
            label="チャット中心で相談したい"
            checked={state.channel_preference === "chat"}
            onClick={() =>
              setState((prev) => ({ ...prev, channel_preference: "chat" }))
            }
          />
          <RadioCard
            label="ビデオ通話で話したい"
            checked={state.channel_preference === "video"}
            onClick={() =>
              setState((prev) => ({ ...prev, channel_preference: "video" }))
            }
          />
          <RadioCard
            label="必要に応じて対面も含めて相談したい"
            checked={state.channel_preference === "in_person"}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                channel_preference: "in_person",
              }))
            }
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        実際の相談内容や契約の形は、顧問薬剤師との話し合いで柔軟に決めていくことができます。
      </p>
    </div>
  );
}

/* ============================
 *   小さい UI コンポーネント
 * ============================ */

function RadioCard({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-md border px-3 py-2 text-left text-xs transition sm:text-sm",
        checked
          ? "border-sky-500 bg-sky-50"
          : "border-slate-200 bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <div
          className={[
            "mt-[3px] h-3 w-3 rounded-full border",
            checked ? "border-sky-600 bg-sky-600" : "border-slate-300",
          ].join(" ")}
        />
        <span className="text-slate-700">{label}</span>
      </div>
    </button>
  );
}

function CheckboxCard({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-md border px-3 py-2 text-left text-xs transition sm:text-sm",
        checked
          ? "border-emerald-500 bg-emerald-50"
          : "border-slate-200 bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <div
          className={[
            "mt-[1px] flex h-3 w-3 items-center justify-center rounded border text-[9px]",
            checked
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 text-transparent",
          ].join(" ")}
        >
          ✓
        </div>
        <span className="text-slate-700">{label}</span>
      </div>
    </button>
  );
}
