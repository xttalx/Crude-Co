import type { DeductibilityStatus } from "@prisma/client";

export type DeductibilityOverride = "auto" | "deductible" | "partial" | "non_deductible";

/** Org-specific rule row (subset of DeductionRule model). */
export type DeductionRuleInput = {
  deductiblePercent: number;
};

export function computeDeductibility(
  deductionType: string | null | undefined,
  amountMinor: number,
  override: DeductibilityOverride,
  rule?: DeductionRuleInput | null,
): {
  status: DeductibilityStatus;
  deductibleAmountMinor: number;
} {
  const pct = Math.min(
    100,
    Math.max(0, Math.round(rule?.deductiblePercent ?? 50)),
  );

  if (override !== "auto") {
    if (override === "deductible") {
      return { status: "deductible", deductibleAmountMinor: amountMinor };
    }
    if (override === "partial") {
      return {
        status: "partial",
        deductibleAmountMinor: Math.round(amountMinor * (pct / 100)),
      };
    }
    return { status: "non_deductible", deductibleAmountMinor: 0 };
  }

  if (deductionType === "deductible") {
    const p = rule?.deductiblePercent ?? 100;
    return {
      status: "deductible",
      deductibleAmountMinor: Math.round(amountMinor * (p / 100)),
    };
  }
  if (deductionType === "partial") {
    return {
      status: "partial",
      deductibleAmountMinor: Math.round(amountMinor * (pct / 100)),
    };
  }
  if (deductionType === "non_deductible") {
    return { status: "non_deductible", deductibleAmountMinor: 0 };
  }
  return { status: "unknown", deductibleAmountMinor: 0 };
}

export function inferPaymentType(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("cash")) return "cash";
  if (
    l.includes("visa") ||
    l.includes("master") ||
    l.includes("amex") ||
    l.includes("credit") ||
    l.includes("debit") ||
    l === "card"
  ) {
    return "card";
  }
  return "other";
}
