export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: 'ผู้ดูแลระบบสูงสุด',
  admin: 'ผู้ดูแลระบบ',
  manager: 'ผู้ดูแลหน่วยงาน',
  staff: 'เจ้าหน้าที่ปฏิบัติงาน',
};

export function getRoleDisplayName(role: string | undefined | null): string {
  if (!role) return '-';
  return ROLE_DISPLAY_NAMES[role] || role;
}
