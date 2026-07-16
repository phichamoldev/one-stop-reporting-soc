/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ReportStatus = 
  | 'รับเรื่องแล้ว' 
  | 'กำลังดำเนินการ' 
  | 'เสร็จสิ้น' 
  | 'ไม่สามารถดำเนินการได้' 
  | 'ยกเลิกรายการ';

export interface ReportLog {
  id: string;
  reportId: string;
  action: string;
  oldStatus: ReportStatus | null;
  newStatus: ReportStatus;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface Report {
  id: string; // เลขที่อ้างอิง เช่น SS-2026-001
  title: string; // หัวข้อ
  description: string; // รายละเอียด
  mainCategory: 'อาคารสถานที่' | 'คอมพิวเตอร์' | 'อินเทอร์เน็ต' | 'ความสะอาด' | 'สิ่งแวดล้อม' | 'ความปลอดภัย';
  subCategory: string; // หมวดหมู่ย่อย เช่น หลอดไฟเสีย, อินเทอร์เน็ตหลุดบ่อย
  location: string; // สถานที่ เช่น อาคาร 1 ชั้น 3 ห้อง 1305
  imageUrl?: string; // รูปภาพคำร้อง
  reporterName: string; // ชื่อผู้แจ้ง
  reporterEmail: string; // อีเมลผู้แจ้ง
  reporterPhone: string; // เบอร์โทรผู้แจ้ง
  department: string; // หน่วยงาน เช่น ภาควิชาจิตวิทยา, สำนักงานคณบดี
  status: ReportStatus; // สถานะปัจจุบัน
  createdAt: string; // วันที่แจ้ง
  updatedAt: string; // วันที่อัปเดต
  notes?: string; // หมายเหตุเจ้าหน้าที่ล่าสุด
  assignedStaff?: string; // เจ้าหน้าที่รับผิดชอบ
  priority: 'ต่ำ' | 'ปานกลาง' | 'สูง' | 'เร่งด่วน';
}

export interface DepartmentStats {
  name: string;
  count: number;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  department: string;
  activeTasks: number;
  completedTasks: number;
  imageUrl?: string;
}

export interface SystemSettings {
  systemName: string;
  maintenanceEmail: string;
  autoAssign: boolean;
  notifyOnNewReport: boolean;
  maxDailyReports: number;
}
