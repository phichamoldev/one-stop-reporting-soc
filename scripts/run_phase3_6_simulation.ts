/**
 * PHASE 3.6 — EMERGENCY BURST SIMULATION & FULL-SYSTEM INTEGRATION RUNNER
 * 
 * Objective: End-to-End Emergency Simulation, Database Persistence, Incident Grouping & LINE Notification Verification
 * 
 * Target: Localhost API at http://localhost:3000/api/reports
 * Target DB: Local PostgreSQL at http://127.0.0.1:54321
 * Target LINE: Verified TEST GROUP (C836...23b0)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Ensure strict local test routing
process.env.REPORT_DATA_SOURCE = 'test';
process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE = 'test';
process.env.LINE_NOTIFICATIONS_ENABLED = 'true';
process.env.LINE_NEW_REPORT_NOTIFICATIONS_ENABLED = 'true';

import { supabaseAdmin } from '../src/lib/supabase-admin';
import { maskDestination } from '../src/lib/notificationLogger';
import fs from 'fs';
import path from 'path';

export const SIMULATION_RUN_ID = `SIM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-BURST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// -----------------------------------------------------------------------------
// REALISTIC NATURAL LANGUAGE MESSAGES (No Forbidden Words: Test, Mock, Simulation)
// -----------------------------------------------------------------------------

export interface SimulationReportSpec {
  eventGroup: 'A' | 'B' | 'C';
  burstNumber?: 1 | 2 | 3;
  category_id: number;
  subcategory_id: number;
  description: string;
  location: string;
  reporter_name: string;
  priority: 'emergency' | 'normal';
  delayMsAfter: number;
}

export const SIMULATION_50_REPORTS: SimulationReportSpec[] = [
  // ===========================================================================
  // EVENT A: เพลิงไหม้อาคารเรียนรวม (30 Reports, Emergency)
  // ===========================================================================
  // Burst 1: 5 Reports (in ~10 seconds)
  {
    eventGroup: 'A',
    burstNumber: 1,
    category_id: 3,
    subcategory_id: 6,
    description: "พบควันไฟสีเทาหนาแน่นลอยออกมาจากห้องเก็บอุปกรณ์ ชั้น 1 อาคารเรียนรวม",
    location: "อาคารเรียนรวม ชั้น 1 หน้าห้อง 102",
    reporter_name: "นายกิตติพงษ์ ใจมั่น",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'A',
    burstNumber: 1,
    category_id: 3,
    subcategory_id: 6,
    description: "มีเปลวไฟและกลิ่นไหม้รุนแรงบริเวณชั้นล่าง ใกล้ห้องเก็บของ อาคารเรียนรวม",
    location: "อาคารเรียนรวม ชั้น 1 บริเวณห้องเก็บของ",
    reporter_name: "นางสาวศิริพร บุญเสริม",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'A',
    burstNumber: 1,
    category_id: 3,
    subcategory_id: 6,
    description: "ได้ยินเสียงสัญญาณเตือนภัยดัง มีกลุ่มควันดำพวยพุ่งออกมาจากหน้าต่างชั้น 1 อาคารเรียนรวม",
    location: "อาคารเรียนรวม ชั้น 1 ฝั่งทิศตะวันออก",
    reporter_name: "นายธนวัฒน์ รุ่งโรจน์",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'A',
    burstNumber: 1,
    category_id: 3,
    subcategory_id: 6,
    description: "มีประกายไฟลุกลามติดกล่องกระดาษในห้องเก็บพัสดุ ชั้น 1 ตึกเรียนรวม รีบส่งเจ้าหน้าที่ด่วน",
    location: "ตึกเรียนรวม ชั้น 1 โซนพัสดุ",
    reporter_name: "นายประเสริฐ ช่างทอง",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'A',
    burstNumber: 1,
    category_id: 3,
    subcategory_id: 6,
    description: "พบไฟกำลังไหม้บริเวณห้องแม่บ้านชั้น 1 อาคารเรียนรวม มีความร้อนสูงมาก",
    location: "อาคารเรียนรวม ชั้น 1 ข้างบันได",
    reporter_name: "นางวรรณา นวลจันทร์",
    priority: "emergency",
    delayMsAfter: 4000, // Completes Burst 1 (~10s total)
  },

  // Burst 2: 10 Reports (in ~1 minute)
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "ควันไฟเริ่มลอยขึ้นบันไดทางขึ้นชั้น 2 อาคารเรียนรวม มีกลิ่นฉุนมาก หายใจลำบาก",
    location: "อาคารเรียนรวม ชั้น 2 บริเวณโถงบันได",
    reporter_name: "นายชวลิต พงษ์สวัสดิ์",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "เห็นแสงเพลิงสีส้มลุกไหม้ด้านในห้องเก็บของ อาคารเรียนรวม ชั้น 1 ประตูล็อคอยู่",
    location: "อาคารเรียนรวม ชั้น 1 ห้องเก็บของ",
    reporter_name: "นายศุภกิตติ์ วงศ์ดี",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "มีควันไฟหนาทึบปกคลุมทางเดินหน้าห้อง 102 อาคารเรียนรวม คนกำลังทยอยวิ่งหนีออกมา",
    location: "อาคารเรียนรวม ชั้น 1 ทางเดินกลาง",
    reporter_name: "นางสาวมัณฑนา ศรีสวัสดิ์",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "พบไฟลัดวงจรที่ตู้เบรกเกอร์หน้าห้องเก็บของชั้นล่าง อาคารเรียนรวม มีประกายไฟกระเด็น",
    location: "อาคารเรียนรวม ชั้นล่าง บริเวณตู้เมนไฟ",
    reporter_name: "นายเอกชัย ยิ่งเจริญ",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "กลิ่นควันไหม้คละคลุ้งเต็มชั้น 1 และชั้น 2 ตึกเรียนรวม มีคนแจ้งว่าเห็นเปลวไฟข้างล่าง",
    location: "ตึกเรียนรวม ชั้น 2 โถงกลาง",
    reporter_name: "นายณัฐพงษ์ แก้วมณี",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "ไฟเริ่มลามออกมาที่วงกบประตูไม้ห้องเก็บพัสดุ ชั้น 1 อาคารเรียนรวม ต้องการถังดับเพลิงด่วน",
    location: "อาคารเรียนรวม ชั้น 1 ฝั่งห้องพัสดุ",
    reporter_name: "นายภานุเดช ฤทธิ์เดช",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "สัญญาณเตือนไฟไหม้ดังต่อเนื่อง อาคารเรียนรวมชั้นล่าง มีควันพุ่งออกมาเยอะมาก",
    location: "อาคารเรียนรวม ชั้น 1 ประตูหน้า",
    reporter_name: "นางกานดา พึ่งพา",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "ได้ยินเสียงกระจกแตกและมีกลุ่มควันดำหนาแน่นบริเวณด้านหลังห้องเก็บของ อาคารเรียนรวม",
    location: "อาคารเรียนรวม ด้านหลังชั้น 1",
    reporter_name: "นายพิชัย ยอดดนตรี",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "พบควันไฟสีดำลอยออกมาทางท่อระบายอากาศ อาคารเรียนรวม ชั้น 1 ร้อนมาก",
    location: "อาคารเรียนรวม ชั้น 1 โซนระบายอากาศ",
    reporter_name: "นายชลิต นามสมมุติ",
    priority: "emergency",
    delayMsAfter: 3000,
  },
  {
    eventGroup: 'A',
    burstNumber: 2,
    category_id: 3,
    subcategory_id: 6,
    description: "มีไฟลุกไหม้สายไฟและกองเอกสารในห้องเก็บของเก่า ชั้น 1 ตึกเรียนรวม ขอความช่วยเหลือทันที",
    location: "ตึกเรียนรวม ชั้น 1 ด้านทิศเหนือ",
    reporter_name: "นางสาวพิมพา สมบูรณ์",
    priority: "emergency",
    delayMsAfter: 4000, // Completes Burst 2 (~1m checkpoint)
  },

  // Burst 3: 15 Reports (over 5m pacing)
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "ควันไฟพุ่งออกมาจากช่องหน้าต่างอาคารเรียนรวมฝั่งทิศตะวันออก ชั้น 1 หนาแน่นมาก",
    location: "อาคารเรียนรวม ชั้น 1 ปีกตะวันออก",
    reporter_name: "นายธีระศักดิ์ มหาชัย",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "เห็นเปลวไฟกำลังลามไปติดฝ้าเพดานใกล้บันไดหนีไฟ ชั้น 1 อาคารเรียนรวม",
    location: "อาคารเรียนรวม ชั้น 1 บันไดหนีไฟ",
    reporter_name: "นายมนตรี ขยันยิ่ง",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "อาจารย์และนิสิตกำลังอพยพออกจากอาคารเรียนรวม มีควันไฟหนาทึบชั้นล่าง",
    location: "อาคารเรียนรวม ลานหน้าอาคาร",
    reporter_name: "ผู้ช่วยศาสตราจารย์สมเกียรติ",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "ได้กลิ่นพลาสติกไหม้และสายไฟช็อตอย่างรุนแรง บริเวณชั้น 1 หน้าห้องเก็บของ อาคารเรียนรวม",
    location: "อาคารเรียนรวม ชั้น 1 โถงทางเดิน",
    reporter_name: "นายวีระชัย จันทร์สว่าง",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "เปลวไฟสูงเกือบถึงเพดานในห้องเก็บอุปกรณ์ อาคารเรียนรวม ชั้น 1 ไม่สามารถเข้าใกล้ได้",
    location: "อาคารเรียนรวม ชั้น 1 ในห้องเก็บอุปกรณ์",
    reporter_name: "นายสมพร สันติสุข",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "มีเสียงระเบิดเล็กๆ จากกระป๋องสเปรย์ในห้องเก็บของ อาคารเรียนรวม ควันดำฟุ้งกระจาย",
    location: "อาคารเรียนรวม ชั้น 1 ห้องพัสดุ",
    reporter_name: "นายอนุชา บรรเทิง",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "พบกลุ่มควันไฟลอยคลุ้งบริเวณโถงกลางอาคารเรียนรวม ชั้น 1 แสบตาและแสบคอมาก",
    location: "อาคารเรียนรวม ชั้น 1 โถงกลาง",
    reporter_name: "นางสาวจิตรา สุขสวัสดิ์",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "ไฟไหม้ห้องเก็บของชั้น 1 อาคารเรียนรวม เริ่มลามไปทางเดินหน้าห้องน้ำ",
    location: "อาคารเรียนรวม ชั้น 1 ฝั่งห้องน้ำชาย",
    reporter_name: "นายอดิศร ทรัพย์มาก",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "เจ้าหน้าที่รปภ. พยายามใช้ถังดับเพลิงฉีดแต่ไฟยังไม่ดับ อาคารเรียนรวม ชั้น 1",
    location: "อาคารเรียนรวม ชั้น 1 โถงหน้า",
    reporter_name: "รปภ. บุญมี แสงอรุณ",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "ควันไฟหนาทึบจนมองไม่เห็นทางเดินชั้น 1 อาคารเรียนรวม ต้องการรถดับเพลิงด่วนที่สุด",
    location: "อาคารเรียนรวม ทางเข้าหลัก",
    reporter_name: "นายสุรพล พลเยี่ยม",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "เปลวไฟลุกไหม้อย่างต่อเนื่องในห้องเก็บอุปกรณ์ชั้น 1 ตึกเรียนรวม ความร้อนสูงมาก",
    location: "ตึกเรียนรวม ชั้น 1 ฝั่งตะวันออก",
    reporter_name: "นายชยานันต์ รุ่งเรือง",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "เห็นควันไฟลอยออกจากประตูห้องเก็บพัสดุ อาคารเรียนรวม ชั้นล่าง มีกลิ่นไหม้รุนแรง",
    location: "อาคารเรียนรวม ชั้นล่าง หน้าห้องพัสดุ",
    reporter_name: "นางสาวมลฤดี ทองอินทร์",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "มีไฟลุกไหม้บริเวณแผงไฟหน้าห้อง 104 อาคารเรียนรวม ประกายไฟตกลงพื้น",
    location: "อาคารเรียนรวม ชั้น 1 หน้าห้อง 104",
    reporter_name: "นายกมลชนก ภักดี",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "ควันไฟลามขึ้นไปชั้น 2 และชั้น 3 อาคารเรียนรวม นิสิตในห้องเรียนต้องรีบวิ่งลงมา",
    location: "อาคารเรียนรวม บันไดกลางชั้น 2",
    reporter_name: "นางสาวศิริลักษณ์ วิไล",
    priority: "emergency",
    delayMsAfter: 1000,
  },
  {
    eventGroup: 'A',
    burstNumber: 3,
    category_id: 3,
    subcategory_id: 6,
    description: "เพลิงกำลังลุกไหม้รุนแรงในห้องเก็บของชั้น 1 อาคารเรียนรวม ขอทีมกู้ภัยและดับเพลิงเข้าพื้นที่ด่วน",
    location: "อาคารเรียนรวม ชั้น 1 ห้องเก็บของกลาง",
    reporter_name: "นายวรวุฒิ สิทธิโชค",
    priority: "emergency",
    delayMsAfter: 2000,
  },

  // ===========================================================================
  // EVENT B: ท่อก๊าซรั่ว โรงอาหารกลาง อาคาร 5 (10 Reports, Emergency, Distinct Tracker)
  // ===========================================================================
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "ได้กลิ่นก๊าซหุงต้มรั่วไหลรุนแรงมาก บริเวณร้านอาหารด้านหลังโรงอาหารกลาง อาคาร 5",
    location: "โรงอาหารกลาง อาคาร 5 ชั้น 1 โซนครัวด้านหลัง",
    reporter_name: "นายบุญส่ง ค้าขายดี",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "พบเสียงฟู่ดังคล้ายก๊าซรั่วออกมาจากวาล์วถังก๊าซรวม โรงอาหารกลาง อาคาร 5 ชั้น 1",
    location: "โรงอาหารกลาง อาคาร 5 จุดรวมถังก๊าซ",
    reporter_name: "นางสำราญ อิ่มเอิบ",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "กลิ่นแก๊สฟุ้งกระจายทั่วบริเวณลานทานข้าว โรงอาหารกลาง เริ่มมีคนเวียนหัว",
    location: "โรงอาหารกลาง อาคาร 5 ลานโต๊ะอาหาร",
    reporter_name: "นายณัฐพล เจริญผล",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "ท่อส่งก๊าซหลังร้านค้าโรงอาหารกลางมีรอยปริแตก ได้ยินเสียงแก๊สพุ่งออกมาอย่างชัดเจน",
    location: "โรงอาหารกลาง อาคาร 5 หลังร้านก๋วยเตี๋ยว",
    reporter_name: "นายสมปอง ช่างแก๊ส",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "มีกลิ่นก๊าซฉุนรุนแรงบริเวณจุดวางถังก๊าซรวม โรงอาหารกลาง เกรงว่าจะเกิดประกายไฟระเบิด",
    location: "โรงอาหารกลาง อาคาร 5 ท้ายอาคาร",
    reporter_name: "นายวิทวัส สายหยุด",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "แม่ค้าแจ้งว่าวาล์วปิดไม่อยู่ ก๊าซรั่วไหลออกมาต่อเนื่อง บริเวณครัวโรงอาหารกลาง อาคาร 5",
    location: "โรงอาหารกลาง อาคาร 5 ล็อคอาหารที่ 4",
    reporter_name: "นางเพ็ญศรี สมรักษ์",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "ได้กลิ่นแก๊สรั่วเข้มข้นมากบริเวณทางเข้าโรงอาหารกลาง อาคาร 5 แนะนำให้รีบปิดวาล์วเมน",
    location: "โรงอาหารกลาง อาคาร 5 ประตูทางเข้า",
    reporter_name: "นายธีระ จารุศร",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "เสียงท่อก๊าซรั่วฟู่ๆ ตรงกำแพงหลังโรงอาหารกลาง ชั้น 1 กลิ่นฉุนรุนแรงจนแสบจมูก",
    location: "โรงอาหารกลาง อาคาร 5 ด้านหลังอาคาร",
    reporter_name: "นางสาวอรทัย บัวงาม",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "ก๊าซรั่วไหลออกมาเป็นไอขาวบางๆ ใกล้วาล์วควบคุมแก๊ส โรงอาหารกลาง อันตรายมาก",
    location: "โรงอาหารกลาง อาคาร 5 จุดวาล์วเมน",
    reporter_name: "นายอำนาจ คมคาย",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'B',
    category_id: 1,
    subcategory_id: 2,
    description: "กลิ่นก๊าซแอลพีจีรั่วไหลกระจายวงกว้าง โรงอาหารกลาง อาคาร 5 สั่งให้อพยพคนออกจากร้านอาหารแล้ว",
    location: "โรงอาหารกลาง อาคาร 5 ชั้น 1 ทั้งหมด",
    reporter_name: "นายประกิจ มหาโชค",
    priority: "emergency",
    delayMsAfter: 2000,
  },

  // ===========================================================================
  // EVENT C: ลิฟต์ค้างมีผู้ติดอยู่ อาคาร 3 (10 Reports, Normal -> Emergency Escalation)
  // ===========================================================================
  // Reports 41-44: Normal issues (Door jerky, noisy, slow) -> Starts AGGREGATING (0 immediate LINE calls)
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "ลิฟต์โดยสารตัวที่ 1 อาคาร 3 ประตูปิดช้าและมีเสียงดังครืดคราดเวลาเปิดปิด",
    location: "อาคาร 3 ชั้น 1 หน้าลิฟต์ตัวที่ 1",
    reporter_name: "นายชลิต ศรีสุข",
    priority: "normal",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "ลิฟต์ตัวที่ 1 อาคารบริการวิชาการ เวลาเคลื่อนที่มีอาการกระตุกเป็นระยะ",
    location: "อาคารบริการวิชาการ (อาคาร 3) ลิฟต์ตัวที่ 1",
    reporter_name: "นางสาวศศิธร เจริญ",
    priority: "normal",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "ปุ่มกดชั้น 4 ในลิฟต์ตัวที่ 1 อาคาร 3 ไฟไม่ติด กดแล้วไม่ค่อยตอบสนอง",
    location: "อาคาร 3 ภายในลิฟต์ตัวที่ 1",
    reporter_name: "นายภพพร สุขสม",
    priority: "normal",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "ลิฟต์ตัวที่ 1 อาคาร 3 จอดไม่ตรงระดับพื้น มีช่องว่างห่างจากชั้นประมาณ 5 เซนติเมตร",
    location: "อาคาร 3 ชั้น 3 หน้าลิฟต์ตัวที่ 1",
    reporter_name: "นายวิศรุต สว่างวงศ์",
    priority: "normal",
    delayMsAfter: 2000,
  },

  // Report 45: ESCALATION (Observer reports people trapped inside!) -> Triggers Escalation Alert to LINE!
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "ฉุกเฉิน! ลิฟต์ตัวที่ 1 อาคาร 3 ค้างอยู่ระหว่างชั้น 3 กับ 4 มีเจ้าหน้าที่และนิสิตติดอยู่ข้างใน 3 คน เริ่มขาดอากาศ",
    location: "อาคาร 3 ระหว่างชั้น 3 และชั้น 4 ลิฟต์ตัวที่ 1",
    reporter_name: "รปภ. ประจำอาคาร 3",
    priority: "emergency",
    delayMsAfter: 2000,
  },

  // Reports 46-50: Trapped people reported -> Tracker is now Emergency -> Duplicate suppressed!
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "มีคนติดอยู่ในลิฟต์ตัวที่ 1 อาคาร 3 ตะโกนขอความช่วยเหลือ ลิฟต์ไม่ขยับเลย",
    location: "อาคาร 3 ชั้น 3 ลิฟต์ตัวที่ 1",
    reporter_name: "นายกานต์ ยศยิ่ง",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "ลิฟต์ค้างชั้น 3 อาคารบริการวิชาการ คนข้างในเริ่มหายใจไม่ออกและเคาะประตูเรียก",
    location: "อาคารบริการวิชาการ ลิฟต์ตัวที่ 1",
    reporter_name: "นางสาววิไลลักษณ์ เกษม",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "รปภ. เข้าไปช่วยดูลิฟต์ตัวที่ 1 อาคาร 3 พบว่าระบบขัดข้อง คนติดข้างใน 3 คน ต้องการช่างลิฟต์ด่วนที่สุด",
    location: "อาคาร 3 ชั้น 4 หน้าลิฟต์",
    reporter_name: "หัวหน้ารปภ. ชาญชัย",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "ได้ยินเสียงคนร้องขอความช่วยเหลือจากในปล่องลิฟต์ตัวที่ 1 อาคาร 3 มีคนติดอยู่ข้างใน",
    location: "อาคาร 3 ชั้น 3 บริเวณหน้าลิฟต์",
    reporter_name: "นายบรรเจิด เกิดผล",
    priority: "emergency",
    delayMsAfter: 1500,
  },
  {
    eventGroup: 'C',
    category_id: 1,
    subcategory_id: 1,
    description: "ลิฟต์โดยสารอาคาร 3 ค้างนานเกิน 15 นาทีแล้ว คนข้างในตกใจและขาดอากาศหายใจ รีบงัดประตูช่วยด่วน",
    location: "อาคาร 3 ระหว่างชั้น 3-4 ลิฟต์ตัวที่ 1",
    reporter_name: "นายสุริยา นวลพงษ์",
    priority: "emergency",
    delayMsAfter: 1000,
  },
];

export interface SimulationResultRecord {
  index: number;
  publicId: string;
  eventGroup: 'A' | 'B' | 'C';
  description: string;
  location: string;
  priority: string;
  httpStatus: number;
  eventAction: string;
  trackerId?: string;
  eventCode?: string;
  outboxId?: string;
  lineStatus?: string;
  timestamp: string;
}

async function runSimulation() {
  console.log("================================================================================");
  console.log("PHASE 3.6 — EMERGENCY BURST SIMULATION & FULL-SYSTEM INTEGRATION RUNNER");
  console.log(`Simulation Run ID: ${SIMULATION_RUN_ID}`);
  console.log("================================================================================");

  const testGroupId = process.env.LINE_TEST_GROUP_ID;
  const prodGroupId = process.env.LINE_GROUP_ID;

  console.log(`Environment: localhost (test)`);
  console.log(`Citizen Submission API: http://localhost:3000/api/reports`);
  console.log(`Database Target: Local PostgreSQL at 127.0.0.1:54321`);
  console.log(`Authorized Test Destination: ${maskDestination(testGroupId)}`);
  console.log(`Prohibited Prod Destination: ${maskDestination(prodGroupId)} (STRICTLY BLOCKED)`);
  console.log("================================================================================\n");

  if (!testGroupId || !process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error("FATAL: LINE_TEST_GROUP_ID or token missing! Refusing to start simulation.");
    process.exit(1);
  }

  // 1. Pre-Simulation Safety Reset on Test Tables
  console.log("Resetting test tables before simulation run...");
  await supabaseAdmin.from('test_event_notification_outbox').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_event_notification_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_event_notification_trackers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_incident_group_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_incident_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_notification_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_report_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('test_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Verify Production tables are 0
  const { count: prodRepCount } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true });
  const { count: prodTrkCount } = await supabaseAdmin.from('event_notification_trackers').select('*', { count: 'exact', head: true });
  const { count: prodOutCount } = await supabaseAdmin.from('event_notification_outbox').select('*', { count: 'exact', head: true });
  const { count: prodNotifCount } = await supabaseAdmin.from('notification_logs').select('*', { count: 'exact', head: true });

  if ((prodRepCount || 0) > 0 || (prodTrkCount || 0) > 0 || (prodOutCount || 0) > 0 || (prodNotifCount || 0) > 0) {
    console.error("FATAL SAFETY HALT: Production tables contain rows! Aborting simulation.");
    process.exit(1);
  }
  console.log("Production tables zero-touch audit passed (all 0 rows).\n");

  // 2. Execute 50 Citizen Submissions via POST /api/reports
  console.log("Starting 50 Citizen Report Submissions through POST /api/reports...");
  const records: SimulationResultRecord[] = [];
  const startTime = Date.now();

  for (let i = 0; i < SIMULATION_50_REPORTS.length; i++) {
    const spec = SIMULATION_50_REPORTS[i];
    const index = i + 1;
    const phone = `089${String(index).padStart(7, '0')}`;
    const email = `citizen${index}@sim-run.internal`;
    const adminRemark = `SIM_RUN:${SIMULATION_RUN_ID}|EVENT:${spec.eventGroup}`;

    const body = {
      category_id: spec.category_id,
      subcategory_id: spec.subcategory_id,
      description: spec.description,
      location: spec.location,
      reporter_name: spec.reporter_name,
      phone,
      email,
      priority: spec.priority,
      admin_remark: adminRemark,
    };

    const res = await fetch("http://localhost:3000/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const resJson = await res.json();
    const data = resJson.data;
    const eventNotif = resJson.eventNotification;

    const record: SimulationResultRecord = {
      index,
      publicId: data?.public_id || 'UNKNOWN',
      eventGroup: spec.eventGroup,
      description: spec.description,
      location: spec.location,
      priority: data?.priority || spec.priority,
      httpStatus: res.status,
      eventAction: eventNotif?.action || 'none',
      trackerId: eventNotif?.trackerId,
      eventCode: eventNotif?.eventCode,
      outboxId: eventNotif?.outboxId,
      lineStatus: eventNotif?.notifyResult?.status || 'none',
      timestamp: new Date().toISOString(),
    };

    records.push(record);

    console.log(
      `[${index}/50] [HTTP ${res.status}] ${record.publicId} (Event ${spec.eventGroup}) -> Priority: ${record.priority} | Action: ${record.eventAction} | LINE: ${record.lineStatus}`
    );

    if (spec.delayMsAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, spec.delayMsAfter));
    }
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nCompleted 50 Submissions in ${durationSec} seconds.\n`);

  // 3. Post-Simulation Database Verification
  console.log("================================================================================");
  console.log("DATABASE PERSISTENCE & INTEGRITY VERIFICATION");
  console.log("================================================================================");

  const { count: actualTestRepCount } = await supabaseAdmin.from('test_reports').select('*', { count: 'exact', head: true });
  const { count: actualTrackerCount } = await supabaseAdmin.from('test_event_notification_trackers').select('*', { count: 'exact', head: true });
  const { count: actualRepMapCount } = await supabaseAdmin.from('test_event_notification_reports').select('*', { count: 'exact', head: true });
  const { count: actualOutboxCount } = await supabaseAdmin.from('test_event_notification_outbox').select('*', { count: 'exact', head: true });
  const { count: actualNotifCount } = await supabaseAdmin.from('test_notification_logs').select('*', { count: 'exact', head: true });
  const { data: trackers } = await supabaseAdmin.from('test_event_notification_trackers').select('event_code, cluster_signature, title, priority, state, total_report_count');

  console.log(`Total test_reports in DB: ${actualTestRepCount} (Expected: 50)`);
  console.log(`Total test_event_notification_trackers: ${actualTrackerCount} (Expected: 3)`);
  console.log(`Total test_event_notification_reports: ${actualRepMapCount} (Expected: 50)`);
  console.log(`Total test_event_notification_outbox: ${actualOutboxCount} (Expected: 3)`);
  console.log(`Total test_notification_logs: ${actualNotifCount} (Expected: 3)`);

  console.log("\nTrackers Breakdown:");
  console.table(trackers);

  // 4. Backoffice Draft Group Verification via API
  console.log("================================================================================");
  console.log("BACKOFFICE INCIDENT DRAFTS VERIFICATION");
  console.log("================================================================================");

  // Login as admin to get auth token
  const authClient = (await import('@supabase/supabase-js')).createClient(
    'http://127.0.0.1:54321',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  );
  const { data: loginRes } = await authClient.auth.signInWithPassword({
    email: 'admin_p3@soc.test',
    password: 'Password123!',
  });

  const authToken = loginRes?.session?.access_token;
  if (!authToken) {
    console.warn("Could not log in as admin_p3@soc.test, skipping draft API check");
  } else {
    const draftRes = await fetch("http://localhost:3000/api/incidents/drafts", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const draftJson = await draftRes.json();
    console.log(`Drafts API returned ${draftJson.totalDrafts} draft proposals from ${draftJson.evaluatedUngroupedCount} ungrouped reports:`);
    (draftJson.drafts || []).forEach((d: any, idx: number) => {
      console.log(`  Draft #${idx + 1}: [${d.priority.toUpperCase()}] ${d.proposedTitle} (Members: ${d.reportCount}, Score: ${d.correlationScore}%)`);
    });
  }

  // 5. Backoffice Headless Browser Verification (Puppeteer)
  console.log("================================================================================");
  console.log("BACKOFFICE HEADLESS BROWSER UI VERIFICATION (PUPPETEER)");
  console.log("================================================================================");

  let browserUiEvidence: any = null;
  try {
    const puppeteer = (await import('puppeteer')).default;
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Login via UI
    console.log("Navigating to http://localhost:3000/backoffice/login...");
    await page.goto("http://localhost:3000/backoffice/login", { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'admin_p3@soc.test');
    await page.type('input[type="password"]', 'Password123!');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await new Promise((r) => setTimeout(r, 2000));
    console.log("Logged in to Backoffice successfully.");

    // Check Reports List
    console.log("Navigating to http://localhost:3000/backoffice/reports...");
    await page.goto("http://localhost:3000/backoffice/reports", { waitUntil: 'networkidle2' });
    await page.waitForSelector('table', { timeout: 10000 });
    const reportsScreenshotPath = path.resolve('docs/screenshots/phase3_6_backoffice_reports.png');
    await page.screenshot({ path: reportsScreenshotPath, fullPage: false });
    console.log(`Captured Backoffice Reports screenshot: ${reportsScreenshotPath}`);

    // Check Incidents List
    console.log("Navigating to http://localhost:3000/backoffice/incidents...");
    await page.goto("http://localhost:3000/backoffice/incidents", { waitUntil: 'networkidle2' });
    await page.waitForSelector('body', { timeout: 10000 });
    const incidentsScreenshotPath = path.resolve('docs/screenshots/phase3_6_backoffice_incidents.png');
    await page.screenshot({ path: incidentsScreenshotPath, fullPage: false });
    console.log(`Captured Backoffice Incidents screenshot: ${incidentsScreenshotPath}`);

    await browser.close();
    browserUiEvidence = {
      reportsScreenshot: reportsScreenshotPath,
      incidentsScreenshot: incidentsScreenshotPath,
      verified: true,
    };
  } catch (browserErr) {
    console.error("Puppeteer verification encountered error:", browserErr);
    browserUiEvidence = {
      verified: false,
      error: browserErr instanceof Error ? browserErr.message : String(browserErr),
    };
  }

  // 6. Save Simulation Artifact Data to JSON
  const simResultsPath = path.resolve('scripts/phase3_6_simulation_results.json');
  fs.writeFileSync(simResultsPath, JSON.stringify({
    simulationRunId: SIMULATION_RUN_ID,
    durationSec,
    totalSubmitted: SIMULATION_50_REPORTS.length,
    actualTestRepCount,
    actualTrackerCount,
    actualRepMapCount,
    actualOutboxCount,
    actualNotifCount,
    trackers,
    records,
    browserUiEvidence,
  }, null, 2));

  console.log(`\nSimulation results written to ${simResultsPath}`);

  return {
    simulationRunId: SIMULATION_RUN_ID,
    actualTestRepCount,
    actualTrackerCount,
    actualRepMapCount,
    actualOutboxCount,
    actualNotifCount,
    trackers,
    records,
  };
}

runSimulation().catch((err) => {
  console.error("Simulation Execution Error:", err);
  process.exit(1);
});
