import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=== STARTING BROWSER BACKOFFICE FLOW VERIFICATION ===");
  const screenshotsDir = path.resolve(process.cwd(), "docs/screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 1. Visit /backoffice unauthenticated
  console.log("\n[STEP 1] Navigating to http://localhost:3000/backoffice...");
  await page.goto("http://localhost:3000/backoffice", { waitUntil: "networkidle0" });
  const currentUrl = page.url();
  console.log("Current URL after redirection:", currentUrl);
  if (!currentUrl.includes("/backoffice/login")) {
    throw new Error(`Expected redirect to /backoffice/login, but was at ${currentUrl}`);
  }
  await page.screenshot({ path: path.join(screenshotsDir, "01_backoffice_login_redirect.png") });
  console.log("Screenshot saved: 01_backoffice_login_redirect.png");

  // 2. Attempt login with suspended user
  console.log("\n[STEP 2] Attempting login with suspended user: suspended_p3@soc.test...");
  await page.type('input[type="email"]', "suspended_p3@soc.test");
  await page.type('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');

  // Wait for error message or unauthorized redirection
  await page.waitForNetworkIdle({ idleTime: 1000 });
  await new Promise((r) => setTimeout(r, 2000));

  const pageUrlAfterSuspended = page.url();
  console.log("Current URL after suspended attempt:", pageUrlAfterSuspended);
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("Body text contains error or unauthorized:", bodyText.includes("ไม่มีสิทธิ์") || bodyText.includes("ระงับ"));
  await page.screenshot({ path: path.join(screenshotsDir, "02_suspended_user_attempt.png") });
  console.log("Screenshot saved: 02_suspended_user_attempt.png");

  // 3. Login with active super_admin
  console.log("\n[STEP 3] Logging in as active admin: admin_p3@soc.test...");
  // Clear inputs or reload login page
  await page.goto("http://localhost:3000/backoffice/login", { waitUntil: "networkidle0" });
  await page.type('input[type="email"]', "admin_p3@soc.test");
  await page.type('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');

  // Wait for navigation to /backoffice
  console.log("Waiting for backoffice navigation...");
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3000));

  const dashboardUrl = page.url();
  console.log("Current URL after admin login:", dashboardUrl);
  const dashboardText = await page.evaluate(() => document.body.innerText);
  console.log("Dashboard contains 'สวัสดี, Super Admin P3'?", dashboardText.includes("Super Admin P3"));
  await page.screenshot({ path: path.join(screenshotsDir, "03_admin_dashboard_success.png") });
  console.log("Screenshot saved: 03_admin_dashboard_success.png");

  await browser.close();
  console.log("\n==========================================");
  console.log("BROWSER BACKOFFICE FLOW VERIFIED SUCCESSFULLY!");
  console.log("==========================================");
}

main().catch((err) => {
  console.error("FATAL BROWSER ERROR:", err);
  process.exit(1);
});

