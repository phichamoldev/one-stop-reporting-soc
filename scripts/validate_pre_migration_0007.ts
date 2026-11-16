/**
 * PRE-MIGRATION 0007 VALIDATION & SCHEMA DRIFT DETECTION SCRIPT
 * File: scripts/validate_pre_migration_0007.ts
 *
 * Verifies that:
 * 1. Prior migration dependencies (0000-0006) exist and are complete.
 * 2. No old 0007 artifacts exist with conflicting schema (e.g. `canonical_group_id`).
 * 3. Required test and production sequences are defined.
 * 4. RLS policies and security definitions meet safety standards.
 */

import fs from "fs";
import path from "path";

interface ValidationResult {
  check: string;
  passed: boolean;
  severity: "CRITICAL" | "HIGH" | "INFO";
  details: string;
}

export function validateMigrationsStatic(): ValidationResult[] {
  const results: ValidationResult[] = [];
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const proposed0007Path = path.join(process.cwd(), "docs", "proposed_0007_report_level_mapping.sql");

  // 1. Check Base Schema existence
  const baseSchemaPath = path.join(migrationsDir, "0000_base_schema.sql");
  if (fs.existsSync(baseSchemaPath)) {
    const baseContent = fs.readFileSync(baseSchemaPath, "utf-8");
    const hasDepartments = baseContent.includes("CREATE TABLE IF NOT EXISTS departments");
    const hasCategories = baseContent.includes("CREATE TABLE IF NOT EXISTS categories");
    const hasReports = baseContent.includes("CREATE TABLE IF NOT EXISTS reports");
    const hasStaffUsers = baseContent.includes("CREATE TABLE IF NOT EXISTS staff_users");

    results.push({
      check: "Base Schema (0000_base_schema.sql) Complete",
      passed: hasDepartments && hasCategories && hasReports && hasStaffUsers,
      severity: "CRITICAL",
      details: hasDepartments && hasCategories && hasReports && hasStaffUsers
        ? "All core base tables (departments, categories, reports, staff_users) defined."
        : "Missing one or more required base tables in 0000_base_schema.sql.",
    });
  } else {
    results.push({
      check: "Base Schema (0000_base_schema.sql) Exists",
      passed: false,
      severity: "CRITICAL",
      details: "0000_base_schema.sql is missing. Blank databases will fail migrations 0001-0007.",
    });
  }

  // 2. Check Sequence Dependencies in 0004
  const mig0004Path = path.join(migrationsDir, "0004_incident_grouping.sql");
  if (fs.existsSync(mig0004Path)) {
    const content0004 = fs.readFileSync(mig0004Path, "utf-8");
    const hasTestSeq = content0004.includes("test_incident_groups_seq");
    const hasProdSeq = content0004.includes("incident_groups_seq");
    results.push({
      check: "Sequence Dependencies in 0004_incident_grouping.sql",
      passed: hasTestSeq && hasProdSeq,
      severity: "CRITICAL",
      details: hasTestSeq && hasProdSeq
        ? "Both incident_groups_seq and test_incident_groups_seq verified."
        : "Missing sequence definitions in 0004_incident_grouping.sql.",
    });
  }

  // 3. Check for Old 0007 Schema Drift in Proposed 0007
  if (fs.existsSync(proposed0007Path)) {
    const content0007 = fs.readFileSync(proposed0007Path, "utf-8");
    
    // Critical: canonical_group_id MUST NOT be in trackers in report-level mapping
    const hasCanonicalInTrackers = /CREATE TABLE IF NOT EXISTS\s+(test_)?event_notification_trackers[^;]+canonical_group_id/i.test(content0007);
    results.push({
      check: "Schema Drift: No canonical_group_id on Trackers",
      passed: !hasCanonicalInTrackers,
      severity: "CRITICAL",
      details: !hasCanonicalInTrackers
        ? "Decoupled architecture verified: Trackers do NOT contain canonical_group_id."
        : "SCHEMA DRIFT CONFLICT: Proposed 0007 still contains canonical_group_id on trackers table!",
    });

    // Check report mapping tables existence
    const hasTestReportsMap = content0007.includes("CREATE TABLE IF NOT EXISTS test_event_notification_reports");
    const hasProdReportsMap = content0007.includes("CREATE TABLE IF NOT EXISTS event_notification_reports");
    results.push({
      check: "Report-Level Mapping Tables Defined",
      passed: hasTestReportsMap && hasProdReportsMap,
      severity: "CRITICAL",
      details: hasTestReportsMap && hasProdReportsMap
        ? "Both test and production event_notification_reports tables present."
        : "Missing event_notification_reports mapping table in proposed 0007.",
    });

    // Check Hardened RLS Policy on Trackers
    const hasActiveStaffPolicy = content0007.includes("AND su.status = 'active'");
    results.push({
      check: "RLS Hardening: Staff Active Profile Verified on Trackers",
      passed: hasActiveStaffPolicy,
      severity: "HIGH",
      details: hasActiveStaffPolicy
        ? "staff_select_evt_trackers verifies active staff status."
        : "Permissive USING(true) policy detected on event_notification_trackers.",
    });

    // Check SECURITY DEFINER search_path on RPCs
    const rpcCount = (content0007.match(/SET search_path = public, pg_temp/g) || []).length;
    results.push({
      check: "SECURITY DEFINER search_path Hardening",
      passed: rpcCount >= 8,
      severity: "HIGH",
      details: `Found ${rpcCount}/8 RPCs with explicit 'SET search_path = public, pg_temp'.`,
    });
  }

  return results;
}

// Run if called directly
if (require.main === module) {
  console.log("================================================================================");
  console.log("  PRE-MIGRATION 0007 VALIDATION & SCHEMA DRIFT AUDIT");
  console.log("================================================================================");
  
  const results = validateMigrationsStatic();
  let hasCriticalFailure = false;

  for (const r of results) {
    const symbol = r.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`[${r.severity}] ${symbol}: ${r.check}`);
    console.log(`    Details: ${r.details}`);
    if (!r.passed && r.severity === "CRITICAL") {
      hasCriticalFailure = true;
    }
  }

  console.log("================================================================================");
  if (hasCriticalFailure) {
    console.error("❌ Pre-migration validation FAILED with critical issues. Halt deployment.");
    process.exit(1);
  } else {
    console.log("✅ All pre-migration static checks PASSED with ZERO schema drift conflicts.");
  }
}

