// src/app/env-check/page.tsx
"use client";

import { useEffect } from "react";

export default function EnvCheckPage() {
  useEffect(() => {
    console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY (先頭10文字):",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10)
    );
  }, []);

  return (
    <div className="p-4 text-sm">
      <p>ブラウザのコンソールに Supabase の環境変数を出力しました。</p>
      <p>Chrome の DevTools（F12）→ Console で確認してください。</p>
    </div>
  );
}
