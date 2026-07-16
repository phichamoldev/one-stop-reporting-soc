require("dotenv").config({
  path: ".env.local",
});

console.log("URL =", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log(
  "SERVICE_ROLE =",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "FOUND" : "MISSING"
);
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const DEPARTMENT_MAP = {
  "หน่วยทะเบียนและประมวลผล": 1,
  "หน่วยกิจการนิสิต": 2,
  "หน่วยบริหารงานบุคคล": 3,
  "หน่วยกายภาพ และสิ่งแวดล้อม": 4,
  "หน่วยดิจิทัลและเทคโนโลยีการศึกษา": 5,
  "หน่วยส่งเสริมการเรียนรู้และสารสนเทศ": 6,
  "หน่วยสารบรรณ": 7,
};

async function run() {
  const workbook = XLSX.readFile("./staff_users.xlsx");

  const sheet = workbook.Sheets["usename"];

  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`พบข้อมูล ${rows.length} รายการ`);

  const results = [];

  for (const row of rows) {
    try {
      const fullName = row["ชื่อ"]?.trim();
      const email = row["KU-Google mail"]?.trim().toLowerCase();
      const password = row["password"]?.trim();
      const role = row["role"]?.trim() || "staff";
      const departmentName = row["Department name_th"]?.trim();

      const departmentId =
        DEPARTMENT_MAP[departmentName];

      if (!email || !password) {
        results.push({
          email,
          status: "FAILED",
          reason: "Email หรือ Password ว่าง",
        });
        continue;
      }

      // เช็ค User ซ้ำ
      const { data: existingUsers } =
        await supabase.auth.admin.listUsers();

      const exists = existingUsers.users.find(
        (u) => u.email?.toLowerCase() === email
      );

      if (exists) {
        results.push({
          email,
          status: "SKIPPED",
          reason: "Email มีอยู่แล้ว",
        });
        continue;
      }

      // Create Auth User
      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) {
        results.push({
          email,
          status: "FAILED",
          reason: authError.message,
        });
        continue;
      }

      // Insert staff_users
      const { error: staffError } =
        await supabase
          .from("staff_users")
          .insert({
            id: authUser.user.id,
            email,
            full_name: fullName,
            department_id: departmentId,
            role,
            is_active: true,
          });

      if (staffError) {
        results.push({
          email,
          status: "FAILED",
          reason: staffError.message,
        });
        continue;
      }

      results.push({
        email,
        status: "SUCCESS",
        uuid: authUser.user.id,
      });

      console.log(
        `✅ ${fullName} (${email})`
      );
    } catch (err) {
      results.push({
        email: row["KU-Google mail"],
        status: "FAILED",
        reason: err.message,
      });
    }
  }

  console.table(results);

  const resultSheet =
    XLSX.utils.json_to_sheet(results);

  const resultBook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    resultBook,
    resultSheet,
    "Result"
  );

  XLSX.writeFile(
    resultBook,
    "import_result.xlsx"
  );

  console.log(
    "เสร็จสิ้น: import_result.xlsx"
  );
}

run();