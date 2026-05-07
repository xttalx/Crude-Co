"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

const CATEGORY_CHIPS = [
  { code: "gas", label: "Gas" },
  { code: "meal", label: "Meals" },
  { code: "travel", label: "Travel" },
  { code: "office_supply", label: "Office" },
  { code: "other", label: "Other" },
] as const;

const PAYMENT_CHIPS = ["Visa", "Amex", "Mastercard", "Debit", "Cash"] as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type Insight = {
  claimable: string;
  nonClaimable: string;
  explanation: string;
};

export function ConversationalExpenseCard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORY_CHIPS)[number]["code"] | null>(null);
  const [payment, setPayment] = useState<string>("Visa");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [lastExpenseId, setLastExpenseId] = useState<string | null>(null);

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image receipt (JPG, PNG, WebP).");
      return;
    }
    setFile(f);
    setError(null);
  };

  const submit = useCallback(async () => {
    setError(null);
    setInsight(null);
    setLastExpenseId(null);

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setError('Describe a purchase — e.g. "$42 Shell gas on Visa".');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expenseDate: todayISO(),
          naturalLanguage: trimmed,
          categoryCode: category ?? undefined,
          paymentLabel: payment,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const json = (await res.json().catch(() => null)) as {
        error?: string;
        insight?: Insight;
        expense?: { id: string };
      } | null;

      if (!res.ok) {
        throw new Error(json?.error ?? "Could not save expense");
      }

      if (json?.insight) setInsight(json.insight);
      if (json?.expense?.id) setLastExpenseId(json.expense.id);

      if (file && json?.expense?.id) {
        const fd = new FormData();
        fd.set("expenseId", json.expense.id);
        fd.set("file", file);
        const up = await fetch("/api/receipts", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!up.ok) {
          setError("Expense saved, but receipt upload failed — try again from Reports.");
        }
      }

      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [text, category, payment, file, router]);

  return (
    <div className="relative flex min-h-dvh flex-col px-4 pb-12 pt-6 text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <SignOutButton className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800" />
          <ThemeToggle />
          <Link
            href="/reports"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Reports
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-8 w-full max-w-lg flex-1">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="rounded-[1.35rem] border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-[0_22px_60px_-28px_rgba(0,0,0,0.35)] dark:shadow-[0_28px_80px_-36px_rgba(0,0,0,0.85)]"
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            SpendSnap
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            What did you spend today?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Type like a text: amounts, merchants, and cards — we&apos;ll sort
            category, claimability, and audit hints.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() =>
                  setCategory((prev) => (prev === c.code ? null : c.code))
                }
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  category === c.code
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                    : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <label className="mt-6 block">
            <span className="text-xs font-semibold text-[color:var(--label)]">
              Tell SpendSnap in your own words
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder='$52 gas on Visa&#10;Client dinner $80 Amex&#10;Office chair $180 Mastercard'
              className="mt-2 w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-base leading-relaxed text-zinc-950 placeholder:text-zinc-400 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/25 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
          </label>

          <div className="mt-4">
            <span className="text-xs font-semibold text-[color:var(--label)]">
              Paid with
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {PAYMENT_CHIPS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPayment(p)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    payment === p
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                      : "border-zinc-300 bg-white text-zinc-800 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div
            role="presentation"
            onDragEnter={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDrag(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              onPickFile(f ?? null);
            }}
            className={`mt-6 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
              drag
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-zinc-300 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-900/40"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Receipt (optional)
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Drag & drop, or use camera / gallery — stored locally for now;
              Supabase Storage ready later.
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Choose image
            </button>
            {file ? (
              <p className="mt-3 truncate text-xs text-emerald-700 dark:text-emerald-400">
                Attached: {file.name}
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <motion.button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            whileTap={{ scale: 0.98 }}
            className="mt-8 w-full rounded-2xl bg-zinc-950 py-4 text-base font-semibold tracking-wide text-white shadow-lg shadow-zinc-900/25 hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:shadow-black/30 dark:hover:bg-white"
          >
            {saving ? "Saving…" : "Log expense"}
          </motion.button>

          <AnimatePresence>
            {insight ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 dark:bg-emerald-500/15"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Claimability snapshot
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] font-medium text-[var(--muted)]">
                      Claimable
                    </p>
                    <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                      ${insight.claimable}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[var(--muted)]">
                      Non-claimable
                    </p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      ${insight.nonClaimable}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {insight.explanation}
                </p>
                {lastExpenseId ? (
                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    Logged — view details anytime in Reports.
                  </p>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}
