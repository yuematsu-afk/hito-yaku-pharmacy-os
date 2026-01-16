// src/lib/logger.ts
const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

export const log = (...args: any[]) => {
  if (!isProd) console.log(...args);
};
export const warn = (...args: any[]) => {
  if (!isProd) console.warn(...args);
};
export const error = (...args: any[]) => {
  // error は本番も残す運用が多い（監視のため）
  console.error(...args);
};
