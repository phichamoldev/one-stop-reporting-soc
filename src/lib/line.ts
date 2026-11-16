export interface LineNotificationResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
  blocked?: boolean;
  status?: 'sent' | 'failed' | 'skipped' | 'blocked';
  attempts?: number;
  logId?: string;
}

export interface LineNotificationPayload {
  publicId: string;
  categoryName: string;
  subcategoryName: string;
  description: string;
  location: string;
  date: string;
  statusText?: string;
  reporterName?: string;
  isTransfer?: boolean;
  oldDepartmentName?: string;
  transferRemark?: string;
  priority?: 'emergency' | 'normal' | 'needs_review';
  priorityReason?: string;
  notificationType?: 'normal_alert' | 'periodic_update' | 'new_report' | 'first_alert' | 'escalation_alert' | 'digest';
  eventCode?: string;
  totalReportCount?: number;
  newReportCount?: number;
  customActionUrl?: string;
  customActionLabel?: string;
}

import { STATUS_DETAILS, ReportStatus } from "@/types/report";
import { getReportDataSource } from "@/lib/dataSource";
import {
  recordNotificationLog,
  maskDestination,
  acquireNotificationLease,
  releaseNotificationLease,
} from "@/lib/notificationLogger";

export type LineNotificationEvent =
  | 'normal_alert'
  | 'periodic_update'
  | 'new_report'
  | 'escalation_alert'
  | 'digest'
  | 'status_change'
  | 'bulk_status_change'
  | 'bulk_reply'
  | 'transfer'
  | 'incident_grouping'
  | 'confirm_incident_group'
  | 'reject_incident_group'
  | 'test_endpoint';

export interface NotifyLineOptions {
  event: LineNotificationEvent;
  reportId?: string | null;
  idempotencyKey?: string | null;
  maxRetries?: number;
}

// In-memory idempotency deduplication cache (5 minutes TTL)
const notifiedNewReports = new Map<string, number>();

// In-memory active in-flight request lock to prevent concurrent duplicates
const activeInFlightKeys = new Set<string>();

/**
 * Event-based Policy for Outbound LINE Notifications
 * 
 * Rules:
 * 1. 'new_report', 'periodic_update', 'escalation_alert':
 *    - Allowed on Localhost/Test: Destination MUST be verified SOC TEST group (never Production group).
 *    - Allowed on Production: Destination is mapped to the responsible production department group.
 * 2. 'status_change', 'bulk_status_change', 'bulk_reply', 'transfer', 'incident_grouping',
 *    'confirm_incident_group', 'reject_incident_group':
 *    - STRICTLY PROHIBITED in ALL environments (Localhost, Test, and Production). No exceptions.
 * 3. 'test_endpoint':
 *    - Prohibited by default unless LINE_ALLOW_TEST_ENDPOINTS === 'true'.
 * 4. Missing or Unknown Events:
 *    - STRICTLY PROHIBITED (Fail-Closed). Zero network requests.
 */
