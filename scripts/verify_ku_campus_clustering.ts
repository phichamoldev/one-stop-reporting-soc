import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
process.env.REPORT_DATA_SOURCE = 'test';

import { generateIncidentDrafts, ProposedReportItem } from '../src/lib/incidentDraftService';
import { evaluateIncidentIdentity } from '../src/lib/similarityDetector';

export interface MockReportDef {
  index: number;
  group: 'A' | 'B' | 'C' | 'D';
  clusterId: string; // e.g. 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', or 'S' + index
  category_id: number;
  subcategory_id: number;
  location: string;
  description: string;
  reporter_name: string;
  phone: string;
  email: string;
}

export const KU_SIMULATION_REPORTS: MockReportDef[] = [
  // -------------------------------------------------------------------------
  // Group A: ฝนตกหนัก (10 reports)
  // -------------------------------------------------------------------------
  {
    index: 1,
    group: 'A',
    clusterId: 'A1',
    category_id: 4,
    subcategory_id: 23,
    location: 'อาคารเรียนรวม 1',
    description: 'ฝนตกหนักบริเวณทางเดินหน้าอาคารเรียนรวม 1 ทำให้เดินผ่านลำบากและมีน้ำขัง',
    reporter_name: 'น.ส. พิมพ์ชนก วัฒนากุล',
    phone: '0814523910',
    email: 'pimchanok.wat@ku.th',
  },
  {
    index: 2,
    group: 'A',
    clusterId: 'A1',
    category_id: 4,
    subcategory_id: 23,
    location: 'อาคารเรียนรวม 1',
    description: 'ฝนตกแรงมากบริเวณทางเชื่อมอาคารเรียนรวม 1 น้ำไหลลงมาจากหลังคาจนพื้นเปียกและลื่น',
    reporter_name: 'นายธนกฤต ศรีสวัสดิ์',
    phone: '0823349012',
    email: 'thanakrit.sri@ku.th',
  },
  {
    index: 3,
    group: 'A',
    clusterId: 'A1',
    category_id: 4,
    subcategory_id: 23,
    location: 'อาคารเรียนรวม 1 ชั้น 1',
    description: 'ฝนสาดเข้าบริเวณโถงทางเดินชั้นล่าง อาคารเรียนรวม 1 ทำให้พื้นเปียกมาก',
    reporter_name: 'น.ส. ณัฐธิดา พรหมรักษ์',
    phone: '0834458921',
    email: 'natthida.pro@ku.th',
  },
  {
    index: 4,
    group: 'A',
    clusterId: 'A2',
    category_id: 4,
    subcategory_id: 23,
    location: 'คณะสังคมศาสตร์ อาคาร 1',
    description: 'ฝนตกหนักจนมีน้ำไหลผ่านทางเดินบริเวณหน้าอาคาร 1 คณะสังคมศาสตร์',
    reporter_name: 'นายภาคิน อินทรรักษ์',
    phone: '0845567890',
    email: 'phakin.int@ku.th',
  },
  {
    index: 5,
    group: 'A',
    clusterId: 'A2',
    category_id: 4,
    subcategory_id: 23,
    location: 'คณะสังคมศาสตร์ อาคาร 1',
    description: 'หลังฝนตกพบว่าทางเดินเชื่อมอาคาร 1 คณะสังคมศาสตร์มีน้ำขังหลายจุด',
    reporter_name: 'น.ส. กัญญารัตน์ สุขเกษม',
    phone: '0856678901',
    email: 'kanyarat.suk@ku.th',
  },
  {
    index: 6,
    group: 'A',
    clusterId: 'A2',
    category_id: 4,
    subcategory_id: 23,
    location: 'คณะสังคมศาสตร์ อาคาร 1',
    description: 'ฝนตกต่อเนื่อง น้ำไหลจากหลังคาลงมาบริเวณทางเข้าอาคาร 1 คณะสังคมศาสตร์',
    reporter_name: 'นายปกรณ์ ตั้งเจริญ',
    phone: '0867789012',
    email: 'pakorn.tan@ku.th',
  },
  {
    index: 7,
    group: 'A',
    clusterId: 'S07',
    category_id: 4,
    subcategory_id: 23,
    location: 'ลานกิจกรรมบ่อปลา',
    description: 'พื้นบริเวณลานกิจกรรมบ่อปลาเปียกและมีน้ำขังจากฝนตกหนัก',
    reporter_name: 'น.ส. ชลธิชา มณีวงศ์',
    phone: '0878890123',
    email: 'chonthicha.man@ku.th',
  },
  {
    index: 8,
    group: 'A',
    clusterId: 'S08',
    category_id: 4,
    subcategory_id: 23,
    location: 'ถนนชูชาติกำภู',
    description: 'ฝนตกแรงบริเวณถนนชูชาติกำภู ทำให้มีน้ำรอระบายบนพื้นผิวถนน',
    reporter_name: 'นายวรเมธ จันทร์สว่าง',
    phone: '0889901234',
    email: 'worameth.cha@ku.th',
  },
  {
    index: 9,
    group: 'A',
    clusterId: 'S09',
    category_id: 4,
    subcategory_id: 23,
    location: 'หอประชุมใหญ่',
    description: 'มีน้ำฝนไหลเข้าบริเวณทางเดินหน้าหอประชุมใหญ่ ทำให้พื้นลื่น',
    reporter_name: 'น.ส. อริสรา เกตุแก้ว',
    phone: '0890012345',
    email: 'arisara.ket@ku.th',
  },
  {
    index: 10,
    group: 'A',
    clusterId: 'S10',
    category_id: 4,
    subcategory_id: 31,
    location: 'ประตูพหลโยธิน',
    description: 'ฝนตกหนักบริเวณทางเข้าประตูพหลโยธิน น้ำขังตามทางเดินเท้าและขอบถนน',
    reporter_name: 'นายกิตติพงษ์ วงศ์ดี',
    phone: '0801123456',
    email: 'kittipong.won@ku.th',
  },

  // -------------------------------------------------------------------------
  // Group B: ต้นไม้ล้ม / กิ่งไม้หัก (10 reports)
  // -------------------------------------------------------------------------
  {
    index: 11,
    group: 'B',
    clusterId: 'B1',
    category_id: 4,
    subcategory_id: 30,
    location: 'อาคาร 4',
    description: 'มีต้นไม้ขนาดใหญ่ล้มขวางถนนข้างอาคาร 4 รถยนต์ไม่สามารถผ่านได้',
    reporter_name: 'น.ส. สุภัสสรา คงมั่น',
    phone: '0812233445',
    email: 'supassra.kon@ku.th',
  },
  {
    index: 12,
    group: 'B',
    clusterId: 'B1',
    category_id: 4,
    subcategory_id: 30,
    location: 'อาคาร 4',
    description: 'พบต้นไม้ใหญ่โค่นกีดขวางถนนข้างอาคาร 4 กิ่งไม้ปิดถนนสัญจรไม่ได้',
    reporter_name: 'นายณัฐพงษ์ พูลผล',
    phone: '0823344556',
    email: 'natthapong.poo@ku.th',
  },
  {
    index: 13,
    group: 'B',
    clusterId: 'B1',
    category_id: 4,
    subcategory_id: 30,
    location: 'อาคาร 4',
    description: 'หลังลมแรงพบต้นไม้ใหญ่ล้มปิดช่องทางจราจรข้างอาคาร 4 การจราจรติดขัด',
    reporter_name: 'น.ส. มนัสวี แสงทอง',
    phone: '0834455667',
    email: 'manatsawee.sae@ku.th',
  },
  {
    index: 14,
    group: 'B',
    clusterId: 'B2',
    category_id: 4,
    subcategory_id: 30,
    location: 'ลานจอดรถข้างอาคาร 1',
    description: 'มีกิ่งไม้ขนาดใหญ่ตกลงมาบนทางเดินและช่องจอดรถ ลานจอดรถข้างอาคาร 1',
    reporter_name: 'นายศุภณัฐ เกียรติไพบูลย์',
    phone: '0845566778',
    email: 'suphanat.kia@ku.th',
  },
  {
    index: 15,
    group: 'B',
    clusterId: 'B2',
    category_id: 4,
    subcategory_id: 30,
    location: 'ลานจอดรถข้างอาคาร 1',
    description: 'กิ่งไม้ขนาดใหญ่หักพาดลงมาขวางลานจอดรถข้างอาคาร 1 กีดขวางช่องจอดรถ',
    reporter_name: 'น.ส. ปาริชาติ วงศ์คำ',
    phone: '0856677889',
    email: 'parichat.won@ku.th',
  },
  {
    index: 16,
    group: 'B',
    clusterId: 'S16',
    category_id: 4,
    subcategory_id: 30,
    location: 'อาคาร 14',
    description: 'พบต้นไม้ล้มบริเวณทางเข้าอาคาร 14 กิ่งไม้กีดขวางทางเดิน',
    reporter_name: 'นายพีรวิชญ์ สุขสันต์',
    phone: '0867788990',
    email: 'peerawich.suk@ku.th',
  },
  {
    index: 17,
    group: 'B',
    clusterId: 'S17',
    category_id: 4,
    subcategory_id: 30,
    location: 'อาคารวิศวกรรมศาสตร์',
    description: 'กิ่งไม้หักลงมาขวางทางเดินใกล้อาคารวิศวกรรมศาสตร์ มีผู้สัญจรผ่านจำนวนมาก',
    reporter_name: 'น.ส. ธัญชนก บุญมี',
    phone: '0878899001',
    email: 'thanchanok.boo@ku.th',
  },
  {
    index: 18,
    group: 'B',
    clusterId: 'S18',
    category_id: 4,
    subcategory_id: 30,
    location: 'อาคารอเนกประสงค์',
    description: 'ต้นไม้ใหญ่ล้มหลังลมแรงและฝนตก ขวางทางเดินใกล้อาคารอเนกประสงค์',
    reporter_name: 'นายจักรพันธ์ แก้วประเสริฐ',
    phone: '0889900112',
    email: 'jakrapan.kae@ku.th',
  },
  {
    index: 19,
    group: 'B',
    clusterId: 'S19',
    category_id: 4,
    subcategory_id: 30,
    location: 'อาคาร 3',
    description: 'มีต้นไม้เอนและรากเริ่มถอนตัวบริเวณทางเดินข้างอาคาร 3 เกรงว่าจะล้มทับผู้สัญจร',
    reporter_name: 'น.ส. เบญจวรรณ สายใจ',
    phone: '0890011223',
    email: 'benjawan.sai@ku.th',
  },
  {
    index: 20,
    group: 'B',
    clusterId: 'S20',
    category_id: 4,
    subcategory_id: 30,
    location: 'อาคารมนุษยศาสตร์',
    description: 'พบกิ่งไม้ขนาดใหญ่ตกลงมาบริเวณลานหน้าอาคารมนุษยศาสตร์ ทำให้ทางเดินไม่สะดวก',
    reporter_name: 'นายธีรภัทร ชูศักดิ์',
    phone: '0801122334',
    email: 'theerapat.chu@ku.th',
  },

  // -------------------------------------------------------------------------
  // Group C: น้ำท่วม / น้ำรอระบาย (10 reports)
  // -------------------------------------------------------------------------
  {
    index: 21,
    group: 'C',
    clusterId: 'C1',
    category_id: 4,
    subcategory_id: 27,
    location: 'ถนนชูชาติกำภู อาคาร 5',
    description: 'น้ำท่วมขังบริเวณถนนข้างอาคาร 5 ระดับน้ำสูงจนรถจักรยานยนต์ผ่านลำบาก',
    reporter_name: 'น.ส. วรัญญา นาคทอง',
    phone: '0813344556',
    email: 'waranya.nak@ku.th',
  },
  {
    index: 22,
    group: 'C',
    clusterId: 'C1',
    category_id: 4,
    subcategory_id: 27,
    location: 'ถนนชูชาติกำภู อาคาร 5',
    description: 'ฝนตกหนักทำให้น้ำระบายไม่ทัน เกิดน้ำท่วมสูงบนถนนข้างอาคาร 5',
    reporter_name: 'นายสิรวิชญ์ พงษ์ไพบูลย์',
    phone: '0824455667',
    email: 'sirawich.pon@ku.th',
  },
  {
    index: 23,
    group: 'C',
    clusterId: 'C1',
    category_id: 4,
    subcategory_id: 27,
    location: 'ถนนชูชาติกำภู อาคาร 5',
    description: 'ถนนข้างอาคาร 5 มีน้ำท่วมขังผิวถนนระดับเสมอทางเท้าหลังฝนตก',
    reporter_name: 'น.ส. อัญชลี รุ่งเรือง',
    phone: '0835566778',
    email: 'anchalee.run@ku.th',
  },
  {
    index: 24,
    group: 'C',
    clusterId: 'C1',
    category_id: 4,
    subcategory_id: 27,
    location: 'ถนนชูชาติกำภู อาคาร 5',
    description: 'น้ำท่วมขังเต็มผิวการจราจรถนนข้างอาคาร 5 รถเล็กสัญจรผ่านไม่สะดวก',
    reporter_name: 'นายพงศกร ทองดี',
    phone: '0846677889',
    email: 'pongsakorn.tho@ku.th',
  },
  {
    index: 25,
    group: 'C',
    clusterId: 'C2',
    category_id: 4,
    subcategory_id: 27,
    location: 'ประตูงามวงศ์วาน 1',
    description: 'น้ำเอ่อล้นจากท่อระบายน้ำท่วมขังบริเวณทางเข้าประตูงามวงศ์วาน 1',
    reporter_name: 'น.ส. พัชรินทร์ มีสุข',
    phone: '0857788990',
    email: 'patcharin.mee@ku.th',
  },
  {
    index: 26,
    group: 'C',
    clusterId: 'C2',
    category_id: 4,
    subcategory_id: 27,
    location: 'ประตูงามวงศ์วาน 1',
    description: 'น้ำท่วมขังสูงบริเวณทางเข้าประตูงามวงศ์วาน 1 น้ำระบายไม่ทัน',
    reporter_name: 'นายอธิวัฒน์ จันทร์เพ็ญ',
    phone: '0868899001',
    email: 'athiwat.jan@ku.th',
  },
  {
    index: 27,
    group: 'C',
    clusterId: 'S27',
    category_id: 4,
    subcategory_id: 23,
    location: 'ทางเดินเชื่อมอาคาร 1-2',
    description: 'น้ำท่วมทางเดินเชื่อมอาคาร 1-2 นักศึกษาไม่สามารถเดินผ่านตามปกติได้',
    reporter_name: 'น.ส. รัตนาภรณ์ ศรีทอง',
    phone: '0879900112',
    email: 'rattanaporn.sri@ku.th',
  },
  {
    index: 28,
    group: 'C',
    clusterId: 'S28',
    category_id: 4,
    subcategory_id: 31,
    location: 'ลานจอดรถคณะเกษตรศาสตร์',
    description: 'บริเวณลานจอดรถคณะเกษตรศาสตร์มีน้ำท่วมขัง รถยนต์และรถจักรยานยนต์เข้าออกไม่สะดวก',
    reporter_name: 'นายปิยวัฒน์ สุขใจ',
    phone: '0880011223',
    email: 'piyawat.suk@ku.th',
  },
  {
    index: 29,
    group: 'C',
    clusterId: 'S29',
    category_id: 4,
    subcategory_id: 27,
    location: 'โรงอาหารกลาง',
    description: 'พบระดับน้ำเพิ่มสูงขึ้นและท่วมขังบริเวณทางเดินหน้าโรงอาหารกลาง ใกล้ท่อระบายน้ำ',
    reporter_name: 'น.ส. กุลธิดา ภักดี',
    phone: '0891122334',
    email: 'kulthida.pak@ku.th',
  },
  {
    index: 30,
    group: 'C',
    clusterId: 'S30',
    category_id: 4,
    subcategory_id: 23,
    location: 'อาคารวิทยาศาสตร์',
    description: 'น้ำฝนไหลเข้าพื้นที่ชั้นล่างของอาคารวิทยาศาสตร์และเริ่มท่วมขังกระทบการใช้งาน',
    reporter_name: 'นายชยพล พูนทรัพย์',
    phone: '0802233445',
    email: 'chayapol.poo@ku.th',
  },

  // -------------------------------------------------------------------------
  // Group D: ไฟฟ้าดับ / ระบบไฟฟ้าขัดข้อง (10 reports)
  // -------------------------------------------------------------------------
  {
    index: 31,
    group: 'D',
    clusterId: 'D1',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคาร 2',
    description: 'ไฟฟ้าดับทั้งอาคาร 2 ระบบแสงสว่างและระบบปรับอากาศหยุดทำงานทั้งหมด',
    reporter_name: 'น.ส. กนกวรรณ ใจดี',
    phone: '0814455667',
    email: 'kanokwan.jai@ku.th',
  },
  {
    index: 32,
    group: 'D',
    clusterId: 'D1',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคาร 2',
    description: 'ไฟฟ้าดับทั้งตึกอาคาร 2 ระบบแสงสว่างและอุปกรณ์สำนักงานดับหมดทั้งอาคาร',
    reporter_name: 'นายธนวัฒน์ บุญช่วย',
    phone: '0825566778',
    email: 'thanawat.boo@ku.th',
  },
  {
    index: 33,
    group: 'D',
    clusterId: 'D1',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคาร 2',
    description: 'อาคาร 2 ไม่มีกระแสไฟฟ้าใช้งานตั้งแต่ช่วงบ่าย ดับทั้งตึกเครื่องปรับอากาศหยุดทำงาน',
    reporter_name: 'น.ส. พิมพ์ลภัส สุขสว่าง',
    phone: '0836677889',
    email: 'pimlapas.suk@ku.th',
  },
  {
    index: 34,
    group: 'D',
    clusterId: 'D2',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคารเรียนรวม ชั้น 3',
    description: 'ไฟฟ้าดับห้องปฏิบัติการคอมพิวเตอร์ อาคารเรียนรวม ชั้น 3 เครื่องคอมพิวเตอร์ดับ',
    reporter_name: 'นายกฤษณะ ศรีสมบัติ',
    phone: '0847788990',
    email: 'kritsana.sri@ku.th',
  },
  {
    index: 35,
    group: 'D',
    clusterId: 'D2',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคารเรียนรวม ชั้น 3',
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ ชั้น 3 อาคารเรียนรวม ไฟดับ คอมพิวเตอร์และอุปกรณ์หยุดทำงาน',
    reporter_name: 'น.ส. ศิริพร ทองคำ',
    phone: '0858899001',
    email: 'siriporn.tho@ku.th',
  },
  {
    index: 36,
    group: 'D',
    clusterId: 'S36',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคาร 3 ชั้น 3',
    description: 'ไฟฟ้าดับเฉพาะห้อง 305 อาคาร 3 ชั้น 3 เบรกเกอร์ห้องตัด แต่ห้องอื่นมีไฟฟ้าปกติ',
    reporter_name: 'นายณรงค์ฤทธิ์ พรหมมา',
    phone: '0869900112',
    email: 'narongrit.pro@ku.th',
  },
  {
    index: 37,
    group: 'D',
    clusterId: 'S37',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคาร 14',
    description: 'เสาไฟส่องสว่างทางเดินข้างอาคาร 14 ดับตลอดแนวช่วงค่ำ ทางเดินมืด',
    reporter_name: 'น.ส. ปวีณา แสงแก้ว',
    phone: '0870011223',
    email: 'paweena.sae@ku.th',
  },
  {
    index: 38,
    group: 'D',
    clusterId: 'S38',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคารเกษตรศาสตร์ ชั้น 2',
    description: 'พบเบรกเกอร์ตัดและไฟฟ้าดับเฉพาะห้องปฏิบัติการชั้น 2 อาคารเกษตรศาสตร์',
    reporter_name: 'นายพชรพล วัฒนชัย',
    phone: '0881122334',
    email: 'phatcharapol.wat@ku.th',
  },
  {
    index: 39,
    group: 'D',
    clusterId: 'S39',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคารบริหารธุรกิจ',
    description: 'ปลั๊กไฟและระบบแสงสว่างบริเวณโถงบริการ อาคารบริหารธุรกิจ ดับบางจุด',
    reporter_name: 'น.ส. สุชาดา อินทร์แก้ว',
    phone: '0892233445',
    email: 'suchada.int@ku.th',
  },
  {
    index: 40,
    group: 'D',
    clusterId: 'S40',
    category_id: 4,
    subcategory_id: 26,
    location: 'อาคารวิศวกรรมศาสตร์ ชั้น 1',
    description: 'ไฟฟ้ากระพริบหลายครั้งก่อนไฟดับเฉพาะห้อง 101 อาคารวิศวกรรมศาสตร์ ชั้น 1',
    reporter_name: 'นายภานุวัฒน์ รัตนชัย',
    phone: '0803344556',
    email: 'panuwat.rat@ku.th',
  },
];

