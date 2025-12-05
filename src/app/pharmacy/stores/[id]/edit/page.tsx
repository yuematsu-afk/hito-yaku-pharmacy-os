// src/app/pharmacy/stores/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { getPharmacyCompanyIdForUser } from "@/lib/pharmacy-company";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { ArrowLeft, Building2, Loader2, AlertTriangle } from "lucide-react";

type Status = "idle" | "loading" | "submitting" | "loaded" | "error" | "not_found";

type StoreRow = {
  id: string;
  pharmacy_id: string;
  name: string;
  phone?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  is_headquarter?: boolean | null;
};

export default function StoreEditPage() {
  const params = useParams<{ id: string }>();
  const storeId = params?.id;
  const router = useRouter();
  const { user, isPharmacyCompany } = useUser();

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pharmacyCompanyId, setPharmacyCompanyId] = useState<string | null>(
    null
  );

  // フォーム状態
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [isHeadquarter, setIsHeadquarter] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setStatus("not_found");
      return;
    }
    if (!user) return;

    if (!isPharmacyCompany) {
      setError("薬局法人アカウントのみ店舗情報を編集できます。");
      setStatus("error");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setError(null);

      // ① 薬局法人IDを取得
      const pharmacyId = await getPharmacyCompanyIdForUser(supabase, user.id);

      if (!pharmacyId) {
        setError(
          "このユーザーに紐づく薬局法人IDが設定されていません。先に薬局情報を設定してください。"
        );
        setStatus("error");
        return;
      }

      setPharmacyCompanyId(pharmacyId);

      // ② 自社店舗かどうか確認しつつ、既存データを取得
      const { data, error: fetchError } = await supabase
        .from("stores")
        .select(
          `
          id,
          pharmacy_id,
          name,
          phone,
          postal_code,
          prefecture,
          city,
          address_line1,
          address_line2,
          is_headquarter
        `
        )
        .eq("id", storeId)
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle();

      if (fetchError) {
        console.error("[store edit] fetch error", fetchError);
        setError(
          "店舗情報の取得に失敗しました。時間をおいて再度お試しください。"
        );
        setStatus("error");
        return;
      }

      if (!data) {
        setStatus("not_found");
        return;
      }

      const s = data as StoreRow;
      setName(s.name ?? "");
      setPhone(s.phone ?? "");
      setPostalCode(s.postal_code ?? "");
      setPrefecture(s.prefecture ?? "");
      setCity(s.city ?? "");
      setAddress1(s.address_line1 ?? "");
      setAddress2(s.address_line2 ?? "");
      setIsHeadquarter(!!s.is_headquarter);

      setStatus("loaded");
    };

    run();
  }, [storeId, user, isPharmacyCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !pharmacyCompanyId) return;

    if (!name.trim()) {
      setError("店舗名は必須です。");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("stores")
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          postal_code: postalCode.trim() || null,
          prefecture: prefecture.trim() || null,
          city: city.trim() || null,
          address_line1: address1.trim() || null,
          address_line2: address2.trim() || null,
          is_headquarter: isHeadquarter,
        })
        .eq("id", storeId)
        .eq("pharmacy_id", pharmacyCompanyId);

      if (updateError) {
        console.error("[store edit] update error", updateError);
        setError(
          "店舗情報の更新に失敗しました。入力内容を確認のうえ、時間をおいて再度お試しください。"
        );
        setStatus("loaded");
        return;
      }

      router.push(`/pharmacy/stores/${storeId}`);
    } catch (e) {
      console.error("[store edit] unexpected error", e);
      setError(
        "予期せぬエラーが発生しました。時間をおいて再度お試しください。"
      );
      setStatus("loaded");
    }
  };

  const disabled =
    status === "loading" || status === "submitting" || !pharmacyCompanyId;

  const Header = (
    <div className="flex items-center justify-between gap-4 mb-1">
      <AppButton
        variant="outline"
        size="sm"
        className="px-2 text-xs"
        onClick={() =>
          storeId
            ? router.push(`/pharmacy/stores/${storeId}`)
            : router.push("/pharmacy/stores")
        }
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        店舗詳細に戻る
      </AppButton>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      {Header}

      <AppCard className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-500" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">店舗情報の編集</h1>
            <p className="mt-1 text-xs text-slate-600">
              既存の店舗情報を更新します。
            </p>
          </div>
        </div>

        {status === "loading" && (
          <div className="py-6 flex flex-col items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            <span>店舗情報を読み込み中です…</span>
          </div>
        )}

        {status === "error" && error && (
          <div className="py-3 text-xs text-red-700 whitespace-pre-line bg-red-50/60 border border-red-100 rounded-md px-3">
            {error}
          </div>
        )}

        {status === "not_found" && (
          <div className="py-6 flex flex-col gap-2 text-sm text-slate-700">
            <div className="flex items-center gap-2 text-slate-800">
              <AlertTriangle className="h-4 w-4 text-slate-500" />
              <span className="font-semibold">
                店舗情報が見つかりませんでした
              </span>
            </div>
            <p className="text-xs text-slate-600">
              URL が誤っているか、この店舗はあなたの薬局法人には属していない可能性があります。
            </p>
          </div>
        )}

        {status !== "loading" && status !== "not_found" && (
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
                {status === "submitting" ? "更新中..." : "この内容で更新する"}
              </AppButton>
            </div>
          </form>
        )}
      </AppCard>
    </div>
  );
}
