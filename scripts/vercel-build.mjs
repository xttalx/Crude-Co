/**
 * Vercel build entry: optional migrate, then `next build`.
 * Logs each step so deploy logs show exactly what failed.
 *
 * Optional env (Supabase / pooler):
 *   MIGRATE_DATABASE_URL or DIRECT_URL — direct Postgres URI used only for
 *   `prisma migrate deploy`. If unset, migrate uses DATABASE_URL (must allow DDL).
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error(`
[spendingtrackerapp] Missing DATABASE_URL

Vercel → Project → Settings → Environment Variables
  • DATABASE_URL = Postgres connection string (Supabase: Database → URI)
  • Enable for Production (and Preview if you use preview deploys)

Redeploy after saving.
`);
  process.exit(1);
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

If this was "prisma migrate deploy":
  • Supabase: use "Session" / direct Postgres URI, or set MIGRATE_DATABASE_URL
    to the direct URI while DATABASE_URL stays on the pooler.
  • Or set VERCEL_SKIP_MIGRATE=1 to skip migrations on this deploy (apply them locally/CI first).
`);
    process.exit(r.status ?? 1);
  }
}

if (process.env.VERCEL_SKIP_MIGRATE === "1") {
  console.log(
    "[spendingtrackerapp] Skipping prisma migrate deploy (VERCEL_SKIP_MIGRATE=1)",
  );
} else {
  const migrateUrl =
    process.env.MIGRATE_DATABASE_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    dbUrl;
  const migrateEnv = { ...process.env, DATABASE_URL: migrateUrl };
  run("prisma migrate deploy", "npx prisma migrate deploy", migrateEnv);
}

run("next build", "npx next build");
console.log("\n[spendingtrackerapp] Build finished OK\n");
