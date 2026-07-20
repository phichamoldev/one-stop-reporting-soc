import { supabase } from "@/lib/supabase";

export const fetcherWithAuth = async (url: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  
  if (session) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url, { headers });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error: any = new Error(errorData.error || 'An error occurred while fetching the data.');
    error.info = errorData;
    error.status = res.status;
    error.code = errorData.code;
    throw error;
  }
  
  return res.json();
};

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error: any = new Error(errorData.error || 'An error occurred while fetching the data.');
    error.info = errorData;
    error.status = res.status;
    throw error;
  }
  
  return res.json();
};
