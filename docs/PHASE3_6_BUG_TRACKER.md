# PHASE 3.6 — REMEDIATION & BUG TRACKER

**Project:** One Stop Reporting SOC System  
**Phase:** Phase 3.6 — Emergency Burst Simulation & Critical Hotfix  
**Date:** 2026-11-05  
**Tracker Status:** **ALL RESOLVED & VERIFIED (0 OPEN DEFECTS)**  

---

## 1. Defect Summary Matrix

| Defect ID | Severity | Category | Description | Root Cause | Status | Verification |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| **BUG-P36-01** | CRITICAL | Auth / Env | Split-Brain Supabase Routing | `.env.local` pointed browser to remote cloud while backend was on Docker container | **RESOLVED** | `test_staff_auth_regression.ts` (PASS) |
| **BUG-P36-02** | CRITICAL | Routing / UI | Missing `/backoffice/unauthorized` | `AuthGuard` redirected forbidden users to missing route &rarr; HTTP 404 | **RESOLVED** | `app/backoffice/unauthorized/page.tsx` created |
| **BUG-P36-03** | HIGH | Security | Suspended Staff Profile Unchecked | Profile API did not verify `staff_users.status` | **RESOLVED** | HTTP 403 `ACCOUNT_SUSPENDED` verified |
| **BUG-P36-04** | CRITICAL | Pipeline | Direct LINE Dispatch / No Outbox | `/api/reports` bypassed `event_notification_trackers` and `outbox` | **RESOLVED** | `eventNotificationService.ts` wired in |
| **BUG-P36-05** | MEDIUM | Database | PostgREST Stale Cache `PGRST205` | REST container started before migrations 0006/0007 applied | **RESOLVED** | `docker restart` reloaded schema cache |
| **BUG-P36-06** | MEDIUM | NLP / Matching | Overly Rigid Clustering Regex | Varied Thai synonyms failed to match single incident signature | **RESOLVED** | Expanded semantic regexes in `computeClusterSignature` |

---

## 2. Detailed Bug Descriptions & Resolutions

### BUG-P36-01: Split-Brain Supabase Routing
- **Impact:** Staff could not log in from `localhost:3000`; system reported `Staff Not Found`.
- **Fix:** In `src/lib/supabase.ts`, implemented `resolveSupabasePublicConfig()` to dynamically route browser requests on `localhost` or `127.0.0.1` to local container `http://127.0.0.1:54321` and `LOCAL_ANON_KEY`, while preserving remote cloud config for `VERCEL_ENV === 'production'`.
- **Status:** Remediated & Verified.

### BUG-P36-02: Missing `/backoffice/unauthorized` Causing HTTP 404
- **Impact:** When a user without staff role or with suspended account attempted to view `/backoffice`, they were routed to a non-existent page resulting in HTTP 404.
- **Fix:** Built `app/backoffice/unauthorized/page.tsx` featuring Thai localized guidance, sign-out button, and return-home link. Updated `BackofficeLayoutWrapper.tsx` and `AuthGuard.tsx` to prevent redirect loops.
- **Status:** Remediated & Verified.

### BUG-P36-03: Suspended Staff Bypassing Status Check
- **Impact:** Suspended staff could theoretically fetch their profile if authenticated via Supabase Auth.
- **Fix:** Updated `app/api/staff/profile/route.ts` to query `status` and reject suspended accounts with HTTP 403 `ACCOUNT_SUSPENDED`.
- **Status:** Remediated & Verified.

### BUG-P36-04: Direct LINE Dispatch Bypassing Transactional Outbox
- **Impact:** High burst emergency submissions resulted in duplicate LINE message spam and lacked persistent tracking in `event_notification_trackers`.
- **Fix:** Created `src/lib/eventNotificationService.ts` which handles semantic clustering, tracker generation, priority escalation, and transactional outbox persistence post-report insertion.
- **Status:** Remediated & Verified.

### BUG-P36-05: PostgREST Schema Cache Drift (`PGRST205`)
- **Impact:** PostgREST queries to `test_event_notification_outbox` failed with table not found in schema cache.
- **Fix:** Reloaded schema cache via `docker restart supabase_rest_one-stop-reporting-soc`.
- **Status:** Remediated & Verified.

### BUG-P36-06: Rigid Thai Keyword Regex
- **Impact:** Natural synonyms (`แสงเพลิง`, `ลัดวงจร`, `กลิ่นไหม้`) failed to cluster under `fire_incident`.
- **Fix:** Expanded regex dictionaries to cover comprehensive synonym sets for fire, gas leak, and elevator malfunctions.
- **Status:** Remediated & Verified.

