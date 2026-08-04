# API URL Token Audit

## 1. File: `src/lib/fetcher.ts`
- **Function:** `fetcherWithAuth`
- **API Endpoint:** Any endpoint called using this fetcher function.
- **Why token is appended to URL:** The code explicitly states: `// Append token to URL to bypass proxies/antivirus stripping headers`.
- **Safe or Unsafe:** **Unsafe.** Appending a sensitive JWT access token to the URL exposes it to web server access logs, proxy logs, router logs, browser history, and potentially HTTP Referer headers. 

## 2. File: `src/contexts/StaffAuthContext.tsx`
- **Function:** `fetch` callback inside `useSWR(user ? "/api/staff/profile?v=2" : null, ...)`
- **API Endpoint:** `/api/staff/profile?v=2`
- **Why token is appended to URL:** The code comments indicate: `// Send token in BOTH header and query string to bypass proxies/antivirus stripping headers`.
- **Safe or Unsafe:** **Unsafe.** As with the generic fetcher, appending the user's Supabase session token to the query string causes it to be recorded in plain text in all intervening network logs and server access logs.

## 3. File: `src/lib/auth-helpers.ts` (Consumer)
- **Function:** `verifyAuthToken`
- **API Endpoint:** All protected backoffice API routes.
- **Why token is consumed from URL:** It extracts the token using `url.searchParams.get("token")` as a fallback if the `Authorization` header is stripped.
- **Safe or Unsafe:** **Unsafe.** While it merely reads the token, supporting this fallback mechanism encourages and facilitates the insecure practice of sending tokens in URLs.

READY FOR SAFE FIX
