import { test, expect } from '@playwright/test';

test.describe('Light Mode Only — System-Wide Enforcement Tests', () => {
  // Use dark mode colorScheme emulation to test OS dark mode override
  test.use({ colorScheme: 'dark' });

  test('1. Landing Page (/) renders in Light Mode when OS is in Dark Mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check root html data-theme and colorScheme
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Check computed background color of body (should be light)
    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    // #F5F6F8 = rgb(245, 246, 248) or #FFFFFF
    expect(bodyBg).not.toBe('rgb(13, 14, 18)');
    expect(bodyBg).not.toBe('rgb(15, 23, 42)');

    // Ensure main cards have white / light background
    const cardBg = await page.evaluate(() => {
      const card = document.querySelector('.bg-white, [class*="bg-white"]');
      return card ? window.getComputedStyle(card).backgroundColor : null;
    });
    if (cardBg) {
      expect(cardBg).toBe('rgb(255, 255, 255)');
    }
  });

  test('2. Track Page (/track) renders in Light Mode under OS Dark Mode across viewports', async ({ page }) => {
    // Desktop (1440px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/track');
    await page.waitForLoadState('networkidle');

    let htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    let bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).not.toBe('rgb(13, 14, 18)');

    // Tablet (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Mobile (375px)
    await page.setViewportSize({ width: 375, height: 667 });
    htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');
  });

  test('3. Report Detail Page (/report/[publicId]) renders in Light Mode under OS Dark Mode', async ({ page }) => {
    await page.route('**/api/reports/SOC-24060', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: {
            id: 'mock-report-id',
            public_id: 'SOC-24060',
            location: 'อาคาร 1',
            description: 'ทดสอบแจ้งปัญหา',
            status: 'in_progress',
            created_at: new Date().toISOString(),
            categories: { name_th: 'อาคารและสถานที่' },
            report_logs: []
          },
          canManage: false
        })
      });
    });

    await page.goto('/report/SOC-24060');
    await page.waitForLoadState('networkidle');

    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).not.toBe('rgb(13, 14, 18)');
  });

  test('4. Backoffice (/backoffice) renders in Light Mode even with stale darkmode in localStorage', async ({ page }) => {
    // Set stale darkmode in localStorage before page load
    await page.addInitScript(() => {
      localStorage.setItem('soc_backoffice_darkmode', 'true');
    });

    await page.route('**/api/staff/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: { id: 'mock-admin', email: 'admin@ku.th', full_name: 'ผู้ดูแลระบบ', role: 'admin' }
        })
      });
    });

    await page.goto('/backoffice/login');
    await page.waitForLoadState('networkidle');

    // html class should NOT contain .dark
    const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDarkClass).toBe(false);

    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');
  });
});
