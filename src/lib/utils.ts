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
 * ฟังก์ชันสำหรับแปลงรูปแบบวันที่และเวลาจากฐานข้อมูลให้ออกมาเป็นรูปแบบภาษาไทยที่สวยงาม
 * ตัวอย่าง: 2 กรกฎาคม 2569 เวลา 13:20 น.
 */
export function formatDateTime(dateString: string | Date): string {
  if (!dateString) return "-";
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  // ใช้รูปแบบไทย พ.ศ. พร้อมกับเวลา น.
  const dateText = date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeText = date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${dateText} เวลา ${timeText} น.`;
}
