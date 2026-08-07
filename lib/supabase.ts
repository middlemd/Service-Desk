import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "./env";

export function createUserSupabaseClient(idToken: string) {
  const env = getServerEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => idToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createServiceSupabaseClient() {
  const env = getServerEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
