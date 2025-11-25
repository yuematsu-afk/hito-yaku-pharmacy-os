// src/app/admin/pharmacies/[pharmacyId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import type { Pharmacy } from "@/types/supabase";

export default function PharmacyDetailPage() {
  const router = useRouter();

  // ✅ URL からパラメータを取得（props は一切使わない）
  const params = useParams() as { pharmacyId?: string };
  const pharmacyId =
    typeof params.pharmacyId === "string" ? params.pharmacyId : undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);

  // 編集用 state
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      // ✅ URL に pharmacyId が無い／読めないときはここで止める
      if (!pharmacyId) {
        setError("URLの薬局IDが不正です（pharmacyId がありません）。");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: pharmacyError } = await supabase
          .from("pharmacies")
          .select("*")
          .eq("id", pharmacyId)
          .limit(1);

        if (pharmacyError) throw pharmacyError;
        if (!data || data.length === 0) {
          throw new Error("薬局データが見つかりませんでした。");
        }

        const row = data[0] as any;
        setPharmacy(row as Pharmacy);

        // 基本情報
        setName(row.name ?? "");
        setArea(row.area ?? "");
        setAddress(row.address ?? "");
        setPhone(row.phone ?? "");
        setEmail(row.email ?? "");
        setWebsite(row.website ?? "");
        setNote(row.note ?? "");

        // services は text[] / text / null など何でも安全に扱う
        const rawServices = row.services;
        let initialServices: string[] = [];
        if (Array.isArray(rawServices)) {
          initialServices = rawServices;
        } else if (
          typeof rawServices === "string" &&
          rawServices.trim() !== ""
        ) {
          initialServices = rawServices
            .split(/[、,]/)
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
        setServices(initialServices);
      } catch (err: any) {
        console.error("Failed to fetch pharmacy detail", err);
        setError(err.message ?? "薬局データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pharmacyId]);

  const handleAddService = () => {
    const trimmed = serviceInput.trim();
    if (!trimmed) return;
    if (services.includes(trimmed)) {
      setServiceInput("");
      return;
    }
    setServices((prev) => [...prev, trimmed]);
    setServiceInput("");
  };

  const handleRemoveService = (svc: string) => {
    setServices((prev) => prev.filter((s) => s !== svc));
  };

  const handleSave = async () => {
    if (!pharmacy) return;
    if (!pharmacyId) {
      setError("URLの薬局IDが不正です（pharmacyId がありません）。");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // DB 側が text[] の想定。text のままならここで join する。
      const payload: any = {
        name: name.trim() || null,
        area: area.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        services, // text[] の場合
        note: note.trim() || null,
      };

      const { error: updateError } = await supabase
        .from("pharmacies")
        .update(payload)
        .eq("id", pharmacyId);

      if (updateError) throw updateError;
    } catch (err: any) {
      console.error("Failed to update pharmacy", err);
      setError(err.message ?? "保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            薬局プロフィール詳細
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            薬局名・エリア・サービス内容・連絡先など、Pharmacy OS 上で表示される情報を管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/pharmacies">
            <AppButton variant="outline" size="sm">
              一覧に戻る
            </AppButton>
          </Link>
        </div>
      </div>

      {loading ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          読み込み中です…
        </AppCard>
      ) : error ? (
        <AppCard className="space-y-3 border-red-200 bg-red-50/70">
          <div className="text-sm font-medium text-red-800">
            エラーが発生しました
          </div>
          <div className="text-xs text-red-700">{error}</div>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
          >
            再読み込み
          </AppButton>
        </AppCard>
      ) : !pharmacy ? (
        <AppCard className="py-10 text-center text-sm text-slate-500">
          薬局データが見つかりませんでした。
        </AppCard>
      ) : (
        <>
          {/* 基本情報 */}
          <AppCard className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">
                基本情報
              </h2>
              <p className="text-xs text-slate-500">
                ユーザーに表示する薬局名やエリア、住所などの基本情報です。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  薬局名
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="例：ヒトヤク薬局 本店"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  エリア
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="例：京都市中京区 / オンライン専門 など"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  住所
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="例：京都府京都市○○区…（オンライン専用なら空欄でもOK）"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  電話番号
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg白 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="例：075-XXXX-XXXX"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="例：info@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Web サイト / LP URL
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  placeholder="例：https://example.com"
                />
              </div>
            </div>
          </AppCard>

          {/* サービス内容・特徴 */}
          <AppCard className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">
                サービス・特徴
              </h2>
              <p className="text-xs text-slate-500">
                在宅対応 / オンライン服薬指導 / 漢方相談 / 多言語対応 など、Pharmacy OS 上でマッチングに使われる情報です。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">
                提供サービス（タグ）
              </label>
              <div className="flex flex-wrap gap-2">
                {services.length === 0 ? (
                  <span className="text-[11px] text-slate-400">
                    まだサービスが登録されていません。
                  </span>
                ) : (
                  services.map((svc) => (
                    <span
                      key={svc}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                    >
                      {svc}
                      <button
                        type="button"
                        onClick={() => handleRemoveService(svc)}
                        className="ml-1 text-[10px] text-slate-500 hover:text-slate-800"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serviceInput}
                  onChange={(e) => setServiceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddService();
                    }
                  }}
                  placeholder="例：オンライン服薬指導 / 在宅訪問 / 漢方相談 など"
                  className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                />
                <AppButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddService}
                >
                  追加
                </AppButton>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">
                メモ / 内部向けメモ
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                placeholder="例：この薬局はIBS・消化器系の相談が多い。外国人患者の比率が高く、英語対応が得意。"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              {saving && (
                <div className="text-xs text-slate-500">保存中です…</div>
              )}
              <AppButton
                type="button"
                variant="primary"
                size="md"
                disabled={saving}
                onClick={handleSave}
              >
                変更を保存
              </AppButton>
            </div>
          </AppCard>
        </>
      )}
    </div>
  );
}
