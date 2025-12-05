// src/app/pharmacy/stores/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { getPharmacyCompanyIdForUser } from "@/lib/pharmacy-company";
import { MapPin, Phone, Building2, PlusCircle } from "lucide-react";

type LoadStatus = "idle" | "loading" | "loaded" | "error";

/**
 * stores テーブルから取得する行の型（必要なカラムだけ定義）
 * 実際のテーブル構造に合わせて拡張してもOK
 */
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

export default function PharmacyStoresPage() {
  const { user, isPharmacyCompany } = useUser();
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pharmacyCompanyId, setPharmacyCompanyId] = useState<string | null>(
    null
  );
  const [needsPharmacySetup, setNeedsPharmacySetup] = useState(false);

  useEffect(() => {
    // /pharmacy 配下は middleware で守られている前提だが、
    // 念のためクライアント側でも軽くガードしておく
    if (!user) return;

    // patient ロールでここに来てしまった場合はメッセージ表示用フラグを立てる
    if (!isPharmacyCompany) {
      setError("薬局法人アカウントのみアクセスできます。");
      setStatus("error");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setError(null);

      // ① このユーザーに紐づく薬局法人IDを取得
      const pharmacyId = await getPharmacyCompanyIdForUser(supabase, user.id);

      if (!pharmacyId) {
        // まだ profile_users.related_pharmacy_id がセットされていない状態
        setNeedsPharmacySetup(true);
        setStatus("loaded");
        return;
      }

      setPharmacyCompanyId(pharmacyId);

      // ② stores 一覧を取得
      const { data, error: storesError } = await supabase
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
          is_headquarter,
          created_at
        `
        )
        .eq("pharmacy_id", pharmacyId)
        .order("is_headquarter", { ascending: false })
        .order("created_at", { ascending: true });

        if (storesError) {
        // 開発中は error を warn にしてオーバーレイのノイズを減らす & 中身を見やすくする
        console.warn("[/pharmacy/stores] stores fetch error", storesError);

        const msg =
            // Supabase のエラーオブジェクトに message があれば優先
            (storesError as any)?.message ??
            // それが無ければ JSON 文字列化
            JSON.stringify(storesError) ??
            "店舗情報の取得に失敗しました。時間をおいて再度お試しください。";

        setError(msg);
        setStatus("error");
        return;
        }

      setStores((data as StoreRow[]) ?? []);
      setStatus("loaded");
    };

    run();
  }, [user, isPharmacyCompany]);

  const renderAddress = (store: StoreRow) => {
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            店舗一覧
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            ログイン中の薬局法人に紐づく店舗の一覧です。
          </p>
          {pharmacyCompanyId && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              薬局法人ID: <span className="font-mono">{pharmacyCompanyId}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/pharmacy/stores/new">
            <AppButton className="flex items-center gap-1">
              <PlusCircle className="h-4 w-4" />
              新規店舗登録
            </AppButton>
          </Link>
        </div>
      </div>

      {/* ロード中 */}
      {status === "loading" && (
        <AppCard className="py-8 text-center text-sm text-slate-500">
          店舗情報を読み込み中です…
        </AppCard>
      )}

      {/* エラー */}
      {status === "error" && error && (
        <AppCard className="border-red-200 bg-red-50/40">
          <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
        </AppCard>
      )}

      {/* 法人未設定（profile_users.related_pharmacy_id が null） */}
      {status === "loaded" && needsPharmacySetup && (
        <AppCard className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            薬局法人情報がまだ設定されていません
          </h2>
          <p className="text-xs text-slate-600 whitespace-pre-line">
            ログイン中のユーザーに紐づく薬局法人IDが設定されていません。
            {"\n"}
            まずは薬局情報（法人情報）を登録し、このユーザーをその法人に紐づけてください。
          </p>
          {/* TODO: 法人情報登録ページができたらリンクを差し替える */}
          <p className="text-xs text-slate-500">
            ※ 将来的に「薬局情報の設定」ページ（例: /pharmacy/settings）へのリンクをここに配置予定です。
          </p>
        </AppCard>
      )}

      {/* 一覧表示 */}
      {status === "loaded" && !needsPharmacySetup && (
        <>
          {stores.length === 0 ? (
            <AppCard className="py-8 text-center text-sm text-slate-500">
              まだ店舗が登録されていません。
              <br />
              右上の「新規店舗登録」ボタンから、最初の店舗を登録してください。
            </AppCard>
          ) : (
            <div className="space-y-3">
              {stores.map((store) => (
                <AppCard
                  key={store.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-900">
                        {store.name}
                      </h2>
                      {store.is_headquarter && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-[1px] text-[10px] font-medium text-emerald-700 border border-emerald-100">
                          本部
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {renderAddress(store)}
                      </span>
                      {store.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {store.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Link href={`/pharmacy/stores/${store.id}`}>
                      <AppButton
                        variant="outline"
                        className="h-8 px-3 text-xs border-slate-200"
                      >
                        詳細を見る
                      </AppButton>
                    </Link>
                    <Link href={`/pharmacy/stores/${store.id}/edit`}>
                      <AppButton className="h-8 px-3 text-xs">
                        編集
                      </AppButton>
                    </Link>
                  </div>
                </AppCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
