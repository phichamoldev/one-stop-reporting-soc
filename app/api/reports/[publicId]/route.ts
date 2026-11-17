import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAccessibleDepartmentIds } from "@/lib/auth-helpers";
import { normalizePublicId } from "@/lib/utils";
import { getReportDataSource } from "@/lib/dataSource";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { reportsTable, reportLogsTable } = getReportDataSource();
    const { publicId } = await params;

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
    }

    let isAuthenticated = false;
    let staffProfileData: any = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        // Verify the user is a staff member
        const { data: staffProfile } = await supabaseAdmin
          .from("staff_users")
          .select("id, role, department_id")
          .eq("id", user.id)
          .maybeSingle();
        
        if (staffProfile) {
          isAuthenticated = true;
          staffProfileData = { ...staffProfile, user_id: user.id };
        }
      }
    }

    const normalizedPublicId = normalizePublicId(publicId);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedPublicId);

    let q = supabaseAdmin
      .from(reportsTable)
      .select(`
        *,
        categories (
          id,
          name_th,
          department_id
        ),
        subcategories (
          id,
          name_th
        ),
        report_logs:${reportLogsTable} (
          id,
          user_id,
          action,
          old_status,
          new_status,
          remark,
          image_url,
          created_at,
          staff_users (
            full_name
          )
        )
      `);
    if (isUUID) {
      q = q.eq("tracking_token", normalizedPublicId.toLowerCase());
    } else {
      q = q.eq("public_id", normalizedPublicId);
    }

    let { data, error } = await q.maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "ไม่พบข้อมูลรายงาน" }, { status: 404 });
    }

    let canManage = false;

    if (isAuthenticated && staffProfileData) {
      const reportDeptId = (data.categories as any)?.department_id;
      
      if (staffProfileData.role === 'super_admin' || staffProfileData.role === 'admin') {
        canManage = true;
      } else {
        const accessibleIds = await getAccessibleDepartmentIds(
          staffProfileData.user_id,
          staffProfileData,
          supabaseAdmin
        );
        if (reportDeptId && accessibleIds.includes(reportDeptId)) {
          canManage = true;
        }
      }
      
      // Security Requirement: If staff is authenticated but unauthorized, they can only view as public
    }

    // PII & internal audit filtering for public access or unauthorized staff
    if (!isAuthenticated || !canManage) {
      delete data.tracking_token;
      delete data.admin_remark;
      delete data.assigned_to;
      delete data.reporter_contact;
      delete data.completed_by;

      if (Array.isArray(data.report_logs)) {
        const INTERNAL_LOG_ACTIONS = new Set([
          'priority_classified',
          'priority_updated',
          'incident_detection_completed',
          'incident_detection_failed',
          'incident_group_added',
          'incident_group_removed',
          'add_report',
          'remove_report',
          'move_report',
          'create_group',
          'draft_created',
          'draft_rejected',
          'task_assigned',
          'suppressed_duplicate',
          'normal_alert_sent',
          'update_sent',
          'window_extended_no_reports',
        ]);

        const PUBLIC_STAFF_ACTIONS = new Set([
          'status_updated',
          'note_updated',
          'image_updated',
          'note_and_image_updated',
          'admin_note_added',
          'transfer',
          'bulk_reply',
        ]);

        data.report_logs = data.report_logs
          .filter((log: {
            action?: string;
            user_id?: string | null;
            remark?: string | null;
            staff_users?: { full_name?: string | null } | null;
          }) => {
            if (!log) return false;
            if (log.action && INTERNAL_LOG_ACTIONS.has(log.action)) return false;
            if (log.action === 'created') return true;
            if (!log.action || !PUBLIC_STAFF_ACTIONS.has(log.action)) return false;

            const hasStaffActor = Boolean(log.user_id || log.staff_users?.full_name);
            if (!hasStaffActor && typeof log.remark === 'string') {
              const trimmed = log.remark.trim();
              if (
                trimmed.startsWith('SIM_RUN:') ||
                trimmed.startsWith('{"simulation_run_id"') ||
                trimmed.startsWith('จัดประเภทความเร่งด่วนเป็น') ||
                trimmed.startsWith('จัดเตรียมร่างกลุ่มเหตุการณ์อัตโนมัติ') ||
                trimmed.startsWith('ยังไม่พบความสัมพันธ์ชัดเจนกับกลุ่มเหตุการณ์') ||
                trimmed.startsWith('พบคำร้องใหม่ที่มีความคล้ายคลึงกัน')
              ) {
                return false;
              }
            }
            return true;
          })
          .map((log: Record<string, unknown>) => {
            const { user_id: _unusedUserId, ...publicLog } = log;
            return publicLog;
          });
      }
    }

    return NextResponse.json({ report: data, canManage });
  } catch (error: any) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
