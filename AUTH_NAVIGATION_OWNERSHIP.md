# AUTH_NAVIGATION_OWNERSHIP.md

## Analysis of Current Implementation

### 1. The Source Code Duplication
Currently, the source code contains overlapping navigation responsibilities:
- **Login Page (`app/backoffice/login/page.tsx`)**: Has a `useEffect` that listens for successful authentication and performs `router.replace(nextUrl)`.
- **AuthGuard (`src/components/backoffice/AuthGuard.tsx`)**: Contains a specific block intercepting `pathname === '/backoffice/login'` that attempts to perform `router.replace('/backoffice')` if a `user` is detected.

### 2. The Runtime Reality (Dead Code)
Despite the duplication in the source code, **there is no duplication at runtime**. 

If we examine `src/components/backoffice/BackofficeLayoutWrapper.tsx`:
```tsx
const isLoginPage = pathname === "/backoffice/login";

return (
  <StaffAuthProvider>
    {isLoginPage ? (
      <div className="min-h-screen bg-slate-50 font-sans">{children}</div>
    ) : (
      <NotificationProvider>
        {/* ... */}
        <AuthGuard>
          {children}
        </AuthGuard>
      </NotificationProvider>
    )}
  </StaffAuthProvider>
)
```
Because the layout conditionally strips away the standard application shell (including `AuthGuard`) when `pathname` is `/backoffice/login`, **`AuthGuard` is never actually mounted when the user is on the login page.**

Therefore, the entire `if (pathname === '/backoffice/login')` block inside `AuthGuard` is completely unreachable dead code.

## Determinations

**Would removing the AuthGuard redirect on `/backoffice/login` break anything?**
Absolutely not. It is currently impossible for that block of code to execute. Removing it is 100% safe.

**Can Login Page become the single owner of post-login navigation?**
Yes. In reality, the Login Page is already the *only* component driving post-login navigation. By deleting the dead code in `AuthGuard`, the architectural ownership will become clean, explicit, and easy for future developers to understand.

## Recommendation
**Remove the dead code from AuthGuard.** Let the `BackofficeLogin` component retain exclusive ownership of post-login routing. `AuthGuard` should strictly operate as a route protector for authenticated pages, rather than attempting to route users away from public pages.
