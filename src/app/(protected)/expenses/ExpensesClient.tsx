"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Meta = {
  categories: { id: string; name: string; code: string; deductionType: string }[];
  paymentMethods: { id: string; type: string; label: string }[];
  vendors: { id: string; name: string }[];
};

type Expense = {
  id: string;
  expenseDate: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  deductibilityStatus: "deductible" | "partial" | "non_deductible" | "unknown";
  deductibleAmountMinor: number | null;
  category: { name: string; deductionType: string };
  vendor: { name: string } | null;
  paymentMethod: { label: string; type: string };
  receipts: { id: string }[];
};

function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(minor / 100);
}

function toInputDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export default function ExpensesClient() {
  const router = useRouter();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    expenseDate: toInputDate(),
    amount: "",
    currency: "USD",
    categoryId: "",
    paymentMethodId: "",
    vendorName: "",
    description: "",
  });

  const canSubmit =
    form.amount.trim().length > 0 &&
    form.categoryId.length > 0 &&
    form.paymentMethodId.length > 0;

  const selectedCategory = useMemo(() => {
    return meta?.categories.find((c) => c.id === form.categoryId) ?? null;
  }, [meta?.categories, form.categoryId]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [metaRes, expensesRes] = await Promise.all([
        fetch("/api/meta", { cache: "no-store", credentials: "include" }),
        fetch("/api/expenses", { cache: "no-store", credentials: "include" }),
      ]);

      if (metaRes.status === 401 || expensesRes.status === 401) {
        router.push("/login");
        return;
      }

      if (!metaRes.ok) throw new Error("Failed to load metadata");
      if (!expensesRes.ok) throw new Error("Failed to load expenses");

      const metaJson = (await metaRes.json()) as Meta;
      const expensesJson = (await expensesRes.json()) as { expenses: Expense[] };

      setMeta(metaJson);
      setExpenses(expensesJson.expenses);

      setForm((f) => ({
        ...f,
        categoryId: f.categoryId || metaJson.categories[0]?.id || "",
        paymentMethodId: f.paymentMethodId || metaJson.paymentMethods[0]?.id || "",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createExpense() {
    setError(null);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        expenseDate: form.expenseDate,
        amount: form.amount,
        currency: form.currency,
        categoryId: form.categoryId,
        paymentMethodId: form.paymentMethodId,
        vendorName: form.vendorName.trim() || undefined,
        description: form.description.trim() || undefined,
      }),
    });

    if (res.status === 401) {
      router.push("/login");
      return;
    }

    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(json?.error || "Failed to create expense");
    }

    setForm((f) => ({ ...f, amount: "", vendorName: "", description: "" }));
    await refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Quick add</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Enter the essentials. We’ll mark deductible vs non-deductible
              automatically.
            </p>
          </div>
          {selectedCategory ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              <div className="font-medium">Deductibility</div>
              <div className="mt-0.5">
                {selectedCategory.deductionType === "deductible"
                  ? "Deductible"
                  : selectedCategory.deductionType === "partial"
                    ? "Partially deductible"
                    : selectedCategory.deductionType === "non_deductible"
                      ? "Non-deductible"
                      : "Depends"}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">Amount</span>
            <input
              inputMode="decimal"
              placeholder="12.34"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">Date</span>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, expenseDate: e.target.value }))
              }
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">Category</span>
            <select
              value={form.categoryId}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoryId: e.target.value }))
              }
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              disabled={!meta}
            >
              {(meta?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">
              Payment method
            </span>
            <select
              value={form.paymentMethodId}
              onChange={(e) =>
                setForm((f) => ({ ...f, paymentMethodId: e.target.value }))
              }
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              disabled={!meta}
            >
              {(meta?.paymentMethods ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-zinc-700">Vendor</span>
            <input
              placeholder="e.g., Starbucks"
              value={form.vendorName}
              onChange={(e) =>
                setForm((f) => ({ ...f, vendorName: e.target.value }))
              }
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-zinc-700">
              Description (optional)
            </span>
            <input
              placeholder="Notes for later"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => refresh()}
            className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              try {
                await createExpense();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unknown error");
              }
            }}
            className="h-11 rounded-lg bg-black px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add expense
          </button>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight">Recent</h2>
          <p className="text-xs text-zinc-500">
            {loading ? "Loading…" : `${expenses.length} shown`}
          </p>
        </div>

        <div className="mt-3 divide-y divide-zinc-100">
          {expenses.length === 0 && !loading ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No expenses yet. Add your first one above.
            </p>
          ) : null}
          {expenses.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{e.category.name}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(e.expenseDate).toLocaleDateString()}
                  </span>
                  {e.vendor?.name ? (
                    <span className="text-xs text-zinc-600">• {e.vendor.name}</span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                  <span>{e.paymentMethod.label}</span>
                  <span>•</span>
                  <span>
                    {e.deductibilityStatus === "deductible"
                      ? "Deductible"
                      : e.deductibilityStatus === "partial"
                        ? "Partially deductible"
                        : e.deductibilityStatus === "non_deductible"
                          ? "Non-deductible"
                          : "Unknown"}
                  </span>
                  {e.deductibilityStatus !== "unknown" ? (
                    <>
                      <span>•</span>
                      <span>
                        Deductible:{" "}
                        {formatMoney(e.deductibleAmountMinor ?? 0, e.currency)}
                      </span>
                    </>
                  ) : null}
                </div>
                {e.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                    {e.description}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold">
                  {formatMoney(e.amountMinor, e.currency)}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {e.receipts.length > 0 ? "Receipt" : "No receipt"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
