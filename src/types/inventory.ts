export type InventoryBatchStatus =
  | "AVAILABLE"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "DEPLETED"
  | "EXPIRED"
  | "BLOCKED";

export type InventoryTxnType =
  | "RECEIVING"
  | "SALE"
  | "SALE_VOID"
  | "SALE_RETURN"
  | "PURCHASE_RETURN"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "DAMAGE"
  | "EXPIRY"
  | "STOCK_TRANSFER_IN"
  | "STOCK_TRANSFER_OUT"
  | "OPENING_BALANCE";

export type InventoryCountStatus = "DRAFT" | "SUBMITTED" | "POSTED";

export const ADJUSTMENT_REASONS = [
  "Damaged",
  "Missing",
  "Spoilage",
  "Expired",
  "Theft/Shrinkage",
  "Counting Error",
  "POS Error",
  "Receiving Error",
  "Other",
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];
