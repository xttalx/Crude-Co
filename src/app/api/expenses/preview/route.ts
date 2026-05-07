import { NextResponse } from "next/server";
import { z } from "zod";
import { parseExpenseNaturalLanguage } from "@/lib/parseExpenseNlp";
import { authErrorResponse, requireAuth } from "@/server/auth";
import { prisma } from "@/server/prisma";

const BodySchema = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  let orgId: string;
  try {
    ({ orgId } = await requireAuth());
  } catch (e) {
    return authErrorResponse(e);
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const hints = parseExpenseNaturalLanguage(parsed.data.text);
  const categories = await prisma.expenseCategory.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, deductionType: true },
  });

  const resolved = hints.categoryCode
    ? categories.find((c) => c.code === hints.categoryCode) ?? null
    : null;

  return NextResponse.json({
    hints,
    suggestedCategory: resolved,
    categories,
  });
}
