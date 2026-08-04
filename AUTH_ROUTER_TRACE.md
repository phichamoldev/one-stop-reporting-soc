# AUTH_ROUTER_TRACE.md

## Trace Logs

```text
[Router]
replace start: /backoffice

[Router]
replace complete: /backoffice

[BackofficeLayoutWrapper]
mounted
isLoginPage=false

[StaffAuthProvider]
already mounted (from layout)

[AuthGuard]
mounted
authorized=false
user=77668994...
profile=super_admin
loading=false
action: setAuthorized(true)

[Dashboard]
mounted
```

## Determinations

1. **Does `router.replace` complete?**
   Yes. The Next.js App Router successfully transitions from `/backoffice/login` to `/backoffice`.

2. **Does `AuthGuard` redirect back?**
   No. Since the authentication states (`user`, `profile`) are already resolved and fully populated in `StaffAuthContext` prior to navigation, `AuthGuard` receives valid values instantly upon mounting. The `loading` state is `false`, so it evaluates `hasAccess` successfully and transitions its internal `authorized` state to `true` without redirecting back to `/backoffice/login`.

3. **Does Dashboard mount?**
   Yes. Once `AuthGuard` calls `setAuthorized(true)`, the component re-renders, bypassing the loader spinner, and successfully mounts its `children` (the `BackofficeDashboard` component).
