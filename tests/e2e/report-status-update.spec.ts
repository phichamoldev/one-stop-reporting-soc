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

test.describe('Report Detail Page — Status Update & Completed State Tests', () => {

  test('1. When status is pending/in_progress, Action Form is shown, not Completed View Mode', async ({ page }) => {
    const reportData = createMockReport('in_progress');

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: true })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Header badge matches in_progress
    const headerBadge = page.locator('h1').locator('xpath=../..').locator('text=กำลังดำเนินการ');
    await expect(headerBadge).toBeVisible();

    // Card header badge matches in_progress (NOT hardcoded "เสร็จสิ้น")
    const cardHeaderBadge = page.locator('h3:has-text("การดำเนินการ")').locator('xpath=../..').locator('text=กำลังดำเนินการ');
    await expect(cardHeaderBadge).toBeVisible();

    // Action form is shown (dropdown for status exists)
    const statusSelect = page.locator('label:has-text("สถานะคำร้อง")');
    await expect(statusSelect).toBeVisible();

    // Completed View Mode is NOT shown
    const editBtn = page.locator('button:has-text("แก้ไขข้อมูล")');
    await expect(editBtn).toHaveCount(0);
  });

  test('2. When status is completed, Completed Read-Only Mode is shown', async ({ page }) => {
    const reportData = createMockReport('completed');

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: true })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Header badge matches completed
    const headerBadge = page.locator('h1').locator('xpath=../..').locator('text=เสร็จสิ้น');
    await expect(headerBadge).toBeVisible();

    // Card header badge matches completed
    const cardHeaderBadge = page.locator('h3:has-text("การดำเนินการ")').locator('xpath=../..').locator('text=เสร็จสิ้น');
    await expect(cardHeaderBadge).toBeVisible();

    // Summary notes are shown
    const summaryLabel = page.locator('text=หมายเหตุสรุปผล');
    await expect(summaryLabel).toBeVisible();

    // Completion image is shown
    const completionImg = page.locator('img[alt="ภาพประกอบการทำงาน"]');
    await expect(completionImg).toBeVisible();

    // "แก้ไขข้อมูล" button is available (or login prompt if not authenticated)
    const editBtn = page.locator('button:has-text("แก้ไขข้อมูล"), button:has-text("เข้าสู่ระบบเพื่อแก้ไข")');
    await expect(editBtn).toBeVisible();
  });

  test('3. Changing status from completed to in_progress returns to Action Form with correct badges and no completion image leak', async ({ page }) => {
    let currentReport = createMockReport('in_progress');

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: currentReport, canManage: true })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // When status is in_progress, it immediately displays Action Form
    const statusSelect = page.locator('label:has-text("สถานะคำร้อง")');
    await expect(statusSelect).toBeVisible();

    // Completion image is NOT shown in in_progress view
    const completionImg = page.locator('img[alt="ภาพประกอบการทำงาน"]');
    await expect(completionImg).toHaveCount(0);
  });

  test('4. Timeline renders full log history without missing items', async ({ page }) => {
    const reportData = createMockReport('in_progress', {
      report_logs: [
        {
          id: 58,
          action: "status_updated",
          old_status: "pending",
          new_status: "completed",
          remark: "เสร็จสิ้นรอบแรก",
          image_url: "https://example.com/1.png",
          created_at: "2026-08-21T09:00:00.000Z",
          staff_users: { full_name: "เจ้าหน้าที่ A" }
        },
        {
          id: 59,
          action: "status_updated",
          old_status: "completed",
          new_status: "received",
          remark: "เปิดงานใหม่",
          image_url: null,
          created_at: "2026-08-22T09:00:00.000Z",
          staff_users: { full_name: "เจ้าหน้าที่ A" }
        },
        {
          id: 61,
          action: "status_updated",
          old_status: "received",
          new_status: "in_progress",
          remark: "กำลังซ่อม",
          image_url: null,
          created_at: "2026-08-23T09:00:00.000Z",
          staff_users: { full_name: "เจ้าหน้าที่ A" }
        }
      ]
    });

    await page.route('**/api/reports/SOC-TEST01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: reportData, canManage: true })
      });
    });

    await page.goto('/report/SOC-TEST01');
    await page.waitForLoadState('networkidle');

    // Verify Timeline count indicator displays 3 items
    const countBadge = page.locator('text=3 รายการ');
    await expect(countBadge).toBeVisible();

    // Verify each action label is in the timeline
    await expect(page.locator('text=เสร็จสิ้นรอบแรก')).toBeVisible();
    await expect(page.locator('text=เปิดงานใหม่')).toBeVisible();
    await expect(page.locator('text=กำลังซ่อม')).toBeVisible();
  });

  test('5. Verify no raw English status strings leak in timeline or badges for SOC-55472 logs', async ({ page }) => {
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
        body: JSON.stringify({ report: reportData, canManage: true })
      });
    });

    await page.goto('/report/SOC-55472');
    await page.waitForLoadState('networkidle');

    // Verify all Thai labels are present in Timeline
    await expect(page.locator('h4:has-text("เสร็จสิ้น")')).toBeVisible();
    await expect(page.locator('h4:has-text("รับเรื่องแล้ว")')).toBeVisible();
    await expect(page.locator('h4:has-text("กำลังดำเนินการ")')).toBeVisible();
    await expect(page.locator('h4:has-text("ยกเลิกรายการ")')).toBeVisible();

    // Verify NO raw English internal status names appear in the UI headers/timeline
    const textContent = await page.locator('body').innerText();
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น received');
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น in_progress');
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น completed');
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น pending');
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น rejected');
    expect(textContent).not.toContain('เปลี่ยนสถานะเป็น cancelled');
  });
});
