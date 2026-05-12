/**
 * Vercel build: prisma migrate deploy, then next build.
 *
 * Supabase + Vercel: direct host db.*.supabase.co:5432 often returns P1001 (can't reach).
 * Use the Session pooler URI (*.pooler.supabase.com:5432) from Dashboard → Connect.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error(`
[spendingtrackerapp] Missing DATABASE_URL

Vercel → Project → Settings → Environment Variables
  • DATABASE_URL = Postgres URI (see .env.example for Supabase + Vercel)

Redeploy after saving.
`);
  process.exit(1);
}

const migrateUrl =
  process.env.MIGRATE_DATABASE_URL?.trim() || dbUrl;

/** Direct Supabase DB hostname — often unreachable from Vercel (IPv4/IPv6). */
function isSupabaseDirectDbHost(url) {
  return /db\.[^.]+\.supabase\.co\b/i.test(url);
}

if (
  process.env.VERCEL === "1" &&
  isSupabaseDirectDbHost(migrateUrl) &&
  process.env.VERCEL_ALLOW_SUPABASE_DIRECT_DB !== "1"
) {
  console.warn(`
[spendingtrackerapp] WARNING: migrate URL uses db.*.supabase.co (direct Postgres).

Vercel often cannot reach that host (Prisma P1001). Prefer the Session pooler URI from
Supabase Dashboard → Connect → "Session pooler" (host *.pooler.supabase.com, port 5432)
as DATABASE_URL or MIGRATE_DATABASE_URL.

If you use Supabase IPv4 add-on and direct host works, set VERCEL_ALLOW_SUPABASE_DIRECT_DB=1
to hide this warning.

See: https://supabase.com/docs/guides/database/prisma
`);
}

function run(label, cmd, env = process.env) {
  console.log(`\n[spendingtrackerapp] ▶ ${label}\n`);
  const r = spawnSync(cmd, {
    stdio: "inherit",
    env,
    shell: true,
    cwd: process.cwd(),
  });
  if (r.signal) {
    console.error(`[spendingtrackerapp] FAILED: ${label} (signal ${r.signal})`);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`
[spendingtrackerapp] FAILED: ${label} (exit ${r.status})

If you saw P1001 to db.*.supabase.co:
  • Use Session pooler (*.pooler.supabase.com:5432) from Supabase Connect, not db.*.

Optional: VERCEL_SKIP_MIGRATE=1 skips migrate (apply migrations locally/CI first).
`);
    process.exit(r.status ?? 1);
  }
}

if (process.env.VERCEL_SKIP_MIGRATE === "1") {
  console.log(
    "[spendingtrackerapp] Skipping prisma migrate deploy (VERCEL_SKIP_MIGRATE=1)",
  );
} else {
  const migrateEnv = { ...process.env, DATABASE_URL: migrateUrl };
  run("prisma migrate deploy", "npx prisma migrate deploy", migrateEnv);
}

run("next build", "npx next build");
console.log("\n[spendingtrackerapp] Build finished OK\n");
