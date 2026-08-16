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

const MANILA_TZ = "Asia/Manila";

function manilaParts(date: Date, withTime = false) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false as const }
      : {}),
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function formatPHP(amount: number) {
  const n = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(n).toFixed(2);
  const [int, frac] = abs.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}₱${grouped}.${frac}`;
}

export function todayInputDate() {
  const { year, month, day } = manilaParts(new Date());
  return `${year}-${month}-${day}`;
}

export function formatDatePH(value: string | Date) {
  const { year, month, day } = manilaParts(new Date(value));
  return `${month}/${day}/${year}`;
}

export function formatDateTimePH(value: string | Date) {
  const { year, month, day, hour, minute } = manilaParts(new Date(value), true);
  return `${month}/${day}/${year} ${hour}:${minute}`;
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
