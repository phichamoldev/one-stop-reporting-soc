import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicRoutes = [
  '/',
  '/report',
  '/track/lookup',
  '/backoffice/login'
];

test.describe('Accessibility scans on public routes', () => {
  for (const route of publicRoutes) {
    test(`Should not have any automatically detectable accessibility issues on ${route}`, async ({ page }) => {
      await page.goto(route);
      // Wait for network idle or main content to load
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});
