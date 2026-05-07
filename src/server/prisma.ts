import type { PrismaClient as PrismaClientType } from "@prisma/client";

// Some environments set PRISMA_CLIENT_ENGINE_TYPE=client globally, which requires
// Driver Adapters/Accelerate. Prisma reads this env var during module load, so we
// must set it before loading `@prisma/client`.
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client") as {
  PrismaClient: new (...args: any[]) => PrismaClientType;
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

