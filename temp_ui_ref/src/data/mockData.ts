/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Report, ReportLog, Staff, SystemSettings } from '../types';

export const INITIAL_DEPARTMENTS = [
  'ภาควิชาจิตวิทยา',
  'ภาควิชาสังคมวิทยาและมนุษยวิทยา',
  'ภาควิชาภูมิศาสตร์',
  'ภาควิชารัฐศาสตร์',
  'สำนักงานคณบดี',
  'ศูนย์วิจัยสังคมศาสตร์',
  'ห้องสมุดคณะสังคมศาสตร์'
];

export const INITIAL_STAFF: Staff[] = [
  {
    id: 'ST-01',
    name: 'นายสมชาย ใจดี',
    role: 'ช่างเทคนิคอาคารและระบบน้ำ',
    department: 'สำนักงานคณบดี (ฝ่ายอาคารสถานที่)',
    activeTasks: 2,
    completedTasks: 24,
    imageUrl: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'ST-02',
    name: 'นางสาวอรทัย แสงสว่าง',
    role: 'ผู้เชี่ยวชาญระบบเครือข่ายและไอที',
    department: 'ศูนย์บริการคอมพิวเตอร์',
    activeTasks: 1,
    completedTasks: 32,
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'ST-03',
    name: 'นายวิชัย รักดี',
    role: 'เจ้าหน้าที่ความปลอดภัยและสิ่งแวดล้อม',
    department: 'สำนักงานคณบดี (ฝ่ายรักษาความปลอดภัย)',
    activeTasks: 1,
    completedTasks: 18,
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'ST-04',
    name: 'นางประนอม ดอกแก้ว',
    role: 'หัวหน้างานแม่บ้านและการดูแลความสะอาด',
    department: 'สำนักงานคณบดี (ฝ่ายบริการทั่วไป)',
    activeTasks: 0,
    completedTasks: 45,
    imageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_REPORTS: Report[] = [
  {
    id: 'SS-2026-001',
    title: 'ก๊อกน้ำอ่างล้างมือชำรุด น้ำไหลไม่หยุด',
    description: 'ก๊อกน้ำที่อ่างล้างมือฝั่งขวาสุดในห้องน้ำหญิง ชั้น 2 มีน้ำรั่วไหลโจ๊กตลอดเวลา หมุนปิดสนิทแล้วก็ยังไหล คาดว่าลูกยางหรือตัววาล์วภายในจะแตก เสี่ยงทำให้พื้นห้องน้ำเปียกและลื่นตลอดเวลา รวมถึงสิ้นเปลืองน้ำอย่างมาก',
    mainCategory: 'อาคารสถานที่',
    subCategory: 'ประปาและสุขภัณฑ์',
    location: 'ห้องน้ำหญิง ชั้น 2 อาคาร 1 คณะสังคมศาสตร์',
    imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80',
    reporterName: 'นางสาววิภาดา รักษ์เรียน',
    reporterEmail: 'wiphada.r@soc.ku.ac.th',
    reporterPhone: '081-234-5678',
    department: 'ภาควิชาจิตวิทยา',
    status: 'เสร็จสิ้น',
    createdAt: '2026-07-10T09:15:00',
    updatedAt: '2026-07-10T14:30:00',
    notes: 'ดำเนินการเปลี่ยนวาล์วทองเหลืองและหัวก๊อกใหม่ขนาด 1/2 นิ้วเรียบร้อยแล้ว ทดสอบไม่มีน้ำรั่วซึม',
    assignedStaff: 'นายสมชาย ใจดี',
    priority: 'สูง'
  },
  {
    id: 'SS-2026-002',
    title: 'หลอดไฟกะพริบถี่ในห้องบรรยาย 3105',
    description: 'หลอดไฟฟลูออเรสเซนต์ช่วงกลางห้องบรรยาย 3105 กะพริบถี่และเสียงดังครางเบาๆ รบกวนสมาธิอาจารย์และนิสิตขณะทำการเรียนการสอนอย่างมาก ขอความกรุณาช่วยตรวจสอบและเปลี่ยนหลอดไฟหรือบัลลาสต์/สตาร์ทเตอร์ด้วยค่ะ',
    mainCategory: 'อาคารสถานที่',
    subCategory: 'ระบบไฟฟ้าและแสงสว่าง',
    location: 'ห้องบรรยาย 3105 ชั้น 1 อาคาร 3 คณะสังคมศาสตร์',
    imageUrl: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=800&auto=format&fit=crop&q=80',
    reporterName: 'ดร.พงศธร ศรศิลป์',
    reporterEmail: 'pongsatorn.s@ku.th',
    reporterPhone: '089-876-5432',
    department: 'ภาควิชาสังคมวิทยาและมนุษยวิทยา',
    status: 'เสร็จสิ้น',
    createdAt: '2026-07-12T11:00:00',
    updatedAt: '2026-07-12T16:15:00',
    notes: 'เปลี่ยนเป็นหลอด LED ขนาด 18W พร้อมถอดสตาร์ทเตอร์เดิมออก เรียบร้อย แสงสว่างสม่ำเสมอไม่มีเสียงคราง',
    assignedStaff: 'นายสมชาย ใจดี',
    priority: 'ปานกลาง'
  },
  {
    id: 'SS-2026-003',
    title: 'แอร์คอนดิชันเนอร์มีน้ำหยดหนักมาก',
    description: 'เครื่องปรับอากาศตัวซ้ายสุดในสำนักงานภาควิชาภูมิศาสตร์ มีน้ำกลั่นไหลย้อยหยดลงมาโดนโต๊ะทำงานและตู้เอกสารด้านล่างโดยตรง เกรงว่าเอกสารสำคัญจะเสียหายและไฟอาจจะลัดวงจร ตอนนี้ต้องนำถังพลาสติกมารองน้ำไว้',
    mainCategory: 'อาคารสถานที่',
    subCategory: 'ระบบปรับอากาศ',
    location: 'ห้องสำนักงานภาควิชาภูมิศาสตร์ อาคาร 2 ชั้น 3',
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop&q=80',
    reporterName: 'นายณรงค์เดช นุ่มนวล',
    reporterEmail: 'narongdej.n@soc.ku.ac.th',
    reporterPhone: '084-555-1122',
    department: 'ภาควิชาภูมิศาสตร์',
    status: 'กำลังดำเนินการ',
    createdAt: '2026-07-14T13:20:00',
    updatedAt: '2026-07-15T10:00:00',
    notes: 'เข้าตรวจสอบพบท่อน้ำทิ้งตันเนื่องจากเมือกสะสม กำลังเตรียมเครื่องเป่าลมแรงดันสูงเข้าทะลวงท่อระบายน้ำทิ้ง',
    assignedStaff: 'นายสมชาย ใจดี',
    priority: 'สูง'
  },
  {
    id: 'SS-2026-004',
    title: 'สัญญาณ Wi-Fi บริเวณลานกิจกรรมใต้ตึก อ่อนและหลุดบ่อย',
    description: 'นิสิตที่นั่งอ่านหนังสือและทำงานกลุ่มบริเวณโต๊ะม้าหินอ่อนลานกิจกรรมชั้น 1 ใต้อาคารเรียนรวม ไม่สามารถเชื่อมต่อ Wi-Fi คณะได้อย่างเสถียร สัญญาณขึ้นเพียง 1 ขีด และหลุดบ่อยครั้งมาก ทำให้เรียนออนไลน์หรือหาข้อมูลทำรายงานไม่ได้เลย',
    mainCategory: 'อินเทอร์เน็ต',
    subCategory: 'สัญญาณเครือข่ายไร้สาย',
    location: 'ลานกิจกรรมชั้น 1 ใต้อาคารเรียนรวม คณะสังคมศาสตร์',
    imageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
    reporterName: 'นายอนันต์ เกียรติภูมิ',
    reporterEmail: 'anan.ki@ku.th',
    reporterPhone: '085-999-8877',
    department: 'สำนักงานคณบดี',
    status: 'กำลังดำเนินการ',
    createdAt: '2026-07-14T15:45:00',
    updatedAt: '2026-07-15T09:30:00',
    notes: 'กำลังทดสอบสัญญาณความเข้มข้น และประสานงานติดตั้ง Access Point เพิ่มเติมอีก 1 จุด เพื่อครอบคลุมพื้นที่ลานกิจกรรม',
    assignedStaff: 'นางสาวอรทัย แสงสว่าง',
    priority: 'ปานกลาง'
  },
  {
    id: 'SS-2026-005',
    title: 'เครื่องคอมพิวเตอร์หมายเลข 12 ในห้องแล็บ 404 เปิดไม่ติด',
    description: 'เครื่องคอมพิวเตอร์ PC หมายเลข 12 สำหรับนิสิตฝึกปฏิบัติการวิจัย เมื่อกดปุ่ม Power แล้วไม่มีการตอบสนองใดๆ ไม่มีไฟสถานะขึ้น และหน้าจอมืดสนิท ตรวจสอบสายไฟ AC หลังเคสแล้วเสียบแน่นดี รบกวนช่างเทคนิคช่วยมาตรวจสอบด่วนครับ เนื่องจากพรุ่งนี้เช้าจะมีเรียนวิชาสถิติ',
    mainCategory: 'คอมพิวเตอร์',
    subCategory: 'อุปกรณ์ฮาร์ดแวร์คอมพิวเตอร์',
    location: 'ห้องปฏิบัติการคอมพิวเตอร์ 404 ชั้น 4 อาคาร 1',
    imageUrl: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=800&auto=format&fit=crop&q=80',
    reporterName: 'ผศ.ดร.สุรเดช เลิศล้ำ',
    reporterEmail: 'suradech.l@ku.ac.th',
    reporterPhone: '087-111-2222',
    department: 'ศูนย์วิจัยสังคมศาสตร์',
    status: 'รับเรื่องแล้ว',
    createdAt: '2026-07-15T10:30:00',
    updatedAt: '2026-07-15T10:30:00',
    notes: '',
    assignedStaff: 'นางสาวอรทัย แสงสว่าง',
    priority: 'สูง'
  },
  {
    id: 'SS-2026-006',
    title: 'กล้องวงจรปิดเยื้องทางเข้าห้องสมุด เลนส์พร่ามัวมองไม่ชัด',
    description: 'กล้องวงจรปิด (CCTV) ตัวที่อยู่บริเวณทางเดินหลักก่อนเลี้ยวเข้าห้องสมุด คณะสังคมศาสตร์ ภาพที่ปรากฏบนจอมอนิเตอร์ของศูนย์รักษาความปลอดภัยมีฝ้าขาวและเบลอมากจนไม่สามารถระบุใบหน้าบุคคลได้ คาดว่ามีฝุ่นสะสมหรือมีความชื้นเข้าไปเกาะที่กระจกครอบเลนส์',
    mainCategory: 'ความปลอดภัย',
    subCategory: 'ระบบกล้องวงจรปิด',
    location: 'โถงทางเดินชั้น 2 หน้าระเบียงทางเข้าห้องสมุดคณะ',
    imageUrl: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&auto=format&fit=crop&q=80',
    reporterName: 'นายศักดิ์ดา ยามดี',
    reporterEmail: 'sakda.y@soc.ku.ac.th',
    reporterPhone: '089-000-1122',
    department: 'ห้องสมุดคณะสังคมศาสตร์',
    status: 'รับเรื่องแล้ว',
    createdAt: '2026-07-15T14:10:00',
    updatedAt: '2026-07-15T14:10:00',
    notes: '',
    assignedStaff: 'นายวิชัย รักดี',
    priority: 'ต่ำ'
  },
  {
    id: 'SS-2026-007',
    title: 'มีเศษวัสดุก่อสร้างกองทิ้งไว้หลังตึก สกปรกและบดบังทางหนีไฟ',
    description: 'มีการทิ้งถุงปูนซีเมนต์ แผ่นฝ้าเก่า และเศษเหล็กขนาดใหญ่บริเวณประตูด้านหลังอาคาร 2 ซึ่งเป็นจุดทางออกหนีไฟฉุกเฉิน กองวัสดุเหล่านี้ตั้งระเกะระกะมาเกือบสัปดาห์แล้ว ส่งผลให้ทัศนียภาพสกปรกและเป็นอันตรายอย่างยิ่งหากเกิดเหตุฉุกเฉินไฟไหม้',
    mainCategory: 'สิ่งแวดล้อม',
    subCategory: 'การขจัดขยะและสิ่งปฏิกูล',
    location: 'ลานหลังอาคาร 2 ใกล้บันไดหนีไฟฝั่งทิศตะวันตก',
    imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&auto=format&fit=crop&q=80',
    reporterName: 'นางกาญจนา แก้วดี',
    reporterEmail: 'kanjana.k@soc.ku.ac.th',
    reporterPhone: '083-444-5566',
    department: 'สำนักงานคณบดี',
    status: 'รับเรื่องแล้ว',
    createdAt: '2026-07-15T16:05:00',
    updatedAt: '2026-07-15T16:05:00',
    notes: '',
    priority: 'เร่งด่วน'
  },
  {
    id: 'SS-2026-008',
    title: 'ถังขยะแยกประเภทโถงล่างอาคาร 1 ส่งกลิ่นเหม็นรุนแรง',
    description: 'ถังขยะสำหรับทิ้งเศษอาหารและขยะเปียกบริเวณโถงต้อนรับอาคาร 1 ส่งกลิ่นเน่าเหม็นตลบอบอวล คาดว่าถุงขยะจะรั่วทำให้มีน้ำขยะซึมลงที่ก้นถังพลาสติกโดยตรง และไม่มีการขัดล้างทำความสะอาดถัง สภาพไม่ถูกสุขลักษณะอย่างยิ่ง',
    mainCategory: 'ความสะอาด',
    subCategory: 'ความสะอาดภายในอาคาร',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&auto=format&fit=crop&q=80',
    location: 'โถงชั้น 1 อาคาร 1 เยื้องลิฟต์โดยสารหลัก',
    reporterName: 'นางสาวสุนิสา ใจเย็น',
    reporterEmail: 'sunisa.j@ku.th',
    reporterPhone: '086-777-6655',
    department: 'ภาควิชารัฐศาสตร์',
    status: 'เสร็จสิ้น',
    createdAt: '2026-07-11T08:30:00',
    updatedAt: '2026-07-11T11:00:00',
    notes: 'ดำเนินการล้างถังขยะด้วยน้ำยาฆ่าเชื้อโรค ดับกลิ่น และเปลี่ยนถุงดำชุดใหม่ พร้อมกำชับแม่บ้านให้ล้างถังทุกเสาร์อาทิตย์',
    assignedStaff: 'นางประนอม ดอกแก้ว',
    priority: 'ต่ำ'
  },
  {
    id: 'SS-2026-009',
    title: 'ตัวล็อกหน้าต่างห้อง 2304 ชำรุด ล็อกไม่ได้',
    description: 'บานหน้าต่างอะลูมิเนียมตรงแถวหลังสุดของห้องเรียน 2304 ตัวล็อกก้านโยกหักหายไป ทำให้ไม่สามารถล็อกหน้าต่างให้สนิทได้ เวลาฝนตกหนักลมแรงจะมีน้ำฝนซัดสาดซึมเข้ามาเลอะพื้นไม้ และเสี่ยงต่อเรื่องความปลอดภัยของอุปกรณ์ภายในห้องเรียนด้วย',
    mainCategory: 'อาคารสถานที่',
    subCategory: 'โครงสร้างและเฟอร์นิเจอร์',
    location: 'อาคาร 2 ชั้น 3 ห้องเรียนบรรยาย 2304',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
    reporterName: 'นายพงษ์ศักดิ์ รุ่งเรือง',
    reporterEmail: 'pongsak.r@soc.ku.ac.th',
    reporterPhone: '082-998-1144',
    department: 'สำนักงานคณบดี',
    status: 'ไม่สามารถดำเนินการได้',
    createdAt: '2026-07-13T10:00:00',
    updatedAt: '2026-07-13T15:30:00',
    notes: 'ตรวจสอบแล้ว อะไหล่หน้าต่างรุ่นนี้เลิกผลิตไปแล้ว ไม่สามารถซ่อมเปลี่ยนเฉพาะตัวล็อกได้ ต้องส่งเรื่องทำแผนเสนอเปลี่ยนกรอบหน้าต่างใหม่ทั้งชุดในงบประมาณก้อนถัดไป',
    assignedStaff: 'นายสมชาย ใจดี',
    priority: 'ปานกลาง'
  },
  {
    id: 'SS-2026-010',
    title: 'ประตูกลอนแม่เหล็กคีย์การ์ดเสีย ค้างเปิดตลอดเวลา',
    description: 'ประตูระบบ Key Card คอนโทรลทางเข้าแผนกคอมพิวเตอร์ อาคาร 1 ชั้น 3 กลอนแม่เหล็กไฟฟ้า (Magnetic Lock) ไม่มีแรงดูดเพื่อล็อก ถึงแม้ไฟสถานะจะเป็นสีแดงคีย์การ์ดปิดแล้วก็ตาม สามารถดึงเปิดเข้าไปได้เลยโดยไม่ต้องทาบบัตร',
    mainCategory: 'ความปลอดภัย',
    subCategory: 'ระบบควบคุมทางเข้าออก',
    location: 'ห้องฝ่ายคอมพิวเตอร์และเครือข่าย ชั้น 3 อาคาร 1',
    imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop&q=80',
    reporterName: 'นางสาวมณีรัตน์ วงศ์เทวัญ',
    reporterEmail: 'maneerat.w@ku.th',
    reporterPhone: '081-443-8899',
    department: 'สำนักงานคณบดี',
    status: 'กำลังดำเนินการ',
    createdAt: '2026-07-14T09:00:00',
    updatedAt: '2026-07-15T08:00:00',
    notes: 'บอร์ดควบคุมไฟเลี้ยงกลอนชำรุด มีกระแสไฟไม่พอเลี้ยงขดลวดแม่เหล็ก กำลังสั่งซื้ออะไหล่รีเลย์การควบคุมใหม่',
    assignedStaff: 'นางสาวอรทัย แสงสว่าง',
    priority: 'สูง'
  }
];

export const INITIAL_LOGS: ReportLog[] = [
  {
    id: 'LOG-001',
    reportId: 'SS-2026-001',
    action: 'สร้างคำร้องใหม่',
    oldStatus: null,
    newStatus: 'รับเรื่องแล้ว',
    note: 'ผู้แจ้งแจ้งคำร้องผ่านระบบสำเร็จ',
    createdBy: 'นางสาววิภาดา รักษ์เรียน (ผู้แจ้ง)',
    createdAt: '2026-07-10T09:15:00'
  },
  {
    id: 'LOG-002',
    reportId: 'SS-2026-001',
    action: 'จ่ายงานและมอบหมาย',
    oldStatus: 'รับเรื่องแล้ว',
    newStatus: 'กำลังดำเนินการ',
    note: 'มอบหมายงานให้ช่างสมชาย ดำเนินการเข้าตรวจสอบหน้างานด่วนเนื่องจากน้ำไหลมาก',
    createdBy: 'ผู้ดูแลระบบกลาง',
    createdAt: '2026-07-10T10:00:00'
  },
  {
    id: 'LOG-003',
    reportId: 'SS-2026-001',
    action: 'อัปเดตและปิดงาน',
    oldStatus: 'กำลังดำเนินการ',
    newStatus: 'เสร็จสิ้น',
    note: 'ดำเนินการเปลี่ยนวาล์วทองเหลืองและหัวก๊อกใหม่ขนาด 1/2 นิ้วเรียบร้อยแล้ว ทดสอบไม่มีน้ำรั่วซึม',
    createdBy: 'นายสมชาย ใจดี (ช่างผู้รับผิดชอบ)',
    createdAt: '2026-07-10T14:30:00'
  },
  {
    id: 'LOG-004',
    reportId: 'SS-2026-002',
    action: 'สร้างคำร้องใหม่',
    oldStatus: null,
    newStatus: 'รับเรื่องแล้ว',
    note: 'ผู้แจ้งแจ้งคำร้องผ่านระบบสำเร็จ',
    createdBy: 'ดร.พงศธร ศรศิลป์ (ผู้แจ้ง)',
    createdAt: '2026-07-12T11:00:00'
  },
  {
    id: 'LOG-005',
    reportId: 'SS-2026-002',
    action: 'มอบหมายช่าง',
    oldStatus: 'รับเรื่องแล้ว',
    newStatus: 'กำลังดำเนินการ',
    note: 'มอบหมายงานให้ นายสมชาย ใจดี',
    createdBy: 'ผู้ดูแลระบบกลาง',
    createdAt: '2026-07-12T13:00:00'
  },
  {
    id: 'LOG-006',
    reportId: 'SS-2026-002',
    action: 'เสร็จสิ้นงาน',
    oldStatus: 'กำลังดำเนินการ',
    newStatus: 'เสร็จสิ้น',
    note: 'เปลี่ยนเป็นหลอด LED ขนาด 18W พร้อมถอดสตาร์ทเตอร์เดิมออก เรียบร้อย แสงสว่างสม่ำเสมอไม่มีเสียงคราง',
    createdBy: 'นายสมชาย ใจดี (ช่างผู้รับผิดชอบ)',
    createdAt: '2026-07-12T16:15:00'
  },
  {
    id: 'LOG-007',
    reportId: 'SS-2026-003',
    action: 'สร้างคำร้องใหม่',
    oldStatus: null,
    newStatus: 'รับเรื่องแล้ว',
    note: 'ผู้แจ้งแจ้งคำร้องผ่านระบบสำเร็จ',
    createdBy: 'นายณรงค์เดช นุ่มนวล (ผู้แจ้ง)',
    createdAt: '2026-07-14T13:20:00'
  },
  {
    id: 'LOG-008',
    reportId: 'SS-2026-003',
    action: 'รับเรื่องและเข้าตรวจสอบ',
    oldStatus: 'รับเรื่องแล้ว',
    newStatus: 'กำลังดำเนินการ',
    note: 'เข้าตรวจสอบพบท่อน้ำทิ้งตันเนื่องจากเมือกสะสม กำลังเตรียมเครื่องเป่าลมแรงดันสูงเข้าทะลวงท่อระบายน้ำทิ้ง',
    createdBy: 'นายสมชาย ใจดี (ช่างผู้รับผิดชอบ)',
    createdAt: '2026-07-15T10:00:00'
  },
  {
    id: 'LOG-009',
    reportId: 'SS-2026-004',
    action: 'สร้างคำร้องใหม่',
    oldStatus: null,
    newStatus: 'รับเรื่องแล้ว',
    note: 'ผู้แจ้งแจ้งคำร้องสำเร็จ',
    createdBy: 'นายอนันต์ เกียรติภูมิ (ผู้แจ้ง)',
    createdAt: '2026-07-14T15:45:00'
  },
  {
    id: 'LOG-010',
    reportId: 'SS-2026-004',
    action: 'อัปเดตสถานะงาน',
    oldStatus: 'รับเรื่องแล้ว',
    newStatus: 'กำลังดำเนินการ',
    note: 'กำลังทดสอบสัญญาณความเข้มข้น และประสานงานติดตั้ง Access Point เพิ่มเติมอีก 1 จุด เพื่อครอบคลุมพื้นที่ลานกิจกรรม',
    createdBy: 'นางสาวอรทัย แสงสว่าง (ช่างผู้รับผิดชอบ)',
    createdAt: '2026-07-15T09:30:00'
  },
  {
    id: 'LOG-011',
    reportId: 'SS-2026-009',
    action: 'สร้างคำร้องใหม่',
    oldStatus: null,
    newStatus: 'รับเรื่องแล้ว',
    note: 'ผู้แจ้งแจ้งเรื่องผ่านระบบ',
    createdBy: 'นายพงษ์ศักดิ์ รุ่งเรือง (ผู้แจ้ง)',
    createdAt: '2026-07-13T10:00:00'
  },
  {
    id: 'LOG-012',
    reportId: 'SS-2026-009',
    action: 'อัปเดตไม่สามารถดำเนินการได้',
    oldStatus: 'รับเรื่องแล้ว',
    newStatus: 'ไม่สามารถดำเนินการได้',
    note: 'ตรวจสอบแล้ว อะไหล่หน้าต่างรุ่นนี้เลิกผลิตไปแล้ว ไม่สามารถซ่อมเปลี่ยนเฉพาะตัวล็อกได้ ต้องส่งเรื่องทำแผนเสนอเปลี่ยนกรอบหน้าต่างใหม่ทั้งชุดในงบประมาณก้อนถัดไป',
    createdBy: 'นายสมชาย ใจดี',
    createdAt: '2026-07-13T15:30:00'
  }
];

export const INITIAL_SETTINGS: SystemSettings = {
  systemName: 'ระบบบริหารจัดการคำร้องแจ้งซ่อมและร้องเรียน คณะสังคมศาสตร์',
  maintenanceEmail: 'soc-repair@ku.ac.th',
  autoAssign: true,
  notifyOnNewReport: true,
  maxDailyReports: 50
};

// LocalStorage helpers to simulate Supabase persistence
export function getSavedReports(): Report[] {
  const data = localStorage.getItem('soc_backoffice_reports');
  if (!data) {
    localStorage.setItem('soc_backoffice_reports', JSON.stringify(INITIAL_REPORTS));
    return INITIAL_REPORTS;
  }
  return JSON.parse(data);
}

export function saveReports(reports: Report[]): void {
  localStorage.setItem('soc_backoffice_reports', JSON.stringify(reports));
}

export function getSavedLogs(): ReportLog[] {
  const data = localStorage.getItem('soc_backoffice_logs');
  if (!data) {
    localStorage.setItem('soc_backoffice_logs', JSON.stringify(INITIAL_LOGS));
    return INITIAL_LOGS;
  }
  return JSON.parse(data);
}

export function saveLogs(logs: ReportLog[]): void {
  localStorage.setItem('soc_backoffice_logs', JSON.stringify(logs));
}

export function getSavedStaff(): Staff[] {
  const data = localStorage.getItem('soc_backoffice_staff');
  if (!data) {
    localStorage.setItem('soc_backoffice_staff', JSON.stringify(INITIAL_STAFF));
    return INITIAL_STAFF;
  }
  return JSON.parse(data);
}

export function saveStaff(staff: Staff[]): void {
  localStorage.setItem('soc_backoffice_staff', JSON.stringify(staff));
}

export function getSavedSettings(): SystemSettings {
  const data = localStorage.getItem('soc_backoffice_settings');
  if (!data) {
    localStorage.setItem('soc_backoffice_settings', JSON.stringify(INITIAL_SETTINGS));
    return INITIAL_SETTINGS;
  }
  return JSON.parse(data);
}

export function saveSettings(settings: SystemSettings): void {
  localStorage.setItem('soc_backoffice_settings', JSON.stringify(settings));
}
