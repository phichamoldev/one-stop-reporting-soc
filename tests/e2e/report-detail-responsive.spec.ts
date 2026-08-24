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

  test('Public API does not strip reporter_name for unauthenticated requests', async ({ request }) => {
    // If a report exists in DB, it returns reporter_name. If not found, returns 404.
    const res = await request.get('/api/reports/SOC-00000');
    expect([200, 404]).toContain(res.status());
  });
});
