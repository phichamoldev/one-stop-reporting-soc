import { SupabaseClient } from "@supabase/supabase-js";

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
export function hasAccess(role: string | null | undefined, route: string): boolean {
  if (!role) return false;

  // Exact matching for specific routes
  if (route.startsWith("/backoffice/settings")) {
    return role === "super_admin";
  }
  
  if (route === "/backoffice" || route.startsWith("/backoffice/analytics") || route.startsWith("/backoffice/staff")) {
    return ["super_admin", "admin", "manager"].includes(role);
  }

  if (route.startsWith("/backoffice/reports")) {
    return true; // All authenticated users can access reports
  }

  // Default deny for unknown backoffice routes
  if (route.startsWith("/backoffice")) {
    return false;
  }

  return true;
}
