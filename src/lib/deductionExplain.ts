import type { DeductionRuleInput } from "@/lib/deductibility";

export function explainDeduction(input: {
  categoryName: string;
  categoryCode: string;
  deductionType: string;
  rule: DeductionRuleInput | null;
}): string {
  const { categoryName, deductionType, rule } = input;
  const pct =
    rule?.deductiblePercent ??
    (deductionType === "partial" ? 50 : deductionType === "deductible" ? 100 : 0);

  if (deductionType === "non_deductible") {
    return `${categoryName} is treated as personal / non-deductible for this workspace.`;
  }
  if (deductionType === "deductible") {
    return `${categoryName} is modeled at ${pct}% of spend toward your claimable estimate. Keep receipts when amounts are material — SpendSnap does not provide tax advice.`;
  }
  if (deductionType === "partial") {
    return `Partial categories like ${categoryName.toLowerCase()} often use a percentage (${pct}% here toward claimable). Rules vary by country and facts — confirm with your advisor.`;
  }
  return `We could not classify deductibility automatically — review this line against your tax advisor’s guidance.`;
}
