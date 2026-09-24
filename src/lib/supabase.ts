import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    (typeof window !== "undefined"
      ? (window as unknown as { __SUPABASE_URL__?: string }).__SUPABASE_URL__
      : "") ||
    "";

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    (typeof window !== "undefined"
      ? (window as unknown as { __SUPABASE_ANON_KEY__?: string }).__SUPABASE_ANON_KEY__
      : "") ||
    "";

  if (!url || !anonKey) {
    return null;
  }

  try {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
    return supabaseClient;
  } catch (err) {
    console.warn("[Supabase] Failed to initialize Supabase client:", err);
    return null;
  }
}
