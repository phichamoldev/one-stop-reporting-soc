const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[StaffAuthContext]') || text.includes('[AuthGuard]') || text.includes('[Sidebar]')) {
      logs.push(text);
      console.log(text);
    }
  });

  console.log("Navigating to login...");
  await page.goto('http://localhost:3000/backoffice/login');
  
  // Wait a bit
  await page.waitForTimeout(2000);

  console.log("Logging in as Staff...");
  await page.fill('input[type="email"]', 'staff@soc.ku.ac.th'); // Assuming staff email
  await page.fill('input[type="password"]', 'staff1234');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  
  console.log("Logging out...");
  try {
    await page.click('button[title="ออกจากระบบ"]');
  } catch (e) {
    console.log("Logout button not found, maybe login failed?");
  }
  
  await page.waitForTimeout(3000);

  console.log("Logging in as Super Admin...");
  await page.fill('input[type="email"]', 'admin@soc.ku.ac.th');
  await page.fill('input[type="password"]', 'admin1234');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(5000);
  
  fs.writeFileSync('runtime_logs.txt', logs.join('\n'));
  
  await browser.close();
})();
