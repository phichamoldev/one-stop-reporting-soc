# PHASE 3.6 — ROOT CAUSE ANALYSIS REPORT (RCA)

**Project:** One Stop Reporting SOC System  
**Phase:** Phase 3.6 — Emergency Burst Simulation & Full-System Integration  
**Date:** 2026-11-05  
**Status:** **CLOSED & REMEDIATED**  

---

## 1. Overview & Problem Definition

During high-volume emergency burst scenarios (e.g., campus fires, gas leaks, structural/elevator failures), multiple citizens submit reports simultaneously within brief time windows. Prior to Phase 3.6 remediation, the system exhibited several architectural vulnerabilities:
1. **Direct LINE Dispatch without Transactional Outbox:** Individual reports made direct external HTTP calls to the LINE Messaging API synchronously during HTTP request handling.
2. **Notification Flooding:** Because each report triggered its own notification, an emergency event with 30 reports would send 30 identical push messages to the response team.
3. **Split-Brain Database Configuration:** Environment variables routed client-side auth to remote cloud Supabase while persistence and migrations ran on the local Docker container.
4. **PostgREST Schema Cache Drift:** Newly applied schema migrations (0004-0007) were rejected with `PGRST205` until PostgREST container cache was reloaded.

---

## 2. Detailed Root Cause Analysis

### RCA-1: Missing Transactional Outbox & Event Grouping in Citizen Submission API
- **Symptom:** Reports submitted via `POST /api/reports` were immediately calling `notifyLine()` in an un-batched, un-clustered manner.
- **Root Cause:** The `POST /api/reports` route handler lacked integration with `event_notification_trackers` and `event_notification_outbox`.
- **Impact:**
  - Emergency burst reports bypassed deduplication logic.
  - Failures in the external LINE API could block or fail report creation.
  - Duplicate suppression was non-existent.
- **Remediation:**
  - Implemented `eventNotificationService.ts` containing `processReportForEventNotification()`.
  - Wired `processReportForEventNotification()` into `app/api/reports/route.ts` immediately following successful database persistence of the report.
  - Report persistence is strictly committed *before* outbox insertion, adhering to the Transactional Outbox pattern.

### RCA-2: Split-Brain Supabase Routing & Staff Auth 404
- **Symptom:** Browser authentication on `localhost:3000` failed to access `/backoffice` (rendered 404) and rejected staff with "Staff Not Found".
- **Root Cause:**
  - `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` pointed to remote cloud Supabase, causing browser client to request tokens from cloud Supabase.
  - Backend database was local Docker container (`http://127.0.0.1:54321`), where remote user IDs did not exist in `staff_users`.
  - `AuthGuard.tsx` redirected forbidden users to `/backoffice/unauthorized`, which did not exist, causing Next.js router to return HTTP 404.
- **Remediation:**
  - Updated `src/lib/supabase.ts` to automatically detect localhost browser sessions and route to `127.0.0.1:54321` and `LOCAL_ANON_KEY`.
  - Updated `src/lib/auth-helpers.ts` to use `supabaseAdmin.auth.getUser(token)`.
  - Created `app/backoffice/unauthorized/page.tsx`.

### RCA-3: Semantic Clustering Keyword Brittleness
- **Symptom:** Natural Thai descriptions describing the same incident with varied terminology (e.g. `แสงเพลิง`, `ประกายไฟ`, `กลุ่มควันดำ`, `ลัดวงจร`) failed to cluster under the same tracker signature.
- **Root Cause:** `computeClusterSignature()` originally looked for exact string matches like `ไฟไหม้` only.
- **Remediation:**
  - Expanded regex patterns in `computeClusterSignature()` to recognize broad semantic synonym clusters:
    - Fire: `/ไฟไหม้|เพลิงไหม้|ควัน|เปลวไฟ|กลิ่นไหม้|ประกายไฟ|แสงเพลิง|ลัดวงจร|ไฟลุก|ดับเพลิง|ไหม้/i`
    - Gas Leak: `/แก๊ส|ก๊าซ|กลิ่นแก๊ส|แก๊สรั่ว|ถังก๊าซ|ท่อแก๊ส/i`
    - Elevator: `/ลิฟต์|ลิฟท์|elevator|lift|ติดในลิฟต์|ลิฟต์ค้าง|ลิฟต์เสีย/i`
  - Normalized locations by stripping building prefix variations (`อาคาร`, `ตึก`).

### RCA-4: PostgREST Schema Cache Invalidation (`PGRST205`)
- **Symptom:** Queries to `test_event_notification_outbox` failed with `PGRST205: Could not find the table 'test_event_notification_outbox' in the schema cache`.
- **Root Cause:** The `supabase_rest_one-stop-reporting-soc` Docker container loaded schema cache at container startup, before migrations 0006 and 0007 were applied.
- **Remediation:**
  - Executed `docker restart supabase_rest_one-stop-reporting-soc` to reload schema cache.
  - Verified all 8 tables and RPC functions are recognized and accessible.

---

## 3. Preventative Safeguards Implemented

| Safeguard ID | Description | Mechanism |
| :--- | :--- | :--- |
| **SG-01** | Test Isolation Gate | Client and server strictly reject production Group ID (`C755...77b0`) in test mode. |
| **SG-02** | Transactional Order | Report saved to DB first &rarr; Cluster matched &rarr; Outbox job created &rarr; LINE notified. |
| **SG-03** | Priority Escalation | When normal report escalates to emergency, `escalate_tracker_priority` RPC triggers alert. |
| **SG-04** | Duplicate Suppression | Once first alert is sent, duplicate emergency reports within 60 min are suppressed. |
| **SG-05** | Fallback Prohibition | If test destination is unverified, system blocks delivery rather than falling back. |

