import { test, expect } from '@playwright/test';

// Base mock report data
const createMockReport = (status: string, extra = {}) => ({
  id: "test-report-uuid",
  public_id: "SOC-TEST01",
  tracking_token: "token-uuid",
  location: "อาคาร 1 ห้อง 101",
  description: "ทดสอบการเปลี่ยนสถานะ",
  image_url: null,
  reporter_name: "ผู้ทดสอบ",
  email: "test@example.com",
  phone: "0812345678",
  status,
  priority: "medium",
  admin_remark: status === 'completed' ? "แก้ไขเสร็จสิ้นแล้ว" : null,
  created_at: "2026-08-20T08:00:00.000Z",
  updated_at: new Date().toISOString(),
  categories: {
    id: 1,
    name_th: "วิชาการและการเรียนการสอน",
    department_id: 1
  },
  subcategories: {
    id: 1,
    name_th: "ห้องเรียน"
  },
  report_logs: [
    {
      id: 1,
      action: "created",
      old_status: null,
      new_status: "pending",
      remark: "ส่งเรื่องเข้าระบบ",
      image_url: null,
      created_at: "2026-08-20T08:00:00.000Z",
      staff_users: { full_name: "ระบบ" }
    },
    ...(status === 'completed' || status === 'in_progress' ? [
      {
        id: 2,
        action: "status_updated",
        old_status: "pending",
        new_status: "completed",
        remark: "แก้ไขเสร็จสิ้นแล้ว",
        image_url: "https://example.com/completion-img.png",
        created_at: "2026-08-21T09:00:00.000Z",
        staff_users: { full_name: "ผู้ดูแลระบบ" }
      }
    ] : [])
  ],
  ...extra
});

