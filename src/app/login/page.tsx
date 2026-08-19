"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error || !res?.ok) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,#7c3aed_0%,#5b21b6_38%,#1e1b4b_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2760%27 height=%2760%27 viewBox=%270 0 60 60%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg fill=%27none%27 fill-rule=%27evenodd%27%3E%3Cg fill=%27%23ffffff%27 fill-opacity=%270.04%27%3E%3Cpath d=%27M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%27/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-4 py-12 lg:flex-row lg:items-center lg:gap-16">
        <div className="animate-fade-up max-w-xl text-violet-50">
          <p className="text-xs uppercase tracking-[0.3em] text-violet-200/80">
            Philippines · Small Enterprise
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-tight sm:text-6xl">
            Chay
          </h1>
          <p className="mt-2 text-lg text-violet-100/90">
            Business Intelligence & Operations Platform — revenue, inventory,
            capital, and KPIs in one mobile-friendly workspace.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="animate-fade-up w-full max-w-md rounded-3xl border border-white/15 bg-white/95 p-6 shadow-2xl shadow-violet-950/40 backdrop-blur sm:p-8"
          style={{ animationDelay: "0.12s" }}
        >
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-violet-950">
            Sign in
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Owner, Manager, and Staff roles with RBAC.
          </p>

          <div className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Enter dashboard"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
