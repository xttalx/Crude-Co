import { prisma } from "@/server/prisma";
import { inferPaymentType } from "@/lib/deductibility";

export async function findOrCreatePaymentMethod(
  orgId: string,
  labelRaw: string,
): Promise<{ id: string }> {
  const label = labelRaw.trim();
  if (!label) throw new Error("Payment label required");

  const existing = await prisma.paymentMethod.findFirst({
    where: { orgId, label },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.paymentMethod.create({
    data: {
      orgId,
      type: inferPaymentType(label),
      label,
    },
    select: { id: true },
  });
}
