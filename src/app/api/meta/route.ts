import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/server/auth";
import { prisma } from "@/server/prisma";

export async function GET() {
  let orgId: string;
  try {
    ({ orgId } = await requireAuth());
  } catch (e) {
    return authErrorResponse(e);
  }

  const [categories, paymentMethods, vendors] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, deductionType: true },
    }),
    prisma.paymentMethod.findMany({
      where: { orgId },
      orderBy: { label: "asc" },
      select: { id: true, type: true, label: true },
    }),
    prisma.vendor.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 50,
    }),
  ]);

  return NextResponse.json({ categories, paymentMethods, vendors });
}

