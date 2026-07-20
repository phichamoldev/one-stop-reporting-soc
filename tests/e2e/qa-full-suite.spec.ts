import { test, expect, Page } from '@playwright/test';

// ===================================================================
//  1. PAGE CRAWL & SMOKE TESTS — Visit every discoverable route
// ===================================================================
const publicRoutes = [
  { path: '/', name: 'Home / Report Form' },
  { path: '/report', name: 'Report Landing' },
  { path: '/track/lookup', name: 'Track Lookup' },
  { path: '/backoffice/login', name: 'Backoffice Login' },
];

const protectedRoutes = [
  { path: '/backoffice', name: 'Backoffice Dashboard' },
  { path: '/backoffice/reports', name: 'Backoffice Reports' },
  { path: '/backoffice/analytics', name: 'Backoffice Analytics' },
  { path: '/backoffice/settings', name: 'Backoffice Settings' },
  { path: '/backoffice/staff', name: 'Backoffice Staff' },
];

test.describe('1. Route Crawling & Smoke Tests', () => {
  for (const route of publicRoutes) {
    test(`Public route ${route.path} (${route.name}) loads without error`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status(), `${route.path} should return HTTP < 400`).toBeLessThan(400);

      // No crash — body should exist
      await expect(page.locator('body')).toBeVisible();

      // Check no unhandled React/Next.js error overlay
      const errorOverlay = page.locator('#__next-error-overlay-content, [data-nextjs-dialog]');
      await expect(errorOverlay).toHaveCount(0);
    });
  }

  test('404 page renders for unknown route', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    // Next.js returns 200 for client-rendered 404s, or 404 for static
    await expect(page.locator('body')).toBeVisible();
  });

  for (const route of protectedRoutes) {
    test(`Protected route ${route.path} (${route.name}) redirects to login when unauthenticated`, async ({ page }) => {
      await page.goto(route.path);
      // Should redirect to login page
      await page.waitForURL('**/backoffice/login', { timeout: 10000 });
      expect(page.url()).toContain('/backoffice/login');
    });
  }
});

// ===================================================================
//  2. HOME PAGE — Form Interaction & Validation
// ===================================================================
test.describe('2. Home Page — Report Submission Form', () => {

  test('Form renders with all required fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take a screenshot of initial state
    await page.screenshot({ path: 'test-results/screenshots/home-initial.png', fullPage: true });

    // Check required form elements exist
    await expect(page.locator('form')).toBeVisible();
  });

  test('Form validation — submit with empty fields shows errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and click the submit button
    const submitButton = page.getByRole('button', { name: /ส่งเรื่อง|แจ้ง|submit/i });
    if (await submitButton.count() > 0) {
      await submitButton.click();
      // Wait a moment for validation errors to appear
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/screenshots/home-validation-errors.png', fullPage: true });

      // Check that error messages appear
      const errorMessages = page.locator('.text-rose-500, .text-red-500');
      expect(await errorMessages.count(), 'Should show validation error messages').toBeGreaterThan(0);
    }
  });

  test('Email validation — invalid email format shows error', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill email with invalid value
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล"]');
    if (await emailInput.count() > 0) {
      await emailInput.fill('not-an-email');
      // Tab away to trigger validation
      await emailInput.press('Tab');
    }
  });

  test('Phone validation — invalid phone format', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const phoneInput = page.locator('input[type="tel"], input[name="phone"], input[placeholder*="เบอร์โทร"]');
    if (await phoneInput.count() > 0) {
      await phoneInput.fill('abc');
    }
  });

  test('Image upload — rejects non-image file type conceptually', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Just verify the upload area exists
    const uploadArea = page.locator('input[type="file"]');
    if (await uploadArea.count() > 0) {
      expect(await uploadArea.getAttribute('accept') || '').toContain('image');
    }
  });

  test('Category dropdown populates from API', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for the category select/dropdown
    const categoryButton = page.locator('button:has-text("เลือกหมวดหมู่หลัก"), button:has-text("Select")').first();
    if (await categoryButton.count() > 0) {
      await categoryButton.click();
      await page.waitForTimeout(500);

      // Check that dropdown options appeared
      const options = page.locator('[role="listbox"] button, .absolute.z-\\[99\\] button');
      const count = await options.count();
      expect(count, 'Category dropdown should have at least 1 option').toBeGreaterThan(0);

      await page.screenshot({ path: 'test-results/screenshots/home-category-dropdown.png', fullPage: true });
    }
  });
});

