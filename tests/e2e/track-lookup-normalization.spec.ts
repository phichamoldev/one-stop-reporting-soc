import { test, expect } from '@playwright/test';

test.describe('Track Lookup Normalization Tests', () => {
  const mockReport = {
    id: 1234,
    public_id: "SOC-80397",
    status: "received",
    title: "ก๊อกน้ำรั่วในห้องน้ำชั้น 2",
    description: "มีน้ำหยดตลอดเวลา",
    location: "อาคาร 1 ชั้น 2",
    created_at: "2026-08-24T10:00:00.000Z",
    updated_at: "2026-08-24T11:00:00.000Z",
    categories: { id: 1, name_th: "อาคารและสถานที่" },
    subcategories: { id: 1, name_th: "ประปา" },
    report_logs: [
      {
        id: 1,
        action: "status_updated",
        new_status: "received",
        remark: "รับเรื่องแล้ว",
        created_at: "2026-08-24T11:00:00.000Z",
        staff_users: { full_name: "เจ้าหน้าที่" }
      }
    ]
  };

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/reports/SOC-80397', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ report: mockReport, canManage: false })
      });
    });

    await page.route('**/api/reports/SOC-99999', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: "ไม่พบข้อมูลรายงาน" })
      });
    });
  });

  test('1. Lookup with full standard format "SOC-80397" navigates to /track/SOC-80397', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    await page.fill('#searchInput', 'SOC-80397');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/track/SOC-80397');
    await expect(page.locator('h1:has-text("SOC-80397")')).toBeVisible();
  });

  test('2. Lookup with pure digits "80397" normalizes and navigates to /track/SOC-80397', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    await page.fill('#searchInput', '80397');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/track/SOC-80397');
    await expect(page.locator('h1:has-text("SOC-80397")')).toBeVisible();
  });

  test('3. Lookup with lowercase "soc-80397" normalizes and navigates to /track/SOC-80397', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    await page.fill('#searchInput', 'soc-80397');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/track/SOC-80397');
    await expect(page.locator('h1:has-text("SOC-80397")')).toBeVisible();
  });

  test('4. Lookup with leading/trailing whitespace "  soc-80397  " normalizes to /track/SOC-80397', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    await page.fill('#searchInput', '  soc-80397  ');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/track/SOC-80397');
    await expect(page.locator('h1:has-text("SOC-80397")')).toBeVisible();
  });

  test('5. Lookup with leading/trailing whitespace around digits "  80397  " normalizes to /track/SOC-80397', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    await page.fill('#searchInput', '  80397  ');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/track/SOC-80397');
    await expect(page.locator('h1:has-text("SOC-80397")')).toBeVisible();
  });

  test('6. Lookup with no hyphen "SOC80397" / "soc80397" normalizes to /track/SOC-80397', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    await page.fill('#searchInput', 'SOC80397');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/track/SOC-80397');
    await expect(page.locator('h1:has-text("SOC-80397")')).toBeVisible();
  });

  test('7. Non-existent report ID (e.g. "99999" or "SOC-99999") shows Not Found page gracefully', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    await page.fill('#searchInput', '99999');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/track/SOC-99999');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2:has-text("ไม่พบข้อมูล")')).toBeVisible();
  });
});
