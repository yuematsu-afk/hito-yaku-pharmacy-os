// src/app/admin/pharmacists/page.tsx
"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Pharmacist, Pharmacy } from "@/types/supabase";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";

// =========================
// CareStyle 定義
// =========================
type CareStyleKey =
  | "understanding"
  | "empathy"
  | "expert"
  | "support"
  | "family"
  | "second_opinion";

const CARE_STYLE_OPTIONS: {
  key: CareStyleKey;
  label: string;
  description: string;
}[] = [
  {
    key: "understanding",
    label: "しっかり理解タイプ",
    description:
      "診断名や検査結果の意味をていねいに説明して整理するのが得意",
  },
  {
    key: "empathy",
    label: "気持ちケアタイプ",
    description: "不安やつらさなど、気持ちに寄り添いながら話を聞くのが得意",
  },
  {
    key: "expert",
    label: "おまかせタイプ",
    description:
      "エビデンスや経験にもとづき、全体の方針を一緒に決めるのが得意",
  },
  {
    key: "support",
    label: "継続苦手タイプ",
    description:
      "治療や習慣を続けるための小さな工夫・伴走サポートが得意",
  },
  {
    key: "family",
    label: "家族サポートタイプ",
    description: "本人だけでなく家族も含めた相談に乗るのが得意",
  },
  {
    key: "second_opinion",
    label: "比較タイプ",
    description:
      "治療の選択肢やセカンドオピニオンを整理・比較するのが得意",
  },
];

// =========================
// 型定義（Pharmacist をゆるく拡張）
// =========================

type ExtendedPharmacist = Pharmacist & {
  one_line_message?: string | null;
  birth_date?: string | null;
  license_number?: string | null;
  web_links?: string[] | null;
  sns_links?: string[] | null;
  image_urls?: string[] | null; // 複数画像
  image_url?: string | null; // 既存の単一画像カラム想定
  visibility?: "public" | "members" | null; // DB はあって TS 型にはないケース用
  care_role?: CareStyleKey[] | string[] | null;
};

// 登録フォーム用（DB 型とは独立）
type InsertPharmacist = {
  name: string;
  belongs_pharmacy_id: string | null;
  one_line_message: string;
  specialty: string[];
  language: string[];
  care_role: CareStyleKey[];
  years_of_experience: number | null;
  visibility: "public" | "members";
  gender: string; // "", "女性", "男性", "その他"
  gender_other: string;
  birth_date: string | null;
  license_number: string;
  web_links: string[];
  sns_links: string[];
  image_urls: string[];
  image_url: string | null;
};

// =========================
// ユーティリティ
// =========================

function calcAgeCategory(
  birthDateStr: string | null | undefined
): string | null {
  if (!birthDateStr) return null;
  const d = new Date(birthDateStr);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  if (age < 20) return null;
  if (age < 30) return "20代";
  if (age < 40) return "30代";
  if (age < 50) return "40代";
  if (age < 60) return "50代";
  if (age < 70) return "60代";
  return "70代以上";
}

