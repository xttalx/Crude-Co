import ExpensesClient from "./ExpensesClient";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

export default function ExpensesPage() {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link className="text-sm font-medium text-zinc-700 hover:underline" href="/">
            ← Home
          </Link>
          <div className="flex items-center gap-2">
            <SignOutButton className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50" />
            <a
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              href="/api/exports/csv"
            >
              Export CSV
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <ExpensesClient />
      </main>
    </div>
  );
}
