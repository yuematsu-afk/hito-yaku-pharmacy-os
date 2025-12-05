// src/app/pharmacy/pharmacists/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import type { Pharmacist } from "@/types/supabase";
import { getPharmacyCompanyIdForUser } from "@/lib/pharmacy-company";
import {
  Loader2,
  Users,
  AlertCircle,
  Hospital,
  Eye,
  Edit2,
  Plus,
} from "lucide-react";

type ExtendedPharmacist = Pharmacist & {
  visibility?: "public" | "members" | null;
  language?: string[] | null;
  specialty?: string[] | null;
  care_role?: string[] | null;
  years_of_experience?: number | null;
  belongs_store_id?: string | null;
  belongs_pharmacy_id?: string | null;
};

// stores テーブル用の簡易型
type Store = {
  id: string;
  pharmacy_id: string | null;
  name: string | null;
  area: string | null;
};

interface PharmacistWithStore {
  pharmacist: ExtendedPharmacist;
  store: Store | null;
}

// 言語コード → 表示ラベル
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

export default function PharmacyPharmacistsPage() {
  const router = useRouter();
  const {
    loading: authLoading,
    isAuthenticated,
    role,
    user,
    isPharmacyCompany,
    isAdmin,
  } = useUser();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PharmacistWithStore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsPharmacySetup, setNeedsPharmacySetup] = useState(false);

  // フィルタ
  const [keyword, setKeyword] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] =
    useState<"all" | "public" | "members">("all");

  // 認証 & role ガード
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/login");
        return;
      }
      if (role !== "pharmacy_company" && role !== "admin") {
        router.push("/mypage");
      }
    }
  }, [authLoading, isAuthenticated, role, router]);

  // データ取得
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      if (!isPharmacyCompany && !isAdmin) return;

      setLoading(true);
      setError(null);
      setNeedsPharmacySetup(false);

      try {
        // ① 法人ユーザーなら自分の pharmacy_company_id を取得
        let pharmacyId: string | null = null;

        if (isPharmacyCompany) {
          pharmacyId = await getPharmacyCompanyIdForUser(supabase, user.id);

          if (!pharmacyId) {
            setNeedsPharmacySetup(true);
            setItems([]);
            setLoading(false);
            return;
          }
        }

        // ② stores 一覧（法人→自社のみ / admin→全て）
        let storesQuery = supabase
          .from("stores")
          .select("*")
          .order("name", { ascending: true });

        if (pharmacyId && !isAdmin) {
          storesQuery = storesQuery.eq("pharmacy_id", pharmacyId);
        }

        const { data: storesData, error: storesError } =
          await storesQuery.returns<Store[]>();

        if (storesError) throw storesError;

        const storeMap = new Map<string, Store>();
        (storesData ?? []).forEach((s) => {
          if (s.id) storeMap.set(s.id, s);
        });

        const storeIds = (storesData ?? []).map((s) => s.id);

        // ③ 薬剤師一覧
        let pharmacistsQuery = supabase
          .from("pharmacists")
          .select("*")
          .order("name", { ascending: true });

        if (pharmacyId && !isAdmin) {
          if (storeIds.length > 0) {
            // ✅ 法人に紐づく「店舗ID」に所属している薬剤師だけ取得
            pharmacistsQuery = pharmacistsQuery.in(
              "belongs_store_id",
              storeIds
            );
          } else {
            // 店舗がまだ無い古いデータ向けフォールバック
            pharmacistsQuery = pharmacistsQuery.eq(
              "belongs_pharmacy_id",
              pharmacyId
            );
          }
        }

        const { data: pharmacistsData, error: phError } =
          await pharmacistsQuery.returns<ExtendedPharmacist[]>();

        if (phError) throw phError;

        // ④ join: pharmacists → stores
        const merged: PharmacistWithStore[] = (pharmacistsData ?? []).map(
          (ph) => {
            const joinStoreId =
              ph.belongs_store_id ?? ph.belongs_pharmacy_id ?? null;

            const store =
              joinStoreId && storeMap.has(joinStoreId)
                ? storeMap.get(joinStoreId)!
                : null;

            return {
              pharmacist: ph,
              store,
            };
          }
        );

        setItems(merged);
      } catch (e: any) {
        console.error("[pharmacy/pharmacists] fetch error", e);
        setError(e.message ?? "薬剤師一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [user, isPharmacyCompany, isAdmin]);

  // 店舗フィルタ用の選択肢
  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(({ store }) => {
      if (store?.id) {
        map.set(store.id, store.name ?? "名称未設定");
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // フィルタ適用後の一覧
  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    return items.filter(({ pharmacist, store }) => {
      if (kw) {
        const langs = (pharmacist.language ?? []).join(" ");
        const specs = (pharmacist.specialty ?? []).join(" ");
        const textBucket = [
          pharmacist.name ?? "",
          store?.name ?? "",
          langs,
          specs,
        ]
          .join(" ")
          .toLowerCase();

        if (!textBucket.includes(kw)) return false;
      }

      if (storeFilter !== "all") {
        if (!store || store.id !== storeFilter) return false;
      }

      const vis = pharmacist.visibility ?? "members";
      if (visibilityFilter !== "all" && vis !== visibilityFilter) {
        return false;
      }

      return true;
    });
  }, [items, keyword, storeFilter, visibilityFilter]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <AppCard className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>薬剤師一覧を準備しています...</span>
        </AppCard>
      </div>
    );
  }

  if (!isAuthenticated || (role !== "pharmacy_company" && role !== "admin")) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              薬剤師一覧（法人用）
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              店舗に所属する薬剤師のプロフィール・所属・公開設定を管理します。
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <AppButton
            size="sm"
            onClick={() => router.push("/pharmacy/pharmacists/new")}
          >
            <Plus className="mr-1 h-4 w-4" />
            薬剤師を追加
          </AppButton>
        </div>
      </div>

      {/* フィルタバー */}
      <AppCard className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              キーワード
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="薬剤師名 / 店舗名 / 専門領域 など"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              店舗
            </label>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">すべて</option>
              {storeOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              公開範囲
            </label>
            <select
              value={visibilityFilter}
              onChange={(e) =>
                setVisibilityFilter(
                  e.target.value as "all" | "public" | "members"
                )
              }
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">すべて</option>
              <option value="public">一般公開</option>
              <option value="members">登録ユーザー限定</option>
            </select>
          </div>
        </div>
      </AppCard>

      {/* 本体 */}
      {loading ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
          読み込み中です…
        </AppCard>
      ) : error ? (
        <AppCard className="space-y-2 border-red-200 bg-red-50/70">
          <div className="flex items-center gap-2 text-sm font-medium text-red-800">
            <AlertCircle className="h-4 w-4" />
            データ取得時にエラーが発生しました
          </div>
          <div className="text-xs text-red-700">{error}</div>
        </AppCard>
      ) : needsPharmacySetup ? (
        <AppCard className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">
            薬局法人情報がまだ設定されていません
          </h2>
          <p className="text-xs text-slate-600 whitespace-pre-line">
            ログイン中のユーザーに紐づく薬局法人IDが設定されていません。
            {"\n"}
            まずは薬局情報（法人情報）を登録し、このユーザーをその法人に紐づけてください。
          </p>
          <p className="text-[11px] text-slate-500">
            ※ 将来的に「薬局情報の設定」ページ（例: /pharmacy/settings）へのリンクをここに配置予定です。
          </p>
        </AppCard>
      ) : filteredItems.length === 0 ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          条件に一致する薬剤師がいません。
          フィルタ条件を変更するか、新たに薬剤師を追加してください。
        </AppCard>
      ) : (
        <AppCard className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">薬剤師</th>
                <th className="px-3 py-2 text-left font-medium">所属店舗</th>
                <th className="px-3 py-2 text-left font-medium">言語</th>
                <th className="px-3 py-2 text-left font-medium">専門領域</th>
                <th className="px-3 py-2 text-left font-medium">経験年数</th>
                <th className="px-3 py-2 text-left font-medium">公開範囲</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(({ pharmacist, store }) => {
                const languages = (pharmacist.language ?? []) as string[];
                const specialties = (pharmacist.specialty ?? []) as string[];
                const years = pharmacist.years_of_experience ?? null;
                const vis = pharmacist.visibility ?? "members";

                return (
                  <tr
                    key={pharmacist.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-slate-900">
                        {pharmacist.name ?? "（名称未設定）"}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1 text-slate-700">
                        <Hospital className="h-3 w-3 text-slate-400" />
                        <span>{store?.name ?? "未割り当て"}</span>
                      </div>
                      {store?.area && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {store.area}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {languages.length === 0 ? (
                          <span className="text-[11px] text-slate-400">
                            未設定
                          </span>
                        ) : (
                          languages.map((l) => (
                            <span
                              key={l}
                              className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 border border-emerald-100"
                            >
                              {formatLanguageLabel(l)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {specialties.length === 0 ? (
                          <span className="text-[11px] text-slate-400">
                            未設定
                          </span>
                        ) : (
                          specialties.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-100"
                            >
                              {s}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">
                      {years != null ? `${years} 年` : "未設定"}
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
                        {vis === "public" ? "一般公開" : "登録ユーザー限定"}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/pharmacists/${pharmacist.id}`}
                          target="_blank"
                        >
                          <AppButton
                            variant="outline"
                            size="sm"
                            className="text-[11px]"
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            公開プロフィール
                          </AppButton>
                        </Link>
                        <Link href={`/pharmacy/pharmacists/${pharmacist.id}`}>
                          <AppButton
                            variant="outline"
                            size="sm"
                            className="text-[11px]"
                          >
                            <Edit2 className="mr-1 h-3 w-3" />
                            編集
                          </AppButton>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AppCard>
      )}
    </div>
  );
}
