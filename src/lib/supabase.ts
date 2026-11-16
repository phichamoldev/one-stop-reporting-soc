import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function resolveSupabasePublicConfig(): { url: string; anonKey: string } {
  // In any production build or Vercel environment:
  // Strictly enforce production Supabase config and eliminate local fallbacks via tree-shaking.
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
  ) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey || url.includes('127.0.0.1') || url.includes('localhost')) {
      throw new Error(
        "FATAL PRODUCTION CONFIG ERROR: Missing or invalid production Supabase configuration (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Localhost URLs are strictly forbidden in production."
      );
    }
    return { url, anonKey };
  }

  // Local development only:
  const LOCAL_DEV_URL = 'http://127.0.0.1:54321';
  const LOCAL_DEV_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

  return {
    url: process.env.NEXT_PUBLIC_LOCAL_SUPABASE_URL || LOCAL_DEV_URL,
    anonKey: process.env.NEXT_PUBLIC_LOCAL_SUPABASE_ANON_KEY || LOCAL_DEV_ANON_KEY,
  };
}

const globalForSupabase = globalThis as unknown as {
  __socSupabaseBrowserClient?: SupabaseClient;
};

export function getSupabase(): SupabaseClient {
  if (!globalForSupabase.__socSupabaseBrowserClient) {
    const config = resolveSupabasePublicConfig();
    globalForSupabase.__socSupabaseBrowserClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'soc-backoffice-auth-token',
      },
    });
  }
  return globalForSupabase.__socSupabaseBrowserClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    if (
      prop === 'then' ||
      prop === '__esModule' ||
      prop === '$$typeof' ||
      typeof prop === 'symbol'
    ) {
      return undefined;
    }
    const instance = getSupabase();
    const value = instance[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
