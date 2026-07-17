import { supabase } from "@/lib/supabase";

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers || {});
  if (session) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  
  return fetch(url, {
    ...options,
    headers
  });
}
