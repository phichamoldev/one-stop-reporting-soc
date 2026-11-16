# PHASE 3.7 — BUG TRACKER & REMEDIATION LOG
**Project:** One Stop Reporting SOC System  
**Date:** 2026-11-05  
**Version:** 1.0.0  
**Status:** ALL BUGS RESOLVED & VERIFIED

---

## 1. Summary of Discovered & Remediated Issues

| Bug ID | Severity | Category | Description | Resolution Status | Verified By |
|:---|:---:|:---|:---|:---:|:---:|
| **BUG-37-01** | CRITICAL | Taxonomy | Fire reports classified under Category 3 (Personnel/HR) instead of Category 4 (Safety). | **RESOLVED** | `test_phase3_7_classification.ts` (13/13 PASS) |
| **BUG-37-02** | HIGH | Notifications | Alert flooding: 30 reports within minutes sent 30 repetitive LINE messages. | **RESOLVED** | TC-01 to TC-05 (10/10 PASS) |
| **BUG-37-03** | HIGH | Concurrency | Burst reports updated `total_report_count` in memory concurrently, causing lost count increments. | **RESOLVED** | TC-02 (Count=15 exact) |
| **BUG-37-04** | MEDIUM | Scheduler | Periodic Update delta count included initial report (+15 instead of +14). | **RESOLVED** | TC-03 (Delta=+14 exact) |
| **BUG-37-05** | MEDIUM | Testing | Lingering open trackers from previous test runs caused new tests to match existing clusters. | **RESOLVED** | Setup test isolation step |
| **BUG-37-06** | LOW | Syntax | Syntax error (extra closing bracket) in `src/lib/line.ts` around line 134. | **RESOLVED** | Clean TypeScript compile |
| **BUG-37-07** | MEDIUM | Build | Next.js App Router Turbopack static/dynamic route verification. | **RESOLVED** | `npm run build` (Exit code 0) |

---

## 2. Detailed Bug Remediations

### BUG-37-01: Fire Reports Classified as Category 3 (Personnel & HR)
- **Root Cause:**
  - Local database `subcategories` table previously only had 6 test rows, where row 6 ("ไฟดับทั้งชั้น/อาคาร") was artificially placed under Category 3 ("บริหารงานบุคคล").
  - Test scripts and mock generators hardcoded `category_id: 3, subcategory_id: 6`.
  - Words like "นาย...", "นิสิต", "อาจารย์" biased heuristic models toward Personnel.
- **Remediation:**
  1. Synchronized all 56 canonical subcategories and 7 categories from remote Supabase into local Docker PostgreSQL with `OVERRIDING SYSTEM VALUE`. Subcategory 34 is now active under Category 4.
  2. Implemented `src/lib/taxonomyClassifier.ts` with comprehensive Thai regex patterns detecting fire, smoke, gas leaks, elevators, and injuries.
  3. Added an automatic Category 3 guard in `app/api/reports/route.ts` that intercepts and sanitizes any emergency report.
  4. Updated `src/lib/similarityDetector.ts` to strictly isolate emergency domains.
- **Verification:** All 13 test scenarios in `scripts/test_phase3_7_classification.ts` PASSED.

---

### BUG-37-02: Report-Based Alert Flooding During Emergency Bursts
- **Root Cause:** Previous architecture triggered an outbound LINE dispatch per citizen report. A burst of 30 reports flooded the staff LINE group with 30 identical notifications.
- **Remediation:**
  1. Re-architected system to **Incident-Based Notifications** (Stage A: First Alert immediately; Stage B: 30-min window with full DB persistence but suppressed LINE alerts; Stage C: Periodic update alert every 30 minutes).
  2. Added migration `0008_incident_30min_updates.sql` with atomic PostgreSQL RPCs.
  3. Integrated `src/lib/eventUpdateScheduler.ts` to handle background polling and dispatch.
- **Verification:** TC-01, TC-02, TC-03 passed with 14 burst reports suppressed and 1 summary update sent.

---

### BUG-37-03: In-Memory Race Condition on Total Report Count During Burst
- **Root Cause:** `processReportForEventNotification` updated `total_report_count` using in-memory state: `(activeTracker.total_report_count || 1) + 1`. During 14 simultaneous burst promises, all promises read `total_report_count = 1` and overwrote each other.
- **Remediation:** Changed `total_report_count` calculation to query the exact row count from `event_notification_reports` (`select('*', { count: 'exact', head: true })`).
- **Verification:** TC-02 verified `total_report_count = 15` after 1 initial + 14 concurrent burst reports.

---

### BUG-37-04: Periodic Update Delta Included First Alert Report
- **Root Cause:** When a new tracker was created, the initial report was linked to `event_notification_reports` with `digest_sequence = NULL`. At the 30-minute mark, the query for unnotified reports (`WHERE digest_sequence IS NULL`) counted the initial report again, showing `Delta: +15` instead of `Delta: +14`.
- **Remediation:** Initial report is registered with `digest_sequence = isEmergency ? 1 : null` when the tracker is created.
- **Verification:** TC-03 verified `totalReportCount = 15, newReportCount = 14`.

---

### BUG-37-05: Lingering Test Trackers Causing Test Inter-Dependency
- **Root Cause:** Completed test runs left trackers in `AGGREGATING` state. Subsequent test runs matched those open trackers instead of creating fresh incidents.
- **Remediation:** Added test database table isolation at the start of `scripts/test_phase3_7_suite.ts`.
- **Verification:** Full suite executes deterministically 10/10 PASS on repeated runs.

---

### BUG-37-06 & BUG-37-07: Syntax and Production Build Verification
- **Root Cause:** A misplaced closing brace occurred in `src/lib/line.ts` during event whitelist additions.
- **Remediation:** Fixed syntax error, recompiled with Turbopack, and ran `npm run build`.
- **Verification:** `npm run build` compiled 19 static pages and all dynamic routes with exit code 0.

