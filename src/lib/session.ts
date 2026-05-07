import type { SessionOptions } from "iron-session";

export type SessionData = {
  userId?: string;
};

const devPassword =
  "spendtrack-dev-only-secret-min-32-chars!!";

/** Prefer `SESSION_SECRET` (32+ chars) in `.env` for real deployments. */
function sessionPassword(): string {
  const p = process.env.SESSION_SECRET;
  if (p && p.length >= 32) return p;
  return devPassword;
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword(),
  cookieName: "spendtrack_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  },
};
