# Routing Audit (2026-07-21)

This document audits the Next.js App Router configuration, route structures, layouts, and route protection mechanisms for the application.

## Routing Architecture

The application utilizes the Next.js App Router (`app/` directory). The primary focus of this audit is the `/backoffice` segment.

```text
app/
 ├── backoffice/
 │    ├── layout.tsx (Provides BackofficeLayoutWrapper & StaffAuthProvider)
 │    ├── page.tsx (Protected: Dashboard)
 │    ├── login/
 │    │    └── page.tsx (Public/Unauthenticated)
 │    ├── reports/
 │    │    └── page.tsx (Protected)
 │    ├── analytics/
 │    │    └── page.tsx (Protected)
 │    ├── staff/
 │    │    └── page.tsx (Protected)
 │    └── settings/
 │         └── page.tsx (Protected)
 ├── api/
 │    └── backoffice/ (Protected API routes)
 └── track/
      └── [publicId]/
           └── page.tsx (Public dynamic route)
```

## Audit Findings

### 1. Middleware (`middleware.ts`)
- **Status**: Not present.
- **Impact**: The application does not utilize Next.js Edge Middleware for route protection or redirect logic. All protection is handled at the Client level (via `AuthGuard`) and at the API level (via explicit token validation). This means initial HTML document requests for protected pages will return the shell layout and rely on client-side JS to kick unauthorized users out.

### 2. Protected Routes (Client-Side)
- **Implementation**: Handled exclusively by `AuthGuard.tsx`.
- **Redirect Loops**: A critical redirect loop previously existed where `login/page.tsx` attempted to send users to `/backoffice` upon login, but a lagging `profile` state caused `AuthGuard` to instantly bounce them back to `/backoffice/login`, resulting in a perpetual loop and forced session termination.
- **Resolution**: The React state race condition was fixed today, eliminating the redirect loop.

### 3. Layouts
- **Missing Layouts**: No missing layouts detected. The `/backoffice` segment correctly shares a single layout (`layout.tsx`).
- **Duplicate Layouts**: None detected.
- **Layout Transitions**: A previous bug caused `StaffAuthProvider` to unmount during layout transitions between `/backoffice/login` and `/backoffice`. This was resolved by lifting the Provider higher up the tree in `BackofficeLayoutWrapper`.

### 4. Dynamic Routes
- **Implementation**: `/app/track/[publicId]/page.tsx` and various API routes like `/api/reports/[publicId]/route.ts`.
- **Issues**: A Next.js error ("Error objects cannot be rendered as React children") occurred on the `track/[publicId]` route when displaying error states. This was fixed today by coercing the error to a string.

## Conclusion
The routing structure relies heavily on Client-Side Rendering (CSR) for access control. While omitting `middleware.ts` increases the initial payload size for unauthorized users (as they download the JS bundle before being redirected), the current architecture is functional and free of redirect loops following today's fixes.
