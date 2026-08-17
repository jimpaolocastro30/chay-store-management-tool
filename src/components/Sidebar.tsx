"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CircleDollarSign,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { can } from "@/lib/utils";
import { UserRole } from "@/types";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ShoppingCart, permission: "usePos" as const },
  { href: "/revenue", label: "Revenue", icon: TrendingUp },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/categories", label: "Categories", icon: Tags, permission: "editInventory" as const },
  { href: "/prices", label: "Prices", icon: CircleDollarSign, permission: "editInventory" as const },
  { href: "/capital", label: "Capital", icon: Landmark, permission: "manageCapital" as const },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet, permission: "exportReports" as const },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/users", label: "Users", icon: Users, permission: "manageUsers" as const },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role as UserRole | undefined;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-violet-900/20 bg-[linear-gradient(165deg,#2e1065_0%,#5b21b6_48%,#7c3aed_100%)] text-violet-50 transition-transform md:static md:w-[5.25rem] md:translate-x-0 lg:w-72 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-6 md:justify-center md:px-2 lg:justify-between lg:px-5">
          <Link href="/" className="group" onClick={onClose}>
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-white md:text-xl lg:text-2xl">
              Chay
            </p>
            <p className="text-xs uppercase tracking-[0.22em] text-violet-200/80 md:hidden lg:block">
              Ops Platform
            </p>
          </Link>
          <button
            className="rounded-lg p-3 text-violet-100 hover:bg-white/10 md:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 md:px-2 lg:px-3">
          {links
            .filter((link) => !link.permission || can(role, link.permission))
            .map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  title={link.label}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition md:justify-center md:px-2 lg:justify-start lg:px-3 ${
                    active
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-violet-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={20} />
                  <span className="md:hidden lg:inline">{link.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-white/10 p-4 md:p-2 lg:p-4">
          <Link
            href="/settings"
            onClick={onClose}
            className="mb-3 block rounded-xl bg-white/10 px-3 py-3 transition hover:bg-white/15 md:px-2 md:py-2 lg:px-3 lg:py-3"
          >
            <p className="text-sm font-medium text-white md:hidden lg:block">
              {data?.user?.name}
            </p>
            <p className="hidden text-center text-xs font-medium text-white md:block lg:hidden">
              {(data?.user?.name || "?").slice(0, 1)}
            </p>
            <p className="text-xs capitalize text-violet-100/70 md:hidden lg:block">
              {role} · {data?.user?.email}
            </p>
            <p className="mt-1 text-[11px] text-violet-200/80 md:hidden lg:block">
              Update profile
            </p>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-violet-100/80 transition hover:bg-white/10 hover:text-white md:justify-center md:px-2 lg:justify-start lg:px-3"
          >
            <LogOut size={16} />
            <span className="md:hidden lg:inline">Sign out</span>
          </button>
          <p className="mt-3 flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wider text-violet-200/50 md:hidden lg:flex">
            <BarChart3 size={12} />
            SE-BIOP Phase 1
          </p>
        </div>
      </aside>
    </>
  );
}
