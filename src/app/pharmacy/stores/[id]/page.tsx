// src/app/pharmacy/stores/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { getPharmacyCompanyIdForUser } from "@/lib/pharmacy-company";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import type { Pharmacist } from "@/types/supabase";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Building2,
  Loader2,
  AlertTriangle,
  Hospital,
  Plus,
} from "lucide-react";

type LoadStatus = "idle" | "loading" | "loaded" | "error" | "not_found";

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

// 店舗詳細ページで使う薬剤師型（必要なカラムだけ拡張）
type StorePharmacist = Pharmacist & {
  visibility?: "public" | "members" | null;
  short_message?: string | null;
  language?: string[] | null;
};

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isPharmacyCompany } = useUser();

  const [status, setStatus] = useState<LoadStatus>("idle");
  const [store, setStore] = useState<StoreRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pharmacists, setPharmacists] = useState<StorePharmacist[]>([]);
  const [pharmacistsLoading, setPharmacistsLoading] =
    useState<boolean>(true);
  const [pharmacistsError, setPharmacistsError] = useState<string | null>(
    null
  );

  const storeId = params?.id;

  // 店舗情報の取得
  useEffect(() => {
    if (!storeId) {
      setStatus("not_found");
      return;
    }
    if (!user) return;

    if (!isPharmacyCompany) {
      setError("薬局法人アカウントのみ店舗詳細を閲覧できます。");
      setStatus("error");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setError(null);

      // ① このユーザーに紐づく薬局法人IDを取得
      const pharmacyId = await getPharmacyCompanyIdForUser(
        supabase,
        user.id
      );

      if (!pharmacyId) {
        setError(
          "このユーザーに紐づく薬局法人IDが設定されていません。先に薬局情報を設定してください。"
        );
        setStatus("error");
        return;
      }

      // ② 自社の店舗かどうかを確認しつつ 1件取得
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
        console.error("[store detail] fetch error", fetchError);
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

      setStore(data as StoreRow);
      setStatus("loaded");
    };

    void run();
  }, [storeId, user, isPharmacyCompany]);

  // この店舗に所属する薬剤師一覧を取得
  useEffect(() => {
    if (!store?.id) return;

    const run = async () => {
      setPharmacistsLoading(true);
      setPharmacistsError(null);

      try {
        const { data, error } = await supabase
          .from("pharmacists")
          .select("*")
          // ✅ 新設計：店舗に紐づく薬剤師は belongs_store_id で絞る
          .eq("belongs_store_id", store.id)
          .order("name", { ascending: true })
          .returns<StorePharmacist[]>();

        if (error) {
          console.error(
            "[/pharmacy/stores/[id]] pharmacists fetch error",
            error
          );
          setPharmacistsError(
            "この店舗に所属する薬剤師情報の取得に失敗しました。"
          );
          setPharmacists([]);
          return;
        }

        setPharmacists(data ?? []);
      } catch (e: any) {
        console.error(
          "[/pharmacy/stores/[id]] pharmacists fetch unexpected error",
          e
        );
        setPharmacistsError(
          e?.message ??
            "この店舗に所属する薬剤師情報の取得中に予期せぬエラーが発生しました。"
        );
        setPharmacists([]);
      } finally {
        setPharmacistsLoading(false);
      }
    };

    void run();
  }, [store?.id]);

  const renderAddress = () => {
    if (!store) return "";

    const parts = [
      store.postal_code ? `〒${store.postal_code}` : null,
      store.prefecture ?? null,
      store.city ?? null,
      store.address_line1 ?? null,
      store.address_line2 ?? null,
    ].filter(Boolean);

    if (parts.length === 0) return "住所未設定";

    return parts.join(" ");
  };

  // 共通ヘッダー部分
  const Header = (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <AppButton
          variant="outline"
          size="sm"
          className="px-2 text-xs"
          onClick={() => router.push("/pharmacy/stores")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          店舗一覧に戻る
        </AppButton>
      </div>

      {store && (
        <div className="flex items-center gap-2">
          <Link href={`/pharmacy/stores/${store.id}/edit`}>
            <AppButton className="h-8 px-3 text-xs">
              店舗情報を編集
            </AppButton>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {Header}

      {status === "loading" && (
        <AppCard className="flex flex-col items-center justify-center gap-2 py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          <p className="text-sm text-slate-600">
            店舗情報を読み込み中です…
          </p>
        </AppCard>
      )}

      {status === "error" && (
        <AppCard className="flex flex-col gap-2 border-red-200 bg-red-50/40 py-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-semibold">
              エラーが発生しました
            </span>
          </div>
          {error && (
            <p className="whitespace-pre-line text-xs text-red-700">
              {error}
            </p>
          )}
        </AppCard>
      )}

      {status === "not_found" && (
        <AppCard className="space-y-2 py-6">
          <div className="flex items-center gap-2 text-slate-800">
            <AlertTriangle className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold">
              店舗情報が見つかりませんでした
            </span>
          </div>
          <p className="text-xs text-slate-600">
            URL が誤っているか、この店舗はあなたの薬局法人には属していない可能性があります。
          </p>
        </AppCard>
      )}

      {status === "loaded" && store && (
        <div className="space-y-4">
          {/* 店舗の基本情報 */}
          <AppCard className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  <h1 className="text-lg font-bold text-slate-900">
                    {store.name}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {store.is_headquarter && (
                    <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-[1px] text-[10px] font-medium text-emerald-700">
                      本部
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full border border-slate-100 bg-slate-50 px-2 py-[1px] text-[10px] font-medium text-slate-600">
                    店舗ID: {store.id}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-3 text-sm text-slate-800">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  住所
                </span>
                <div className="inline-flex items-start gap-2 text-[13px] text-slate-800">
                  <MapPin className="mt-[2px] h-4 w-4 text-slate-500" />
                  <span>{renderAddress()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  電話番号
                </span>
                <div className="inline-flex items-center gap-2 text-[13px] text-slate-800">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span>{store.phone || "未設定"}</span>
                </div>
              </div>
            </div>
          </AppCard>

          {/* この店舗に所属する薬剤師一覧 */}
          <AppCard className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Hospital className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    この店舗に所属する薬剤師
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    新規登録した薬剤師で、所属店舗に「{store.name}」を選んだスタッフが表示されます。
                  </p>
                </div>
              </div>

              {/* ✅ storeId をクエリで渡して、新規登録画面で店舗をプリセット */}
              <AppButton
                size="sm"
                onClick={() =>
                  router.push(
                    `/pharmacy/pharmacists/new?storeId=${store.id}`
                  )
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                薬剤師を追加
              </AppButton>
            </div>

            {pharmacistsLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>所属薬剤師を読み込んでいます...</span>
              </div>
            ) : pharmacistsError ? (
              <div className="flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span>{pharmacistsError}</span>
              </div>
            ) : pharmacists.length === 0 ? (
              <p className="text-xs text-slate-500">
                この店舗に所属している薬剤師はまだ登録されていません。
                「薬剤師を追加」から新規登録してください。
              </p>
            ) : (
              <table className="min-w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">
                      薬剤師
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      公開範囲
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacists.map((ph) => {
                    const vis =
                      (ph.visibility as "public" | "members" | null) ??
                      "members";
                    return (
                      <tr
                        key={ph.id}
                        className="border-b border-slate-100 hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-900">
                            {ph.name ?? "（名称未設定）"}
                          </div>
                          {ph.short_message && (
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                              {ph.short_message}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={[
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] border",
                              vis === "public"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : "border-slate-300 bg-slate-50 text-slate-700",
                            ].join(" ")}
                          >
                            {vis === "public"
                              ? "一般公開"
                              : "登録ユーザー限定"}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <div className="flex justify-end gap-2">
                            <AppButton
                              variant="outline"
                              size="sm"
                              className="text-[11px]"
                              onClick={() =>
                                router.push(
                                  `/pharmacy/pharmacists/${ph.id}`
                                )
                              }
                            >
                              プロフィール編集
                            </AppButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </AppCard>
        </div>
      )}
    </div>
  );
}
