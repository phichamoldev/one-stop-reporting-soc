import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getReportDataSource } from "@/lib/dataSource";
import { normalizePublicId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/[publicId]/incident
 * Returns incident group membership for a specific report.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const dataSource = getReportDataSource();
    const { publicId } = await params;

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
    }

    const normalizedPublicId = normalizePublicId(publicId);

    // 1. Resolve Report ID
    const { data: report, error: repErr } = await supabaseAdmin
      .from(dataSource.reportsTable)
      .select("id, public_id")
      .eq("public_id", normalizedPublicId)
      .maybeSingle();

    if (repErr || !report) {
      return NextResponse.json({ error: "ไม่พบคำร้องที่ระบุ" }, { status: 404 });
    }

    // 2. Query Membership
    const { data: membership, error: memErr } = await supabaseAdmin
      .from(dataSource.incidentGroupMembersTable)
      .select(`
        id,
        group_id,
        added_at,
        notes,
        incident_group:${dataSource.incidentGroupsTable} (
          id,
          group_code,
          title,
          status,
          category_id,
          created_at
        )
      `)
      .eq("report_id", report.id)
      .maybeSingle();

    if (memErr) {
      console.error("Error fetching incident group for report:", memErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!membership || !membership.incident_group) {
      return NextResponse.json({
        success: true,
        isGrouped: false,
        incidentGroup: null,
      });
    }

    return NextResponse.json({
      success: true,
      isGrouped: true,
      membershipId: membership.id,
      addedAt: membership.added_at,
      notes: membership.notes,
      incidentGroup: membership.incident_group,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in GET /api/reports/[publicId]/incident:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
