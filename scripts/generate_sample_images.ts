import { chromium } from 'playwright';

async function generateImages() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Issue Image: Corridor with unlit lamp
  await page.setContent(`
    <div style="width:600px;height:400px;background:#1e293b;color:#f8fafc;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;top:20px;left:20px;background:#ef4444;color:white;padding:6px 14px;border-radius:20px;font-size:14px;font-weight:bold;">จุดเกิดเหตุ: หลอดไฟไม่ติด</div>
      <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
        <path d="M9 18h6M10 22h4M12 2v2M4.929 4.929l1.414 1.414M2 12h2M4.929 19.071l1.414-1.414M12 6a6 6 0 0 0-6 6c0 2.22 1.2 4.16 3 5.2V18h6v-.8c1.8-1.04 3-2.98 3-5.2a6 6 0 0 0-6-6Z" stroke-dasharray="2 2"/>
      </svg>
      <div style="margin-top:20px;font-size:18px;font-weight:bold;color:#e2e8f0;">อาคารเรียน คณะวิศวกรรมศาสตร์</div>
      <div style="margin-top:8px;font-size:14px;color:#94a3b8;">บริเวณทางเดิน ชั้น 2 ไฟฟ้าส่องสว่างดับ แสงสว่างไม่เพียงพอ</div>
    </div>
  `);
  const issueEl = await page.locator('div').first();
  await issueEl.screenshot({ path: 'public/images/sample-light-issue.png' });

  // 2. Completion Image: Repaired lamp with bright light
  await page.setContent(`
    <div style="width:600px;height:400px;background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;top:20px;left:20px;background:#10b981;color:white;padding:6px 14px;border-radius:20px;font-size:14px;font-weight:bold;">ผลการดำเนินงาน: เปลี่ยนหลอดไฟแล้ว</div>
      <svg width="100" height="100" viewBox="0 0 24 24" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5">
        <path d="M9 18h6M10 22h4M12 2v2M4.929 4.929l1.414 1.414M2 12h2M4.929 19.071l1.414-1.414M12 6a6 6 0 0 0-6 6c0 2.22 1.2 4.16 3 5.2V18h6v-.8c1.8-1.04 3-2.98 3-5.2a6 6 0 0 0-6-6Z"/>
      </svg>
      <div style="margin-top:20px;font-size:18px;font-weight:bold;color:#f8fafc;">ดำเนินการเปลี่ยนหลอดไฟ LED เรียบร้อย</div>
      <div style="margin-top:8px;font-size:14px;color:#cbd5e1;">แสงสว่างใช้งานได้ตามปกติ • ตรวจสอบความปลอดภัยแล้ว</div>
    </div>
  `);
  const fixedEl = await page.locator('div').first();
  await fixedEl.screenshot({ path: 'public/images/sample-repair-completed.png' });

  await browser.close();
  console.log('Sample images generated successfully');
}

generateImages().catch(console.error);

