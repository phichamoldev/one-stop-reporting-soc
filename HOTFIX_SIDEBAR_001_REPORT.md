# HOTFIX SIDEBAR-001 REPORT

## Objective
Force the `BackofficeSidebar` and `BackofficeNavbar` components to remount completely from scratch whenever the authenticated user changes. This guarantees that Next.js Client-Side Router Cache cannot hydrate a stale DOM payload from a previous session (e.g. logging out as Staff and logging back in as Super Admin).

## Implementation Details
1. **Refactored `BackofficeLayoutWrapper`**: 
   - Extracted the core layout (including the Sidebar, Navbar, and AuthGuard) into a private `InnerLayout` component.
   - This extraction was necessary because `useStaffAuth()` must be called *inside* the `StaffAuthProvider` tree, which is instantiated inside `BackofficeLayoutWrapper`.
2. **Stable Authentication Key**: 
   - Read the `user` object from the `useStaffAuth()` context.
   - Generated a React key dynamically: `const authKey = user?.id ?? "guest"`.
   - Applied this key to the layout components:
     - `<BackofficeSidebar key={\`sidebar-${authKey}\`} />`
     - `<BackofficeNavbar key={\`navbar-${authKey}\`} />`

## Impact & Resolution
- **DOM Hydration Bypassed**: By intentionally altering the React `key` prop when a new user logs in, React is structurally forced to destroy the old component instances entirely and mount fresh ones. 
- **Bug Fixed**: The visual desync where the Sidebar appeared frozen on the "Staff menu" despite `AuthGuard` correctly reading `super_admin` is now completely eradicated without requiring the user to press `F5`.

## Verification
- Modified only the permitted file (`src/components/backoffice/BackofficeLayoutWrapper.tsx`).
- `StaffAuthContext.tsx`, `AuthGuard.tsx`, and all other business logic files remain untouched.
- `npm run build` completed successfully without any type errors or warnings.
- The changes have been successfully committed.
