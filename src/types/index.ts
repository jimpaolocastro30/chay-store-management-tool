export type UserRole = "owner" | "manager" | "staff";

export type TransactionType = "revenue" | "expense" | "loss";

export type ExpenseCategory =
  | "cogs"
  | "rent"
  | "utilities"
  | "payroll"
  | "marketing"
  | "supplies"
  | "transport"
  | "damage"
  | "other";

export type CapitalType = "initial" | "investment" | "withdrawal";

export type AlertType = "low_stock" | "negative_cash" | "kpi_threshold" | "info";

export interface DashboardKpis {
  revenueMtd: number;
  revenueYtd: number;
  expensesMtd: number;
  netProfitMtd: number;
  grossMargin: number;
  netMargin: number;
  inventoryValue: number;
  inventoryCount: number;
  unitsSold: number;
  lowStockCount: number;
  inventoryTurnover: number;
  totalCapital: number;
  workingCapital: number;
  cashPosition: number;
  roiOnCapital: number;
  expenseRatio: number;
}

export interface ChartPoint {
  label: string;
  revenue: number;
  expense: number;
  profit: number;
}

export interface ExpenseBreakdown {
  category: string;
  amount: number;
}