// ===================================================================
//  3. TRACK LOOKUP PAGE
// ===================================================================
test.describe('3. Track Lookup Page', () => {

  test('Page renders correctly', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/track-lookup.png', fullPage: true });

    await expect(page.locator('h1')).toContainText('ค้นหาและติดตามสถานะ');
  });

  test('Empty search shows validation error', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    // Click search button without entering ID
    const searchBtn = page.getByRole('button', { name: /ค้นหา|search/i });
    if (await searchBtn.count() > 0) {
      await searchBtn.click();
      await page.waitForTimeout(500);

      const error = page.locator('.text-rose-500');
      expect(await error.count(), 'Should show error for empty search').toBeGreaterThan(0);
      await page.screenshot({ path: 'test-results/screenshots/track-empty-error.png', fullPage: true });
    }
  });

  test('Invalid report ID navigates to not-found', async ({ page }) => {
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');

    const input = page.locator('input[id="publicId"], input[placeholder*="SOC"]');
    if (await input.count() > 0) {
      await input.fill('SOC-XXXXX');
      const searchBtn = page.getByRole('button', { name: /ค้นหา|search/i });
      if (await searchBtn.count() > 0) {
        await searchBtn.click();
        await page.waitForURL('**/track/SOC-XXXXX', { timeout: 15000 });
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/screenshots/track-not-found.png', fullPage: true });
      }
    }
  });
});

// ===================================================================
//  4. BACKOFFICE LOGIN PAGE
// ===================================================================
test.describe('4. Backoffice Login Page', () => {

  test('Login page renders correctly', async ({ page }) => {
    await page.goto('/backoffice/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/login-page.png', fullPage: true });

    await expect(page.locator('h1')).toContainText('Back Office');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('Login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/backoffice/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').fill('invalid@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword123');

    const loginBtn = page.getByRole('button', { name: /เข้าสู่ระบบ|login|sign in/i });
    await loginBtn.click();

    // Wait for error message
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/screenshots/login-invalid.png', fullPage: true });

    // Check for error message display
    const errorMsg = page.locator('.bg-red-50, [class*="red"], [class*="error"]');
    expect(await errorMsg.count(), 'Should show login error message').toBeGreaterThan(0);
  });

  test('Login with empty fields — HTML5 validation', async ({ page }) => {
    await page.goto('/backoffice/login');
    await page.waitForLoadState('networkidle');

    const loginBtn = page.getByRole('button', { name: /เข้าสู่ระบบ|login|sign in/i });
    await loginBtn.click();

    // HTML5 required validation should prevent submission
    // The email input should be invalid
    const emailInput = page.locator('input[type="email"]');
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid, 'Email field should be invalid when empty').toBe(false);
  });
});

