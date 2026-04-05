import { createClient } from "@supabase/supabase-js";

let supabaseInstance: ReturnType<typeof createClient> | null = null;

/**
 * Get a server-side Supabase client using the service role key.
 * This bypasses Row Level Security (RLS) for full data access.
 * Returns null if the required environment variables are not set.
 */
export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
}
