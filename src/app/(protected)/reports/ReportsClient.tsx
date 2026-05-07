"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { sortExpensesForReport } from "@/lib/categorySort";

type Range = "biweekly" | "monthly";

type Summary = {
  range: Range;
  periodStart: string;
  periodEnd: string;
  expenseCount: number;
  totals: {
    spend: string;
    claimable: string;
    nonClaimablePortion: string;
    spendMinor: number;
    claimableMinor: number;
    nonClaimableMinor: number;
    estimatedTaxSavings?: string;
    estimatedTaxSavingsMinor?: number;
    marginalRateApplied?: number;
  };
  auditReadiness?: {
    score: number;
    missingReceipts: number;
    riskyWithoutNote: number;
    incompleteDeductibility: number;
    issues: string[];
  };
  byCategory: {
    code: string;
    name: string;
    amount: string;
    amountMinor: number;
    claimable: string;
    claimableMinor: number;
    nonClaimablePortion: string;
  }[];
};

type ExpenseRow = {
  id: string;
  expenseDate: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  deductibilityStatus: string;
  deductibleAmountMinor: number | null;
  category: { name: string; code: string };
  paymentMethod: { label: string };
  vendor: { name: string } | null;
  receipts: { id: string; storageKey?: string; ocrStatus?: string }[];
};

const PIE_COLORS = {
  claimable: "#10b981",
  nonClaimable: "#a1a1aa",
} as const;

