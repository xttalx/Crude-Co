import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

/**
 * Browser-side Supabase client (e.g. Storage uploads). Uses `@supabase/ssr` for cookie-aware auth.
 * Returns null when env is not configured — local flows work without Supabase.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient();
}
