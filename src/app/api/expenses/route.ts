import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/prisma";
import { authErrorResponse, requireAuth } from "@/server/auth";
import {
  computeDeductibility,
  type DeductibilityOverride,
} from "@/lib/deductibility";
import { explainDeduction } from "@/lib/deductionExplain";
import { parseExpenseNaturalLanguage } from "@/lib/parseExpenseNlp";
import { findOrCreatePaymentMethod } from "@/server/payments";

const CreateBodySchema = z.object({
  expenseDate: z.string().min(1),
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().min(3).max(3).default("USD"),
  categoryId: z.string().min(1).optional(),
  categoryCode: z.string().min(1).optional(),
  paymentMethodId: z.string().min(1).optional(),
  paymentLabel: z.string().trim().optional(),
  vendorName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  naturalLanguage: z.string().trim().optional(),
  deductibilityOverride: z
    .enum(["auto", "deductible", "partial", "non_deductible"])
    .default("auto"),
});

function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export async function GET(req: Request) {
  let orgId: string;
  try {
    ({ orgId } = await requireAuth());
  } catch (e) {
    return authErrorResponse(e);
  }
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "200") || 200,
    2000,
  );

  const fromDate = from ? new Date(from + "T00:00:00") : null;
  const toDate = to ? new Date(to + "T23:59:59") : null;

  const expenses = await prisma.expense.findMany({
    where: {
      orgId,
      ...(fromDate || toDate
        ? {
            expenseDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { expenseDate: "desc" },
    take: limit,
    include: {
      category: { select: { name: true, code: true, deductionType: true } },
      vendor: { select: { name: true } },
      paymentMethod: { select: { label: true, type: true } },
      receipts: { select: { id: true, storageKey: true, ocrStatus: true } },
    },
  });

  return NextResponse.json({ expenses });
}

export async function POST(req: Request) {
  let orgId: string;
  let userId: string;
  try {
    ({ orgId, userId } = await requireAuth());
  } catch (e) {
    return authErrorResponse(e);
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const d = parsed.data;
  let amountRaw = d.amount;
  let categoryId = d.categoryId;
  let categoryCode = d.categoryCode;
  let paymentMethodId = d.paymentMethodId;
  let paymentLabel = d.paymentLabel;
  let vendorName = d.vendorName;
  let description = d.description;

  let hints: ReturnType<typeof parseExpenseNaturalLanguage> | undefined;

  if (d.naturalLanguage && d.naturalLanguage.trim().length > 0) {
    const h = parseExpenseNaturalLanguage(d.naturalLanguage);
    hints = h;
    if (amountRaw == null && h.amount != null) amountRaw = h.amount;
    if (!categoryId && !categoryCode && h.categoryCode)
      categoryCode = h.categoryCode;
    if (!paymentMethodId && !paymentLabel && h.paymentLabel)
      paymentLabel = h.paymentLabel;
    if (!vendorName && h.merchant) vendorName = h.merchant;
    if (!description && h.note) description = h.note;
  }

  const amountNumber =
    typeof amountRaw === "string"
      ? Number.parseFloat(amountRaw)
      : amountRaw;

  if (
    amountNumber == null ||
    !Number.isFinite(amountNumber) ||
    amountNumber <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Could not find a valid amount — include something like “$42 gas on Visa”.",
      },
      { status: 400 },
    );
  }

  if (!categoryId && !categoryCode) {
    return NextResponse.json(
      {
        error:
          "Pick a category chip or mention gas / meal / office / travel in your message.",
      },
      { status: 400 },
    );
  }

  if (!paymentMethodId && !paymentLabel) {
    return NextResponse.json(
      {
        error:
          "Add how you paid (e.g. Visa, Amex, debit, cash).",
      },
      { status: 400 },
    );
  }

  const expenseDate = new Date(d.expenseDate + "T00:00:00");
  if (Number.isNaN(expenseDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const category = categoryId
    ? await prisma.expenseCategory.findFirst({
        where: { orgId, id: categoryId },
        include: {
          deductionRule: {
            select: { deductiblePercent: true },
          },
        },
      })
    : await prisma.expenseCategory.findFirst({
        where: { orgId, code: categoryCode! },
        include: {
          deductionRule: {
            select: { deductiblePercent: true },
          },
        },
      });

  if (!category) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  const paymentMethodIdResolved = paymentMethodId
    ? paymentMethodId
    : (await findOrCreatePaymentMethod(orgId, paymentLabel!)).id;

  const pm = await prisma.paymentMethod.findFirst({
    where: { orgId, id: paymentMethodIdResolved },
    select: { id: true },
  });
  if (!pm) {
    return NextResponse.json({ error: "Unknown payment method" }, { status: 400 });
  }

  const vendorNameTrim = vendorName?.trim();
  const vendor =
    vendorNameTrim && vendorNameTrim.length > 0
      ? await (async () => {
          const existing = await prisma.vendor.findFirst({
            where: { orgId, name: vendorNameTrim },
            select: { id: true },
          });
          if (existing) return existing;
          return prisma.vendor.create({
            data: {
              orgId,
              name: vendorNameTrim,
              normalizedName: vendorNameTrim.toLowerCase(),
            },
            select: { id: true },
          });
        })()
      : null;

  const amountMinor = toMinorUnits(amountNumber);
  const override = d.deductibilityOverride as DeductibilityOverride;
  const rule = category.deductionRule;
  const { status: deductibilityStatus, deductibleAmountMinor } =
    computeDeductibility(
      category.deductionType,
      amountMinor,
      override,
      rule ?? undefined,
    );

  const nonClaimableAmountMinor = Math.max(0, amountMinor - deductibleAmountMinor);

  const parsedSnapshotJson =
    d.naturalLanguage && d.naturalLanguage.trim().length > 0
      ? {
          naturalLanguage: d.naturalLanguage.trim(),
          hints:
            hints ?? parseExpenseNaturalLanguage(d.naturalLanguage.trim()),
        }
      : undefined;

  const expense = await prisma.expense.create({
    data: {
      orgId,
      createdByUserId: userId,
      expenseDate,
      amountMinor,
      currency: d.currency.toUpperCase(),
      categoryId: category.id,
      paymentMethodId: paymentMethodIdResolved,
      vendorId: vendor?.id ?? null,
      description: description?.trim() || null,
      deductibilityStatus,
      deductibleAmountMinor,
      nonClaimableAmountMinor,
      parsedSnapshotJson: parsedSnapshotJson ?? undefined,
      source: "manual",
    },
    include: {
      category: {
        select: {
          name: true,
          code: true,
          deductionType: true,
          deductionRule: { select: { deductiblePercent: true } },
        },
      },
      vendor: { select: { name: true } },
      paymentMethod: { select: { label: true, type: true } },
      receipts: { select: { id: true } },
    },
  });

  const explanation = explainDeduction({
    categoryName: expense.category.name,
    categoryCode: expense.category.code,
    deductionType: expense.category.deductionType,
    rule: expense.category.deductionRule
      ? { deductiblePercent: expense.category.deductionRule.deductiblePercent }
      : null,
  });

  return NextResponse.json(
    {
      expense,
      insight: {
        claimableMinor: deductibleAmountMinor,
        nonClaimableMinor: nonClaimableAmountMinor,
        claimable: (deductibleAmountMinor / 100).toFixed(2),
        nonClaimable: (nonClaimableAmountMinor / 100).toFixed(2),
        explanation,
      },
    },
    { status: 201 },
  );
}