export function isLineEventAllowed(event?: LineNotificationEvent): {
  allowed: boolean;
  reason?: string;
} {
  // Fail-Closed: Missing or empty event is strictly blocked
  if (!event || typeof event !== 'string' || event.trim() === '') {
    return {
      allowed: false,
      reason: "LINE notification blocked: Missing mandatory event parameter (Fail-Closed policy enforced)",
    };
  }

  // Deprecated/removed events in Phase 3.8: escalation_alert and digest
  if (event === 'escalation_alert' || event === 'digest') {
    return {
      allowed: false,
      reason: `LINE notification event '${event}' was removed in Phase 3.8 (Only 'normal_alert' and 'periodic_update' are permitted)`,
    };
  }

  // Disallowed events (Zero tolerance across all environments: Localhost and Production)
  if (
    event === 'status_change' ||
    event === 'bulk_status_change' ||
    event === 'bulk_reply' ||
    event === 'transfer' ||
    event === 'incident_grouping' ||
    event === 'confirm_incident_group' ||
    event === 'reject_incident_group'
  ) {
    return {
      allowed: false,
      reason: `LINE notification prohibited by event policy for event '${event}' (Status updates, replies & grouping never send LINE)`,
    };
  }

  // Test endpoints
  if (event === 'test_endpoint') {
    if (process.env.LINE_ALLOW_TEST_ENDPOINTS !== 'true') {
      return {
        allowed: false,
        reason: "Test endpoints LINE dispatch is disabled by default",
      };
    }
    return { allowed: true };
  }

  // Allowed active events: normal_alert (or new_report alias) and periodic_update
  if (event === 'normal_alert' || event === 'new_report' || event === 'periodic_update') {
    if (process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED === 'false') {
      return {
        allowed: false,
        reason: `${event} LINE notifications explicitly disabled by LINE_NEW_REPORT_NOTIFICATIONS_ENABLED=false`,
      };
    }

    if (process.env.LINE_NOTIFICATIONS_ENABLED === 'false' && process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED !== 'true') {
      return {
        allowed: false,
        reason: "LINE notifications disabled by environment (LINE_NOTIFICATIONS_ENABLED=false)",
      };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: `Unknown event type '${event}' (Fail-Closed policy enforced)` };
}

/**
 * Resolves an action URL safe for LINE dispatch:
 * Strictly converts localhost/127.0.0.1 URLs into publicly accessible production URLs.
 */
export function resolvePublicActionUrl(url?: string | null, fallbackPath: string = ""): string {
  const prodBase = "https://supportsoc.vercel.app";
  let targetUrl = url;

  if (!targetUrl) {
    const configuredBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    targetUrl = configuredBase ? `${configuredBase}${fallbackPath.startsWith('/') ? '' : '/'}${fallbackPath}` : `${prodBase}${fallbackPath.startsWith('/') ? '' : '/'}${fallbackPath}`;
  }

  // Strictly enforce: Never send localhost or 127.0.0.1 URLs to LINE!
  if (/^https?:\/\/localhost(:\d+)?/i.test(targetUrl) || /^https?:\/\/127\.0\.0\.1(:\d+)?/i.test(targetUrl)) {
    targetUrl = targetUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, prodBase);
  }

  return targetUrl;
}

/**
 * Helper to check if notification is enabled for a specific event
 */
export function isLineNotificationEnabled(event?: LineNotificationEvent): boolean {
  if (!event) return false;
  return isLineEventAllowed(event).allowed;
}

/**
 * Validates the target LINE group for test/non-production environments.
 * 
 * Safety Guard:
 * In test environments, outbound LINE notifications may NEVER be sent to production LINE groups.
 * Must strictly match the verified 'soc-test' group ID from the test database/environment.
 * If there is any mismatch, missing ID, or production ID, fail closed!
 */
export function validateTestLineDestination(
  targetGroupId: string | null | undefined,
  isTestEnv: boolean = getReportDataSource().isTest
): {
  isValid: boolean;
  reason?: string;
} {
  // In production mode:
  if (!isTestEnv) {
    if (!targetGroupId) {
      return { isValid: false, reason: "Missing target LINE group ID in production environment" };
    }
    // Fail-Closed: if LINE_TEST_GROUP_ID is not set, skip the reverse-guard check
    // (cannot verify test group without configuration — do not hardcode secrets)
    const testGroupId = process.env.LINE_TEST_GROUP_ID;
    if (testGroupId && targetGroupId === testGroupId) {
      return { isValid: false, reason: "Attempted to send to Test LINE group in production environment (STRICTLY PROHIBITED)" };
    }
    return { isValid: true };
  }

  // In test mode:
  if (!targetGroupId) {
    return { isValid: false, reason: "Missing target LINE group ID in test environment" };
  }

  const prodGroupId = process.env.LINE_GROUP_ID;
  if (prodGroupId && targetGroupId === prodGroupId) {
    return { isValid: false, reason: "Target LINE group matches production group ID in test environment (STRICTLY PROHIBITED)" };
  }

  // Fail-Closed: LINE_TEST_GROUP_ID must be explicitly configured — no hardcoded fallback
  // If missing, we cannot verify the destination is safe → reject immediately
  const configuredTestGroupId = process.env.LINE_TEST_GROUP_ID;
  if (!configuredTestGroupId) {
    return {
      isValid: false,
      reason: "LINE_TEST_GROUP_ID is not configured — cannot verify test destination (Fail-Closed: refusing to send to unverified group)"
    };
  }
  if (targetGroupId !== configuredTestGroupId) {
    return {
      isValid: false,
      reason: `Target LINE group '${maskDestination(targetGroupId)}' does not match verified SOC TEST group '${maskDestination(configuredTestGroupId)}'`
    };
  }

  return { isValid: true };
}

