import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import { execSync } from "child_process";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function runLocalSql(sql: string) {
  execSync(
    `docker exec -i supabase_db_one-stop-reporting-soc psql -U postgres -d postgres -v ON_ERROR_STOP=1`,
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] }
  );
}

function sqlLiteral(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function syncExistingStaffToLocal() {
  const remoteClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const localClient = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Read existing departments, categories, staff_users, manager_departments (READ-ONLY from configured project)
  const { data: remDepts, error: dErr } = await remoteClient
    .from("departments")
    .select("*")
    .order("id");
  if (dErr) throw dErr;

  const { data: remCats, error: cErr } = await remoteClient
    .from("categories")
    .select("*")
    .order("id");
  if (cErr) throw cErr;

  const { data: remSubcats, error: scErr } = await remoteClient
    .from("subcategories")
    .select("*")
    .order("id");
  if (scErr) throw scErr;

  const { data: remStaff, error: sErr } = await remoteClient
    .from("staff_users")
    .select("*");
  if (sErr) throw sErr;

  const { data: remMgr, error: mErr } = await remoteClient
    .from("manager_departments")
    .select("*");
  if (mErr) throw mErr;

  // 2. Sync departments into Local DB with OVERRIDING SYSTEM VALUE (nullifying production line_group_id except soc-test)
  const testGroupId = process.env.LINE_TEST_GROUP_ID || null;
  const deptSqlLines: string[] = ["BEGIN;"];
  for (const dept of remDepts || []) {
    const safeLineGroupId = dept.code === "soc-test" ? testGroupId : null;
    deptSqlLines.push(
      `INSERT INTO public.departments (id, code, name_th, is_active, line_group_id)
       OVERRIDING SYSTEM VALUE
       VALUES (${sqlLiteral(dept.id)}, ${sqlLiteral(dept.code)}, ${sqlLiteral(dept.name_th)}, ${sqlLiteral(dept.is_active)}, ${sqlLiteral(safeLineGroupId)})
       ON CONFLICT (id) DO UPDATE
       SET code = EXCLUDED.code,
           name_th = EXCLUDED.name_th,
           is_active = EXCLUDED.is_active,
           line_group_id = EXCLUDED.line_group_id;`
    );
  }
  deptSqlLines.push(
    `SELECT setval(pg_get_serial_sequence('public.departments', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.departments));`
  );
  for (const cat of remCats || []) {
    deptSqlLines.push(
      `INSERT INTO public.categories (id, name_th, department_id)
       OVERRIDING SYSTEM VALUE
       VALUES (${sqlLiteral(cat.id)}, ${sqlLiteral(cat.name_th)}, ${sqlLiteral(cat.department_id)})
       ON CONFLICT (id) DO UPDATE
       SET name_th = EXCLUDED.name_th,
           department_id = EXCLUDED.department_id;`
    );
  }
  deptSqlLines.push(
    `SELECT setval(pg_get_serial_sequence('public.categories', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.categories));`
  );
  for (const sc of remSubcats || []) {
    deptSqlLines.push(
      `INSERT INTO public.subcategories (id, category_id, name_th)
       OVERRIDING SYSTEM VALUE
       VALUES (${sqlLiteral(sc.id)}, ${sqlLiteral(sc.category_id)}, ${sqlLiteral(sc.name_th)})
       ON CONFLICT (id) DO UPDATE
       SET category_id = EXCLUDED.category_id,
           name_th = EXCLUDED.name_th;`
    );
  }
  deptSqlLines.push(
    `SELECT setval(pg_get_serial_sequence('public.subcategories', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.subcategories));`
  );
  deptSqlLines.push("COMMIT;");
  runLocalSql(deptSqlLines.join("\n"));
  console.log(
    `Synced ${remDepts?.length || 0} departments, ${remCats?.length || 0} categories, and ${remSubcats?.length || 0} subcategories to Local DB.`
  );

  // 3. Load known local passwords from workspace files (without printing them)
  const excelMap = new Map<string, string>();
  if (fs.existsSync("./staff_users.xlsx")) {
    const wb = XLSX.readFile("./staff_users.xlsx");
    const sheet = wb.Sheets["usename"];
    if (sheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      for (const r of rows) {
        const email = r["KU-Google mail"]?.trim()?.toLowerCase();
        const pass = r["password"]?.trim();
        if (email && pass) {
          excelMap.set(email, String(pass));
        }
      }
    }
  }

  let defaultKnownPass = "Password123!";
  if (fs.existsSync("test_auth.js")) {
    const content = fs.readFileSync("test_auth.js", "utf8");
    const match = content.match(/password:\s*['"]([^'"]+)['"]/);
    if (match?.[1]) {
      defaultKnownPass = match[1];
    }
  }

  // 4. Ensure all 17 existing staff users exist in Local auth.users AND Local public.staff_users with exact UUIDs
  const { data: localAuthList } = await localClient.auth.admin.listUsers({
    perPage: 1000,
  });
  const localAuthById = new Map(
    (localAuthList?.users || []).map((u) => [u.id, u])
  );

  for (const staff of remStaff || []) {
    const emailLower = (staff.email || "").trim().toLowerCase();
    const passToUse = excelMap.get(emailLower) || defaultKnownPass;

    if (!localAuthById.has(staff.id)) {
      const { error: createAuthErr } = await localClient.auth.admin.createUser({
        id: staff.id,
        email: emailLower,
        password: passToUse,
        email_confirm: true,
        user_metadata: { full_name: staff.full_name },
      });
      if (createAuthErr) {
        console.error(
          `Error creating local auth user for ${emailLower}:`,
          createAuthErr.message
        );
      }
    } else {
      const { error: updateAuthErr } =
        await localClient.auth.admin.updateUserById(staff.id, {
          email: emailLower,
          password: passToUse,
          email_confirm: true,
        });
      if (updateAuthErr) {
        console.error(
          `Error updating local auth user for ${emailLower}:`,
          updateAuthErr.message
        );
      }
    }

    const { error: staffUpsertErr } = await localClient
      .from("staff_users")
      .upsert(
        {
          id: staff.id,
          auth_user_id: staff.id,
          email: staff.email,
          full_name: staff.full_name,
          role: staff.role,
          status: staff.status,
          department_id: staff.department_id,
        },
        { onConflict: "id" }
      );
    if (staffUpsertErr) {
      console.error(
        `Error upserting staff_users for ${emailLower}:`,
        staffUpsertErr.message
      );
    }
  }
  console.log(
    `Synced ${remStaff?.length || 0} existing staff_users (id = auth.users.id) to Local DB.`
  );

  // 5. Sync manager_departments into Local DB
  for (const mgr of remMgr || []) {
    const { error: mgrErr } = await localClient
      .from("manager_departments")
      .upsert(
        {
          staff_user_id: mgr.staff_user_id,
          department_id: mgr.department_id,
        },
        { onConflict: "staff_user_id,department_id" }
      );
    if (mgrErr) {
      console.error(
        `Error syncing manager_department ${mgr.staff_user_id} -> ${mgr.department_id}:`,
        mgrErr.message
      );
    }
  }
  console.log(
    `Synced ${remMgr?.length || 0} manager_departments rows to Local DB.`
  );

  // 6. Verify final counts in Local DB
  const { data: verifyStaff } = await localClient
    .from("staff_users")
    .select(
      "id, auth_user_id, email, full_name, role, status, department_id, departments(name_th)"
    )
    .order("email");
  console.log(
    `\n=== VERIFIED LOCAL PUBLIC.STAFF_USERS (${verifyStaff?.length || 0} total) ===`
  );
  for (const s of verifyStaff || []) {
    const deptName = (s as any).departments?.name_th || "All";
    console.log(
      `  id=${s.id} | id===auth=${s.id === s.auth_user_id} | email=${s.email} | role=${s.role} | status=${s.status} | dept=${s.department_id} (${deptName}) | name=${s.full_name}`
    );
  }
}

syncExistingStaffToLocal();
