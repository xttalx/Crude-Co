/**
 * Canonical order for dashboard categories (aligned with conversational home chips).
 */
export const PRIMARY_CATEGORY_ORDER = [
  "gas",
  "meal",
  "travel",
  "office_supply",
  "other",
] as const;

const SECONDARY_ORDER = ["clothing", "tools"] as const;

const UNKNOWN_BUCKET = 100;

/** Lower bucket = earlier in list. Unknown categories share a bucket and sort by name. */
export function categoryBucket(code: string | undefined): number {
  const c = (code ?? "").toLowerCase();
  const primary = PRIMARY_CATEGORY_ORDER.indexOf(
    c as (typeof PRIMARY_CATEGORY_ORDER)[number],
  );
  if (primary >= 0) return primary;

  const secondary = SECONDARY_ORDER.indexOf(
    c as (typeof SECONDARY_ORDER)[number],
  );
  if (secondary >= 0) return PRIMARY_CATEGORY_ORDER.length + secondary;

  return UNKNOWN_BUCKET;
}

export type CategoryBreakdownRow = {
  code: string;
  name: string;
  amountMinor: number;
  claimableMinor: number;
};

export function sortCategoryBreakdown<T extends CategoryBreakdownRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ba = categoryBucket(a.code);
    const bb = categoryBucket(b.code);
    if (ba !== bb) return ba - bb;
    if (ba === UNKNOWN_BUCKET) return a.name.localeCompare(b.name);
    return b.amountMinor - a.amountMinor;
  });
}

/** Sort expense-like rows: category bucket first, then newest date first */
export function sortExpensesForReport<
  T extends {
    expenseDate: string;
    category: { code: string; name: string };
  },
>(expenses: T[]): T[] {
  return [...expenses].sort((a, b) => {
    const ba = categoryBucket(a.category.code);
    const bb = categoryBucket(b.category.code);
    if (ba !== bb) return ba - bb;
    if (ba === UNKNOWN_BUCKET)
      return a.category.name.localeCompare(b.category.name);
    return (
      new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()
    );
  });
}
