import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all staff users and their departments
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff_users")
      .select(`
        *,
        departments (
          id,
          name_th
        )
      `)
      .order("created_at", { ascending: false });

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    }

    // Fetch report logs to calculate stats
    const { data: logs } = await supabaseAdmin
      .from("report_logs")
      .select(`
        user_id,
        new_status,
        report_id,
        reports (
          status
        )
      `);

    // Map to the required format for StaffView
    const mappedStaff = staff.map((s: any) => {
      // Find unique reports this user interacted with
      const userLogs = logs?.filter((l: any) => l.user_id === s.id) || [];
      
      const activeTasksCount = new Set(
        userLogs
          .filter((l: any) => l.reports?.status === 'in_progress' || l.reports?.status === 'pending')
          .map((l: any) => l.report_id)
      ).size;
      
      const completedTasksCount = new Set(
        userLogs
          .filter((l: any) => l.new_status === 'completed')
          .map((l: any) => l.report_id)
      ).size;

      return {
        id: s.id,
        name: s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : (s.email || "Unknown"),
        email: s.email,
        role: s.role === 'super_admin' ? 'ผู้ดูแลระบบสูงสุด' : (s.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่ปฏิบัติงาน'),
        department: s.departments?.name_th || "ไม่ระบุฝ่าย",
        imageUrl: s.avatar_url || null,
        activeTasks: activeTasksCount,
        completedTasks: completedTasksCount,
        phone: s.phone || null
      };
    });

    return NextResponse.json({ staff: mappedStaff });
  } catch (error: any) {
    console.error("Error fetching staff data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
