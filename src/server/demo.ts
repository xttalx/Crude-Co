import { prisma } from "@/server/prisma";

/** Categories used by the conversational card and API */
const WIZARD_CATEGORIES = [
  { code: "meal", name: "Meals", deductionType: "partial" },
  { code: "gas", name: "Gas", deductionType: "deductible" },
  { code: "travel", name: "Travel", deductionType: "partial" },
  { code: "office_supply", name: "Office", deductionType: "deductible" },
  { code: "clothing", name: "Clothing", deductionType: "non_deductible" },
  { code: "tools", name: "Tools", deductionType: "deductible" },
  { code: "other", name: "Other", deductionType: "non_deductible" },
] as const;

type RuleSeed = {
  deductiblePercent: number;
  receiptRecommended: boolean;
  businessPurposeRecommended: boolean;
  jurisdictionNotes: string;
};

const RULES_BY_CODE: Record<string, RuleSeed> = {
  meal: {
    deductiblePercent: 50,
    receiptRecommended: true,
    businessPurposeRecommended: true,
    jurisdictionNotes:
      "Meals & entertainment are often 50% deductible when truly business-related; keep receipts and attendee notes.",
  },
  gas: {
    deductiblePercent: 100,
    receiptRecommended: false,
    businessPurposeRecommended: false,
    jurisdictionNotes:
      "Vehicle fuel is commonly 100% deductible when the trip is clearly business use.",
  },
  travel: {
    deductiblePercent: 50,
    receiptRecommended: true,
    businessPurposeRecommended: true,
    jurisdictionNotes:
      "Travel often mixes business and personal days — allocate before claiming 100%.",
  },
  office_supply: {
    deductiblePercent: 100,
    receiptRecommended: true,
    businessPurposeRecommended: false,
    jurisdictionNotes:
      "Office supplies are typically fully deductible when used in your trade or business.",
  },
  clothing: {
    deductiblePercent: 0,
    receiptRecommended: false,
    businessPurposeRecommended: false,
    jurisdictionNotes:
      "Everyday clothing is usually non-deductible unless specialized protective gear.",
  },
  tools: {
    deductiblePercent: 100,
    receiptRecommended: true,
    businessPurposeRecommended: false,
    jurisdictionNotes:
      "Tools used predominantly for business are often fully deductible.",
  },
  other: {
    deductiblePercent: 0,
    receiptRecommended: false,
    businessPurposeRecommended: true,
    jurisdictionNotes:
      "Review ‘other’ lines with your accountant — default assumption is non-deductible until documented.",
  },
};

export async function ensureWizardCategories(orgId: string): Promise<void> {
  for (const c of WIZARD_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { orgId_code: { orgId, code: c.code } },
      create: {
        orgId,
        code: c.code,
        name: c.name,
        deductionType: c.deductionType,
      },
      update: { name: c.name, deductionType: c.deductionType },
    });
  }
  await ensureDeductionRules(orgId);
}

async function ensureDeductionRules(orgId: string): Promise<void> {
  const categories = await prisma.expenseCategory.findMany({
    where: { orgId },
    select: { id: true, code: true },
  });

  for (const c of categories) {
    const seed = RULES_BY_CODE[c.code] ?? RULES_BY_CODE.other;
    await prisma.deductionRule.upsert({
      where: { categoryId: c.id },
      create: {
        orgId,
        categoryId: c.id,
        deductiblePercent: seed.deductiblePercent,
        reimbursementEligible: true,
        receiptRecommended: seed.receiptRecommended,
        businessPurposeRecommended: seed.businessPurposeRecommended,
        jurisdictionNotes: seed.jurisdictionNotes,
      },
      update: {
        deductiblePercent: seed.deductiblePercent,
        receiptRecommended: seed.receiptRecommended,
        businessPurposeRecommended: seed.businessPurposeRecommended,
        jurisdictionNotes: seed.jurisdictionNotes,
      },
    });
  }
}
