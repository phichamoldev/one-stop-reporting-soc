import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client (Service Role)
 * 
 * Safety & Isolation:
 * - In Test mode (REPORT_DATA_SOURCE === 'test' or non-production default), strictly routes to the isolated local Supabase
 *   container (127.0.0.1:54321) to prevent any leakage or writes to remote/production instances.
 * - In Production mode (VERCEL_ENV === 'production'), strictly uses verified production environment variables.
 * - Uses lazy client instantiation to guarantee environment variables are fully loaded before client creation.
 */

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

function resolveSupabaseConfig(): { url: string; key: string } {
  const isVercelProd = process.env.VERCEL_ENV === 'production';
  const isProdBuild = process.env.NODE_ENV === 'production';
  const configuredSource = (process.env.REPORT_DATA_SOURCE || '').toLowerCase().trim();

  // In production deployment or explicit production mode:
  if (isVercelProd || configuredSource === 'production' || (isProdBuild && configuredSource !== 'test')) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || url.includes('127.0.0.1') || url.includes('localhost')) {
      throw new Error(
        "FATAL PRODUCTION CONFIG ERROR: Missing or invalid Supabase configuration in production environment. Localhost URLs are strictly forbidden."
      );
    }
    return { url, key };
  }

  // In Localhost / Test mode:
  // If explicitly configured for test, or if URL is local, or non-production default:
  if (configuredSource === 'test' || !configuredSource) {
    return {
      url: process.env.LOCAL_SUPABASE_URL || LOCAL_URL,
      key: process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY || LOCAL_SERVICE_KEY,
    };
  }

  // If explicitly 'production' in local development:
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url: url || LOCAL_URL, key: key || LOCAL_SERVICE_KEY };
}

let _clientInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'SECURITY VIOLATION: src/lib/supabase-admin.ts is strictly server-only and must never be executed in the browser.'
    );
  }
  if (!_clientInstance) {
    const config = resolveSupabaseConfig();
    _clientInstance = createClient(config.url, config.key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _clientInstance;
}

// Proxy wrapper so existing `supabaseAdmin.from(...)` syntax continues to work seamlessly
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    if (
      prop === 'then' ||
      prop === '__esModule' ||
      prop === '$$typeof' ||
      typeof prop === 'symbol'
    ) {
      return undefined;
    }
    const instance = getSupabaseAdmin();
    const value = instance[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
