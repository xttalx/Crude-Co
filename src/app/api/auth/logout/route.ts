import { NextResponse } from "next/server";
import { authErrorResponse, logoutUser } from "@/server/auth";

export async function POST() {
  try {
    await logoutUser();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
