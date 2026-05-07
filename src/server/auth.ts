import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sessionOptions, type SessionData } from "@/lib/session";
import { prisma } from "@/server/prisma";
import { ensureWizardCategories } from "@/server/demo";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAuth(): Promise<{ orgId: string; userId: string }> {
  const session = await getSession();
  if (!session.userId) {
    throw new HttpError(401, "Unauthorized");
  }
  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: { orgId: true },
  });
  if (!membership) {
    throw new HttpError(401, "Unauthorized");
  }
  await ensureWizardCategories(membership.orgId);
  return { orgId: membership.orgId, userId: session.userId };
}

export async function getSessionUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      jobType: true,
      city: true,
      country: true,
    },
  });
  return user;
}

const JOB_MAP: Record<
  string,
  { businessType: string; industryCode: string }
> = {
  freelancer: { businessType: "freelancer", industryCode: "consulting" },
  employee: { businessType: "employee", industryCode: "general" },
  contractor: { businessType: "contractor", industryCode: "construction" },
  business_owner: { businessType: "small_business", industryCode: "retail" },
  other: { businessType: "other", industryCode: "general" },
};

export function mapJobTypeToBusiness(jobType: string) {
  return JOB_MAP[jobType] ?? JOB_MAP.other;
}

export async function registerUser(input: {
  email: string;
  password: string;
  jobType: string;
  city: string;
  country: string;
}) {
  const email = input.email.trim().toLowerCase();
  const city = input.city.trim();
  const country = input.country.trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const { businessType, industryCode } = mapJobTypeToBusiness(input.jobType);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      jobType: input.jobType,
      city: city.length > 0 ? city : null,
      country: country.length > 0 ? country : null,
      name: email.split("@")[0] ?? email,
    },
    select: { id: true },
  });

  const orgName =
    city.length > 0 && country.length > 0
      ? `SpendSnap — ${city}, ${country}`
      : city.length > 0
        ? `SpendSnap — ${city}`
        : "SpendSnap";

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      defaultCurrency: "USD",
      memberships: {
        create: {
          userId: user.id,
          role: "owner",
          status: "active",
        },
      },
      businessProfile: {
        create: {
          businessType,
          industryCode,
          employeeCount: 0,
        },
      },
      paymentMethods: {
        create: [
          { type: "cash", label: "Cash" },
          { type: "credit", label: "Card" },
        ],
      },
    },
    select: { id: true },
  });

  await ensureWizardCategories(org.id);

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return { userId: user.id, orgId: org.id };
}

export async function loginUser(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    throw new HttpError(401, "Invalid email or password");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid email or password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return { userId: user.id };
}

export async function logoutUser() {
  const session = await getSession();
  session.destroy();
  await session.save();
}

export function authErrorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}
