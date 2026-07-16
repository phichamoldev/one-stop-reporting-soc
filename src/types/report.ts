

export type ReportStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'rejected'
  | 'cancelled';

type ReportPriority = 
  | 'low' 
  | 'medium' 
  | 'high';

export interface Report {
  id: string; // UUID จากฐานข้อมูล
  public_id: string; // SOC-XXXXX
  tracking_token: string; // UUID สำหรับตรวจสอบสถานะ
  category_id?: number;
  subcategory_id?: number;
  location: string;
  description: string;
  image_url: string | null;
  reporter_name: string;
  email: string;
  phone?: string;
  status: ReportStatus;
  priority: ReportPriority;
  admin_remark: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  categories?: {
    id: number;
    name_th: string;
    department_id?: number;
  };
  subcategories?: {
    id: number;
    name_th: string;
  };
  report_logs?: ReportLog[];
}

export interface DBCategory {
  id: number;
  name_th: string;
}

export interface DBSubcategory {
  id: number;
  name_th: string;
}

export interface StaffProfile {
  id: string;
  full_name: string;
  department_id: number | null;
  role: string;
  departments?: {
    name_th: string;
  };
}

export interface ReportLog {
  id: number;
  report_id: string;
  user_id: string | null;
  action: string;
  old_status: ReportStatus | null;
  new_status: ReportStatus;
  remark: string | null;
  created_at: string;
  staff_users?: {
    full_name: string;
  } | null;
  custom_label?: string;
}



// รายละเอียดสไตล์และป้ายกำกับภาษาไทยสำหรับแต่ละสถานะ
export interface StatusConfig {
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
  stepIndex: number;
}

export const STATUS_DETAILS: Record<ReportStatus, StatusConfig> = {
  pending: {
    label: 'รับเรื่องแล้ว',
    description: 'อยู่ระหว่างการรอคัดกรอง',
    colorClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    borderClass: 'border-amber-200 dark:border-amber-900/50',
    dotClass: 'bg-amber-500',
    stepIndex: 0
  },
  in_progress: {
    label: 'กำลังดำเนินการ',
    description: 'ดำเนินการแจ้งไปยังหน่วยที่เกี่ยวข้องแล้ว',
    colorClass: 'text-orange-700 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-950/20',
    borderClass: 'border-orange-200 dark:border-orange-900/50',
    dotClass: 'bg-orange-500',
    stepIndex: 1
  },
  completed: {
    label: 'เสร็จสิ้น',
    description: 'ขอบคุณที่ช่วยกันพัฒนาคณะของเรา',
    colorClass: 'text-green-700 dark:text-green-400',
    bgClass: 'bg-green-50 dark:bg-green-950/20',
    borderClass: 'border-green-200 dark:border-green-900/50',
    dotClass: 'bg-green-500',
    stepIndex: 2
  },
  rejected: {
    label: 'ไม่สามารถดำเนินการได้',
    description: 'เรื่องนี้ไม่อยู่ในขอบเขตการดำเนินงานของคณะ',
    colorClass: 'text-red-700 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/20',
    borderClass: 'border-red-200 dark:border-red-900/50',
    dotClass: 'bg-red-500',
    stepIndex: 3
  },
  cancelled: {
    label: 'ยกเลิกรายการ',
    description: 'รายการนี้ถูกยกเลิก',
    colorClass: 'text-gray-700 dark:text-gray-400',
    bgClass: 'bg-gray-50 dark:bg-gray-950/20',
    borderClass: 'border-gray-200 dark:border-gray-900/50',
    dotClass: 'bg-gray-500',
    stepIndex: 4
  }
};

