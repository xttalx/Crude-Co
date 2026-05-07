import { NextResponse } from "next/server";
import { authErrorResponse, getSessionUser } from "@/server/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({ user });
  } catch (e) {
    return authErrorResponse(e);
  }
}