export const validateLineDestination = validateTestLineDestination;

/**
 * Sends a message using the LINE Messaging API.
 * Uses the push endpoint to send a notification to a specific group.
 * 
 * FAIL-CLOSED: options.event is strictly mandatory. If missing or invalid, blocks immediately.
 * Features:
 * - Policy validation
 * - Test/Production destination safety isolation
 * - Concurrency lock & Idempotency deduplication
 * - Safe bounded retry for transient 5xx errors (non-retryable on 4xx)
 * - Structured audit logging (recordNotificationLog)
 */
export async function notifyLine(
  message: string | LineNotificationPayload,
  customGroupId: string | null | undefined,
  options: NotifyLineOptions
): Promise<LineNotificationResult> {
  const event = options?.event;
  const publicId = typeof message !== 'string' ? message.publicId : null;
  const reportId = options?.reportId || null;
  const dataSource = getReportDataSource();
  const environment = dataSource.isTest ? 'test' : 'production';

  // 1. FAIL-CLOSED EVENT POLICY GATEKEEPER
  if (!event) {
    console.warn("LINE notification blocked: Missing mandatory options.event parameter (Fail-Closed policy enforced)");
    const blockedReason = "LINE notification blocked: Missing mandatory options.event parameter (Fail-Closed policy enforced)";
    await recordNotificationLog({
      event_type: 'unknown',
      report_id: reportId,
      public_id: publicId,
      destination: customGroupId || 'UNRESOLVED',
      environment,
      status: 'blocked',
      attempt_count: 0,
      error_code: 'MISSING_EVENT_PARAM',
      error_message: blockedReason,
    });

    return {
      success: false,
      blocked: true,
      error: blockedReason,
      skipped: true,
      status: 'blocked',
    };
  }

  const eventCheck = isLineEventAllowed(event);
  if (!eventCheck.allowed) {
    console.log(`LINE notification skipped: ${eventCheck.reason}`);
    await recordNotificationLog({
      event_type: event,
      report_id: reportId,
      public_id: publicId,
      destination: customGroupId || 'UNRESOLVED',
      environment,
      status: 'blocked',
      attempt_count: 0,
      error_code: 'EVENT_POLICY_PROHIBITED',
      error_message: eventCheck.reason,
    });

    return {
      success: false,
      blocked: true,
      error: `LINE notification skipped: ${eventCheck.reason}`,
      skipped: true,
      status: 'blocked',
    };
  }

  // 2. TARGET GROUP & ENVIRONMENT SAFETY CHECK (Fail Closed)
  if (!customGroupId || !customGroupId.trim()) {
    console.warn("LINE notification blocked: Missing destination target group ID");
    await recordNotificationLog({
      event_type: event,
      report_id: reportId,
      public_id: publicId,
      destination: 'MISSING',
      environment,
      status: 'blocked',
      attempt_count: 0,
      error_code: 'MISSING_DESTINATION',
      error_message: "Missing target LINE destination group ID (Fail-Closed enforced)",
    });

    return {
      success: false,
      blocked: true,
      error: "Missing target LINE destination group ID",
      skipped: true,
      status: 'blocked',
    };
  }

  const groupId: string = customGroupId.trim();

  if (dataSource.isTest) {
    const validation = validateTestLineDestination(groupId);
    if (!validation.isValid) {
      console.warn(`LINE notification blocked: ${validation.reason}`);
      await recordNotificationLog({
        event_type: event,
        report_id: reportId,
        public_id: publicId,
        destination: groupId || 'INVALID',
        environment,
        status: 'blocked',
        attempt_count: 0,
        error_code: 'TEST_DESTINATION_MISMATCH',
        error_message: validation.reason,
      });

      return {
        success: false,
        blocked: true,
        error: `LINE notification blocked: ${validation.reason}`,
        skipped: true,
        status: 'blocked',
      };
    }
  } else {
    // In production environment:
    const validation = validateTestLineDestination(groupId);
    if (!validation.isValid) {
      console.warn(`LINE notification blocked: ${validation.reason}`);
      await recordNotificationLog({
        event_type: event,
        report_id: reportId,
        public_id: publicId,
        destination: groupId || 'INVALID',
        environment,
        status: 'blocked',
        attempt_count: 0,
        error_code: 'PROD_DESTINATION_MISMATCH',
        error_message: validation.reason,
      });

      return {
        success: false,
        blocked: true,
        error: `LINE notification blocked: ${validation.reason}`,
        skipped: true,
        status: 'blocked',
      };
    }
  }

  // 3. IDEMPOTENCY / DEDUPLICATION GUARD (Distributed & Local)
  const dedupKey = options.idempotencyKey || (publicId ? `evt_${event}_${publicId}` : null);

  if (dedupKey) {
    const lease = await acquireNotificationLease({
      idempotencyKey: dedupKey,
      eventType: event,
      reportId: reportId || null,
      publicId: publicId || null,
      destination: groupId,
      environment,
    });

    if (!lease.acquired) {
      if (lease.status === 'in_flight') {
        console.log(`LINE notification skipped: concurrent request already in flight for ${dedupKey}`);
        await recordNotificationLog({
          event_type: event,
          report_id: reportId,
          public_id: publicId,
          destination: groupId,
          environment,
          status: 'skipped',
          attempt_count: 0,
          error_code: 'CONCURRENT_REQUEST_DEDUPLICATED',
          error_message: lease.reason || "Concurrent notification in progress (deduplicated)",
          idempotency_key: dedupKey,
        });

        return {
          success: true,
          error: "Concurrent notification in progress (deduplicated)",
          skipped: true,
          status: 'skipped',
        };
      }

      if (lease.status === 'already_sent') {
        console.log(`LINE notification skipped: ${dedupKey} already notified within 5 minutes`);
        await recordNotificationLog({
          event_type: event,
          report_id: reportId,
          public_id: publicId,
          destination: groupId,
          environment,
          status: 'skipped',
          attempt_count: 0,
          error_code: 'RECENTLY_NOTIFIED_IDEMPOTENT',
          error_message: lease.reason || "Already notified recently (idempotent)",
          idempotency_key: dedupKey,
        });

        return {
          success: true,
          error: "Already notified recently (idempotent)",
          skipped: true,
          status: 'skipped',
        };
      }

      if (lease.status === 'uncertain_delivery') {
        console.warn(`LINE notification skipped: ${dedupKey} uncertain delivery state - retry suppressed to avoid duplicate`);
        await recordNotificationLog({
          event_type: event,
          report_id: reportId,
          public_id: publicId,
          destination: groupId,
          environment,
          status: 'failed',
          attempt_count: 0,
          error_code: 'UNCERTAIN_DELIVERY',
          error_message: lease.reason || "Previous attempt abandoned in flight (retry suppressed to prevent duplication)",
          idempotency_key: dedupKey,
        });

        return {
          success: false,
          error: lease.reason || "Previous in-flight dispatch abandoned; retry suppressed to prevent duplication",
          skipped: true,
          status: 'failed',
        };
      }

      return {
        success: false,
        error: lease.reason || "Idempotency lease could not be acquired",
        skipped: true,
        status: 'failed',
      };
    }
  }

  // 4. TOKEN VERIFICATION
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("LINE notification skipped: LINE_CHANNEL_ACCESS_TOKEN is missing");
    await recordNotificationLog({
      event_type: event,
      report_id: reportId,
      public_id: publicId,
      destination: groupId,
      environment,
      status: 'failed',
      attempt_count: 0,
      error_code: 'MISSING_ACCESS_TOKEN',
      error_message: "LINE_CHANNEL_ACCESS_TOKEN is missing",
      idempotency_key: dedupKey,
    });

    return {
      success: false,
      error: "LINE_CHANNEL_ACCESS_TOKEN is missing",
      skipped: true,
      status: 'failed',
    };
  }

  console.log("LINE destination target group verified for event:", event, "environment:", dataSource.source);

  // 5. MESSAGE CONSTRUCTION (Flex Message Builder)
  let lineMessages: Record<string, unknown>[] = [];

  let payload: LineNotificationPayload | null = null;
  if (typeof message === "string") {
    // If a string is passed for an event that requires a Flex Message, convert into a standard Flex payload
    if (event === 'normal_alert' || event === 'new_report' || event === 'periodic_update') {
      const isEmerg = event === 'periodic_update' || /ฉุกเฉิน|ไฟไหม้|ควัน/i.test(message);
      payload = {
        publicId: options.reportId || "SOC-ALERT",
        categoryName: "ระบบแจ้งเหตุ ONE STOP SERVICE",
        subcategoryName: event === 'periodic_update' ? "อัปเดตสถานการณ์" : "แจ้งเตือนคำร้อง",
        description: message,
        location: "-",
        date: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        statusText: isEmerg ? "in_progress" : "pending",
        priority: isEmerg ? "emergency" : "normal",
        notificationType: event === 'periodic_update' ? 'periodic_update' : 'normal_alert',
      };
    } else {
      lineMessages = [
        {
          type: "text",
          text: message
        }
      ];
    }
  } else {
    payload = message;
  }

  if (payload) {
    const statusText = (payload.statusText || "pending") as ReportStatus;
    
    // Default mapped status
    let mappedStatus = `🟡 ${STATUS_DETAILS.pending.label}`;
    
    if (statusText === "pending") {
      mappedStatus = `🟡 ${STATUS_DETAILS.pending.label}`;
    } else if (statusText === "received") {
      mappedStatus = `🟡 ${STATUS_DETAILS.received.label}`;
    } else if (statusText === "in_progress") {
      mappedStatus = `🔵 ${STATUS_DETAILS.in_progress.label}`;
    } else if (statusText === "completed") {
      mappedStatus = `🟢 ${STATUS_DETAILS.completed.label}`;
    } else if (statusText === "rejected") {
      mappedStatus = `🔴 ${STATUS_DETAILS.rejected.label}`;
    } else if (statusText === "cancelled") {
      mappedStatus = `⚫ ${STATUS_DETAILS.cancelled.label}`;
    }

    const isPeriodicUpdate = payload.notificationType === 'periodic_update' || event === 'periodic_update';
    const isTransfer = payload.isTransfer;
    const isEmergency = payload.priority === 'emergency' || isPeriodicUpdate;
    const isNeedsReview = payload.priority === 'needs_review';

    let headerColor = "#D1350F";
    let headerText = "ONE STOP SERVICE";
    let altText = `🔔 มีคำร้องใหม่: ${payload.publicId}`;

    if (isPeriodicUpdate) {
      headerColor = "#DC2626";
      headerText = "📢 [อัปเดตเหตุการณ์] ONE STOP SERVICE";
      altText = `📢 [อัปเดตเหตุการณ์] ${payload.eventCode || payload.publicId}: ${payload.subcategoryName || payload.categoryName}`;
    } else if (isEmergency) {
      headerColor = "#DC2626";
      headerText = "🚨 [เหตุฉุกเฉินเร่งด่วน] ONE STOP SERVICE";
      altText = `🚨 [ฉุกเฉิน] มีคำร้องใหม่: ${payload.publicId}`;
    } else if (isTransfer) {
      headerColor = "#9333EA";
      headerText = "🔄 แจ้งโอนคำร้อง (ONE STOP SERVICE)";
      altText = `🔄 มีการโอนคำร้อง: ${payload.publicId}`;
    } else if (isNeedsReview) {
      headerColor = "#D97706";
      headerText = "⚠️ [รอตรวจสอบความเร่งด่วน] ONE STOP SERVICE";
      altText = `⚠️ [รอตรวจสอบ] มีคำร้องใหม่: ${payload.publicId}`;
    } else {
      headerColor = "#D1350F";
      headerText = "🔔 [แจ้งเตือนคำร้องใหม่] ONE STOP SERVICE";
      altText = `🔔 มีคำร้องใหม่: ${payload.publicId}`;
    }

    lineMessages = [
      {
        type: "flex",
        altText: altText,
        contents: {
          type: "bubble",
          size: "kilo",
          header: {
            type: "box",
            layout: "horizontal",
            alignItems: "center",
            paddingTop: "12px",
            paddingEnd: "12px",
            paddingBottom: "0px",
            paddingStart: "12px",
            contents: [
              {
                type: "text",
                text: headerText,
                color: headerColor,
                weight: "bold",
                size: (isEmergency || isPeriodicUpdate) ? "sm" : "md",
                wrap: true,
              }
            ]
          },
          body: {
            type: "box",
            layout: "vertical",
            paddingTop: "12px",
            paddingEnd: "12px",
            paddingBottom: "0px",
            paddingStart: "12px",
            contents: [
              ...(isPeriodicUpdate ? [
                {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#FFF7ED",
                  borderColor: "#FDBA74",
                  borderWidth: "1px",
                  cornerRadius: "md",
                  paddingAll: "10px",
                  contents: [
                    {
                      type: "text",
                      text: "สรุปการแจ้งเหตุเพิ่มเติม",
                      color: "#C2410C",
                      weight: "bold",
                      size: "xs"
                    },
                    {
                      type: "text",
                      text: payload.subcategoryName || payload.description || "เหตุการณ์",
                      color: "#9A3412",
                      weight: "bold",
                      size: "sm",
                      wrap: true,
                      margin: "xs"
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "xs",
                      spacing: "none",
                      contents: [
                        {
                          type: "text",
                          text: `- คำร้องใหม่: ${payload.newReportCount ?? 0} รายการ`,
                          color: "#374151",
                          size: "xs",
                          weight: "bold"
                        },
                        {
                          type: "text",
                          text: `- คำร้องที่เกี่ยวข้องทั้งหมด: ${payload.totalReportCount ?? 0} รายการ`,
                          color: "#374151",
                          size: "xs"
                        }
                      ]
                    }
                  ]
                },
                { type: "separator", margin: "md", color: "#f0f0f0" },
              ] : isEmergency ? [
                {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#FEF2F2",
                  borderColor: "#F87171",
                  borderWidth: "1px",
                  cornerRadius: "md",
                  paddingAll: "8px",
                  contents: [
                    {
                      type: "text",
                      text: "🔴 ระดับความเร่งด่วน: ฉุกเฉิน (Emergency)",
                      color: "#DC2626",
                      weight: "bold",
                      size: "xs"
                    },
                    {
                      type: "text",
                      text: payload.priorityReason || "อาจมีความเสี่ยงเร่งด่วนต่อชีวิตหรือทรัพย์สิน",
                      color: "#991B1B",
                      size: "xxs",
                      wrap: true
                    }
                  ]
                },
                { type: "separator", margin: "md", color: "#f0f0f0" },
              ] : isNeedsReview ? [
                {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#FFFBEB",
                  borderColor: "#FCD34D",
                  borderWidth: "1px",
                  cornerRadius: "md",
                  paddingAll: "8px",
                  contents: [
                    {
                      type: "text",
                      text: "⚠️ ระดับความเร่งด่วน: รอตรวจสอบ (Needs Review)",
                      color: "#D97706",
                      weight: "bold",
                      size: "xs"
                    },
                    {
                      type: "text",
                      text: payload.priorityReason || "ข้อมูลไม่ชัดเจน แนะนำให้เจ้าหน้าที่คัดกรองความเร่งด่วน",
                      color: "#92400E",
                      size: "xxs",
                      wrap: true
                    }
                  ]
                },
                { type: "separator", margin: "md", color: "#f0f0f0" },
              ] : []),
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                contents: [
                  { type: "text", text: isPeriodicUpdate ? "รหัสเหตุการณ์" : "เลขอ้างอิง", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: (isPeriodicUpdate ? payload.eventCode : payload.publicId) || payload.publicId, color: "#1A1A2E", size: "xs", wrap: true, weight: "bold" }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              ...(isTransfer ? [
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "xs",
                  margin: "md",
                  contents: [
                    { type: "text", text: "โอนจากหน่วยงาน", color: "#8c8c8c", size: "xs" },
                    { type: "text", text: payload.oldDepartmentName || "-", color: "#9333EA", size: "xs", weight: "bold", wrap: true }
                  ]
                },
                { type: "separator", margin: "md", color: "#f0f0f0" },
              ] : []),
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: isPeriodicUpdate ? "รายละเอียดเหตุการณ์" : "หมวดหมู่ (ปัจจุบัน)", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: isPeriodicUpdate ? (payload.subcategoryName || payload.description || "เหตุการณ์ที่ได้รับแจ้ง") : `${payload.categoryName}\n-\n${payload.subcategoryName}`, color: "#1A1A2E", size: "xs", wrap: true, weight: isPeriodicUpdate ? "bold" : "regular" }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              ...(!isPeriodicUpdate ? [
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "xs",
                  margin: "md",
                  contents: [
                    { type: "text", text: "เรื่องที่แจ้ง", color: "#8c8c8c", size: "xs" },
                    { type: "text", text: payload.description, color: "#1A1A2E", size: "xs", wrap: true }
                  ]
                },
                { type: "separator", margin: "md", color: "#f0f0f0" },
              ] : []),
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: isPeriodicUpdate ? "สถานที่เกิดเหตุ" : "สถานที่", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: payload.location, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              ...(isTransfer && payload.transferRemark ? [
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "xs",
                  margin: "md",
                  contents: [
                    { type: "text", text: "หมายเหตุการโอน", color: "#8c8c8c", size: "xs" },
                    { type: "text", text: payload.transferRemark, color: "#1A1A2E", size: "xs", wrap: true }
                  ]
                },
                { type: "separator", margin: "md", color: "#f0f0f0" },
              ] : []),
              ...(!isPeriodicUpdate && payload.reporterName ? [
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "xs",
                  margin: "md",
                  contents: [
                    { type: "text", text: "ผู้แจ้ง", color: "#8c8c8c", size: "xs" },
                    { type: "text", text: payload.reporterName || "-", color: "#1A1A2E", size: "xs", wrap: true }
                  ]
                },
                { type: "separator", margin: "md", color: "#f0f0f0" },
              ] : []),
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: isPeriodicUpdate ? "เวลาอัปเดต" : "วันที่แจ้ง", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: payload.date, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              },
              { type: "separator", margin: "md", color: "#f0f0f0" },
              {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                margin: "md",
                contents: [
                  { type: "text", text: "สถานะ", color: "#8c8c8c", size: "xs" },
                  { type: "text", text: mappedStatus, color: "#1A1A2E", size: "xs", wrap: true }
                ]
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "12px",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#D1350F",
                action: {
                  type: "uri",
                  label: isPeriodicUpdate ? (payload.customActionLabel || "ดูรายละเอียดเหตุการณ์") : (payload.customActionLabel || "ดูรายละเอียดเพิ่มเติม"),
                  uri: resolvePublicActionUrl(payload.customActionUrl, isPeriodicUpdate ? "/backoffice/incidents" : `/report/${payload.publicId}`)
                }
              }
            ]
          }
        }
      }
    ];
  }

  // 6. SAFE DELIVERY WITH CONCURRENCY LOCK & BOUNDED RETRY
  if (dedupKey) {
    activeInFlightKeys.add(dedupKey);
  }

  const maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 1; // 1 retry on 5xx
  let currentAttempt = 0;
  let lastError: string = "Unknown error";
  let lastStatus = 0;

  try {
    while (currentAttempt <= maxRetries) {
      currentAttempt++;
      const attemptStart = new Date().toISOString();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const destClassification = groupId === process.env.LINE_TEST_GROUP_ID
          ? 'TEST'
          : (groupId === process.env.LINE_GROUP_ID ? 'PRODUCTION' : 'UNKNOWN');

        console.log("=== LINE PRE-DISPATCH METADATA ===");
        console.log(`Environment: ${environment}`);
        console.log(`Destination Classification: ${destClassification}`);
        console.log(`Destination: ${maskDestination(groupId)}`);
        console.log(`Messaging API Endpoint: https://api.line.me/v2/bot/message/push`);
        console.log(`Delivery Mode: ${dataSource.isTest ? 'TEST GROUP ISOLATED' : 'PRODUCTION'}`);
        console.log("==================================");

        const response = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            to: groupId,
            messages: lineMessages
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastStatus = response.status;
        const responseText = await response.text();

        console.log("LINE STATUS:", response.status);
        console.log("LINE RESPONSE:", responseText);

        if (response.ok) {
          // Success: Mark cache
          if (dedupKey) {
            notifiedNewReports.set(dedupKey, Date.now());
          }
          if (publicId) {
            notifiedNewReports.set(publicId, Date.now());
          }

          const logRecord = await recordNotificationLog({
            event_type: event,
            report_id: reportId,
            public_id: publicId,
            destination: groupId,
            environment,
            status: 'sent',
            attempt_count: currentAttempt,
            idempotency_key: dedupKey,
            attempted_at: attemptStart,
            sent_at: new Date().toISOString(),
          });

          return {
            success: true,
            status: 'sent',
            attempts: currentAttempt,
            logId: logRecord.id,
          };
        }

        // Non-200 Response
        lastError = `LINE API responded with status ${response.status}: ${responseText}`;
        console.error("LINE API Error:", responseText);

        // Deterministic Client Error (4xx): DO NOT RETRY
        if (response.status >= 400 && response.status < 500) {
          await recordNotificationLog({
            event_type: event,
            report_id: reportId,
            public_id: publicId,
            destination: groupId,
            environment,
            status: 'failed',
            attempt_count: currentAttempt,
            error_code: `LINE_${response.status}`,
            error_message: lastError,
            idempotency_key: dedupKey,
            attempted_at: attemptStart,
          });

          return {
            success: false,
            status: 'failed',
            attempts: currentAttempt,
            error: lastError,
          };
        }

        // Server Error (5xx): Retryable if attempts remain
        if (currentAttempt <= maxRetries) {
          console.warn(`[notifyLine] Retrying LINE push after status ${response.status} (attempt ${currentAttempt}/${maxRetries + 1})...`);
          await new Promise((resolve) => setTimeout(resolve, 300 * currentAttempt));
          continue;
        }

      } catch (fetchErr: unknown) {
        const isTimeout =
          fetchErr instanceof Error &&
          (fetchErr.name === 'AbortError' ||
            fetchErr.message.toLowerCase().includes('timeout') ||
            fetchErr.message.toLowerCase().includes('abort'));

        const errorCode = isTimeout ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
        lastError = fetchErr instanceof Error ? fetchErr.message : "Network fetch failed";
        console.error(`[notifyLine] Attempt ${currentAttempt} ${errorCode}:`, fetchErr);

        // DO NOT RETRY on Timeout or Network Error (indeterminate delivery state)
        // Record failure immediately to prevent duplicate message dispatch
        await recordNotificationLog({
          event_type: event,
          report_id: reportId,
          public_id: publicId,
          destination: groupId,
          environment,
          status: 'failed',
          attempt_count: currentAttempt,
          error_code: errorCode,
          error_message: `${errorCode}: ${lastError} (delivery unconfirmed - retry skipped to prevent duplication)`,
          idempotency_key: dedupKey,
          attempted_at: attemptStart,
        });

        return {
          success: false,
          status: 'failed',
          attempts: currentAttempt,
          error: `${errorCode}: ${lastError}`,
        };
      }
    }

    // All 5xx retries exhausted
    await recordNotificationLog({
      event_type: event,
      report_id: reportId,
      public_id: publicId,
      destination: groupId,
      environment,
      status: 'failed',
      attempt_count: currentAttempt,
      error_code: lastStatus ? `LINE_${lastStatus}` : 'SERVER_ERROR',
      error_message: lastError,
      idempotency_key: dedupKey,
    });

    return {
      success: false,
      status: 'failed',
      attempts: currentAttempt,
      error: lastError,
    };

  } finally {
    if (dedupKey) {
      activeInFlightKeys.delete(dedupKey);
      releaseNotificationLease(dedupKey);
    }
  }
}
