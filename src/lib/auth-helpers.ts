import { createClient, SupabaseClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

let _primaryAuthVerifier: SupabaseClient | null = null;
let _localAuthVerifier: SupabaseClient | null = null;

function getPrimaryAuthVerifier(): SupabaseClient {
  if (!_primaryAuthVerifier) {
    const isVercelProd = process.env.VERCEL_ENV === "production";
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (isVercelProd && (!url || !key)) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in production environment");
    }
    _primaryAuthVerifier = createClient(url || LOCAL_URL, key || LOCAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _primaryAuthVerifier;
}

function getLocalAuthVerifier(): SupabaseClient {
  if (!_localAuthVerifier) {
    const url = process.env.LOCAL_SUPABASE_URL || LOCAL_URL;
    const key = process.env.LOCAL_SUPABASE_ANON_KEY || LOCAL_ANON_KEY;
    _localAuthVerifier = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _localAuthVerifier;
}

/**
 * Verifies a token from either Authorization header or query string (?token=...)
 * This prevents proxy/antivirus stripping headers from breaking auth.
 */
export async function verifyAuthToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");

  const token =
    queryToken || (authHeader ? authHeader.replace("Bearer ", "").trim() : "");

  if (!token || token === "undefined" || token === "null") {
    return { user: null, error: "Missing token", token: null };
  }

  const isVercelProd = process.env.VERCEL_ENV === "production";
  const configuredSource = (process.env.REPORT_DATA_SOURCE || "").toLowerCase().trim();

  // In Production: strictly verify against Production Supabase Auth (never touch localhost)
  if (isVercelProd || configuredSource === "production") {
    const primaryRes = await getPrimaryAuthVerifier().auth.getUser(token);
    if (primaryRes.data?.user && !primaryRes.error) {
      return { user: primaryRes.data.user, error: null, token };
    }
    return {
      user: null,
      error: primaryRes.error?.message || "Invalid or expired session token",
      token,
    };
  }

  // In Localhost / Test mode: verify against Local Supabase container first
  if (configuredSource === "test") {
    const localRes = await getLocalAuthVerifier().auth.getUser(token);
    if (localRes.data?.user && !localRes.error) {
      return { user: localRes.data.user, error: null, token };
    }
  }

  // Fallback for hybrid local testing
  const primaryRes = await getPrimaryAuthVerifier().auth.getUser(token);
  if (primaryRes.data?.user && !primaryRes.error) {
    return { user: primaryRes.data.user, error: null, token };
  }

  return {
    user: null,
    error: primaryRes.error?.message || "Invalid or expired session token",
    token,
  };
}

/**
 * Returns an array of accessible department IDs for a given staff user.
 *
 * - SUPER_ADMIN / ADMIN -> Returns `[]` (empty array signifies access to ALL departments).
 * - MANAGER -> Queries `manager_departments` and returns those IDs (plus `profile.department_id` if present).
 * - STAFF -> Returns `[profile.department_id]`. If missing, returns `[-1]` to force empty access.
 */
export async function getAccessibleDepartmentIds(
  userId: string,
  profile: { role: string; department_id: number | null },
  supabaseAdmin: SupabaseClient
): Promise<number[]> {
  const { role, department_id } = profile;

  if (role === "super_admin" || role === "admin") {
    return []; // All access
  }

  if (role === "manager") {
    const { data: mDepts } = await supabaseAdmin
      .from("manager_departments")
      .select("department_id")
      .eq("staff_user_id", userId);

    const ids = new Set<number>();

    if (mDepts) {
      mDepts.forEach((d) => ids.add(d.department_id));
    }

    // Fallback: Also include their primary department if they have one assigned in staff_users
    if (department_id !== null) {
      ids.add(department_id);
    }

    if (ids.size === 0) {
      return [-1]; // No departments accessible
    }

    return Array.from(ids);
  }

  // Staff (or any other role)
  if (department_id !== null) {
    return [department_id];
  }

  return [-1]; // Fallback to no access
}

/**
 * Validates if a role has access to a specific route.
 *
 * - Settings: super_admin ONLY
 * - Staff, Analytics, Dashboard: super_admin, admin, manager
 * - Reports: all authenticated users
 */
export function hasAccess(
  role: string | null | undefined,
  route: string
): boolean {
  if (!role) return false;

  // Exact matching for specific routes
  if (route.startsWith("/backoffice/settings")) {
    return role === "super_admin";
  }

  if (route === "/backoffice") {
    return ["super_admin", "admin", "manager", "staff"].includes(role);
  }

  if (
    route.startsWith("/backoffice/analytics") ||
    route.startsWith("/backoffice/staff")
  ) {
    return ["super_admin", "admin", "manager"].includes(role);
  }

  if (
    route.startsWith("/backoffice/reports") ||
    route.startsWith("/backoffice/incidents") ||
    route.startsWith("/backoffice/related-requests-lab")
  ) {
    return ["super_admin", "admin", "manager", "staff"].includes(role);
  }

  // Default deny for unknown backoffice routes
  if (route.startsWith("/backoffice")) {
    return false;
  }

  return true;
}