function periodQuery(range: Range): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  let from: Date;
  if (range === "monthly") {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else {
    from = new Date(now);
    from.setDate(from.getDate() - 13);
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(minor / 100);
}

export default function ReportsClient() {
  const router = useRouter();
  const [range, setRange] = useState<Range>("monthly");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { from, to } = useMemo(() => periodQuery(range), [range]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = periodQuery(range);
    try {
      const [sRes, eRes] = await Promise.all([
        fetch(`/api/reports/summary?range=${range}`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/expenses?from=${q.from}&to=${q.to}&limit=500`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);
      if (sRes.status === 401 || eRes.status === 401) {
        router.push("/login");
        return;
      }
      if (!sRes.ok) throw new Error("Failed to load summary");
      if (!eRes.ok) throw new Error("Failed to load expenses");
      const sJson = (await sRes.json()) as Summary;
      const eJson = (await eRes.json()) as { expenses: ExpenseRow[] };
      setSummary(sJson);
      setExpenses(eJson.expenses);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [range, router]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = `/api/exports/csv?from=${from}&to=${to}`;
  const exportXlsx = `/api/exports/xlsx?from=${from}&to=${to}`;

  const sortedExpenses = useMemo(
    () => sortExpensesForReport(expenses),
    [expenses],
  );

  const pieData = useMemo(() => {
    if (!summary) return [];
    const claim = summary.totals.claimableMinor ?? 0;
    const non = summary.totals.nonClaimableMinor ?? 0;
    const rows: { name: string; value: number; fill: string }[] = [];
    if (claim > 0) {
      rows.push({
        name: "Claimable",
        value: claim,
        fill: PIE_COLORS.claimable,
      });
    }
    if (non > 0) {
      rows.push({
        name: "Non-claimable",
        value: non,
        fill: PIE_COLORS.nonClaimable,
      });
    }
    return rows;
  }, [summary]);

  const totalPieMinor = useMemo(() => {
    if (!summary) return 0;
    return (
      (summary.totals.claimableMinor ?? 0) +
      (summary.totals.nonClaimableMinor ?? 0)
    );
  }, [summary]);

  return (
    <div className="min-h-dvh px-4 pb-10 pt-6">
      <header className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm font-medium text-[var(--muted)] hover:underline"
        >
          ← Log expense
        </Link>
        <div className="flex items-center gap-2">
          <SignOutButton className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Reports
        </h1>

        <div className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-1 shadow-sm">
          {(["biweekly", "monthly"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                range === r
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-[var(--muted)] hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {r === "biweekly" ? "Biweekly" : "Monthly"}
            </button>
          ))}
        </div>

        {err ? (
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : null}

        {loading || !summary ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-xs font-medium text-[var(--muted)]">Total spend</p>
                <p className="mt-1 text-xl font-semibold">${summary.totals.spend}</p>
              </div>
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-xs font-medium text-[var(--muted)]">Claimable</p>
                <p className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                  ${summary.totals.claimable}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-xs font-medium text-[var(--muted)]">
                  Non-claimable portion
                </p>
                <p className="mt-1 text-xl font-semibold">
                  ${summary.totals.nonClaimablePortion}
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-xs font-medium text-[var(--muted)]">
                  Est. tax savings (illustrative)
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  ${summary.totals.estimatedTaxSavings ?? "0.00"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  Uses claimable × marginal rate (
                  {((summary.totals.marginalRateApplied ?? 0.24) * 100).toFixed(
                    0,
                  )}
                  % default). Set{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                    MARGINAL_TAX_RATE
                  </code>{" "}
                  in env.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-xs font-medium text-[var(--muted)]">
                  Audit readiness
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {summary.auditReadiness?.score ?? 100}%
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
                  Receipts missing (flagged):{" "}
                  {summary.auditReadiness?.missingReceipts ?? 0} · Notes thin on
                  risky lines: {summary.auditReadiness?.riskyWithoutNote ?? 0}
                </p>
              </div>
            </section>

            {summary.auditReadiness &&
            summary.auditReadiness.issues.length > 0 ? (
              <section className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 dark:bg-amber-500/15">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Heads-up for audit prep
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-950/90 dark:text-amber-100/90">
                  {summary.auditReadiness.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Spending split
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Claimable vs non-claimable portion of total spend in this period.
              </p>
              {totalPieMinor <= 0 ? (
                <p className="mt-6 text-center text-sm text-[var(--muted)]">
                  No spending in this period yet.
                </p>
              ) : (
                <div className="mt-4 h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={`cell-${i}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          money(Number(value ?? 0), "USD")
                        }
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <p className="text-xs text-[var(--muted)]">
              {summary.expenseCount} expenses ·{" "}
              {new Date(summary.periodStart).toLocaleDateString()} –{" "}
              {new Date(summary.periodEnd).toLocaleDateString()}
            </p>

            <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                By category
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Sorted: Gas → Meals → Travel → Office → Other, then clothing &
                tools, then anything else (A–Z).
              </p>
              <ul className="mt-3 space-y-3">
                {summary.byCategory.map((c) => (
                  <li key={c.code} className="border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      <span>{c.name}</span>
                      <span>${c.amount}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
                      <span>Claimable</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-500">
                        ${c.claimable}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-xs text-[var(--muted)]">
                      <span>Non-claimable portion</span>
                      <span>${c.nonClaimablePortion}</span>
                    </div>
                  </li>
                ))}
                {summary.byCategory.length === 0 ? (
                  <li className="text-sm text-[var(--muted)]">No data yet.</li>
                ) : null}
              </ul>
            </section>

            <div className="flex flex-wrap gap-2">
              <a
                href={exportCsv}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Export CSV
              </a>
              <a
                href={exportXlsx}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Export Excel
              </a>
            </div>

            <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Recent in period
              </h2>
              <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {sortedExpenses.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.category.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {e.vendor?.name ? (
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {e.vendor.name}
                          </span>
                        ) : (
                          <span>No merchant</span>
                        )}
                        {" · "}
                        {new Date(e.expenseDate).toLocaleDateString()} ·{" "}
                        {e.paymentMethod.label}
                        {e.description ? ` · ${e.description}` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        Receipt:{" "}
                        {e.receipts.length > 0
                          ? `yes (${e.receipts.length})`
                          : "none"}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">
                        {money(e.amountMinor, e.currency)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Claimable{" "}
                        {money(e.deductibleAmountMinor ?? 0, e.currency)}
                      </p>
                    </div>
                  </li>
                ))}
                {expenses.length === 0 ? (
                  <li className="py-6 text-center text-sm text-[var(--muted)]">
                    No expenses in this range.
                  </li>
                ) : null}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
