import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, registerUser } from "@/server/auth";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  jobType: z.enum([
    "freelancer",
    "employee",
    "contractor",
    "business_owner",
    "other",
  ]),
  city: z.string().trim().min(1, "City is required"),
  country: z.string().trim().min(2, "Country is required"),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = RegisterSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    await registerUser(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
