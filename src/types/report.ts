export type ReportCategory = 
  | 'Safety' 
  | 'Infrastructure' 
  | 'Sanitation' 
  | 'Traffic' 
  | 'Other';

export type ReportStatus = 
  | 'pending' 
  | 'investigating' 
  | 'in_progress' 
  | 'resolved' 
  | 'rejected';

type ReportPriority = 
  | 'low' 
  | 'medium' 
  | 'high';

export interface Report {
  id: string; // UUID จากฐานข้อมูล
  public_id: string; // SOC-XXXXX
  tracking_token: string; // UUID สำหรับตรวจสอบสถานะ
  category: ReportCategory;
  location: string;
  description: string;
  image_url: string | null;
  reporter_name: string;
  email: string;
  status: ReportStatus;
  priority: ReportPriority;
  admin_remark: string | null;
  created_at: string;
  updated_at: string;
}

// ป้ายกำกับและไอคอนภาษาไทยสำหรับแต่ละหมวดหมู่
export const CATEGORY_DETAILS: Record<ReportCategory, { label: string; icon: string; description: string }> = {
  Safety: {
    label: 'ความปลอดภัย',
    icon: '🛡️',
    description: 'เรื่องที่เป็นอันตรายต่อชีวิต ทรัพย์สิน หรือความปลอดภัยสาธารณะ'
  },
  Infrastructure: {
    label: 'โครงสร้างพื้นฐาน',
    icon: '🚧',
    description: 'ถนนชำรุด ท่อระบายน้ำอุดตัน ไฟถนนดับ เสาไฟเอียง'
  },
  Sanitation: {
    label: 'สุขาภิบาล/ขยะ',
    icon: '🧹',
    description: 'ขยะมูลฝอยตกค้าง กลิ่นเหม็น สิ่งปฏิกูล น้ำเสีย'
  },
  Traffic: {
    label: 'การจราจร/ถนน',
    icon: '🚗',
    description: 'จอดรถกีดขวาง ป้ายจราจรเสียหาย สัญญาณไฟจราจรเสีย'
  },
  Other: {
    label: 'เรื่องอื่น ๆ',
    icon: '📁',
    description: 'ข้อเสนอแนะ ข้อร้องเรียน หรือเรื่องทั่วไปอื่น ๆ'
  }
};

// รายละเอียดสไตล์และป้ายกำกับภาษาไทยสำหรับแต่ละสถานะ
export interface StatusConfig {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
  stepIndex: number;
}

export const STATUS_DETAILS: Record<ReportStatus, StatusConfig> = {
  pending: {
    label: 'ยื่นเรื่องแล้ว',
    colorClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    borderClass: 'border-amber-200 dark:border-amber-900/50',
    dotClass: 'bg-amber-500',
    stepIndex: 0
  },
  investigating: {
    label: 'กำลังตรวจสอบ',
    colorClass: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    borderClass: 'border-blue-200 dark:border-blue-900/50',
    dotClass: 'bg-blue-500',
    stepIndex: 1
  },
  in_progress: {
    label: 'กำลังดำเนินการ',
    colorClass: 'text-purple-700 dark:text-purple-400',
    bgClass: 'bg-purple-50 dark:bg-purple-950/20',
    borderClass: 'border-purple-200 dark:border-purple-900/50',
    dotClass: 'bg-purple-500',
    stepIndex: 2
  },
  resolved: {
    label: 'ดำเนินการเสร็จสิ้น',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderClass: 'border-emerald-200 dark:border-emerald-900/50',
    dotClass: 'bg-emerald-500',
    stepIndex: 3
  },
  rejected: {
    label: 'ไม่รับเรื่อง',
    colorClass: 'text-rose-700 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/20',
    borderClass: 'border-rose-200 dark:border-rose-900/50',
    dotClass: 'bg-rose-500',
    stepIndex: 4
  }
};

