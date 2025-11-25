// src/components/ui/app-button.tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline";
type Size = "sm" | "md";

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * アプリ全体で使う共通ボタン
 * - primary: メインの強調ボタン（青系）
 * - secondary: ほどよい強調のサブボタン（エメラルド系）
 * - outline: 枠のみの弱めのボタン
 */
export function AppButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: AppButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition disabled:opacity-60 disabled:cursor-not-allowed";

  const sizeClass =
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  const variantClass =
    variant === "primary"
      ? "bg-sky-600 text-white hover:bg-sky-700"
      : variant === "secondary"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      {...props}
      className={`${base} ${sizeClass} ${variantClass} ${className}`}
    />
  );
}
