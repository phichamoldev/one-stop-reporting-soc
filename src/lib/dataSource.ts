/**
 * Centralized Data Source Routing & Safety Guard
 * 
 * Production:
 *   - reports
 *   - report_logs
 * 
 * Localhost / Development:
 *   - test_reports
 *   - test_report_logs
 * 
 * Safety Guard:
 *   - Prevents Production (e.g. VERCEL_ENV === 'production') from ever pointing to test tables.
 *   - Fail-fast mechanism prevents accidental corruption or isolation leaks.
 *   - Does NOT allow client/URL parameter overrides (?table=...).
 */

export type ReportDataSource = 'production' | 'test';

export interface DataSourceConfig {
  source: ReportDataSource;
  reportsTable: 'reports' | 'test_reports';
  reportLogsTable: 'report_logs' | 'test_report_logs';
  incidentGroupsTable: 'incident_groups' | 'test_incident_groups';
  incidentGroupMembersTable: 'incident_group_members' | 'test_incident_group_members';
  incidentGroupHistoryTable: 'incident_group_history' | 'test_incident_group_history';
  notificationLogsTable: 'notification_logs' | 'test_notification_logs';
  eventTrackersTable: 'event_notification_trackers' | 'test_event_notification_trackers';
  eventReportsTable: 'event_notification_reports' | 'test_event_notification_reports';
  eventOutboxTable: 'event_notification_outbox' | 'test_event_notification_outbox';
  escalatePriorityRpc: 'escalate_event_priority' | 'test_escalate_event_priority';
  claimDigestRpc: 'claim_and_snapshot_digest' | 'test_claim_and_snapshot_digest';
  claimIncidentUpdateRpc: 'claim_tracker_incident_update' | 'test_claim_tracker_incident_update';
  claimNextIncidentUpdateRpc: 'claim_next_incident_update' | 'test_claim_next_incident_update';
  completeIncidentUpdateRpc: 'complete_incident_update' | 'test_complete_incident_update';
  incidentGroupPrefix: 'INC-' | 'INC-T-';
  isTest: boolean;
  isProduction: boolean;
}

export function getReportDataSource(): DataSourceConfig {
  const isVercelProd = process.env.VERCEL_ENV === 'production';
  const configured = (process.env.REPORT_DATA_SOURCE || '').toLowerCase().trim();

  // Safety Guard: In production deployment, NEVER allow test data source
  if (isVercelProd) {
    if (configured === 'test') {
      throw new Error(
        "FATAL PRODUCTION SAFETY ERROR: VERCEL_ENV is 'production' but REPORT_DATA_SOURCE is set to 'test'! Refusing to start or proceed."
      );
    }
    return {
      source: 'production',
      reportsTable: 'reports',
      reportLogsTable: 'report_logs',
      incidentGroupsTable: 'incident_groups',
      incidentGroupMembersTable: 'incident_group_members',
      incidentGroupHistoryTable: 'incident_group_history',
      notificationLogsTable: 'notification_logs',
      eventTrackersTable: 'event_notification_trackers',
      eventReportsTable: 'event_notification_reports',
      eventOutboxTable: 'event_notification_outbox',
      escalatePriorityRpc: 'escalate_event_priority',
      claimDigestRpc: 'claim_and_snapshot_digest',
      claimIncidentUpdateRpc: 'claim_tracker_incident_update',
      claimNextIncidentUpdateRpc: 'claim_next_incident_update',
      completeIncidentUpdateRpc: 'complete_incident_update',
      incidentGroupPrefix: 'INC-',
      isTest: false,
      isProduction: true,
    };
  }

  // Local / non-production environment: Check REPORT_DATA_SOURCE configuration
  // Fail-Closed: If REPORT_DATA_SOURCE is missing or empty, NEVER default to production tables
  if (!configured) {
    throw new Error(
      "FAIL-CLOSED SAFETY ERROR: REPORT_DATA_SOURCE is not set in non-production environment. " +
      "Refusing to default to production tables. Set REPORT_DATA_SOURCE='test' or 'production' explicitly."
    );
  }

  if (configured === 'test') {
    return {
      source: 'test',
      reportsTable: 'test_reports',
      reportLogsTable: 'test_report_logs',
      incidentGroupsTable: 'test_incident_groups',
      incidentGroupMembersTable: 'test_incident_group_members',
      incidentGroupHistoryTable: 'test_incident_group_history',
      notificationLogsTable: 'test_notification_logs',
      eventTrackersTable: 'test_event_notification_trackers',
      eventReportsTable: 'test_event_notification_reports',
      eventOutboxTable: 'test_event_notification_outbox',
      escalatePriorityRpc: 'test_escalate_event_priority',
      claimDigestRpc: 'test_claim_and_snapshot_digest',
      claimIncidentUpdateRpc: 'test_claim_tracker_incident_update',
      claimNextIncidentUpdateRpc: 'test_claim_next_incident_update',
      completeIncidentUpdateRpc: 'test_complete_incident_update',
      incidentGroupPrefix: 'INC-T-',
      isTest: true,
      isProduction: false,
    };
  }

  // Explicitly allow production only if deliberately set to 'production'
  if (configured === 'production') {
    return {
      source: 'production',
      reportsTable: 'reports',
      reportLogsTable: 'report_logs',
      incidentGroupsTable: 'incident_groups',
      incidentGroupMembersTable: 'incident_group_members',
      incidentGroupHistoryTable: 'incident_group_history',
      notificationLogsTable: 'notification_logs',
      eventTrackersTable: 'event_notification_trackers',
      eventReportsTable: 'event_notification_reports',
      eventOutboxTable: 'event_notification_outbox',
      escalatePriorityRpc: 'escalate_event_priority',
      claimDigestRpc: 'claim_and_snapshot_digest',
      claimIncidentUpdateRpc: 'claim_tracker_incident_update',
      claimNextIncidentUpdateRpc: 'claim_next_incident_update',
      completeIncidentUpdateRpc: 'complete_incident_update',
      incidentGroupPrefix: 'INC-',
      isTest: false,
      isProduction: true,
    };
  }

  // Fail-Closed: Reject unknown or invalid values
  throw new Error(
    `FAIL-CLOSED SAFETY ERROR: Invalid REPORT_DATA_SOURCE='${configured}'. Must be explicitly 'test' or 'production'.`
  );
}