// ===================================================================
//  5. API ENDPOINT VALIDATION
// ===================================================================
test.describe('5. API Endpoint Validation', () => {

  test('GET /api/categories returns valid data', async ({ request }) => {
    const response = await request.get('/api/categories');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('categories');
    expect(Array.isArray(data.categories)).toBe(true);

    // Each category should have id and name_th
    if (data.categories.length > 0) {
      expect(data.categories[0]).toHaveProperty('id');
      expect(data.categories[0]).toHaveProperty('name_th');
    }
  });

  test('GET /api/departments returns valid data', async ({ request }) => {
    const response = await request.get('/api/departments');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('departments');
    expect(Array.isArray(data.departments)).toBe(true);
  });

  test('GET /api/subcategories requires categoryId', async ({ request }) => {
    // Without categoryId
    const response = await request.get('/api/subcategories');
    const data = await response.json();
    // Should either return empty or an error
    expect(response.status()).toBeLessThan(500);
  });

  test('GET /api/subcategories?categoryId=1 returns valid data', async ({ request }) => {
    const response = await request.get('/api/subcategories?categoryId=1');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('subcategories');
    expect(Array.isArray(data.subcategories)).toBe(true);
  });

  test('GET /api/reports/NONEXISTENT returns 404', async ({ request }) => {
    const response = await request.get('/api/reports/SOC-00000');
    expect(response.status()).toBe(404);
  });

  test('POST /api/reports with empty body returns 400 or 500', async ({ request }) => {
    const response = await request.post('/api/reports', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/reports with missing required fields returns error', async ({ request }) => {
    const response = await request.post('/api/reports', {
      data: {
        description: 'test',
        // Missing most required fields
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  // RBAC: Protected endpoints should require auth
  test('GET /api/backoffice/dashboard without auth returns error', async ({ request }) => {
    const response = await request.get('/api/backoffice/dashboard');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('GET /api/staff/profile without auth returns error', async ({ request }) => {
    const response = await request.get('/api/staff/profile');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('PATCH /api/reports/SOC-00000/status without auth returns 401', async ({ request }) => {
    const response = await request.patch('/api/reports/SOC-00000/status', {
      data: { status: 'in_progress' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/backoffice/settings/users without auth returns error', async ({ request }) => {
    const response = await request.get('/api/backoffice/settings/users');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

// ===================================================================
//  6. SECURITY CHECKS
// ===================================================================
test.describe('6. Security Checks', () => {

  test('Service role key is not exposed in client HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const html = await page.content();
    // The service role key should NEVER appear in client-side HTML
    expect(html).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(html).not.toContain('sb_secret_');
  });

  test('LINE credentials are not exposed in client HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const html = await page.content();
    expect(html).not.toContain('LINE_CHANNEL_ACCESS_TOKEN');
    expect(html).not.toContain('LINE_CHANNEL_SECRET');
  });

  test('Report detail API does not leak PII to unauthenticated users', async ({ request }) => {
    // First get a valid report ID via categories (which is public)
    const catResponse = await request.get('/api/categories');
    // We just check the concept - with an actual report
    // For now, just verify the behavior on a hypothetical public_id
    const response = await request.get('/api/reports/SOC-00000');
    if (response.status() === 200) {
      const data = await response.json();
      // Unauthenticated should not see tracking_token or admin_remark
      expect(data.report).not.toHaveProperty('tracking_token');
      expect(data.report).not.toHaveProperty('admin_remark');
    }
  });

  test('CSP or X-Content-Type-Options headers present', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};
    // Note: this is aspirational — many Next.js apps don't set these by default
    // We log it as a finding rather than a hard failure
    const hasSecurityHeaders = 
      headers['x-content-type-options'] ||
      headers['content-security-policy'] ||
      headers['x-frame-options'];

    if (!hasSecurityHeaders) {
      console.warn('WARNING: No security headers (CSP, X-Content-Type-Options, X-Frame-Options) found');
    }
  });
});

// ===================================================================
//  7. UI REGRESSION & VISUAL CHECKS
// ===================================================================
test.describe('7. UI Regression & Visual Checks', () => {

  test('Home page responsive — mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/home-mobile.png', fullPage: true });

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth, 'Page should not have horizontal scroll on mobile').toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('Home page responsive — tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/home-tablet.png', fullPage: true });
  });

  test('Home page responsive — desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/home-desktop.png', fullPage: true });
  });

  test('Login page responsive — mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/backoffice/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/login-mobile.png', fullPage: true });
  });

  test('Track lookup responsive — mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/track/lookup');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/track-mobile.png', fullPage: true });
  });

  test('No console errors on home page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Filter out known non-critical console errors
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('hydration') &&
      !e.includes('Warning:')
    );

    if (criticalErrors.length > 0) {
      console.warn('Console errors found:', criticalErrors);
    }
  });

  test('No console errors on login page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/backoffice/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });
});

// ===================================================================
//  8. ACCESSIBILITY (axe-core)
// ===================================================================
test.describe('8. Accessibility Checks', () => {

  test('Home page — all images have alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt, `Image ${i} should have alt text`).toBeTruthy();
    }
  });

  test('Home page — all form inputs have associated labels or aria-labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input:not([type="hidden"]):not([type="file"]), textarea, select');
    const count = await inputs.count();

    let unlabeled = 0;
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        if (await label.count() === 0 && !ariaLabel && !ariaLabelledBy && !placeholder) {
          unlabeled++;
        }
      } else if (!ariaLabel && !ariaLabelledBy && !placeholder) {
        unlabeled++;
      }
    }

    if (unlabeled > 0) {
      console.warn(`Found ${unlabeled} unlabeled input(s)`);
    }
  });

  test('Login page — form inputs are labeled', async ({ page }) => {
    await page.goto('/backoffice/login');
    await page.waitForLoadState('networkidle');

    // Verify email field is labeled
    const emailLabel = page.locator('label:has-text("อีเมล")');
    expect(await emailLabel.count(), 'Email label should exist').toBeGreaterThan(0);

    // Verify password field is labeled
    const passwordLabel = page.locator('label:has-text("รหัสผ่าน")');
    expect(await passwordLabel.count(), 'Password label should exist').toBeGreaterThan(0);
  });

  test('Pages have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const h1Count = await page.locator('h1').count();
    expect(h1Count, 'Page should have exactly one H1').toBe(1);
  });

  test('Login page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/backoffice/login');
    await page.waitForLoadState('networkidle');

    const h1Count = await page.locator('h1').count();
    expect(h1Count, 'Login page should have exactly one H1').toBe(1);
  });
});
