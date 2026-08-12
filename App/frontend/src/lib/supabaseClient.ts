import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Lazily-created Supabase client. Previously this module threw at import time
 * when the env vars were absent, which crashed the whole app on boot. Now it
 * degrades gracefully: `supabase` is `null` until both vars are configured.
 */
let supabaseInstance: SupabaseClient | null = null;

function ensureClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  if (supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export function getSupabase(): SupabaseClient | null {
  return ensureClient();
}

/** @deprecated use getSupabase() — kept for minimal-diff compatibility. */
export const supabase: SupabaseClient | null = null;
