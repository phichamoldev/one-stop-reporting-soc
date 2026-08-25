

export type ReportStatus = 
  | 'pending' 
  | 'received'
  | 'in_progress' 
  | 'completed' 
  | 'rejected'
  | 'cancelled';

type ReportPriority = 
  | 'low' 
  | 'medium' 
  | 'high';

export type SearchMethod = 'soc' | 'phone';

export interface ReportLookupSummary {
  public_id: string;
  title?: string;
  description: string;
  location?: string;
  status: ReportStatus;
  created_at: string;
  category_name?: string;
}

export type LookupPhoneResponse = {
  found: boolean;
  count?: number;
  maskedPhone: string;
  reports: ReportLookupSummary[];
  error?: string;
};

export interface Report {
  id: string; // UUID จากฐานข้อมูล
  public_id: string; // SOC-XXXXX
  tracking_token: string; // UUID สำหรับตรวจสอบสถานะ
  category_id?: number;
  subcategory_id?: number;
  location: string;
  room_number?: string;
  description: string;
  image_url: string | null;
  reporter_name: string;
  email: string;
  phone?: string;
  reporter_phone?: string;
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
  image_url?: string | null;
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
  borderLeftClass: string;
  dotClass: string;
  icon: string;
  stepIndex: number;
}

export const STATUS_DETAILS: Record<ReportStatus, StatusConfig> = {
  pending: {
    label: 'รอรับเรื่อง',
    description: 'อยู่ระหว่างการรอคัดกรอง',
    colorClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    borderClass: 'border-amber-200 dark:border-amber-900/50',
    borderLeftClass: 'border-l-amber-500',
    dotClass: 'bg-amber-500',
    icon: 'Clock',
    stepIndex: 0
  },
  received: {
    label: 'รับเรื่องแล้ว',
    description: 'รับเรื่องเข้าระบบแล้ว',
    colorClass: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    borderClass: 'border-blue-200 dark:border-blue-900/50',
    borderLeftClass: 'border-l-blue-500',
    dotClass: 'bg-blue-500',
    icon: 'Inbox',
    stepIndex: 1
  },
  in_progress: {
    label: 'กำลังดำเนินการ',
    description: 'ดำเนินการแจ้งไปยังหน่วยที่เกี่ยวข้องแล้ว',
    colorClass: 'text-orange-700 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-950/20',
    borderClass: 'border-orange-200 dark:border-orange-900/50',
    borderLeftClass: 'border-l-orange-500',
    dotClass: 'bg-orange-500',
    icon: 'Play',
    stepIndex: 2
  },
  completed: {
    label: 'เสร็จสิ้น',
    description: 'ขอบคุณที่ช่วยกันพัฒนาคณะของเรา',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderClass: 'border-emerald-200 dark:border-emerald-900/50',
    borderLeftClass: 'border-l-emerald-500',
    dotClass: 'bg-emerald-500',
    icon: 'CheckCircle2',
    stepIndex: 3
  },
  rejected: {
    label: 'ไม่สามารถดำเนินการได้',
    description: 'เรื่องนี้ไม่อยู่ในขอบเขตการดำเนินงานของคณะ',
    colorClass: 'text-red-700 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/20',
    borderClass: 'border-red-200 dark:border-red-900/50',
    borderLeftClass: 'border-l-red-500',
    dotClass: 'bg-red-500',
    icon: 'XCircle',
    stepIndex: 4
  },
  cancelled: {
    label: 'ยกเลิกรายการ',
    description: 'รายการนี้ถูกยกเลิก',
    colorClass: 'text-gray-700 dark:text-gray-400',
    bgClass: 'bg-gray-50 dark:bg-gray-950/20',
    borderClass: 'border-gray-200 dark:border-gray-900/50',
    borderLeftClass: 'border-l-gray-500',
    dotClass: 'bg-gray-500',
    icon: 'AlertTriangle',
    stepIndex: 5
  }
};

export const STATUS_LABELS: Record<string, string> = {
  pending: STATUS_DETAILS.pending.label,
  received: STATUS_DETAILS.received.label,
  in_progress: STATUS_DETAILS.in_progress.label,
  completed: STATUS_DETAILS.completed.label,
  rejected: STATUS_DETAILS.rejected.label,
  cancelled: STATUS_DETAILS.cancelled.label
};

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return '-';
  const clean = status.trim().toLowerCase();
  if (clean === 'pending') return STATUS_DETAILS.pending.label;
  if (clean === 'received') return STATUS_DETAILS.received.label;
  if (clean === 'in_progress') return STATUS_DETAILS.in_progress.label;
  if (clean === 'completed') return STATUS_DETAILS.completed.label;
  if (clean === 'rejected') return STATUS_DETAILS.rejected.label;
  if (clean === 'cancelled') return STATUS_DETAILS.cancelled.label;
  return STATUS_DETAILS[clean as ReportStatus]?.label || status;
}

export function getActionLabel(action: string | null | undefined, newStatus?: string | null): string {
  if (action === 'transfer') return 'โอนคำร้อง';
  if (action === 'created') return 'ส่งเรื่องเข้าระบบ';
  if (action === 'status_updated' || action === 'อัปเดตข้อมูล' || action === 'update') {
    return newStatus ? `เปลี่ยนสถานะเป็น ${getStatusLabel(newStatus)}` : 'อัปเดตข้อมูล';
  }
  if (action === 'note_updated') return 'อัปเดตหมายเหตุ';
  if (newStatus) return `เปลี่ยนสถานะเป็น ${getStatusLabel(newStatus)}`;
  if (!action) return '-';
  return action;
}

