import { ReactNode } from "react";
import Link from "next/link";

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const tones = {
    default: "from-white to-violet-50/80 border-violet-900/10",
    good: "from-white to-emerald-50 border-emerald-200/80",
    warn: "from-white to-amber-50 border-amber-200/80",
    bad: "from-white to-rose-50 border-rose-200/80",
  };

  const card = (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-4 shadow-[0_10px_30px_-20px_rgba(124,58,237,0.45)] ${tones[tone]} ${
        href ? "transition hover:border-violet-700/40 hover:shadow-[0_12px_36px_-18px_rgba(124,58,237,0.55)]" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-violet-950 sm:text-3xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );

  if (!href) return card;
  return <Link href={href}>{card}</Link>;
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-violet-900/10 bg-white/80 p-4 shadow-[0_12px_40px_-28px_rgba(124,58,237,0.5)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-violet-950">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary:
      "bg-violet-800 text-white hover:bg-violet-700 shadow-sm shadow-violet-900/20",
    secondary:
      "bg-white text-violet-900 border border-violet-900/15 hover:border-violet-700/40",
    danger: "bg-rose-700 text-white hover:bg-rose-600",
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
) {
  const { label, className = "", id, ...rest } = props;
  return (
    <label className="block space-y-1.5 text-sm">
      {label ? <span className="text-slate-600">{label}</span> : null}
      <input
        id={id}
        className={`min-h-11 w-full rounded-xl border border-violet-900/15 bg-white px-3 py-2.5 text-base text-violet-950 outline-none ring-violet-700/30 transition focus:ring-2 md:text-sm ${className}`}
        {...rest}
      />
    </label>
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }
) {
  const { label, className = "", children, ...rest } = props;
  return (
    <label className="block space-y-1.5 text-sm">
      {label ? <span className="text-slate-600">{label}</span> : null}
      <select
        className={`min-h-11 w-full rounded-xl border border-violet-900/15 bg-white px-3 py-2.5 text-base text-violet-950 outline-none ring-violet-700/30 transition focus:ring-2 md:text-sm ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
) {
  const { label, className = "", ...rest } = props;
  return (
    <label className="block space-y-1.5 text-sm">
      {label ? <span className="text-slate-600">{label}</span> : null}
      <textarea
        className={`w-full rounded-xl border border-violet-900/15 bg-white px-3 py-2.5 text-violet-950 outline-none ring-violet-700/30 transition focus:ring-2 ${className}`}
        {...rest}
      />
    </label>
  );
}
