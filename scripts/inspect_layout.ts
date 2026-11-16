import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function testInspection() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const heroBox = await page.locator('div[style*="hero-bg2.png"]').boundingBox();
  const formBox = await page.locator('form').boundingBox();
  const catSelect = await page.locator('text=เลือกหมวดหมู่หลัก').first().boundingBox();
  const submitBtn = await page.locator('button[type="submit"]').boundingBox();

  console.log('Hero:', heroBox);
  console.log('Form:', formBox);
  console.log('CatSelect:', catSelect);
  console.log('SubmitBtn:', submitBtn);

  await browser.close();
}

testInspection().catch(console.error);

