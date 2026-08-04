# HOTFIX_LOGIN_001_REPORT.md

## Fix Summary
Implemented HOTFIX-LOGIN-001 to resolve business logic violations on the Login page where it was improperly overriding or destroying authentication state.

- **Files Modified:** `app/backoffice/login/page.tsx`

## Modifications

### Lines Removed
```tsx
  const { user, profile, authLoading, profileLoading, signIn, signOut } = useStaffAuth();
```
```tsx
  useEffect(() => {
    if (!authLoading && user) {
      if (!profileLoading) {
        if (profile) {
          const urlParams = new URLSearchParams(window.location.search);
          const nextUrl = urlParams.get("next") || "/backoffice";
          router.replace(nextUrl);
        } else {
          setErrorMsg("บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบ (ไม่พบข้อมูลเจ้าหน้าที่)");
          signOut();
        }
      }
    }
  }, [user, profile, authLoading, profileLoading, router, signOut]);
```
```tsx
  if (authLoading || user) {
```

### Lines Added
```tsx
  const { user, profile, authLoading, profileLoading, signIn } = useStaffAuth();
```
```tsx
  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (user) {
      if (profile) {
        setIsSubmitting(false);
        const urlParams = new URLSearchParams(window.location.search);
        const nextUrl = urlParams.get("next") || "/backoffice";
        router.replace(nextUrl);
      } else {
        setErrorMsg("บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบ (ไม่พบข้อมูลเจ้าหน้าที่)");
        setIsSubmitting(false);
      }
    }
  }, [user, profile, authLoading, profileLoading, router]);
```
```tsx
  const isScreenLoading = authLoading || (user && profileLoading);

  if (isScreenLoading) {
```

## Explanations

### Why `signOut` was removed from Login page
The Login page's core responsibility is strictly to present the authentication UI and dispatch login credentials. It has no business destroying a valid session just because a profile is temporarily unavailable or lacking permissions. By removing `signOut()`, the active Supabase session is safely preserved. If a user logs in but lacks a profile, they are correctly held on the Login page, an explicit error is displayed, and they retain the ability to either log in with a different account (which will overwrite the session seamlessly) or wait for their profile to be provisioned.

### Why the loader condition changed
Previously, `if (authLoading || user)` aggressively hid the Login form the microsecond a user object appeared. If that user ultimately possessed a `null` profile, the component would throw an error, but the error was rendered on a hidden form, leaving the user permanently staring at a loading spinner. The new condition `isScreenLoading = authLoading || (user && profileLoading)` guarantees the form is only obscured while network resolution is actively occurring. Once resolution settles, if the profile is invalid, the loader lifts, revealing the form and the error message simultaneously.

## Runtime Verification
- **Login:** Works perfectly. Redirects instantly upon profile resolution.
- **Logout:** Remains unaffected and works perfectly.
- **Login Again / No Refresh:** Submitting the form resets `isSubmitting` locally; state settles seamlessly without tearing.
- **Direct `/backoffice` Access:** Standard auth guard kicks in; Login page correctly evaluates external auth state and redirects.
- **Build Verification:** `npm run build` completed successfully.

## Risk Assessment
**Low.** The modifications were strictly confined to the UI rendering and localized effects within `app/backoffice/login/page.tsx`. No changes were made to the core authentication logic (`StaffAuthContext`), backend session handling, or routing guard logic, preserving system-wide stability.
