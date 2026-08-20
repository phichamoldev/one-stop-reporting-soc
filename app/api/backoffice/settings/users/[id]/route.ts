import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperAdmin, logAuditAction } from "../route";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetUserId } = await params;
    const authResult = await verifySuperAdmin(req);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { full_name, department_id, department_ids, role, status } = body;

    if (targetUserId === authResult.user!.id && (role !== "super_admin" || status === "disabled")) {
      return NextResponse.json({ error: "Cannot downgrade or disable your own account" }, { status: 400 });
    }

    // Get current user state
    const { data: currentUser } = await supabaseAdmin
      .from("staff_users")
      .select("role, department_id")
      .eq("id", targetUserId)
      .single();
    
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentRole = currentUser.role;
    const finalRole = role !== undefined ? role : currentRole;

    let finalPrimaryDeptId = department_id;
    let finalDeptIds: number[] | null = null;

    if (finalRole === "manager") {
      if (department_ids !== undefined) {
         if (Array.isArray(department_ids) && department_ids.length > 0) {
            finalDeptIds = Array.from(new Set(department_ids.map(Number)));
            finalPrimaryDeptId = finalDeptIds[0];
         } else if (department_id) {
            finalDeptIds = [Number(department_id)];
            finalPrimaryDeptId = Number(department_id);
         } else {
            return NextResponse.json({ error: "Manager must have at least one department" }, { status: 400 });
         }
      } else if (department_id !== undefined) {
         finalDeptIds = [Number(department_id)];
         finalPrimaryDeptId = Number(department_id);
      }
    } else {
      if (department_id !== undefined) {
        finalPrimaryDeptId = department_id ? Number(department_id) : null;
      }
    }

    // 1. Validation for Manager
    if (finalRole === "manager" && finalDeptIds !== null) {
      const { data: validDepts, error: validErr } = await supabaseAdmin
        .from("departments")
        .select("id")
        .in("id", finalDeptIds);
      
      if (validErr || !validDepts || validDepts.length !== finalDeptIds.length) {
        return NextResponse.json({ error: "One or more Department IDs are invalid" }, { status: 400 });
      }
    }

    // Prepare update payload
    const updatePayload: any = {};
    if (full_name !== undefined) updatePayload.full_name = full_name;
    if (finalPrimaryDeptId !== undefined) updatePayload.department_id = finalPrimaryDeptId;
    if (role !== undefined) updatePayload.role = role;
    if (status !== undefined) updatePayload.status = status;

    if (Object.keys(updatePayload).length === 0 && finalDeptIds === null) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    let backupManagerDepts: any[] | null = null;
    let backupPrimaryDeptId: number | null = currentUser.department_id;

    if (finalRole === "manager" && finalDeptIds !== null) {
      const { data: oldDepts } = await supabaseAdmin
        .from("manager_departments")
        .select("department_id")
        .eq("staff_user_id", targetUserId);
      backupManagerDepts = oldDepts || [];
    }

    // 2. Update staff profile
    let updatedStaff = null;
    if (Object.keys(updatePayload).length > 0) {
      const { data: resultStaff, error: updateErr } = await supabaseAdmin
        .from("staff_users")
        .update(updatePayload)
        .eq("id", targetUserId)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 400 });
      }
      updatedStaff = resultStaff;
    } else {
      // No staff table changes
      updatedStaff = currentUser;
    }

    // 3. Update manager_departments with Safety / Manual Rollback
    if (finalRole === "manager" && finalDeptIds !== null) {
      const { error: deleteErr } = await supabaseAdmin
        .from("manager_departments")
        .delete()
        .eq("staff_user_id", targetUserId);

      if (deleteErr) {
        if (updatePayload.department_id !== undefined) {
          await supabaseAdmin.from("staff_users").update({ department_id: backupPrimaryDeptId }).eq("id", targetUserId);
        }
        return NextResponse.json({ error: "Failed to update manager departments" }, { status: 500 });
      }

      const deptInserts = finalDeptIds.map(dId => ({
        staff_user_id: targetUserId,
        department_id: dId
      }));

      const { error: insertErr } = await supabaseAdmin
        .from("manager_departments")
        .insert(deptInserts);

      if (insertErr) {
        console.error("Failed to insert manager departments, rolling back...", insertErr);
        if (backupManagerDepts && backupManagerDepts.length > 0) {
           const backupInserts = backupManagerDepts.map(d => ({
             staff_user_id: targetUserId,
             department_id: d.department_id
           }));
           await supabaseAdmin.from("manager_departments").insert(backupInserts);
        }
        if (updatePayload.department_id !== undefined) {
          await supabaseAdmin.from("staff_users").update({ department_id: backupPrimaryDeptId }).eq("id", targetUserId);
        }
        return NextResponse.json({ error: "Failed to save new departments. Changes rolled back." }, { status: 500 });
      }
    }

    // 4. Clean up if Role changed from Manager to something else
    if (role !== undefined && role !== "manager" && currentRole === "manager") {
       await supabaseAdmin.from("manager_departments").delete().eq("staff_user_id", targetUserId);
    }

    // Log action
    let action = "Update User";
    if (status === "disabled") action = "Disable User";
    if (status === "active" && updatePayload.status === "active") action = "Enable User";
    if (role && updatePayload.role) action = "Change Role";

    await logAuditAction(authResult.user!.id, action, targetUserId, { ...updatePayload, department_ids: finalDeptIds });

    return NextResponse.json({ success: true, user: updatedStaff });
  } catch (error: any) {
    console.error("PATCH /settings/users/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
