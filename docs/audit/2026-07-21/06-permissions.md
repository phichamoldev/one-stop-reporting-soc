# Permission Audit (2026-07-21)

This document audits the role-based access control (RBAC), Row Level Security (RLS), and API protections.

## Role Definitions

The system utilizes custom roles defined within the `staff_users` table in the database:
- `super_admin`
- `admin`
- `manager`
- *(implicit)* `staff` / other valid authenticated roles.

## Route Protection (`hasAccess` helper)

Client-side routing and some server-side data fetching rely on the `hasAccess(role, route)` utility function.

### Access Matrix
| Route / Feature | Allowed Roles |
| :--- | :--- |
| `/backoffice/settings` | `super_admin` |
| `/backoffice` (Dashboard) | `super_admin`, `admin`, `manager` |
| `/backoffice/analytics` | `super_admin`, `admin`, `manager` |
| `/backoffice/staff` | `super_admin`, `admin`, `manager` |
| `/backoffice/reports` | All authenticated roles |

### Client-Side Enforcement
`AuthGuard.tsx` enforces these rules globally for the `/backoffice` segment. If a user accesses a restricted route, they are seamlessly redirected:
- Unauthorized access to `/backoffice/settings` -> Redirects to `/backoffice/unauthorized`
- Unauthorized access to Dashboard/Analytics/Staff -> Redirects to `/backoffice/reports`

## Database & API Protections

### 1. Row Level Security (RLS)
- **`staff_users` Table**: Highly restrictive RLS. General authenticated users (via client JWT) cannot directly query `staff_users`. 
- **Impact on Auth Flow**: This strict RLS previously caused infinite login loops because the client-side attempt to fetch the profile failed. This was resolved by using the Service Role Key (`supabaseAdmin`) exclusively for the `/api/staff/profile` API route.

### 2. Department Filters (`getAccessibleDepartmentIds`)
Data segregation is achieved programmatically via `getAccessibleDepartmentIds` in `auth-helpers.ts`.
- `super_admin` / `admin`: Can access data across ALL departments.
- `manager` / `staff`: Can only access data associated with their `department_id`.
- This function explicitly returns `[-1]` (a forced invalid ID) if permissions are utterly missing, ensuring queries safely return empty sets rather than exposing data.

### 3. Server Actions & API Protection
- All Backoffice API routes extract the token manually and validate it using `verifyAuthToken`.
- After validating the JWT, APIs lookup the user's role and `department_id` from the database.
- Database operations are then performed using `supabaseAdmin`, with constraints manually applied via `.in("department_id", accessibleDeptIds)` to mimic RLS securely without client-side vulnerabilities.

## Audit Conclusion
The permission model is robust, acting as a hybrid between programmatic enforcement (Server-side constraints) and Client-Side gating (AuthGuard). The decision to bypass RLS for specific admin operations via `supabaseAdmin` while manually enforcing `department_id` checks is a valid pattern for admin dashboards where standard RLS might conflict with complex hierarchical data aggregation.
