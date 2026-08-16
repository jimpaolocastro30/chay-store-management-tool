"use client";

import { useEffect, useState } from "react";
import { PRODUCT_CATEGORIES } from "@/lib/categories";

export function useProductCategories() {
  const [categories, setCategories] = useState<string[]>([
    ...PRODUCT_CATEGORIES,
  ]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<{ name: string }>) => {
        if (cancelled) return;
        const names = Array.from(
          new Set(
            (Array.isArray(rows) ? rows : [])
              .map((row) => row.name)
              .filter(Boolean)
          )
        );
        if (names.length) setCategories(names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return categories;
}
