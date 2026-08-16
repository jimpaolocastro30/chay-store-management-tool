export const PRODUCT_CATEGORIES = [
  "Tea",
  "Snacks",
  "Beverages",
  "Merchandise",
  "Supplies",
  "Gift Sets",
  "Catering",
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
