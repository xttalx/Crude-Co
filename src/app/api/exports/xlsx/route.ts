import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
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
    orderBy: { expenseDate: "asc" },
    include: {
      category: { select: { code: true, name: true, deductionType: true } },
      vendor: { select: { name: true } },
      paymentMethod: { select: { type: true, label: true } },
    },
  });

  const rows = expenses.map((e) => ({
    date: toISODate(e.expenseDate),
    amount: Number((e.amountMinor / 100).toFixed(2)),
    currency: e.currency,
    category: e.category.name,
    category_code: e.category.code,
    payment_method: e.paymentMethod.label,
    vendor: e.vendor?.name ?? "",
    description: e.description ?? "",
    claimable_status: e.deductibilityStatus,
    claimable_amount: Number(((e.deductibleAmountMinor ?? 0) / 100).toFixed(2)),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="expenses-${from ?? "all"}-${to ?? "all"}.xlsx"`,
    },
  });
}
