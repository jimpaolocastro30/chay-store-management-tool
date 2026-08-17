"use client";

import { useEffect } from "react";

/**
 * Run an async query on mount/when `enabled` flips on, and apply the
 * result in a promise callback so setState is not called in the effect body.
 */
export function useMountQuery<T>(
  query: () => Promise<T>,
  apply: (value: T) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    query()
      .then((value) => {
        if (!cancelled) apply(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Query/apply are recreated each render; we only want mount + enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

export function resolveCategory(
  current: string,
  options: string[],
  locked = false
) {
  if (locked || !options.length || options.includes(current)) return current;
  return options[0];
}
