"use client";

import { Bell, Menu } from "lucide-react";
import Link from "next/link";

export function Header({
  title,
  subtitle,
  onMenu,
}: {
  title: string;
  subtitle?: string;
  onMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-teal-900/10 bg-[#f4faf8]/90 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            className="rounded-xl border border-teal-900/10 bg-white p-2 text-teal-900 shadow-sm lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-teal-950 sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-slate-600">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <Link
          href="/alerts"
          className="inline-flex items-center gap-2 rounded-xl border border-teal-900/10 bg-white px-3 py-2 text-sm text-teal-900 shadow-sm transition hover:border-teal-700/30"
        >
          <Bell size={16} />
          <span className="hidden sm:inline">Alerts</span>
        </Link>
      </div>
    </header>
  );
}
