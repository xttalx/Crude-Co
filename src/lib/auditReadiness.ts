import type { DeductibilityStatus } from "@prisma/client";

export type PeriodExpenseAuditInput = {
  amountMinor: number;
  deductibilityStatus: DeductibilityStatus;
  description: string | null;
  receiptCount: number;
  categoryCode: string;
};

/**
 * Lightweight 0–100 score: receipts, notes for risky categories, unknown deductibility.
 */
export function computeAuditReadinessScore(
  rows: PeriodExpenseAuditInput[],
  opts?: {
    receiptRecommendedCategoryCodes?: Set<string>;
  },
): {
  score: number;
  missingReceipts: number;
  riskyWithoutNote: number;
  incompleteDeductibility: number;
  issues: string[];
} {
  const receiptRecommended =
    opts?.receiptRecommendedCategoryCodes ??
    new Set(["meal", "travel", "office_supply"]);

  let missingReceipts = 0;
  let riskyWithoutNote = 0;
  let incompleteDeductibility = 0;
  const issues: string[] = [];

  if (rows.length === 0) {
    return {
      score: 100,
      missingReceipts: 0,
      riskyWithoutNote: 0,
      incompleteDeductibility: 0,
      issues: [],
    };
  }

  let raw = 0;
  const per = rows.length > 0 ? 100 / rows.length : 0;

  for (const r of rows) {
    const note = (r.description ?? "").trim();
    const material = r.amountMinor >= 7500;

    if (r.receiptCount === 0 && (receiptRecommended.has(r.categoryCode) || material)) {
      missingReceipts += 1;
      raw -= per * 0.35;
      if (material && r.receiptCount === 0) {
        issues.push("Large expense without a receipt attachment.");
      }
    }

    if (
      receiptRecommended.has(r.categoryCode) &&
      note.length < 8 &&
      r.amountMinor >= 2500
    ) {
      riskyWithoutNote += 1;
      raw -= per * 0.25;
      issues.push(`Add a short business-purpose note for ${r.categoryCode} expenses when audited.`);
    }

    if (r.deductibilityStatus === "unknown") {
      incompleteDeductibility += 1;
      raw -= per * 0.2;
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 + raw)));
  const dedupedIssues = [...new Set(issues)].slice(0, 6);

  return {
    score,
    missingReceipts,
    riskyWithoutNote,
    incompleteDeductibility,
    issues:
      dedupedIssues.length > 0
        ? dedupedIssues
        : ["Looks organized — keep attaching receipts for meals & travel."],
  };
}
