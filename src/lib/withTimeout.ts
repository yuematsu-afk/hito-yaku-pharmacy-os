// src/lib/withTimeout.ts
export class TimeoutError extends Error {
  public readonly name = "TimeoutError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Promiseにタイムアウトを付ける。
 * タイムアウトしたら TimeoutError を throw する。
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
