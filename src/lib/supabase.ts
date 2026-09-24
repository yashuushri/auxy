import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAnonClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    (typeof window !== "undefined"
      ? (window as unknown as { __SUPABASE_URL__?: string }).__SUPABASE_URL__
      : "") ||
    ""
  );
}

function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    (typeof window !== "undefined"
      ? (window as unknown as { __SUPABASE_ANON_KEY__?: string }).__SUPABASE_ANON_KEY__
      : "") ||
    ""
  );
}

function getSupabaseServiceRoleKey(): string {
  if (typeof window !== "undefined") return "";
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

/**
 * Returns the Supabase Admin client with service_role privileges.
 * Only available server-side. Falls back to anon client if service role key is not configured.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    // Client-side should never use service role
    return getSupabase();
  }

  if (supabaseAdminClient) return supabaseAdminClient;

  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();

  if (url && serviceKey) {
    try {
      supabaseAdminClient = createClient(url, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      return supabaseAdminClient;
    } catch (err) {
      console.warn("[Supabase] Failed to initialize Supabase Admin client:", err);
    }
  }

  // Fallback to anon client if service role key not set
  return getSupabase();
}

/**
 * Authoritative Supabase Client.
 * On server-side, automatically prefers the admin service role client if available
 * so that serverless API routes can reliably perform queries without RLS blockage.
 */
export function getSupabase(preferServiceRole = false): SupabaseClient | null {
  const isServer = typeof window === "undefined";

  if (isServer && (preferServiceRole || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    const admin = getSupabaseAdmin();
    if (admin) return admin;
  }

  if (supabaseAnonClient) return supabaseAnonClient;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey() || getSupabaseServiceRoleKey();

  if (!url || !anonKey) {
    return null;
  }

  try {
    supabaseAnonClient = createClient(url, anonKey, {
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
    return supabaseAnonClient;
  } catch (err) {
    console.warn("[Supabase] Failed to initialize Supabase client:", err);
    return null;
  }
}

