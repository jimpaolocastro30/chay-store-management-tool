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
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { can } from "@/lib/utils";
import { UserRole } from "@/types";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/revenue", label: "Revenue", icon: TrendingUp },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/prices", label: "Prices", icon: CircleDollarSign, permission: "editInventory" as const },
  { href: "/capital", label: "Capital", icon: Landmark, permission: "manageCapital" as const },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet, permission: "exportReports" as const },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/users", label: "Users", icon: Users, permission: "manageUsers" as const },
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
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-violet-900/20 bg-[linear-gradient(165deg,#2e1065_0%,#5b21b6_48%,#7c3aed_100%)] text-violet-50 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <Link href="/" className="group" onClick={onClose}>
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-white">
              Chay
            </p>
            <p className="text-xs uppercase tracking-[0.22em] text-violet-200/80">
              Ops Platform
            </p>
          </Link>
          <button
            className="rounded-lg p-2 text-violet-100 hover:bg-white/10 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
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
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-violet-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {link.label}
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-xl bg-white/10 px-3 py-3">
            <p className="text-sm font-medium text-white">
              {data?.user?.name}
            </p>
            <p className="text-xs capitalize text-violet-100/70">
              {role} · {data?.user?.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-violet-100/80 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
            Sign out
          </button>
          <p className="mt-3 flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wider text-violet-200/50">
            <BarChart3 size={12} />
            SE-BIOP Phase 1
          </p>
        </div>
      </aside>
    </>
  );
}
