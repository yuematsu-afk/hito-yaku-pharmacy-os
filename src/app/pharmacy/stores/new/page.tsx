// src/app/pharmacy/stores/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { getPharmacyCompanyIdForUser } from "@/lib/pharmacy-company";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "submitting" | "loaded" | "error";

export default function StoreNewPage() {
  const router = useRouter();
  const { user, isPharmacyCompany } = useUser();

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pharmacyCompanyId, setPharmacyCompanyId] = useState<string | null>(
    null
  );

  // フォームの状態
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [isHeadquarter, setIsHeadquarter] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (!isPharmacyCompany) {
      setError("薬局法人アカウントのみ新規店舗を登録できます。");
      setStatus("error");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setError(null);

      const pharmacyId = await getPharmacyCompanyIdForUser(supabase, user.id);

      if (!pharmacyId) {
        setError(
          "このユーザーに紐づく薬局法人IDが設定されていません。先に薬局情報を設定してください。"
        );
        setStatus("error");
        return;
      }

      setPharmacyCompanyId(pharmacyId);
      setStatus("loaded");
    };

    run();
  }, [user, isPharmacyCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacyCompanyId) return;

    if (!name.trim()) {
      setError("店舗名は必須です。");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from("stores")
        .insert({
          pharmacy_id: pharmacyCompanyId,
          name: name.trim(),
          phone: phone.trim() || null,
          postal_code: postalCode.trim() || null,
          prefecture: prefecture.trim() || null,
          city: city.trim() || null,
          address_line1: address1.trim() || null,
          address_line2: address2.trim() || null,
          is_headquarter: isHeadquarter,
        })
        .select("id")
        .maybeSingle();

      if (insertError) {
        console.error("[store new] insert error", insertError);
        setError(
          "店舗の登録に失敗しました。入力内容を確認のうえ、時間をおいて再度お試しください。"
        );
        setStatus("loaded");
        return;
      }

      if (!data?.id) {
        setError("店舗の登録は完了しましたが、詳細画面に遷移できませんでした。");
        setStatus("loaded");
        return;
      }

      router.push(`/pharmacy/stores/${data.id}`);
    } catch (e) {
      console.error("[store new] unexpected error", e);
      setError(
        "予期せぬエラーが発生しました。時間をおいて再度お試しください。"
      );
      setStatus("loaded");
    }
  };

  const disabled =
    status === "loading" || status === "submitting" || !pharmacyCompanyId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4 mb-1">
        <AppButton
          variant="outline"
          size="sm"
          className="px-2 text-xs"
          onClick={() => router.push("/pharmacy/stores")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          店舗一覧に戻る
        </AppButton>
      </div>

      <AppCard className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-500" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">新規店舗登録</h1>
            <p className="mt-1 text-xs text-slate-600">
              ログイン中の薬局法人に紐づく新しい店舗を登録します。
            </p>
          </div>
        </div>

        {status === "loading" && (
          <div className="py-6 flex flex-col items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            <span>薬局法人情報を読み込み中です…</span>
          </div>
        )}

        {status === "error" && error && (
          <div className="py-3 text-xs text-red-700 whitespace-pre-line bg-red-50/60 border border-red-100 rounded-md px-3">
            {error}
          </div>
        )}

        {status !== "loading" && (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  店舗名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="〇〇薬局 △△店"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is_headquarter"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={isHeadquarter}
                  onChange={(e) => setIsHeadquarter(e.target.checked)}
                />
                <label
                  htmlFor="is_headquarter"
                  className="text-xs text-slate-700"
                >
                  この店舗を「本部」として扱う
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  電話番号
                </label>
                <input
                  type="tel"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="075-xxx-xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    郵便番号
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="6000000"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    都道府県
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="京都府"
                    value={prefecture}
                    onChange={(e) => setPrefecture(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    市区町村
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="京都市〇〇区"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  以降の住所
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="〇〇町1-2-3 △△ビル 3F"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  建物名・部屋番号など（任意）
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="ビル名・マンション名など"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                />
              </div>
            </div>

            {error && status !== "error" && (
              <p className="text-xs text-red-600 whitespace-pre-line">{error}</p>
            )}

            <div className="flex justify-end">
              <AppButton type="submit" disabled={disabled}>
                {status === "submitting" ? "登録中..." : "この内容で登録する"}
              </AppButton>
            </div>
          </form>
        )}
      </AppCard>
    </div>
  );
}
