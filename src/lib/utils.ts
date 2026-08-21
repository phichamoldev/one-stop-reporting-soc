/**
 * ฟังก์ชันสำหรับสุ่มตัวเลข 5 หลักเพื่อใช้เป็นรหัสรายงาน SOC-XXXXX
 */
export function generatePublicId(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000); // 10000 - 99999
  return `SOC-${randomNum}`;
}

/**
 * ฟังก์ชันสำหรับสร้าง Tracking Token ด้วย UUIDv4
 */
export function generateTrackingToken(): string {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback ในกรณีที่สภาพแวดล้อมไม่รองรับ crypto.randomUUID
  return (
    Math.random().toString(36).substring(2, 10) +
    "-" +
    Math.random().toString(36).substring(2, 6) +
    "-" +
    Date.now().toString(36).substring(2, 6)
  );
}

/**
 * ตรวจสอบว่าเป็นหมวดหมู่ย่อย "อื่น ๆ" / "อื่นๆ" หรือไม่
 */
export function isOtherSubcategory(name?: string | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  // ตรวจสอบชื่อ เช่น "อื่น ๆ", "อื่นๆ", "อื่น ๆ (โปรดระบุ)", "อื่นๆ (โปรดระบุ)", หรือขึ้นต้นด้วย "อื่น"
  return /^(อื่น\s*ๆ|อื่นๆ|อื่น\s*ฯ|อื่น)(?:\s*\(.*?\))?$/i.test(trimmed) || trimmed === 'อื่น ๆ' || trimmed === 'อื่นๆ';
}

/**
 * เรียงลำดับหมวดหมู่ย่อย:
 * 1. รายการทั่วไปเรียงตาม id ASC
 * 2. รายการ "อื่น ๆ" หรือ "อื่นๆ" ให้อยู่ท้ายสุดเสมอ
 */
export function sortSubcategories<T extends { id: number; name_th?: string | null }>(items: T[]): T[] {
  if (!items || !Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const isOtherA = isOtherSubcategory(a.name_th);
    const isOtherB = isOtherSubcategory(b.name_th);

    if (isOtherA && !isOtherB) return 1;
    if (!isOtherA && isOtherB) return -1;
    return a.id - b.id;
  });
}

