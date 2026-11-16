import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import puppeteer from "puppeteer";

async function run10StepRegression() {
  // Read existing super_admin password from workspace test_auth.js without logging it
  const testAuthContent = fs.readFileSync("test_auth.js", "utf8");
  const passMatch = testAuthContent.match(/password:\s*['"]([^'"]+)['"]/);
  if (!passMatch?.[1]) {
    throw new Error("Could not read password from test_auth.js");
  }
  const existingEmail = "soc_onestop@ku.th";
  const existingPassword = passMatch[1];
  const expectedUserId = "77668994-3535-4126-8d4a-84abbb2dee8c";

  const consoleLogs: { type: string; text: string }[] = [];
  const authApiResponses: { url: string; status: number }[] = [];
  const profileApiResponses: { url: string; status: number; body: any }[] = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    page.on("console", (msg) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    page.on("pageerror", (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      consoleLogs.push({ type: "pageerror", text: msg });
    });

    page.on("response", async (res) => {
      const url = res.url();
      if (url.includes("/auth/v1/token")) {
        authApiResponses.push({ url, status: res.status() });
      }
      if (url.includes("/api/staff/profile")) {
        let body = null;
        try {
          body = await res.json();
        } catch {}
        profileApiResponses.push({ url, status: res.status(), body });
      }
    });

    console.log("=== 10-STEP BACKOFFICE LOGIN REGRESSION SUITE ===");

    // STEP 1: Open /backoffice/login
    const step1Res = await page.goto("http://localhost:3000/backoffice/login", {
      waitUntil: "networkidle0",
    });
    const step1Pass =
      step1Res?.status() === 200 &&
      page.url().includes("/backoffice/login");
    console.log(
      `[Step 1] Open /backoffice/login -> HTTP ${step1Res?.status()} | URL=${page.url()} | ${step1Pass ? "PASS" : "FAIL"}`
    );

    // STEP 2: Login with existing Staff account (soc_onestop@ku.th)
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', existingEmail);
    await page.type('input[type="password"]', existingPassword);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForFunction(
        () => window.location.pathname === "/backoffice",
        { timeout: 15000 }
      ),
    ]);
    await new Promise((r) => setTimeout(r, 1500));
    console.log(
      `[Step 2] Submit Login Form (${existingEmail}) -> Redirected to ${page.url()} | PASS`
    );

    // STEP 3: Verify Supabase Auth Response
    const tokenRes = authApiResponses.find((r) =>
      r.url.includes("grant_type=password")
    );
    const step3Pass = tokenRes?.status === 200;
    console.log(
      `[Step 3] Verify Supabase Auth Response -> status=${tokenRes?.status} | ${step3Pass ? "PASS" : "FAIL"}`
    );

    // STEP 4: Verify Session in Browser Storage (without printing tokens)
    const sessionCheck = await page.evaluate(() => {
      const raw = window.localStorage.getItem("soc-backoffice-auth-token");
      if (!raw) return { exists: false };
      try {
        const parsed = JSON.parse(raw);
        return {
          exists: true,
          hasAccessToken: Boolean(parsed.access_token),
          hasRefreshToken: Boolean(parsed.refresh_token),
          userId: parsed.user?.id || null,
          email: parsed.user?.email || null,
        };
      } catch {
        return { exists: false };
      }
    });
    const step4Pass =
      sessionCheck.exists &&
      sessionCheck.hasAccessToken &&
      sessionCheck.userId === expectedUserId;
    console.log(
      `[Step 4] Verify Session -> storageKey=soc-backoffice-auth-token | hasAccessToken=${sessionCheck.hasAccessToken} | user.id=${sessionCheck.userId} | matchesAuthUsersId=${sessionCheck.userId === expectedUserId} | ${step4Pass ? "PASS" : "FAIL"}`
    );

    // STEP 5: Verify Staff Profile API Response
    const profRes = profileApiResponses[profileApiResponses.length - 1];
    const step5Pass =
      profRes?.status === 200 &&
      profRes?.body?.profile?.id === expectedUserId &&
      profRes?.body?.profile?.role === "super_admin" &&
      profRes?.body?.profile?.status === "active";
    console.log(
      `[Step 5] Verify Staff Profile -> HTTP ${profRes?.status} | id=${profRes?.body?.profile?.id} | role=${profRes?.body?.profile?.role} | status=${profRes?.body?.profile?.status} | full_name=${profRes?.body?.profile?.full_name} | ${step5Pass ? "PASS" : "FAIL"}`
    );

    // STEP 6: Verify /backoffice Dashboard Renders
    const dashText = await page.evaluate(() => document.body.innerText);
    const step6Pass =
      page.url() === "http://localhost:3000/backoffice" &&
      (dashText.includes("ผู้ดูแลระบบสูงสุด") || dashText.includes("ภาพรวม"));
    console.log(
      `[Step 6] Open /backoffice -> URL=${page.url()} | Renders Staff Name=${dashText.includes("ผู้ดูแลระบบสูงสุด")} | ${step6Pass ? "PASS" : "FAIL"}`
    );

    // STEP 7: Refresh /backoffice and Verify Session Persists
    const reloadRes = await page.reload({ waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));
    const afterReloadText = await page.evaluate(() => document.body.innerText);
    const step7Pass =
      reloadRes?.status() === 200 &&
      page.url() === "http://localhost:3000/backoffice" &&
      afterReloadText.includes("ผู้ดูแลระบบสูงสุด");
    console.log(
      `[Step 7] Refresh /backoffice -> HTTP ${reloadRes?.status()} | URL=${page.url()} | Session Persisted=${afterReloadText.includes("ผู้ดูแลระบบสูงสุด")} | ${step7Pass ? "PASS" : "FAIL"}`
    );

    // STEP 8: Open /backoffice/incidents
    const incRes = await page.goto(
      "http://localhost:3000/backoffice/incidents",
      { waitUntil: "networkidle0" }
    );
    await new Promise((r) => setTimeout(r, 1500));
    const incText = await page.evaluate(() => document.body.innerText);
    const step8Pass =
      incRes?.status() === 200 &&
      page.url() === "http://localhost:3000/backoffice/incidents" &&
      incText.includes("กลุ่มเหตุการณ์");
    console.log(
      `[Step 8] Open /backoffice/incidents -> HTTP ${incRes?.status()} | URL=${page.url()} | Renders Incidents Page=${incText.includes("กลุ่มเหตุการณ์")} | ${step8Pass ? "PASS" : "FAIL"}`
    );

    // STEP 9: Logout
    await page.waitForSelector('button[title="ออกจากระบบ"]', { timeout: 10000 });
    await page.click('button[title="ออกจากระบบ"]');
    await page.waitForFunction(
      () => window.location.pathname.includes("/backoffice/login"),
      { timeout: 10000 }
    );
    const sessionAfterLogout = await page.evaluate(() =>
      window.localStorage.getItem("soc-backoffice-auth-token")
    );
    const step9Pass =
      page.url().includes("/backoffice/login") && !sessionAfterLogout;
    console.log(
      `[Step 9] Logout -> Redirected to ${page.url()} | Storage Cleared=${!sessionAfterLogout} | ${step9Pass ? "PASS" : "FAIL"}`
    );

    // STEP 10: Attempt to open /backoffice while logged out
    await page.goto("http://localhost:3000/backoffice", {
      waitUntil: "networkidle0",
    });
    await page.waitForFunction(
      () => window.location.pathname.includes("/backoffice/login"),
      { timeout: 10000 }
    );
    const step10Pass = page
      .url()
      .includes("/backoffice/login?next=%2Fbackoffice");
    console.log(
      `[Step 10] Open /backoffice Unauthenticated -> Redirected to ${page.url()} | ${step10Pass ? "PASS" : "FAIL"}`
    );

    // Check Browser Console for Multiple GoTrueClient warnings or errors
    const goTrueWarnings = consoleLogs.filter((c) =>
      c.text.includes("Multiple GoTrueClient")
    );
    const consoleErrors = consoleLogs.filter(
      (c) => c.type === "error" || c.type === "pageerror"
    );

    console.log("\n=== BROWSER CONSOLE AUDIT ===");
    console.log(`Total console messages: ${consoleLogs.length}`);
    console.log(
      `Multiple GoTrueClient warnings: ${goTrueWarnings.length} (Expected: 0)`
    );
    console.log(`Console/Page errors: ${consoleErrors.length} (Expected: 0)`);
    if (consoleLogs.length > 0) {
      for (const c of consoleLogs) {
        console.log(`  [${c.type}] ${c.text}`);
      }
    }
  } finally {
    await browser.close();
  }
}

run10StepRegression();

