// src/app/admin/pharmacies/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import type { Pharmacy } from "@/types/supabase";

function formatArea(area: string | null | undefined) {
  if (!area) return "エリア未設定";
  return area;
}

export default function PharmacyListPage() {
  const [loading, setLoading] = useState(true);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: pharmacyError } = await supabase
          .from("pharmacies")
          .select("*")
          .order("name", { ascending: true });

        if (pharmacyError) throw pharmacyError;
        setPharmacies((data ?? []) as Pharmacy[]);
      } catch (err: any) {
        console.error("Failed to fetch pharmacies", err);
        setError(err.message ?? "薬局データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            薬局プロフィール一覧
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pharmacy OS に登録されている薬局の基本情報・サービス内容を管理します。
          </p>
        </div>
      </div>

      {/* 状態表示 */}
      {loading ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          読み込み中です…
        </AppCard>
      ) : error ? (
        <AppCard className="py-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </AppCard>
      ) : pharmacies.length === 0 ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          登録されている薬局がありません。
          Supabase の <code>pharmacies</code> テーブルにデータを追加してください。
        </AppCard>
      ) : (
        <AppCard className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">薬局名</th>
                <th className="px-3 py-2 text-left font-medium">エリア</th>
                <th className="px-3 py-2 text-left font-medium">サービス</th>
                <th className="px-3 py-2 text-left font-medium">連絡先</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {pharmacies.map((ph) => {
                const name = (ph as any).name ?? "名称未設定の薬局";
                const area = formatArea((ph as any).area);
                const email = (ph as any).email ?? "";
                const phone = (ph as any).phone ?? "";
                const rawServices = (ph as any).services;
                const services = Array.isArray(rawServices) ? rawServices : [];

                const firstServices = services.slice(0, 3);
                const moreCount =
                  services.length > 3 ? services.length - firstServices.length : 0;

                return (
                  <tr
                    key={ph.id as string}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-slate-900">{name}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-[11px] sm:text-xs text-slate-700">
                        {area}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {firstServices.length === 0 ? (
                          <span className="text-[11px] text-slate-400">
                            未設定
                          </span>
                        ) : (
                          firstServices.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700"
                            >
                              {s}
                            </span>
                          ))
                        )}
                        {moreCount > 0 && (
                          <span className="text-[10px] text-slate-400">
                            +{moreCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-0.5 text-[11px] sm:text-xs text-slate-700">
                        {phone && <span>Tel: {phone}</span>}
                        {email && <span>Mail: {email}</span>}
                        {!phone && !email && (
                          <span className="text-slate-400">未設定</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Link href={`/admin/pharmacies/${ph.id}`}>
                        <AppButton variant="outline" size="sm">
                          詳細・編集
                        </AppButton>
                      </Link>
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
