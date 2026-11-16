import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";
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

    let query = supabaseAdmin
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
          action,
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
      query = query.eq("tracking_token", normalizedPublicId.toLowerCase());
    } else {
      query = query.eq("public_id", normalizedPublicId);
    }

    const { data, error } = await query.maybeSingle();

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
          'draft_created',
          'draft_rejected',
        ]);

        data.report_logs = data.report_logs.filter((log: { action?: string; remark?: string | null }) => {
          if (!log) return false;
          if (log.action && INTERNAL_LOG_ACTIONS.has(log.action)) return false;
          if (typeof log.remark === 'string') {
            if (
              log.remark.includes('ความสัมพันธ์') ||
              log.remark.includes('กลุ่มเหตุการณ์') ||
              log.remark.includes('จัดประเภทความเร่งด่วน')
            ) {
              return false;
            }
          }
          return true;
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
