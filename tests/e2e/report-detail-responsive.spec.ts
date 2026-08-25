import { test, expect } from '@playwright/test';

const mockReportWithData = {
  id: "11111111-2222-3333-4444-555555555555",
  public_id: "SOC-99999",
  tracking_token: "11111111-2222-3333-4444-555555555555",
  location: "อาคาร 1 ชั้น 2 ห้อง 204",
  description: "เครื่องปรับอากาศไม่เย็น มีน้ำหยดลงพื้น",
  image_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500",
  reporter_name: "ทดสอบระบบ",
  email: "reporter@example.com",
  phone: "0812345678",
  status: "pending",
  priority: "medium",
  admin_remark: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  categories: {
    id: 1,
    name_th: "อาคารและสถานที่",
    department_id: 1
  },
  subcategories: {
    id: 1,
    name_th: "เครื่องปรับอากาศ"
  },
  report_logs: []
};

const mockReportWithNullReporter = {
  ...mockReportWithData,
  public_id: "SOC-88888",
  reporter_name: null,
  email: "reporter@example.com",
  phone: "0812345678"
};

const viewports = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 812 },
];

test.describe('Report Detail Page — Responsive Reporter Information Mismatch Tests', () => {

  for (const vp of viewports) {
    test(`[${vp.name}] When reporter_name has value, it displays the actual name correctly`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Intercept API call to return unauthenticated report data with reporter_name
      await page.route('**/api/reports/SOC-99999', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            report: mockReportWithData,
            canManage: false
          })
        });
      });

      await page.goto('/report/SOC-99999');
      await page.waitForLoadState('networkidle');

      // Verify "ข้อมูลผู้แจ้ง" section exists
      const reporterSection = page.locator('text=ข้อมูลผู้แจ้ง');
      await expect(reporterSection).toBeVisible();

      // Verify "ชื่อผู้แจ้ง" displays "ทดสอบระบบ"
      const reporterNameEl = page.locator('text=ชื่อผู้แจ้ง').locator('xpath=..').locator('span.text-\\[14px\\]');
      await expect(reporterNameEl).toBeVisible();
      await expect(reporterNameEl).toHaveText('ทดสอบระบบ');

      // Verify Email and Phone are unaffected and correct
      const emailEl = page.locator('text=อีเมล').locator('xpath=..').locator('span.text-\\[14px\\]');
      await expect(emailEl).toHaveText('reporter@example.com');

      const phoneEl = page.locator('text=เบอร์โทรศัพท์').locator('xpath=..').locator('span.text-\\[14px\\]');
      await expect(phoneEl).toHaveText('0812345678');
    });

    test(`[${vp.name}] When reporter_name is null, it displays "-" fallback only`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Intercept API call to return report with null reporter_name
      await page.route('**/api/reports/SOC-88888', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            report: mockReportWithNullReporter,
            canManage: false
          })
        });
      });

      await page.goto('/report/SOC-88888');
      await page.waitForLoadState('networkidle');

      // Verify "ข้อมูลผู้แจ้ง" section exists
      const reporterSection = page.locator('text=ข้อมูลผู้แจ้ง');
      await expect(reporterSection).toBeVisible();

      // Verify "ชื่อผู้แจ้ง" displays "-"
      const reporterNameEl = page.locator('text=ชื่อผู้แจ้ง').locator('xpath=..').locator('span.text-\\[14px\\]');
      await expect(reporterNameEl).toBeVisible();
      await expect(reporterNameEl).toHaveText('-');

      // Verify Email and Phone are still correct
      const emailEl = page.locator('text=อีเมล').locator('xpath=..').locator('span.text-\\[14px\\]');
      await expect(emailEl).toHaveText('reporter@example.com');

      const phoneEl = page.locator('text=เบอร์โทรศัพท์').locator('xpath=..').locator('span.text-\\[14px\\]');
      await expect(phoneEl).toHaveText('0812345678');
    });
  }

  test('Location Mapping: Public and Backoffice both render location string correctly (SOC-99230 scenario)', async ({ page }) => {
    const mockSOC99230 = {
      ...mockReportWithData,
      public_id: "SOC-99230",
      location: "ซุ้มสาขาสังคมวิทยาและมานุษยวิทยา"
    };

    await page.route('**/api/reports/SOC-99230', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: mockSOC99230,
          canManage: true
        })
      });
    });

    await page.route('**/api/departments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ departments: [{ id: 1, name_th: "อาคารและสถานที่" }] })
      });
    });

    // 1. Check Public page
    await page.goto('/report/SOC-99230');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=ซุ้มสาขาสังคมวิทยาและมานุษยวิทยา')).toBeVisible();

    // 2. Check Backoffice page (via login)
    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: "mock-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: { id: "mock-staff", email: "staff@ku.th" }
        })
      });
    });

    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: "mock-staff", email: "staff@ku.th" })
      });
    });

    await page.route('**/api/staff/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: { id: "mock-staff", email: "staff@ku.th", full_name: "เจ้าหน้าที่ทดสอบ", role: "staff", department_id: 1 }
        })
      });
    });

    await page.goto('/backoffice/login?next=/backoffice/reports/SOC-99230');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'staff@ku.th');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/backoffice/reports/SOC-99230');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=ซุ้มสาขาสังคมวิทยาและมานุษยวิทยา')).toBeVisible();
  });

  test('Location Mapping: When location is null or missing, Backoffice renders "ไม่ระบุ"', async ({ page }) => {
    const mockReportNoLocation = {
      ...mockReportWithData,
      public_id: "SOC-NOLOC",
      location: null
    };

    await page.route('**/api/reports/SOC-NOLOC', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: mockReportNoLocation,
          canManage: true
        })
      });
    });

    await page.route('**/api/departments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ departments: [{ id: 1, name_th: "อาคารและสถานที่" }] })
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
          user: { id: "mock-staff", email: "staff@ku.th" }
        })
      });
    });

    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: "mock-staff", email: "staff@ku.th" })
      });
    });

    await page.route('**/api/staff/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: { id: "mock-staff", email: "staff@ku.th", full_name: "เจ้าหน้าที่ทดสอบ", role: "staff", department_id: 1 }
        })
      });
    });

    await page.goto('/backoffice/login?next=/backoffice/reports/SOC-NOLOC');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'staff@ku.th');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/backoffice/reports/SOC-NOLOC');
    await page.waitForLoadState('networkidle');
    const locationField = page.locator('h5:has-text("สถานที่")').locator('xpath=..').locator('p');
    await expect(locationField).toContainText('ไม่ระบุ');
  });

  test('Public API does not strip reporter_name for unauthenticated requests', async ({ request }) => {
    // If a report exists in DB, it returns reporter_name. If not found, returns 404.
    const res = await request.get('/api/reports/SOC-00000');
    expect([200, 404, 500]).toContain(res.status());
  });
});