async function runClusteringCheck() {
  console.log('Evaluating Clustering & Similarity against Ground Truth...');
  
  // Transform to ProposedReportItem
  const proposedPool: ProposedReportItem[] = KU_SIMULATION_REPORTS.map((r) => ({
    id: `rep_${r.index}`,
    public_id: `SOC-T-SIM${String(r.index).padStart(3, '0')}`,
    category_id: r.category_id,
    subcategory_id: r.subcategory_id,
    location: r.location,
    description: r.description,
    status: 'pending',
    priority: 'normal',
    reporter_name: r.reporter_name,
    created_at: new Date().toISOString(),
  }));

  const drafts = generateIncidentDrafts(proposedPool, [], {
    minClusterSize: 2,
    similarityThreshold: 50,
  });

  console.log(`\nGenerated ${drafts.length} Incident Drafts:`);
  drafts.forEach((d, idx) => {
    const pids = d.reports.map((r) => r.public_id).join(', ');
    console.log(`[Draft ${idx + 1}] Title: "${d.proposedTitle}" | Reports: (${d.reportCount}) [${pids}] | Score: ${d.correlationScore}%`);
  });

  // Calculate Pairwise Ground Truth vs Detected Drafts
  // Map public_id -> clusterId from ground truth
  const groundTruthMap = new Map<string, string>();
  KU_SIMULATION_REPORTS.forEach((r) => {
    groundTruthMap.set(`SOC-T-SIM${String(r.index).padStart(3, '0')}`, r.clusterId);
  });

  // Set of predicted pairs from drafts
  const predictedPairs = new Set<string>();
  drafts.forEach((d) => {
    const rIds = d.reports.map((r) => r.public_id).sort();
    for (let i = 0; i < rIds.length; i++) {
      for (let j = i + 1; j < rIds.length; j++) {
        predictedPairs.add(`${rIds[i]}::${rIds[j]}`);
      }
    }
  });

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  const n = KU_SIMULATION_REPORTS.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pidI = `SOC-T-SIM${String(KU_SIMULATION_REPORTS[i].index).padStart(3, '0')}`;
      const pidJ = `SOC-T-SIM${String(KU_SIMULATION_REPORTS[j].index).padStart(3, '0')}`;
      const pairKey = `${pidI}::${pidJ}`;

      const gtClusterI = KU_SIMULATION_REPORTS[i].clusterId;
      const gtClusterJ = KU_SIMULATION_REPORTS[j].clusterId;
      const isGtSame = !gtClusterI.startsWith('S') && gtClusterI === gtClusterJ;
      const isPredSame = predictedPairs.has(pairKey);

      if (isGtSame && isPredSame) {
        tp++;
      } else if (!isGtSame && isPredSame) {
        fp++;
        console.warn(`[FP Alert] Pair (${pidI}, ${pidJ}) was grouped, but GT differs (${gtClusterI} vs ${gtClusterJ})`);
      } else if (isGtSame && !isPredSame) {
        fn++;
        console.warn(`[FN Alert] Pair (${pidI}, ${pidJ}) in GT ${gtClusterI} was NOT grouped`);
      } else {
        tn++;
      }
    }
  }

  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = ((tp + tn) / (tp + tn + fp + fn)) * 100;

  const r21 = { ...KU_SIMULATION_REPORTS[20], id: '21', public_id: 'SOC-T-SIM021', created_at: new Date().toISOString() };
  const r22 = { ...KU_SIMULATION_REPORTS[21], id: '22', public_id: 'SOC-T-SIM022', created_at: new Date().toISOString() };
  const r7 = { ...KU_SIMULATION_REPORTS[6], id: '7', public_id: 'SOC-T-SIM007', created_at: new Date().toISOString() };

  const r10 = { ...KU_SIMULATION_REPORTS[9], id: '10', public_id: 'SOC-T-SIM010', created_at: new Date().toISOString() };
  const ev7_10 = evaluateIncidentIdentity(r7, r10);
  console.log('7 vs 10 decision:', ev7_10.candidateDecision, ev7_10.ruleScore, ev7_10.targetAnchor, ev7_10.candidateAnchor, ev7_10.evidence, ev7_10.contradictions);

  const r25 = { ...KU_SIMULATION_REPORTS[24], id: '25', public_id: 'SOC-T-SIM025', created_at: new Date().toISOString() };
  const r26 = { ...KU_SIMULATION_REPORTS[25], id: '26', public_id: 'SOC-T-SIM026', created_at: new Date().toISOString() };
  const ev25_26 = evaluateIncidentIdentity(r25, r26);
  console.log('25 vs 26 decision:', ev25_26.candidateDecision, ev25_26.ruleScore, ev25_26.targetAnchor, ev25_26.candidateAnchor, ev25_26.evidence, ev25_26.contradictions);


  console.log(`Total Pairs Evaluated: ${tp + tn + fp + fn}`);
  console.log(`True Positives (TP):  ${tp}`);
  console.log(`False Positives (FP): ${fp}`);
  console.log(`False Negatives (FN): ${fn}`);
  console.log(`True Negatives (TN):  ${tn}`);
  console.log(`Precision:            ${precision.toFixed(2)}%`);
  console.log(`Recall:               ${recall.toFixed(2)}%`);
  console.log(`F1-Score:             ${f1.toFixed(2)}%`);
  console.log(`Pairwise Accuracy:    ${accuracy.toFixed(2)}%`);
  console.log(`===============================================================\n`);
}

if (require.main === module) {
  runClusteringCheck();
}
