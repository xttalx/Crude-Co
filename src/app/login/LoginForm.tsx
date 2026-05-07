"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(json?.error ?? "Something went wrong");
      }

      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [email, password, router]);

  return (
    <div className="relative flex min-h-dvh flex-col px-4 pb-10 pt-6 text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
        <BrandLogo />
        <ThemeToggle />
      </header>

      <main className="mx-auto mt-8 w-full max-w-md flex-1">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-lg shadow-zinc-900/8 dark:shadow-black/40">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Welcome back — your claimable totals are one tap away.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--label)]">
                Email
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-zinc-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--label)]">
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-zinc-400"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={loading}
            onClick={() => void submit()}
            className="mt-8 w-full rounded-xl bg-zinc-950 py-4 text-base font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            {loading ? "Please wait…" : "Sign in"}
          </button>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            New to SpendSnap?{" "}
            <Link
              href="/register"
              className="font-semibold text-zinc-900 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-white"
            >
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
