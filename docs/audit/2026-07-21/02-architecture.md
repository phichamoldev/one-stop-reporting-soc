# Architecture Audit (2026-07-21)

This document provides a comprehensive architecture map and dependency tree of the Backoffice panel.

## Backoffice Dependency Tree

```text
app/backoffice/layout.tsx
 └── BackofficeLayoutWrapper (Client Component)
      └── StaffAuthProvider
           ├── NotificationProvider
           │    ├── RealtimeListener
           │    └── NotificationToastContainer
           ├── BackofficeSidebar
           ├── BackofficeNavbar
           └── AuthGuard
                └── page.tsx (Dashboard, Reports, Analytics, Staff, Settings)
                     └── DashboardProvider (if on /backoffice)
                          ├── DashboardKPIs
                          ├── DashboardCharts
                          └── DashboardRecentReports
```

## Detailed Dependency Map

### 1. Root Layouts & Wrappers
- **`BackofficeLayoutWrapper`**: The primary layout component for the Backoffice. It handles conditional rendering for the `/login` page vs. authenticated pages.
- **`StaffAuthProvider`**: The authentication context. Wraps almost the entire Backoffice, making `useStaffAuth` available to all child components. It also fetches the staff `profile` from the API.

### 2. Global UI & Listeners (Inside StaffAuthProvider)
- **`NotificationProvider`**: Manages global toast notifications.
- **`RealtimeListener`**: Subscribes to Supabase realtime events and fetches `/api/backoffice/pending-summary`. It uses `useStaffAuth` to determine if a user is logged in before subscribing.
- **`BackofficeSidebar`**: Renders navigation menus. It consumes `useStaffAuth` to filter menus based on the user's role.
- **`BackofficeNavbar`**: Top navigation bar, consumes `useStaffAuth` to display user profile info and logout button.

### 3. Protection & Routing
- **`AuthGuard`**: The critical protection layer. 
  - Depends on: `useStaffAuth` (user, profile, loading state).
  - Logic: Redirects to `/backoffice/login` if unauthenticated. Redirects to authorized fallback pages if the role lacks permission for the current route.
  - Renders `children` only when `authorized` is true.

### 4. Page Level (Dashboard)
- **`BackofficeDashboard` (`page.tsx`)**: The main dashboard view.
  - **`DashboardProvider`**: Wraps the dashboard widgets. It manages SWR data fetching for `/api/backoffice/dashboard`.
    - Depends on: `useStaffAuth` (user, profile) and `hasAccess` helper.
  - **Widgets**: `DashboardKPIs`, `DashboardCharts`, `DashboardRecentReports` all consume `useDashboardContext` to render data.

## Architectural Observations

1. **Nested Providers**: There is deep nesting of providers (`StaffAuthProvider` -> `NotificationProvider` -> `AuthGuard` -> `DashboardProvider`). This is standard in React but requires careful handling of loading states to avoid race conditions.
2. **Global Listeners Unprotected by AuthGuard**: `RealtimeListener`, `BackofficeSidebar`, and `BackofficeNavbar` are inside `StaffAuthProvider` but **outside** `AuthGuard`. This means they can mount and render while `AuthGuard` is still deciding whether to kick the user out (e.g., during login transitions or token expiration).
3. **Duplicate Providers**: No explicit duplicate providers found, but `useSWR` in various places acts as distributed state providers.
4. **Circular Dependencies**: No direct module circular dependencies were observed, but state loops (e.g., Auth state triggering route transitions which trigger re-evaluations of Auth state) were a major risk factor during recent refactors.
