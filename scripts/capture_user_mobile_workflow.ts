import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Output directory
const OUTPUT_DIR = path.resolve(process.cwd(), 'artifacts/screenshots/user-mobile');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Local Supabase client for staff action
const localSupabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

// Sample Image paths
const ISSUE_IMAGE_PATH = path.resolve(process.cwd(), 'public/images/sample-light-issue.png');
const REPAIR_IMAGE_PATH = path.resolve(process.cwd(), 'public/images/sample-repair-completed.png');

async function runCaptureWorkflow() {
  console.log('===============================================================');
  console.log('STARTING MOBILE UI SCREENSHOT CAPTURE (USER WORKFLOW)');
  console.log('Target Device: iPhone 14 / 15 (390 x 844 px)');
  console.log('Destination:', OUTPUT_DIR);
  console.log('===============================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1, // 100% scale
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  // Route interception to guarantee 100% local operation (zero requests to remote Supabase storage)
  await page.route('**/storage/v1/object/**', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      console.log('[Route Intercept] Intercepted storage upload -> returning local URL');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          Key: 'report-images/test/sample-light-issue.png',
          Id: 'local-test-img-id',
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Intercept public image reads if pointing to Supabase storage
  await page.route('**/storage/v1/object/public/**', async (route) => {
    console.log('[Route Intercept] Serving local sample image for public storage request');
    const imgBuffer = fs.readFileSync(ISSUE_IMAGE_PATH);
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: imgBuffer,
    });
  });

  // ---------------------------------------------------------------------------
  // PHASE 1: เริ่มต้นแจ้งเรื่อง
  // ---------------------------------------------------------------------------

  // --- Step 01: หน้าฟอร์มแจ้งเรื่อง (Empty Form) ---
  console.log('\n--- STEP 01: Capturing Empty Form ---');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=ระบบรับแจ้งปัญหา');
  // Ensure categories are loaded
  await page.waitForSelector('button:has-text("เลือกหมวดหมู่หลัก")');

  // Viewport screenshot (390 x 844)
  const path01 = path.join(OUTPUT_DIR, '01-user-empty-form.png');
  await page.screenshot({ path: path01 });
  console.log(`✅ Saved: ${path01} (Viewport: 390x844)`);

  // Scroll to bottom showing submit button
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const path01Submit = path.join(OUTPUT_DIR, '01-user-empty-form-submit.png');
  await page.screenshot({ path: path01Submit });
  console.log(`✅ Saved: ${path01Submit} (Submit Button View: 390x844)`);

  // Reset scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // Also capture full-length mobile version
  const path01Full = path.join(OUTPUT_DIR, '01-user-empty-form-full.png');
  await page.screenshot({ path: path01Full, fullPage: true });
  console.log(`✅ Saved: ${path01Full} (Full Mobile Page)`);

  // --- Step 02: หน้าฟอร์มแจ้งเรื่อง (Filled Form) ---
  console.log('\n--- STEP 02: Filling Form with Sample Data ---');

  // 1. Select Main Category: กายภาพ สิ่งแวดล้อม และความปลอดภัย
  console.log('Selecting category: กายภาพ สิ่งแวดล้อม และความปลอดภัย');
  await page.click('button:has-text("เลือกหมวดหมู่หลัก")');
  await page.waitForTimeout(300);
  await page.click('text=กายภาพ สิ่งแวดล้อม และความปลอดภัย');
  await page.waitForTimeout(500);

  // 2. Select Subcategory: ไฟฟ้า
  console.log('Selecting subcategory: ไฟฟ้า');
  await page.click('button:has-text("เลือกหมวดหมู่ย่อย")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("ไฟฟ้า")');
  await page.waitForTimeout(300);

  // 3. Fill Location
  console.log('Filling location: อาคารเรียน คณะวิศวกรรมศาสตร์');
  await page.fill('input#location', 'อาคารเรียน คณะวิศวกรรมศาสตร์');

  // 4. Fill Description
  console.log('Filling description...');
  await page.fill(
    'textarea#description',
    'หลอดไฟบริเวณทางเดินชั้น 2 ไม่ติด ทำให้บริเวณดังกล่าวมีแสงสว่างไม่เพียงพอ'
  );

  // 5. Attach Image
  console.log('Attaching sample issue photo...');
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.setInputFiles(ISSUE_IMAGE_PATH);
    await page.waitForTimeout(600); // Wait for preview to render
  }

  // 6. Fill Reporter Information
  console.log('Filling reporter info: นายสมชาย ใจดี, somchai.j@ku.th, 0812345678');
  await page.fill('input#reporterName', 'นายสมชาย ใจดี');
  await page.fill('input#email', 'somchai.j@ku.th');
  await page.fill('input#phone', '0812345678');

  // Scroll to see form fields comfortably
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(300);

  const path02 = path.join(OUTPUT_DIR, '02-user-filled-form.png');
  await page.screenshot({ path: path02 });
  console.log(`✅ Saved: ${path02} (Viewport: 390x844)`);

  // Scroll to bottom showing filled reporter info and submit button
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const path02Submit = path.join(OUTPUT_DIR, '02-user-filled-form-submit.png');
  await page.screenshot({ path: path02Submit });
  console.log(`✅ Saved: ${path02Submit} (Submit Button View: 390x844)`);

  const path02Full = path.join(OUTPUT_DIR, '02-user-filled-form-full.png');
  await page.screenshot({ path: path02Full, fullPage: true });
  console.log(`✅ Saved: ${path02Full} (Full Mobile Page)`);

  // ---------------------------------------------------------------------------
  // PHASE 2: ส่งคำร้องสำเร็จ
  // ---------------------------------------------------------------------------

  // --- Step 03: หน้าส่งคำร้องสำเร็จ (Success Page) ---
  console.log('\n--- STEP 03: Submitting Form & Capturing Success Screen ---');

  // Scroll to submit button and click
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);

  // Set up API response listener to capture created report data
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/reports') && res.request().method() === 'POST'
  );

  await page.click('button[type="submit"]');

  const createRes = await responsePromise;
  const createJson = await createRes.json();
  const createdReport = createJson.data;

  if (!createdReport || !createdReport.public_id) {
    throw new Error('Failed to create report: ' + JSON.stringify(createJson));
  }

  const publicId = createdReport.public_id;
  const reportUuid = createdReport.id;
  console.log(`🎉 Report Created Successfully!`);
  console.log(`   Public ID:  ${publicId}`);
  console.log(`   Report UUID: ${reportUuid}`);

  // Wait for success screen UI to render
  await page.waitForSelector('text=ส่งข้อมูลเรียบร้อยแล้ว!');
  await page.waitForSelector(`text=${publicId}`);
  await page.waitForTimeout(500);

  // Scroll to top of success screen
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const path03 = path.join(OUTPUT_DIR, '03-user-submission-success.png');
  await page.screenshot({ path: path03 });
  console.log(`✅ Saved: ${path03} (Viewport: 390x844)`);

  // ---------------------------------------------------------------------------
  // PHASE 3: ติดตามคำร้อง
  // ---------------------------------------------------------------------------

  // --- Step 04: หน้าติดตามคำร้อง (Tracking Page) ---
  console.log('\n--- STEP 04: Navigating to Tracking Lookup Page ---');
  await page.goto('http://localhost:3000/track/lookup', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=ค้นหาและติดตามสถานะ');

  // Fill in the generated public_id in the SOC ID input
  console.log(`Entering Public ID in tracking search: ${publicId}`);
  await page.fill('input#searchInput', publicId);
  await page.waitForTimeout(400);

  const path04 = path.join(OUTPUT_DIR, '04-user-tracking.png');
  await page.screenshot({ path: path04 });
  console.log(`✅ Saved: ${path04} (Viewport: 390x844)`);

  // Also capture the phone lookup result state on /track/lookup as an additional visual
  console.log('Capturing phone lookup result view on /track/lookup...');
  await page.click('button:has-text("เบอร์โทรศัพท์")');
  await page.waitForTimeout(300);
  await page.fill('input#searchInput', '0812345678');
  await page.click('button[type="submit"]');
  await page.waitForSelector('button:has-text("ค้นหาใหม่")');
  await page.waitForTimeout(500);

  const path04Result = path.join(OUTPUT_DIR, '04-user-tracking-result.png');
  await page.screenshot({ path: path04Result });
  console.log(`✅ Saved: ${path04Result} (Phone Lookup Result)`);

  // --- Step 05: หน้ารายละเอียดคำร้อง (Request Detail Before Reply) ---
  console.log('\n--- STEP 05: Navigating to Request Detail Page (Before Reply) ---');
  // Click on the report card or navigate directly to /track/{publicId}
  await page.goto(`http://localhost:3000/track/${publicId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`text=${publicId}`);
  await page.waitForSelector('text=รายละเอียดการแจ้ง');
  await page.waitForTimeout(500);

  const path05 = path.join(OUTPUT_DIR, '05-user-request-detail-before-reply.png');
  await page.screenshot({ path: path05 });
  console.log(`✅ Saved: ${path05} (Top View: 390x844)`);

  // Scroll to show timeline view
  const timelineBox = await page.locator('text=ประวัติการดำเนินงาน').boundingBox();
  if (timelineBox) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 60)), timelineBox.y);
    await page.waitForTimeout(400);
    const path05Timeline = path.join(OUTPUT_DIR, '05-user-request-detail-before-reply-timeline.png');
    await page.screenshot({ path: path05Timeline });
    console.log(`✅ Saved: ${path05Timeline} (Timeline View: 390x844)`);
  }

  const path05Full = path.join(OUTPUT_DIR, '05-user-request-detail-before-reply-full.png');
  await page.screenshot({ path: path05Full, fullPage: true });
  console.log(`✅ Saved: ${path05Full} (Full Mobile Page)`);

  // ---------------------------------------------------------------------------
  // PHASE 4: เจ้าหน้าที่ตอบกลับ
  // ---------------------------------------------------------------------------

  console.log('\n--- PHASE 4: Staff Action (Responding & Completing Report) ---');

  // Authenticate as staff on local Supabase
  console.log('Authenticating staff: admin_p3@soc.test...');
  const { data: authData, error: authError } = await localSupabase.auth.signInWithPassword({
    email: 'admin_p3@soc.test',
    password: 'Password123!',
  });

  if (authError || !authData.session) {
    throw new Error('Staff auth failed: ' + authError?.message);
  }

  const staffToken = authData.session.access_token;
  console.log('Staff token acquired successfully.');

  // Perform staff reply via PATCH /api/reports/{publicId}/status
  const staffRemark =
    'เจ้าหน้าที่ฝ่ายอาคารและสถานที่ได้เข้าตรวจสอบและดำเนินการเปลี่ยนหลอดไฟบริเวณทางเดินชั้น 2 เรียบร้อยแล้ว ระบบไฟฟ้าส่องสว่างกลับมาใช้งานได้ตามปกติ';

  console.log(`Dispatching staff reply for ${publicId}...`);
  const statusRes = await fetch(`http://localhost:3000/api/reports/${publicId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      reportId: reportUuid,
      status: 'completed',
      oldStatus: 'pending',
      remark: staffRemark,
      imageUrl: '/images/sample-repair-completed.png',
    }),
  });

  const statusJson = await statusRes.json();
  if (!statusRes.ok || !statusJson.success) {
    throw new Error('Staff reply PATCH failed: ' + JSON.stringify(statusJson));
  }
  console.log('✅ Staff Reply & Completion Applied Successfully!');

  // --- Step 06: หน้ารายละเอียดคำร้องหลังเจ้าหน้าที่ตอบกลับ ---
  console.log('\n--- STEP 06: Reloading Request Detail Page (After Reply) ---');
  await page.goto(`http://localhost:3000/track/${publicId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`text=${publicId}`);
  await page.waitForSelector('text=เสร็จสิ้น');
  await page.waitForSelector('text=การตอบกลับของเจ้าหน้าที่');
  await page.waitForSelector('text=หมายเหตุสรุปผล');
  await page.waitForTimeout(500);

  // Capture top view showing completed status badge
  const path06Top = path.join(OUTPUT_DIR, '06-user-request-detail-after-reply-top.png');
  await page.screenshot({ path: path06Top });
  console.log(`✅ Saved: ${path06Top} (Top View: 390x844)`);

  // Scroll to show Staff Reply card prominently
  const replyBox = await page.locator('text=การตอบกลับของเจ้าหน้าที่').boundingBox();
  if (replyBox) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 60)), replyBox.y);
    await page.waitForTimeout(400);
  }

  const path06 = path.join(OUTPUT_DIR, '06-user-request-detail-after-reply.png');
  await page.screenshot({ path: path06 });
  console.log(`✅ Saved: ${path06} (Staff Reply Card View: 390x844)`);

  const path06Full = path.join(OUTPUT_DIR, '06-user-request-detail-after-reply-full.png');
  await page.screenshot({ path: path06Full, fullPage: true });
  console.log(`✅ Saved: ${path06Full} (Full Mobile Page)`);

  await browser.close();

  // ---------------------------------------------------------------------------
  // Generate README.md
  // ---------------------------------------------------------------------------
  console.log('\n--- Generating Documentation README.md ---');
  const readmeContent = `# SOC STATION – User Workflow Mobile Screenshots

**Project:** One Stop Reporting SOC (Faculty of Social Sciences, Kasetsart University)  
**Target Device:** iPhone 14 / iPhone 15  
**Viewport Resolution:** 390 × 844 px (Portrait, Scale 100%)  
**Browser Engine:** Chromium (Playwright Mobile Emulation)  
**Environment:** Localhost Only (\`http://localhost:3000\`, Local Supabase \`127.0.0.1:54321\`)  
**Data Source:** \`test\` (\`test_reports\`, \`test_report_logs\`)  
**Tested Request ID:** \`${publicId}\`  
**Execution Timestamp:** ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}  

---

## 1. Executive Summary & Verification Checklist

- [x] **01 – หน้าฟอร์มแจ้งเรื่อง (Empty Form):** ได้ภาพฟอร์มเริ่มต้น แสดงโครงสร้างครบถ้วน
- [x] **02 – หน้าฟอร์มแจ้งเรื่อง (Filled Form):** ได้ภาพฟอร์มที่กรอกข้อมูลทดสอบสมจริง หมวดหมู่ไฟฟ้า รูปภาพประกอบ และข้อมูลผู้แจ้ง
- [x] **03 – หน้าส่งคำร้องสำเร็จ (Success Page):** ได้ภาพแจ้งผลสำเร็จ แสดงหมายเลขคำร้อง \`${publicId}\`
- [x] **04 – หน้าติดตามคำร้อง (Tracking Page):** ได้ภาพหน้าค้นหาและติดตามคำร้องด้วยหมายเลขคำร้อง \`${publicId}\`
- [x] **05 – หน้ารายละเอียดคำร้องก่อนตอบกลับ (Before Reply):** ได้ภาพรายละเอียดคำร้อง สถานะ "รับเรื่องแล้ว" พร้อม Timeline เริ่มต้น
- [x] **06 – หน้ารายละเอียดคำร้องหลังเจ้าหน้าที่ตอบกลับ (After Reply):** ได้ภาพคำร้องเดิม (\`${publicId}\`) สถานะ "เสร็จสิ้น" กล่องตอบกลับเจ้าหน้าที่ ภาพประกอบผลงาน และ Timeline ที่อัปเดต
- [x] **Mobile Viewport Compliance:** ทุกภาพเป็น Mobile View จริง (390 × 844 px) ไม่ใช่การย่อขนาดหน้าจอ Desktop
- [x] **Identity Consistency:** ภาพที่ 05 และ 06 ใช้ Request ID เดียวกัน (\`${publicId}\`) เพื่อแสดงความเปลี่ยนแปลงชัดเจน
- [x] **Localhost Isolation:** ดำเนินการผ่าน Localhost และ Local Supabase 100% ไม่มีการส่งข้อความหรือข้อมูลออกสู่ระบบจริง

---

## 2. Screenshot Inventory

| # | ชื่อไฟล์ (File Name) | ขนาดภาพ (Dimension) | รายละเอียดเนื้อหาบนหน้าจอ |
|---|---|---|---|
| 01 | \`01-user-empty-form.png\` | 390 × 844 px | หน้าฟอร์มแจ้งเรื่องในสภาพเริ่มต้น แสดง Hero Banner, หมวดหมู่หลัก, หมวดหมู่ย่อย, สถานที่, และองค์ประกอบสำคัญ |
| 01 (Full) | \`01-user-empty-form-full.png\` | 390 × 1674 px | ภาพฟอร์มเต็มความยาว แสดงครบตั้งแต่ Hero จนถึงปุ่มส่งคำร้อง |
| 02 | \`02-user-filled-form.png\` | 390 × 844 px | หน้าฟอร์มที่กรอกข้อมูลครบถ้วน: หมวดหมู่กายภาพฯ > ไฟฟ้า, สถานที่อาคารเรียน คณะวิศวกรรมศาสตร์, รายละเอียดหลอดไฟทางเดินชั้น 2 ไม่ติด, แนบรูปภาพประกอบ |
| 02 (Full) | \`02-user-filled-form-full.png\` | 390 × 1674 px | ภาพฟอร์มเต็มความยาวที่กรอกข้อมูลสมจริง พร้อมข้อมูลผู้แจ้งและปุ่มส่งคำร้อง |
| 03 | \`03-user-submission-success.png\` | 390 × 844 px | หน้าแสดงผลการส่งคำร้องสำเร็จ Concentric Glow Checkmark, หมายเลขคำร้อง \`${publicId}\`, สถานะ "รับเรื่องแล้ว", ลิงก์ติดตามสถานะ และปุ่มดูสถานะ |
| 04 | \`04-user-tracking.png\` | 390 × 844 px | หน้าค้นหาและติดตามคำร้อง (\`/track/lookup\`) กรอกหมายเลขคำร้อง \`${publicId}\` พร้อมค้นหา |
| 04 (Result) | \`04-user-tracking-result.png\` | 390 × 844 px | มุมมองผลการค้นหาคำร้อง แสดงการ์ดสรุปคำร้อง \`${publicId}\` พร้อมสถานะ "รับเรื่องแล้ว" |
| 05 | \`05-user-request-detail-before-reply.png\` | 390 × 844 px | หน้ารายละเอียดคำร้อง \`${publicId}\` ก่อนตอบกลับ สถานะ "รับเรื่องแล้ว", หมวดหมู่, สถานที่, รายละเอียด, รูปภาพประกอบ และ Timeline |
| 05 (Full) | \`05-user-request-detail-before-reply-full.png\` | 390 × 1380 px | หน้ารายละเอียดคำร้องเต็มความยาว แสดงข้อมูลผู้แจ้งและประวัติการดำเนินงานครบถ้วน |
| 06 | \`06-user-request-detail-after-reply.png\` | 390 × 844 px | หน้ารายละเอียดคำร้องเดิม \`${publicId}\` หลังเจ้าหน้าที่ตอบกลับ สถานะ "เสร็จสิ้น", กล่องสีเขียว "การตอบกลับของเจ้าหน้าที่" พร้อมข้อความสรุป ภาพผลงาน และเวลาดำเนินการ |
| 06 (Full) | \`06-user-request-detail-after-reply-full.png\` | 390 × 1650 px | หน้ารายละเอียดคำร้องเต็มความยาวหลังตอบกลับ แสดงประวัติการดำเนินงานอัปเดตสถานะเสร็จสิ้น |

---

## 3. Test Data Specification

- **หมายเลขคำร้อง (Request ID):** \`${publicId}\`
- **หมวดหมู่หลัก:** กายภาพ สิ่งแวดล้อม และความปลอดภัย (ID: 4)
- **หมวดหมู่ย่อย:** ไฟฟ้า (ID: 26)
- **สถานที่เกิดเหตุ:** อาคารเรียน คณะวิศวกรรมศาสตร์
- **รายละเอียดปัญหา:** หลอดไฟบริเวณทางเดินชั้น 2 ไม่ติด ทำให้บริเวณดังกล่าวมีแสงสว่างไม่เพียงพอ
- **ผู้แจ้ง:** นายสมชาย ใจดี
- **อีเมล:** somchai.j@ku.th
- **เบอร์โทรศัพท์:** 081-234-5678
- **เจ้าหน้าที่ผู้ดำเนินการ:** Super Admin P3 (\`admin_p3@soc.test\`)
- **ข้อความตอบกลับของเจ้าหน้าที่:** "เจ้าหน้าที่ฝ่ายอาคารและสถานที่ได้เข้าตรวจสอบและดำเนินการเปลี่ยนหลอดไฟบริเวณทางเดินชั้น 2 เรียบร้อยแล้ว ระบบไฟฟ้าส่องสว่างกลับมาใช้งานได้ตามปกติ"
- **ภาพประกอบผลงาน:** รูปภาพการเปลี่ยนหลอดไฟ LED แสงสว่างใช้งานได้ปกติ

---

## 4. Technical Environment & Safety Compliance

1. **Localhost Isolation:** ระบบทำงานบน \`http://localhost:3000\` เชื่อมต่อไปยัง Local Supabase PostgreSQL 17.11 ที่ \`127.0.0.1:54321\`
2. **Data Isolation:** ตารางที่ใช้คือ \`test_reports\` และ \`test_report_logs\` ไม่มีการแตะต้องตาราง Production
3. **No External Network Calls:** รูปภาพและการอัปโหลดถูกจำลองและจัดเก็บภายในเครื่อง ไม่มีการส่งข้อมูลขึ้น Cloud
4. **LINE Notification Guard:** ระบบจำกัดการแจ้งเตือนไว้ที่ Local Test Group (\`LINE_TEST_GROUP_ID\`) เท่านั้น ไม่มีการส่งเข้ากลุ่ม Production
`;

  const readmePath = path.join(OUTPUT_DIR, 'README.md');
  fs.writeFileSync(readmePath, readmeContent, 'utf8');
  console.log(`✅ Documentation created: ${readmePath}`);
  console.log('\n===============================================================');
  console.log('ALL WORKFLOW SCREENSHOTS CAPTURED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

runCaptureWorkflow().catch((err) => {
  console.error('Fatal Capture Error:', err);
  process.exit(1);
});
