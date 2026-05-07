import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/prisma";
import { authErrorResponse, requireAuth } from "@/server/auth";
import { effectiveClaimableMinor } from "@/lib/claimableMath";
import { sortCategoryBreakdown } from "@/lib/categorySort";
import { computeAuditReadinessScore } from "@/lib/auditReadiness";

const RangeSchema = z.enum(["biweekly", "monthly"]);

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function rollingBiweeklyStart(now: Date): Date {
  const start = new Date(now);
  start.setDate(start.getDate() - 13);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function GET(req: Request) {
  let orgId: string;
  try {
    ({ orgId } = await requireAuth());
  } catch (e) {
    return authErrorResponse(e);
  }
  const url = new URL(req.url);
  const range = RangeSchema.safeParse(url.searchParams.get("range") ?? "monthly");
  if (!range.success) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);

  const periodStart =
    range.data === "monthly"
      ? startOfMonth(now)
      : rollingBiweeklyStart(now);

  const expenses = await prisma.expense.findMany({
    where: {
      orgId,
      expenseDate: { gte: periodStart, lte: periodEnd },
    },
    select: {
      amountMinor: true,
      deductibleAmountMinor: true,
      deductibilityStatus: true,
      description: true,
      category: { select: { name: true, code: true } },
      receipts: { select: { id: true } },
    },
  });

  let totalSpendMinor = 0;
  let totalClaimableMinor = 0;

  const agg = new Map<
    string,
    { code: string; name: string; amountMinor: number; claimableMinor: number }
  >();

  for (const e of expenses) {
    totalSpendMinor += e.amountMinor;
    const claim = effectiveClaimableMinor(
      e.amountMinor,
      e.deductibilityStatus,
      e.deductibleAmountMinor,
    );
    totalClaimableMinor += claim;

    const code = e.category.code;
    const name = e.category.name;
    const cur = agg.get(code) ?? { code, name, amountMinor: 0, claimableMinor: 0 };
    cur.amountMinor += e.amountMinor;
    cur.claimableMinor += claim;
    agg.set(code, cur);
  }

  const nonClaimablePortionMinor = Math.max(0, totalSpendMinor - totalClaimableMinor);

  const marginalRate = Math.min(
    0.6,
    Math.max(0, Number(process.env.MARGINAL_TAX_RATE ?? "0.24")),
  );
  const estimatedTaxSavingsMinor = Math.round(totalClaimableMinor * marginalRate);

  const auditRows = expenses.map((e) => ({
    amountMinor: e.amountMinor,
    deductibilityStatus: e.deductibilityStatus,
    description: e.description,
    receiptCount: e.receipts.length,
    categoryCode: e.category.code,
  }));

  const audit = computeAuditReadinessScore(auditRows);

  const byCategory = sortCategoryBreakdown(
    [...agg.values()].map((row) => ({
      code: row.code,
      name: row.name,
      amountMinor: row.amountMinor,
      claimableMinor: row.claimableMinor,
      amount: (row.amountMinor / 100).toFixed(2),
      claimable: (row.claimableMinor / 100).toFixed(2),
      nonClaimablePortion: (
        (row.amountMinor - row.claimableMinor) /
        100
      ).toFixed(2),
    })),
  );

  return NextResponse.json({
    range: range.data,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    expenseCount: expenses.length,
    totals: {
      spendMinor: totalSpendMinor,
      spend: (totalSpendMinor / 100).toFixed(2),
      claimableMinor: totalClaimableMinor,
      claimable: (totalClaimableMinor / 100).toFixed(2),
      nonClaimableMinor: nonClaimablePortionMinor,
      nonClaimablePortion: (nonClaimablePortionMinor / 100).toFixed(2),
      estimatedTaxSavingsMinor,
      estimatedTaxSavings: (estimatedTaxSavingsMinor / 100).toFixed(2),
      marginalRateApplied: marginalRate,
    },
    auditReadiness: audit,
    byCategory,
  });
}
