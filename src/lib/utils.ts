import { UserRole } from "@/types";

const permissions = {
  owner: {
    viewDashboard: true,
    manageTransactions: true,
    manageInventory: true,
    manageCapital: true,
    manageUsers: true,
    exportReports: true,
    deleteRecords: true,
  },
  manager: {
    viewDashboard: true,
    manageTransactions: true,
    manageInventory: true,
    manageCapital: false,
    manageUsers: false,
    exportReports: true,
    deleteRecords: false,
  },
  staff: {
    viewDashboard: true,
    manageTransactions: true,
    manageInventory: true,
    manageCapital: false,
    manageUsers: false,
    exportReports: false,
    deleteRecords: false,
  },
} as const;

export type Permission = keyof (typeof permissions)["owner"];

export function can(role: UserRole | undefined, permission: Permission) {
  if (!role) return false;
  return permissions[role][permission];
}

export function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatPercent(value: number) {
  return `${(value || 0).toFixed(1)}%`;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const value = row[h] ?? "";
          const str = String(value).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}
