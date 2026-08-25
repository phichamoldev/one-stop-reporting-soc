/**
 * ฟังก์ชันสำหรับสุ่มตัวเลข 5 หลักเพื่อใช้เป็นรหัสรายงาน SOC-XXXXX
 */
export function generatePublicId(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000); // 10000 - 99999
  return `SOC-${randomNum}`;
}

/**
 * ฟังก์ชันสำหรับแปลงเลขอ้างอิงคำร้องให้อยู่ในรูปแบบมาตรฐาน (SOC-XXXXX หรือ UUID)
 * - ตัดช่องว่างหน้า-หลัง (trim whitespace)
 * - แปลงตัวพิมพ์เล็กเป็นตัวพิมพ์ใหญ่ (uppercase)
 * - หากกรอกเฉพาะตัวเลข (เช่น "80397") จะเติม prefix "SOC-" อัตโนมัติ -> "SOC-80397"
 * - หากกรอก "SOC80397" หรือ "soc80397" (ไม่มีขีด) จะแปลงเป็น "SOC-80397"
 * - หากกรอก "SOC-80397" หรือ "soc-80397" จะแปลงเป็น "SOC-80397"
 * - หากเป็น UUID Tracking Token จะคงรูปแบบเดิม
 */
export function normalizePublicId(input?: string | null): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  // ตรวจสอบว่าเป็น UUID Tracking Token หรือไม่
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
  if (isUUID) {
    return trimmed.toLowerCase();
  }

  // แปลงเป็นตัวพิมพ์ใหญ่
  const upper = trimmed.toUpperCase();

  // กรณีเป็นตัวเลขล้วน เช่น "80397" หรือ "1234" -> เติม "SOC-"
  if (/^\d+$/.test(upper)) {
    return `SOC-${upper}`;
  }

  // กรณีพิมพ์ "SOC80397" (ไม่มีขีดกลาง) -> แปลงเป็น "SOC-80397"
  if (/^SOC\d+$/i.test(upper)) {
    return `SOC-${upper.slice(3)}`;
  }

  return upper;
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

