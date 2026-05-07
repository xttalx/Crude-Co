import { NextResponse } from "next/server";
import Papa from "papaparse";
import { authErrorResponse, requireAuth } from "@/server/auth";
import { prisma } from "@/server/prisma";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

  const fromDate = from ? new Date(from + "T00:00:00") : null;
  const toDate = to ? new Date(to + "T23:59:59") : null;

  const where = {
    orgId,
    ...(fromDate || toDate
      ? {
          expenseDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  } as const;

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: "asc" },
    include: {
      category: { select: { code: true, name: true, deductionType: true } },
      vendor: { select: { name: true } },
      paymentMethod: { select: { type: true, label: true } },
    },
  });

  const rows = expenses.map((e) => ({
    date: toISODate(e.expenseDate),
    amount: (e.amountMinor / 100).toFixed(2),
    currency: e.currency,
    category: e.category.name,
    category_code: e.category.code,
    payment_method: e.paymentMethod.label,
    vendor: e.vendor?.name ?? "",
    description: e.description ?? "",
    deductible_status: e.deductibilityStatus,
    deductible_amount: ((e.deductibleAmountMinor ?? 0) / 100).toFixed(2),
  }));

  const csv = Papa.unparse(rows, { newline: "\n" });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="expenses-${from ?? "all"}-${to ?? "all"}.csv"`,
    },
  });
}