// 1行1URL → string[]
function parseMultilineUrls(value: string): string[] {
  return value
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// カンマ区切り → string[]
function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function AdminPharmacistsPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacists, setPharmacists] = useState<ExtendedPharmacist[]>([]);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null); // 編集中の薬剤師
  const [showForm, setShowForm] = useState<boolean>(false); // 登録フォーム開閉

  // 登録フォーム state
  const [form, setForm] = useState<InsertPharmacist>({
    name: "",
    belongs_pharmacy_id: null,
    one_line_message: "",
    specialty: [],
    language: [],
    care_role: [],
    years_of_experience: null,
    visibility: "members",
    gender: "",
    gender_other: "",
    birth_date: null,
    license_number: "",
    web_links: [],
    sns_links: [],
    image_urls: [],
    image_url: null,
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]); // 最大5枚

  // =========================
  // 初期ロード
  // =========================
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          { data: pharmaciesData, error: phErr },
          { data: pharmacistsData, error: paErr },
        ] = await Promise.all([
          supabase
            .from("pharmacies")
            .select("*")
            .order("name", { ascending: true }),
          supabase
            .from("pharmacists")
            .select("*")
            .order("name", { ascending: true }),
        ]);

        if (phErr) throw phErr;
        if (paErr) throw paErr;

        setPharmacies((pharmaciesData ?? []) as Pharmacy[]);
        setPharmacists((pharmacistsData ?? []) as ExtendedPharmacist[]);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  // =========================
  // 登録フォーム：入力ハンドラ
  // =========================
  const handleInputChange = (
    e: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    if (name === "belongs_pharmacy_id") {
      setForm((prev) => ({
        ...prev,
        belongs_pharmacy_id: value === "" ? null : value,
      }));
      return;
    }

    if (name === "years_of_experience") {
      setForm((prev) => ({
        ...prev,
        years_of_experience: value === "" ? null : Number(value),
      }));
      return;
    }

    if (name === "visibility") {
      setForm((prev) => ({
        ...prev,
        visibility: value as "public" | "members",
      }));
      return;
    }

    if (name === "gender") {
      setForm((prev) => ({
        ...prev,
        gender: value,
        gender_other: value === "その他" ? prev.gender_other : "",
      }));
      return;
    }

    if (name === "birth_date") {
      setForm((prev) => ({
        ...prev,
        birth_date: value === "" ? null : value,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ケアロール（登録フォーム）
  const toggleFormCareRole = (key: CareStyleKey) => {
    setForm((prev) => {
      const list = prev.care_role;
      const exists = list.includes(key);
      return {
        ...prev,
        care_role: exists ? list.filter((k) => k !== key) : [...list, key],
      };
    });
  };

  const specialtyInputValue = form.specialty.join(", ");
  const languageInputValue = form.language.join(", ");
  const webLinksInputValue = form.web_links.join("\n");
  const snsLinksInputValue = form.sns_links.join("\n");

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    setImageFiles(files);
  };

  // =========================
  // 登録フォーム送信
  // =========================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1) 画像アップロード
      let imageUrls: string[] = [];

      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = fileName;

          const { error: uploadError } = await supabase.storage
            .from("pharmacists")
            .upload(filePath, file);

          if (uploadError) {
            console.error(uploadError);
            throw new Error("画像のアップロードに失敗しました。");
          }

          const { data: publicData } = supabase.storage
            .from("pharmacists")
            .getPublicUrl(filePath);

          if (publicData.publicUrl) {
            imageUrls.push(publicData.publicUrl);
          }
        }
      }

      const mainImageUrl = imageUrls[0] ?? null;

      // 2) 年代算出
      const ageCategory = calcAgeCategory(form.birth_date);

      // 3) payload 作成（型注釈は付けない）
      const payload = {
        name: form.name,
        belongs_pharmacy_id: form.belongs_pharmacy_id,
        one_line_message: form.one_line_message || null,
        specialty: form.specialty,
        language: form.language,
        care_role: form.care_role,
        years_of_experience: form.years_of_experience,
        visibility: form.visibility, // "public" | "members"
        gender: form.gender === "" ? null : (form.gender as Pharmacist["gender"]),
        gender_other:
          form.gender === "その他" && form.gender_other
            ? form.gender_other
            : null,
        birth_date: form.birth_date,
        age_category: ageCategory as Pharmacist["age_category"] | null,
        license_number: form.license_number || null,
        web_links: form.web_links,
        sns_links: form.sns_links,
        image_urls: imageUrls,
        image_url: mainImageUrl,
      };

      if (!payload.name) {
        throw new Error("薬剤師の氏名を入力してください。");
      }

      const { data: inserted, error: insertError } = await supabase
        .from("pharmacists")
        .insert(payload)
        .select("*")
        .single<ExtendedPharmacist>();

      if (insertError) {
        console.error(insertError);
        throw new Error("薬剤師の登録に失敗しました。");
      }

      // 一覧に追加
      setPharmacists((prev) => [inserted as ExtendedPharmacist, ...prev]);

      // フォームリセット
      setForm({
        name: "",
        belongs_pharmacy_id: null,
        one_line_message: "",
        specialty: [],
        language: [],
        care_role: [],
        years_of_experience: null,
        visibility: "members",
        gender: "",
        gender_other: "",
        birth_date: null,
        license_number: "",
        web_links: [],
        sns_links: [],
        image_urls: [],
        image_url: null,
      });
      setImageFiles([]);
      const imageInput = document.getElementById(
        "pharmacist-image-input"
      ) as HTMLInputElement | null;
      if (imageInput) {
        imageInput.value = "";
      }

      setSuccessMessage("薬剤師を登録しました。");
      setShowForm(false);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "登録中にエラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  // =========================
  // 一覧側：編集ハンドラ
  // =========================

  const toggleRoleRow = (id: string, key: CareStyleKey) => {
    setPharmacists((prev) =>
      prev.map((ph) => {
        if (ph.id !== id) return ph;
        const list = (ph.care_role ?? []) as string[];
        const updated = list.includes(key)
          ? list.filter((k) => k !== key)
          : [...list, key];
        return { ...ph, care_role: updated } as ExtendedPharmacist;
      })
    );
  };

  const handleGenderChangeRow = (id: string, value: string) => {
    setPharmacists((prev) =>
      prev.map((ph) => {
        if (ph.id !== id) return ph;

        if (value === "") {
          return {
            ...ph,
            gender: null,
            gender_other: null,
          } as ExtendedPharmacist;
        }
        if (value === "その他") {
          return {
            ...ph,
            gender: "その他" as Pharmacist["gender"],
            gender_other: ph.gender_other ?? "",
          } as ExtendedPharmacist;
        }
        return {
          ...ph,
          gender: value as Pharmacist["gender"],
          gender_other: null,
        } as ExtendedPharmacist;
      })
    );
  };

  const handleGenderOtherChangeRow = (id: string, value: string) => {
    const trimmed = value.slice(0, 40);
    setPharmacists((prev) =>
      prev.map((ph) =>
        ph.id === id
          ? ({ ...ph, gender_other: trimmed } as ExtendedPharmacist)
          : ph
      )
    );
  };

  const handleBirthDateChangeRow = (id: string, value: string) => {
    const bd = value === "" ? null : value;
    const ageCat = calcAgeCategory(bd);
    setPharmacists((prev) =>
      prev.map((ph) =>
        ph.id === id
          ? ({
              ...ph,
              birth_date: bd,
              age_category: ageCat as Pharmacist["age_category"] | null,
            } as ExtendedPharmacist)
          : ph
      )
    );
  };

  const handleLicenseNumberChangeRow = (id: string, value: string) => {
    setPharmacists((prev) =>
      prev.map((ph) =>
        ph.id === id
          ? ({ ...ph, license_number: value } as ExtendedPharmacist)
          : ph
      )
    );
  };

  const handleOneLineMessageChangeRow = (id: string, value: string) => {
    setPharmacists((prev) =>
      prev.map((ph) =>
        ph.id === id
          ? ({ ...ph, one_line_message: value } as ExtendedPharmacist)
          : ph
      )
    );
  };

  const handleYearsChangeRow = (id: string, value: string) => {
    const num = value === "" ? null : Number(value);
    setPharmacists((prev) =>
      prev.map((ph) =>
        ph.id === id
          ? ({ ...ph, years_of_experience: num } as ExtendedPharmacist)
          : ph
      )
    );
  };

  const handleVisibilityChangeRow = (id: string, value: string) => {
    const v = value as "public" | "members";
    setPharmacists((prev) =>
      prev.map((ph) =>
        ph.id === id
          ? ({ ...ph, visibility: v } as ExtendedPharmacist)
          : ph
      )
    );
  };

  const handleWebLinksChangeRow = (id: string, value: string) => {
    const arr = parseMultilineUrls(value);
    setPharmacists((prev) =>
      prev.map((ph) =>
        ph.id === id
          ? ({ ...ph, web_links: arr } as ExtendedPharmacist)
          : ph
      )
    );
  };

  const handleSNSLinksChangeRow = (id: string, value: string) => {
    const arr = parseMultilineUrls(value);
    setPharmacists((prev) =>
      prev.map((ph) =>
        ph.id === id
          ? ({ ...ph, sns_links: arr } as ExtendedPharmacist)
          : ph
      )
    );
  };

  // =========================
  // 保存（一人分）
  // =========================
  const savePharmacist = async (ph: ExtendedPharmacist) => {
    setSavingId(ph.id);
    setError(null);
    setSuccessMessage(null);

    const ageCategory = calcAgeCategory(ph.birth_date ?? null);

    const payload = {
      care_role: ph.care_role ?? [],
      gender: ph.gender ?? null,
      gender_other:
        ph.gender === "その他" ? ph.gender_other ?? null : null,
      birth_date: ph.birth_date ?? null,
      age_category: ageCategory as Pharmacist["age_category"] | null,
      license_number: ph.license_number ?? null,
      one_line_message: ph.one_line_message ?? null,
      years_of_experience: ph.years_of_experience ?? null,
      visibility:
        (ph.visibility ?? "members") as "public" | "members",
      web_links: ph.web_links ?? [],
      sns_links: ph.sns_links ?? [],
      image_urls: ph.image_urls ?? [],
      image_url: ph.image_url ?? null,
    };

    const { error } = await supabase
      .from("pharmacists")
      .update(payload)
      .eq("id", ph.id);

    if (error) {
      console.error(error);
      setError("薬剤師プロフィールの保存に失敗しました。");
    } else {
      setSuccessMessage("薬剤師プロフィールを保存しました。");
    }

    setSavingId(null);
  };

  // =========================
  // レンダリング
  // =========================
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            薬剤師の登録・ケアロール管理
          </h1>
          <p className="text-sm text-slate-600">
            薬局側でヒトヤクに掲載する薬剤師プロフィールを登録し、
            性別・年代（生年月日から自動計算）・相談スタイル（ケアロール）・
            免許番号・各種リンクを管理できます。
          </p>
        </div>
        <a
          href="/admin"
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-[11px] hover:bg-slate-50"
        >
          管理TOPにもどる
        </a>
      </div>

      {/* エラー / 成功メッセージ */}
      {(error || successMessage) && (
        <div className="space-y-2">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {/* 登録フォーム（折りたたみ） */}
      <AppCard className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            新しい薬剤師を登録する
          </h2>
          <AppButton
            type="button"
            size="sm"
            variant="primary"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? "閉じる" : "薬剤師を登録"}
          </AppButton>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1列目：氏名・所属薬局 */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  薬剤師氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  placeholder="例）佐藤 花子"
                  value={form.name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  所属薬局（任意）
                </label>
                <select
                  name="belongs_pharmacy_id"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  value={form.belongs_pharmacy_id ?? ""}
                  onChange={handleInputChange}
                >
                  <option value="">選択なし</option>
                  {pharmacies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 一言メッセージ */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                一言メッセージ（任意）
              </label>
              <textarea
                name="one_line_message"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                rows={2}
                placeholder="例）IBS・PMSなど女性特有のお悩みを一緒に整理します。"
                value={form.one_line_message}
                onChange={handleInputChange}
              />
            </div>

            {/* 専門・言語 */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  専門領域（カンマ区切り）
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  placeholder="例）IBS, メンタル, 漢方"
                  value={specialtyInputValue}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      specialty: parseCommaSeparated(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  対応言語（カンマ区切り）
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  placeholder="例）日本語, 英語, 中国語"
                  value={languageInputValue}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      language: parseCommaSeparated(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            {/* 性別・生年月日・免許番号 */}
            <div className="grid gap-3 md:grid-cols-3">
              {/* 性別 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  性別
                </label>
                <select
                  name="gender"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  value={form.gender}
                  onChange={handleInputChange}
                >
                  <option value="">選択してください</option>
                  <option value="女性">女性</option>
                  <option value="男性">男性</option>
                  <option value="その他">その他（自由記載）</option>
                </select>
                {form.gender === "その他" && (
                  <input
                    name="gender_other"
                    type="text"
                    maxLength={40}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    placeholder="40文字以内で入力"
                    value={form.gender_other}
                    onChange={handleInputChange}
                  />
                )}
              </div>

              {/* 生年月日 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  生年月日
                </label>
                <input
                  name="birth_date"
                  type="date"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  value={form.birth_date ?? ""}
                  onChange={handleInputChange}
                />
                <p className="text-[10px] text-slate-500">
                  入力すると、年代（20代/30代 など）が自動で算出されます。
                </p>
              </div>

              {/* 免許番号 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  薬剤師免許番号（任意）
                </label>
                <input
                  name="license_number"
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  placeholder="例）第123456号"
                  value={form.license_number}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* 得意な相談スタイル */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                得意な相談スタイル（複数選択可）
              </label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CARE_STYLE_OPTIONS.map((opt) => {
                  const isActive = form.care_role.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleFormCareRole(opt.key)}
                      className={`flex flex-col border rounded-md px-3 py-2 text-[11px] ${
                        isActive
                          ? "bg-sky-50 border-sky-500 text-sky-900"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-semibold mb-1">
                        {opt.label}
                        {isActive && (
                          <span className="ml-1 text-[10px] text-sky-700">
                            選択中
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 経験年数・公開範囲 */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  薬剤師経験年数（任意）
                </label>
                <input
                  name="years_of_experience"
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  placeholder="例）8"
                  value={form.years_of_experience ?? ""}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  プロフィールの公開範囲
                </label>
                <select
                  name="visibility"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  value={form.visibility}
                  onChange={handleInputChange}
                >
                  <option value="members">登録ユーザー限定</option>
                  <option value="public">一般公開</option>
                </select>
              </div>
            </div>

            {/* 自由URL / SNS */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  自由URLリンク（任意・1行に1つ）
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  rows={2}
                  placeholder="例）https://example.com/profile"
                  value={webLinksInputValue}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      web_links: parseMultilineUrls(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  SNSリンク（任意・1行に1つ）
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  rows={2}
                  placeholder="例）https://twitter.com/..., https://www.instagram.com/..."
                  value={snsLinksInputValue}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sns_links: parseMultilineUrls(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            {/* 顔写真 */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                顔写真（任意・最大5枚）
              </label>
              <input
                id="pharmacist-image-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="text-[10px] text-slate-500">
                ※ 選択された画像のうち1枚目が、一覧や詳細ページのメイン画像として表示されます。
              </p>
            </div>

            <div className="pt-2">
              <AppButton type="submit" size="sm" disabled={submitting}>
                {submitting ? "登録中..." : "薬剤師を登録する"}
              </AppButton>
            </div>
          </form>
        )}
      </AppCard>

      {/* 登録済み一覧 */}
      <AppCard className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            登録済みの薬剤師（{pharmacists.length}名）
          </h2>
          <span className="text-[11px] text-slate-500">
            名前の右にある「編集」ボタンを押すと、詳細な編集フォームが開きます。
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">読み込み中です...</p>
        ) : pharmacists.length === 0 ? (
          <p className="text-sm text-slate-600">
            まだ薬剤師が登録されていません。
          </p>
        ) : (
          <div className="space-y-4">
            {pharmacists.map((ph) => {
              const pharmacy = pharmacies.find(
                (p) => p.id === (ph as any).belongs_pharmacy_id
              );
              const gender = (ph.gender ?? "") as string;
              const genderOther = (ph.gender_other ?? "") as string;
              const ageCategory =
                (ph.age_category as string | null) ??
                calcAgeCategory(ph.birth_date ?? null);
              const webLinksText = (ph.web_links ?? []).join("\n");
              const snsLinksText = (ph.sns_links ?? []).join("\n");
              const isOpen = openId === ph.id;

              return (
                <section
                  key={ph.id}
                  className="rounded-lg border bg-white p-4 space-y-3"
                >
                  {/* ヘッダー行 */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{ph.name}</h3>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 border border-emerald-100">
                          登録済み
                        </span>
                        {pharmacy?.name && (
                          <span className="text-[11px] text-slate-500">
                            （{pharmacy.name}）
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
                        <span>
                          公開範囲：
                          {(ph.visibility ?? "members") === "public"
                            ? "一般公開"
                            : "登録ユーザー限定"}
                        </span>
                        {ageCategory && (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 border border-slate-200">
                            年代：{ageCategory}
                          </span>
                        )}
                        {(ph.care_role ?? []).length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 border border-sky-200 text-sky-700">
                            ケアロール：
                            {(ph.care_role ?? [])
                              .map(
                                (k) =>
                                  CARE_STYLE_OPTIONS.find(
                                    (o) => o.key === (k as CareStyleKey)
                                  )?.label
                              )
                              .filter(Boolean)
                              .join(" / ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenId((curr) => (curr === ph.id ? null : ph.id))
                        }
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] hover:bg-slate-50"
                      >
                        {isOpen ? "閉じる" : "編集"}
                      </button>
                    </div>
                  </div>

                  {/* 編集フォーム */}
                  {isOpen && (
                    <div className="pt-3 border-t border-slate-200 space-y-4">
                      {/* 一言メッセージ / 経験年数 / 公開範囲 */}
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <label className="text-[11px] font-semibold">
                            一言メッセージ
                          </label>
                          <textarea
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px]"
                            rows={2}
                            value={ph.one_line_message ?? ""}
                            onChange={(e) =>
                              handleOneLineMessageChangeRow(
                                ph.id,
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="w-full md:w-52 space-y-2 text-[11px] text-slate-600">
                          <div>
                            経験年数：
                            <input
                              type="number"
                              min={0}
                              className="w-16 rounded-md border border-slate-300 px-1 py-0.5 text-[11px] text-right"
                              value={ph.years_of_experience ?? ""}
                              onChange={(e) =>
                                handleYearsChangeRow(ph.id, e.target.value)
                              }
                            />{" "}
                            年
                          </div>
                          <div>
                            公開範囲：
                            <select
                              className="ml-1 rounded-md border border-slate-300 px-1 py-0.5 text-[11px]"
                              value={ph.visibility ?? "members"}
                              onChange={(e) =>
                                handleVisibilityChangeRow(
                                  ph.id,
                                  e.target.value
                                )
                              }
                            >
                              <option value="members">
                                登録ユーザー限定
                              </option>
                              <option value="public">一般公開</option>
                            </select>
                          </div>
                          <div>年代表示：{ageCategory ?? "（未設定）"}</div>
                        </div>
                      </div>

                      {/* 性別 / 生年月日 / 免許番号 */}
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <p className="text-[11px] font-semibold mb-1">
                            性別
                          </p>
                          <select
                            value={gender}
                            onChange={(e) =>
                              handleGenderChangeRow(ph.id, e.target.value)
                            }
                            className="w-full border rounded-md px-2 py-1 text-sm"
                          >
                            <option value="">選択してください</option>
                            <option value="女性">女性</option>
                            <option value="男性">男性</option>
                            <option value="その他">その他（自由記載）</option>
                          </select>

                          {gender === "その他" && (
                            <input
                              type="text"
                              value={genderOther}
                              onChange={(e) =>
                                handleGenderOtherChangeRow(
                                  ph.id,
                                  e.target.value
                                )
                              }
                              maxLength={40}
                              className="mt-1 w-full border rounded-md px-2 py-1 text-sm"
                              placeholder="40文字以内で入力"
                            />
                          )}
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold mb-1">
                            生年月日
                          </p>
                          <input
                            type="date"
                            className="w-full border rounded-md px-2 py-1 text-sm"
                            value={ph.birth_date ?? ""}
                            onChange={(e) =>
                              handleBirthDateChangeRow(
                                ph.id,
                                e.target.value
                              )
                            }
                          />
                          <p className="mt-1 text-[10px] text-slate-500">
                            年代（20代/30代など）は自動で再計算されます。
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold mb-1">
                            薬剤師免許番号
                          </p>
                          <input
                            type="text"
                            className="w-full border rounded-md px-2 py-1 text-sm"
                            value={ph.license_number ?? ""}
                            onChange={(e) =>
                              handleLicenseNumberChangeRow(
                                ph.id,
                                e.target.value
                              )
                            }
                            placeholder="例）第123456号"
                          />
                        </div>
                      </div>

                      {/* ケアロール */}
                      <div>
                        <p className="text-[11px] font-semibold mb-1">
                          得意な相談スタイル（ケアロール）
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {CARE_STYLE_OPTIONS.map((opt) => {
                            const isActive = (
                              (ph.care_role ?? []) as string[]
                            ).includes(opt.key);
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => toggleRoleRow(ph.id, opt.key)}
                                className={`flex flex-col border rounded-md px-3 py-2 text-[11px] ${
                                  isActive
                                    ? "bg-sky-50 border-sky-500 text-sky-900"
                                    : "bg-white border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <span className="font-semibold mb-1">
                                  {opt.label}
                                  {isActive && (
                                    <span className="ml-1 text-[10px] text-sky-700">
                                      選択中
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-600">
                                  {opt.description}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 自由URL / SNS */}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold mb-1">
                            自由URLリンク（1行に1つ）
                          </p>
                          <textarea
                            className="w-full border rounded-md px-2 py-1 text-[11px]"
                            rows={2}
                            value={webLinksText}
                            onChange={(e) =>
                              handleWebLinksChangeRow(
                                ph.id,
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold mb-1">
                            SNSリンク（1行に1つ）
                          </p>
                          <textarea
                            className="w-full border rounded-md px-2 py-1 text-[11px]"
                            rows={2}
                            value={snsLinksText}
                            onChange={(e) =>
                              handleSNSLinksChangeRow(
                                ph.id,
                                e.target.value
                              )
                            }
                          />
                        </div>
                      </div>

                      {/* 顔写真（参照表示） */}
                      {ph.image_urls && ph.image_urls.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold mb-1">
                            登録済みの顔写真（参照）
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ph.image_urls.map((url) => (
                              <div
                                key={url}
                                className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-slate-50"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt="pharmacist"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-500">
                            ※ 画像の再アップロード・削除機能は今後拡張予定です。
                          </p>
                        </div>
                      )}

                      {/* 保存行 */}
                      <div className="flex justify-between items-center">
                        <div className="text-[11px] text-slate-500 space-y-0.5">
                          <div>
                            性別：{" "}
                            {gender === ""
                              ? "（未設定）"
                              : gender === "その他" && genderOther
                              ? `その他（${genderOther}）`
                              : gender}
                          </div>
                          <div>
                            年代：
                            {ageCategory ?? "（生年月日未設定）"}
                          </div>
                          <div>
                            ケアロール：
                            {(ph.care_role ?? []).length === 0
                              ? "（なし）"
                              : (ph.care_role ?? [])
                                  .map(
                                    (k) =>
                                      CARE_STYLE_OPTIONS.find(
                                        (o) =>
                                          o.key === (k as CareStyleKey)
                                      )?.label
                                  )
                                  .filter(Boolean)
                                  .join(" / ")}
                          </div>
                        </div>

                        <AppButton
                          size="sm"
                          type="button"
                          onClick={() => savePharmacist(ph)}
                          disabled={savingId === ph.id}
                        >
                          {savingId === ph.id ? "保存中..." : "この内容で保存"}
                        </AppButton>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </AppCard>
    </div>
  );
}
