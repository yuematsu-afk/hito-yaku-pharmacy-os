// src/components/patient/FavoriteButton.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Heart, Loader2 } from "lucide-react";
import { AppButton } from "@/components/ui/app-button";

export type FavoriteButtonProps = {
  pharmacistId: string;
  className?: string;
  onChange?: (isFavorite: boolean) => void;
};

const PATIENT_ID_KEY = "hito_yaku_patient_id";
const MAX_FAVORITES = 30;

export function FavoriteButton({
  pharmacistId,
  className,
  onChange,
}: FavoriteButtonProps) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);

  // localStorage から patient_id を取得
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PATIENT_ID_KEY);
    if (stored) {
      setPatientId(stored);
    } else {
      setPatientId(null);
      setLoading(false);
    }
  }, []);

  // 初期状態で既にお気に入り登録済みか確認
  useEffect(() => {
    const fetchIsFavorite = async () => {
      if (!patientId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("patient_favorites")
        .select("id")
        .eq("patient_id", patientId)
        .eq("pharmacist_id", pharmacistId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error(error);
      }

      setIsFavorite(!!data);
      setLoading(false);
    };

    if (patientId) {
      fetchIsFavorite();
    }
  }, [patientId, pharmacistId]);

  const handleClick = async () => {
    if (!patientId) {
      alert("診断結果がまだこの端末に保存されていません。診断を完了してからご利用ください。");
      return;
    }

    if (loading || updating) return;

    setUpdating(true);
    try {
      if (!isFavorite) {
        // 上限チェック
        const { count, error: countError } = await supabase
          .from("patient_favorites")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patientId);

        if (countError) {
          console.error(countError);
        } else if ((count ?? 0) >= MAX_FAVORITES) {
          alert("「気になる薬剤師」は最大30件まで登録できます。不要な薬剤師を削除してから追加してください。");
          return;
        }

        const { error: insertError } = await supabase.from("patient_favorites").insert({
          patient_id: patientId,
          pharmacist_id: pharmacistId,
        });

        if (insertError) {
          console.error(insertError);
        } else {
          setIsFavorite(true);
          onChange?.(true);
        }
      } else {
        const { error: delError } = await supabase
          .from("patient_favorites")
          .delete()
          .eq("patient_id", patientId)
          .eq("pharmacist_id", pharmacistId);

        if (delError) {
          console.error(delError);
        } else {
          setIsFavorite(false);
          onChange?.(false);
        }
      }
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AppButton
      type="button"
      variant={isFavorite ? "secondary" : "outline"}
      size="sm"
      className={className}
      onClick={handleClick}
      disabled={loading || updating}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "気になる薬剤師から削除" : "気になる薬剤師に追加"}
    >
      {loading || updating ? (
        <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
      ) : (
        <Heart
          className={`h-4 w-4 ${
            isFavorite ? "fill-rose-500 text-rose-500" : "text-slate-400"
          }`}
        />
      )}
    </AppButton>
  );
}
