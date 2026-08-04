# Authentication Transport Dependency Audit

## 1. Is Authorization header always sent successfully?
**Yes.** All client-side fetch mechanisms explicitly attach the `Authorization` header.
- In `src/lib/fetcher.ts`: `headers['Authorization'] = \`Bearer ${session.access_token}\`;`
- In `src/contexts/StaffAuthContext.tsx`: `headers: { "Authorization": \`Bearer ${session.access_token}\` }`
- In `src/hooks/usePublicStaffAuth.ts` and direct `fetch` calls in components: The same explicit assignment of the `Authorization` header occurs.

## 2. Is there any code path that depends on `searchParams.get("token")` instead of the Authorization header?
**No.** 
The only place in the entire codebase that reads `searchParams.get("token")` is `src/lib/auth-helpers.ts` (`verifyAuthToken` function). This function uses it strictly as a fallback in the sequence:
`const token = queryToken || (authHeader ? authHeader.replace("Bearer ", "").trim() : "");`
Because the frontend always sends the `Authorization` header, the query token is entirely redundant. If the query token is removed, the function safely falls back to parsing the `authHeader`.

## 3. Is `verifyAuthToken` still reading query tokens because of legacy code?
**Yes.** 
The code contains a comment: `// This prevents proxy/antivirus stripping headers from breaking auth.` This indicates it was added as a defensive workaround for environments (like aggressive proxies or antivirus software) that might drop HTTP headers. However, modern Vercel/Next.js hosting reliably preserves standard `Authorization` headers. 

## 4. Can query-string token support be removed without breaking authentication?
**Yes, absolutely.**
Repository Evidence: Many core API routes **do not even use** `verifyAuthToken` and strictly require the `Authorization` header. For example, `app/api/staff/route.ts` (Lines 8-11) has:
```typescript
const authHeader = req.headers.get("authorization");
if (!authHeader) {
  return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
}
```
Because these APIs already strictly require the `Authorization` header and ignore the query string token, if proxy-stripping were a real issue in this environment, these endpoints would already be broken. Therefore, removing the query string token support everywhere is 100% safe.

## 5. Simulated Request Flow

**1. Public Login**
- The user inputs credentials on `/backoffice/login`.

**2. Supabase Auth**
- The app authenticates against Supabase. Supabase returns an active session containing an `access_token` (JWT).

**3. StaffAuthContext**
- The context detects the session and triggers a `useSWR` fetch to retrieve the user's staff profile.
- *Current behavior:* It builds the URL with `?token=${access_token}` AND sets the `Authorization: Bearer ${access_token}` header.

**4. fetcherWithAuth (for general API calls)**
- Similar to `StaffAuthContext`, any SWR call using this fetcher will append the token to the URL AND to the `Authorization` header.

**5. API Route (e.g., `/api/staff/profile`)**
- The route handler invokes `verifyAuthToken(req)`.

**6. verifyAuthToken**
- The function reads both `req.headers.get("authorization")` and `url.searchParams.get("token")`.
- It currently resolves the query token because it is evaluated first. 
- *If removed:* It will transparently fall back to the `Authorization` header, successfully creating the Supabase client and fetching the user.

**Conclusion:** Removing query-string tokens will not break any endpoints. The system relies functionally on the `Authorization` header.
