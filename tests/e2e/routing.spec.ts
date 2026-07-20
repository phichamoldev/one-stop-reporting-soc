import { test, expect } from '@playwright/test';

test.describe('Routing and Smoke Tests', () => {
  test('Home page loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    // Make sure we didn't get a 404 or 500
    expect(response?.status()).toBeLessThan(400);
    
    // Check that we have a title or some known content
    // We will just verify it renders without crashing
    await expect(page).toHaveTitle(/ระบบรับแจ้งปัญหา One Stop Service/i);
  });

  // More routing tests will be added after we discover what routes exist
});
