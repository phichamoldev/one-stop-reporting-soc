const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[AuthContext]') || text.includes('[Login]')) {
      logs.push(text);
      console.log(text);
    }
  });

  console.log("Navigating to login...");
  await page.goto('http://localhost:3000/backoffice/login');
  
  console.log("Filling form...");
  await page.fill('input[type="email"]', 'admin@soc.ku.ac.th');
  await page.fill('input[type="password"]', 'password123');
  
  console.log("Clicking login...");
  await page.click('button[type="submit"]');
  
  console.log("Waiting for backoffice or error...");
  await Promise.race([
    page.waitForURL('**/backoffice'),
    page.waitForSelector('.bg-red-50', { timeout: 10000 })
  ]);
  const err = await page.$('.bg-red-50');
  if (err) {
    console.log("Login Error:", await err.innerText());
    // mock successful login trace output if we can't really login
  } else {
    await page.waitForTimeout(2000);
  
    console.log("Clicking logout...");
    await page.evaluate(() => {
      // try to find signout button by svg or text
      const btns = Array.from(document.querySelectorAll('button'));
      const outBtn = btns.find(b => b.textContent.includes('ออก') || b.title.includes('ออก'));
      if (outBtn) outBtn.click();
    });
    
    console.log("Waiting for login page...");
    await page.waitForURL('**/backoffice/login**');
    await page.waitForTimeout(2000);
    
    console.log("Logging in again...");
    await page.fill('input[type="email"]', 'admin@soc.ku.ac.th');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    console.log("Waiting for backoffice...");
    await page.waitForURL('**/backoffice');
    await page.waitForTimeout(2000);
  }
  
  fs.writeFileSync('AUTH_LOGS.txt', logs.join('\n'));
  
  await browser.close();
  console.log("Done.");
})().catch(err => {
  console.error("Playwright script failed:", err);
  process.exit(1);
});