test.describe('Report Detail Page — Staff Authentication & Response Flow Tests', () => {

  test('1. CASE 1: When opening report with NO active session, Staff Login Form is shown and Action Form is hidden', async ({ page }) => {
    const reportData = createMockReport('in_progress');

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: false })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Header and Card Header badges are visible with correct status
    await expect(page.locator('h1').locator('xpath=../..').locator('text=กำลังดำเนินการ')).toBeVisible();
    await expect(page.locator('h3:has-text("การดำเนินการ")')).toBeVisible();

    // Staff Login Form is displayed
    await expect(page.locator('h4:has-text("เข้าสู่ระบบสำหรับเจ้าหน้าที่")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("เข้าสู่ระบบเพื่อดำเนินการ")')).toBeVisible();

    // Staff Action Form (status dropdown, remark textarea, save button) is NOT shown
    await expect(page.locator('label:has-text("สถานะคำร้อง")')).toHaveCount(0);
    await expect(page.locator('button:has-text("บันทึกข้อมูล")')).toHaveCount(0);
  });

  test('2. CASE 1 -> 2: Successful Staff Login transitions to Staff Action Form', async ({ page }) => {
    const reportData = createMockReport('in_progress');

    let isAuthed = false;
    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: isAuthed })
      });
    });

    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      isAuthed = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "mock-staff-uid",
            email: "staff@ku.th",
            app_metadata: {},
            user_metadata: {}
          }
        })
      });
    });

    await page.route('**/api/staff/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: "mock-staff-uid",
            email: "staff@ku.th",
            full_name: "นายทดสอบ ปฏิบัติงาน",
            role: "staff",
            department_id: 1
          }
        })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Fill in staff login credentials
    await page.fill('input[type="email"]', 'staff@ku.th');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("เข้าสู่ระบบเพื่อดำเนินการ")');

    // After login succeeds, Staff Profile bar appears
    await expect(page.locator('text=นายทดสอบ ปฏิบัติงาน')).toBeVisible();

    // Staff Action Form (status dropdown and save button) appears
    await expect(page.locator('label:has-text("สถานะคำร้อง")')).toBeVisible();
    await expect(page.locator('button:has-text("บันทึกข้อมูล")')).toBeVisible();
  });

  test('3. CASE 5: Logged-in user WITHOUT authorization sees Unauthorized Notice and cannot edit', async ({ page }) => {
    const reportData = createMockReport('in_progress');

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: false })
      });
    });

    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: "mock-unauth-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "unauth-staff-id",
            email: "other@ku.th",
            app_metadata: {},
            user_metadata: {}
          }
        })
      });
    });

    await page.route('**/api/staff/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: "unauth-staff-id",
            email: "other@ku.th",
            full_name: "นายเจ้าหน้าที่ ต่างหน่วยงาน",
            role: "staff",
            department_id: 99
          }
        })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Perform login with unauthorized staff account
    await page.fill('input[type="email"]', 'other@ku.th');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("เข้าสู่ระบบเพื่อดำเนินการ")');

    // Unauthorized notice is shown
    await expect(page.locator('text=ไม่มีสิทธิ์จัดการคำร้องนี้')).toBeVisible();
    // Action form is hidden
    await expect(page.locator('label:has-text("สถานะคำร้อง")')).toHaveCount(0);
    await expect(page.locator('button:has-text("บันทึกข้อมูล")')).toHaveCount(0);
  });

  test('4. COMPLETED REPORT: Read-Only Mode with "เข้าสู่ระบบเพื่อแก้ไข" for unauthenticated users', async ({ page }) => {
    const reportData = createMockReport('completed');

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: false })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Completed Read-Only Mode elements
    await expect(page.locator('text=หมายเหตุสรุปผล')).toBeVisible();
    await expect(page.locator('img[alt="ภาพประกอบการทำงาน"]')).toBeVisible();
    await expect(page.locator('button:has-text("เข้าสู่ระบบเพื่อแก้ไข")')).toBeVisible();

    // Clicking "เข้าสู่ระบบเพื่อแก้ไข" opens Login Modal
    await page.click('button:has-text("เข้าสู่ระบบเพื่อแก้ไข")');
    await expect(page.locator('h3:has-text("เข้าสู่ระบบเจ้าหน้าที่")')).toBeVisible();
  });

  test('5. Timeline renders full log history without leaking raw English status', async ({ page }) => {
    const reportData = createMockReport('cancelled', {
      public_id: "SOC-55472",
      status: "cancelled",
      report_logs: [
        {
          id: 58,
          action: "status_updated",
          old_status: "pending",
          new_status: "completed",
          remark: null,
          image_url: null,
          created_at: "2026-08-24T02:20:46.393+00:00",
          staff_users: { full_name: "ผู้ดูแลระบบสูงสุด" }
        },
        {
          id: 59,
          action: "status_updated",
          old_status: "completed",
          new_status: "received",
          remark: null,
          image_url: null,
          created_at: "2026-08-24T02:21:16.229+00:00",
          staff_users: { full_name: "ผู้ดูแลระบบสูงสุด" }
        },
        {
          id: 61,
          action: "status_updated",
          old_status: "received",
          new_status: "in_progress",
          remark: null,
          image_url: null,
          created_at: "2026-08-24T02:23:07.107+00:00",
          staff_users: { full_name: "ผู้ดูแลระบบสูงสุด" }
        },
        {
          id: 62,
          action: "status_updated",
          old_status: "in_progress",
          new_status: "cancelled",
          remark: null,
          image_url: null,
          created_at: "2026-08-24T02:25:26.523+00:00",
          staff_users: { full_name: "ผู้ดูแลระบบสูงสุด" }
        }
      ]
    });

    await page.route('**/api/reports/SOC-55472', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: false })
      });
    });

    await page.goto('/report/SOC-55472');
    await page.waitForLoadState('networkidle');

    // Verify Thai labels in Timeline
    await expect(page.locator('h4:has-text("เสร็จสิ้น")')).toBeVisible();
    await expect(page.locator('h4:has-text("รับเรื่องแล้ว")')).toBeVisible();
    await expect(page.locator('h4:has-text("กำลังดำเนินการ")')).toBeVisible();
    await expect(page.locator('h4:has-text("ยกเลิกรายการ")')).toBeVisible();

    // Verify NO raw English internal status names leak
    const textContent = await page.locator('body').innerText();
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น received');
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น in_progress');
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น completed');
  });

  test('6. Public Report Detail: No status change + No note change disables Save; Note change enables Save', async ({ page }) => {
    const reportData = createMockReport('in_progress', { admin_remark: "หมายเหตุเดิม" });

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: true })
      });
    });

    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: "mock-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: { id: "mock-uid", email: "staff@ku.th" }
        })
      });
    });

    await page.route('**/api/staff/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: { id: "mock-uid", email: "staff@ku.th", full_name: "เจ้าหน้าที่ A", role: "admin" }
        })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Login
    await page.fill('input[type="email"]', 'staff@ku.th');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("เข้าสู่ระบบเพื่อดำเนินการ")');

    const saveBtn = page.locator('button:has-text("บันทึกข้อมูล")');

    // 1. Initial State: Status is in_progress (unchanged) and Remark is "หมายเหตุเดิม" (unchanged)
    // -> Save disabled and warning is visible
    await expect(saveBtn).toBeDisabled();
    await expect(page.locator('text=กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ')).toBeVisible();

    // 2. Case 2: Edit Note only -> Save enabled and warning hidden
    const remarkTextarea = page.locator('textarea');
    await remarkTextarea.fill('อัปเดตหมายเหตุใหม่');
    await expect(saveBtn).toBeEnabled();
    await expect(page.locator('text=กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ')).toHaveCount(0);

    // 3. Reset Note back to original -> Save disabled again
    await remarkTextarea.fill('หมายเหตุเดิม');
    await expect(saveBtn).toBeDisabled();
    await expect(page.locator('text=กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ')).toBeVisible();

    // 4. Case 3: Change Status only -> Save enabled and warning hidden
    const selectTrigger = page.locator('button:has-text("กำลังดำเนินการ")');
    await selectTrigger.click();
    await page.locator('button:has-text("เสร็จสิ้น")').click();
    await expect(saveBtn).toBeEnabled();
    await expect(page.locator('text=กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ')).toHaveCount(0);
  });

  test('7. Backoffice Report Detail: No status + No note disables Save; Note change enables Save', async ({ page }) => {
    const reportData = createMockReport('in_progress', { admin_remark: "หมายเหตุเดิม" });

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: true })
      });
    });

    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: "mock-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: { id: "mock-admin", email: "admin@ku.th" }
        })
      });
    });

    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: "mock-admin", email: "admin@ku.th" })
      });
    });

    await page.route('**/api/staff/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: { id: "mock-admin", email: "admin@ku.th", full_name: "ผู้ดูแลระบบ", role: "admin" }
        })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Login
    await page.fill('input[type="email"]', 'staff@ku.th');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("เข้าสู่ระบบเพื่อดำเนินการ")');

    const saveBtn = page.locator('button:has-text("บันทึกข้อมูล")');
    await expect(saveBtn).toBeDisabled();
    await expect(page.locator('text=กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ')).toBeVisible();

    // Type new remark -> Save enabled
    const remarkTextarea = page.locator('textarea');
    await remarkTextarea.fill('แก้ไขเพิ่มเติม');
    await expect(saveBtn).toBeEnabled();
    await expect(page.locator('text=กรุณาเลือกสถานะใหม่ หรือเพิ่มหมายเหตุ')).toHaveCount(0);
  });

  test('8. Staff Exit Mode on Report: Clicking "ออกจากโหมดเจ้าหน้าที่" returns to Public View without clearing Supabase session', async ({ page }) => {
    const reportData = createMockReport('in_progress');

    let isAuthed = false;
    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: isAuthed })
      });
    });

    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      isAuthed = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "mock-staff-uid",
            email: "staff@ku.th",
            app_metadata: {},
            user_metadata: {}
          }
        })
      });
    });

    await page.route('**/api/staff/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: "mock-staff-uid",
            email: "staff@ku.th",
            full_name: "นายทดสอบ ปฏิบัติงาน",
            role: "staff",
            department_id: 1
          }
        })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Login to enter Staff Mode
    await page.fill('input[type="email"]', 'staff@ku.th');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("เข้าสู่ระบบเพื่อดำเนินการ")');

    await expect(page.locator('text=นายทดสอบ ปฏิบัติงาน')).toBeVisible();
    await expect(page.locator('button:has-text("บันทึกข้อมูล")')).toBeVisible();

    // Click "ออกจากโหมดเจ้าหน้าที่"
    await page.click('button:has-text("ออกจากโหมดเจ้าหน้าที่")');

    // Report switches back to Public View (Staff Action Form hidden, login prompt / resume button shown)
    await expect(page.locator('button:has-text("บันทึกข้อมูล")')).toHaveCount(0);
    await expect(page.locator('h4:has-text("เข้าสู่ระบบสำหรับเจ้าหน้าที่")')).toBeVisible();
    await expect(page.locator('button:has-text("กลับเข้าสู่โหมดเจ้าหน้าที่ (นายทดสอบ ปฏิบัติงาน)")')).toBeVisible();

    // Re-enter Staff Mode via quick button
    await page.click('button:has-text("กลับเข้าสู่โหมดเจ้าหน้าที่ (นายทดสอบ ปฏิบัติงาน)")');
    await expect(page.locator('text=นายทดสอบ ปฏิบัติงาน')).toBeVisible();
    await expect(page.locator('button:has-text("บันทึกข้อมูล")')).toBeVisible();
  });
});
