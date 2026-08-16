"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const AppShellView = dynamic(
  () => import("./AppShellView").then((mod) => mod.AppShellView),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-[#f5f3ff]" />,
  }
);

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <AppShellView title={title} subtitle={subtitle}>
      {children}
    </AppShellView>
  );
}
