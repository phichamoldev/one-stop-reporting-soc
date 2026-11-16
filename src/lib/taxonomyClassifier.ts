/**
 * Canonical Category & Incident Taxonomy Classification Service
 * 
 * Enforces Phase 3.7 Canonical Taxonomy Rules:
 * 1. Physical safety & emergency incidents (Fire, Smoke, Gas Leak, Elevator, Structural)
 *    strictly map to Category 4: "กายภาพ สิ่งแวดล้อม และความปลอดภัย" (Department 4).
 * 2. Fire/Disaster incidents map to Subcategory 34: "เหตุฉุกเฉิน" (Emergency) or 32: "ความปลอดภัย".
 * 3. STRICT RULE: Fire & emergency reports MUST NEVER be classified as Category 3: "บริหารงานบุคคล"
 *    (Personnel Administration), even if text mentions informants, victims, or individuals
 *    (e.g., "นาย...", "นางสาว...", "นิสิต", "อาจารย์", "แม่บ้าน", "ช่าง", "บุคคล").
 * 4. Separate System Entities ensure Fire, Gas Leak, Elevator, and Injury incidents remain
 *    mutually isolated and are NEVER conflated or inappropriately merged.
 */

export type CanonicalIncidentType =
  | 'fire'
  | 'gas_leak'
  | 'elevator'
  | 'injury_accident'
  | 'electrical_routine'
  | 'it_wifi'
  | 'facility_routine'
  | 'academic'
  | 'personnel_hr'
  | 'general';

export interface TaxonomyClassification {
  category_id: number;
  subcategory_id: number;
  category_name: string;
  subcategory_name: string;
  incident_type: CanonicalIncidentType;
  display_label: string;
  system_entity: string;
}

export function classifyReportTaxonomy(
  description: string = '',
  location: string = ''
): TaxonomyClassification {
  const text = `${description || ''} ${location || ''}`.trim();

  // 1. Injury / Medical Emergency (e.g., "พบผู้บาดเจ็บจากไฟไหม้", "คนหมดสติ")
  if (/(?:ผู้บาดเจ็บ|คนเจ็บ|หมดสติ|เลือดออก|ปฐมพยาบาล|กู้ชีพ|บาดเจ็บสาหัส|ล้มหมดสติ)/i.test(text)) {
    return {
      category_id: 4,
      subcategory_id: 34,
      category_name: 'กายภาพ สิ่งแวดล้อม และความปลอดภัย',
      subcategory_name: 'เหตุฉุกเฉิน',
      incident_type: 'injury_accident',
      display_label: 'ประเภทอุบัติเหตุ/ผู้บาดเจ็บตาม Taxonomy',
      system_entity: 'injury_medical_emergency',
    };
  }

  // 2. Fire Scenario / เพลิงไหม้ (e.g., "พบไฟไหม้ในอาคาร", "พบควันไฟจากห้องเก็บของ", "พบควันหนาทึบ")
  // MUST NEVER BE CLASSIFIED AS CATEGORY 3 (บริหารงานบุคคล)
  if (/(?:ไฟไหม้|เพลิงไหม้|ควันไฟ|กลุ่มควัน|เปลวไฟ|กลิ่นไหม้|ไฟลุก|ประกายไฟ|แสงเพลิง|ดับเพลิง|เกิดไฟ|มีไฟลุก|ควัน(?:หนาทึบ|ดำ|พวยพุ่ง|หนาแน่น|โขมง)?)/i.test(text)) {
    return {
      category_id: 4,
      subcategory_id: 34,
      category_name: 'กายภาพ สิ่งแวดล้อม และความปลอดภัย',
      subcategory_name: 'เหตุฉุกเฉิน',
      incident_type: 'fire',
      display_label: 'เพลิงไหม้',
      system_entity: 'fire_emergency',
    };
  }

  // 3. Gas / Chemical Leak / ก๊าซรั่ว (e.g., "ท่อก๊าซรั่ว", "ได้กลิ่นแก๊สรั่ว")
  if (/(?:ก๊าซรั่ว|แก๊สรั่ว|ท่อก๊าซ|ท่อแก๊ส|กลิ่นก๊าซ|กลิ่นแก๊ส|สารเคมีรั่ว|ถังก๊าซ|ถังแก๊ส)/i.test(text)) {
    return {
      category_id: 4,
      subcategory_id: 34,
      category_name: 'กายภาพ สิ่งแวดล้อม และความปลอดภัย',
      subcategory_name: 'เหตุฉุกเฉิน',
      incident_type: 'gas_leak',
      display_label: 'ก๊าซรั่ว',
      system_entity: 'gas_leak_emergency',
    };
  }

  // 4. Elevator / ลิฟต์ (e.g., "ลิฟต์ค้างมีคนติดอยู่", "ลิฟต์ขัดข้อง")
  if (/ลิฟต์/i.test(text)) {
    const isTrapped = /(?:ติดอยู่|คนติด|ค้าง|เปิดไม่ออก|ไม่ขยับ|ขาดอากาศ)/i.test(text);
    return {
      category_id: 4,
      subcategory_id: isTrapped ? 34 : 23,
      category_name: 'กายภาพ สิ่งแวดล้อม และความปลอดภัย',
      subcategory_name: isTrapped ? 'เหตุฉุกเฉิน' : 'อาคารและสถานที่',
      incident_type: 'elevator',
      display_label: 'ลิฟต์ / เหตุฉุกเฉินเกี่ยวกับบุคคล',
      system_entity: 'elevator_emergency',
    };
  }

  // 5. IT / Wi-Fi / ระบบเครือข่าย
  if (/(?:wi-?fi|ไวไฟ|อินเทอร์เน็ต|เน็ตหลุด|เน็ตช้า|เราเตอร์|router|สายแลน)/i.test(text)) {
    return {
      category_id: 5,
      subcategory_id: 36,
      category_name: 'ระบบดิจิทัล คอมพิวเตอร์ และโสตทัศนูปกรณ์',
      subcategory_name: 'อินเทอร์เน็ต / Wi-Fi',
      incident_type: 'it_wifi',
      display_label: 'อินเทอร์เน็ตและเครือข่าย',
      system_entity: 'network_wifi',
    };
  }

  // 6. Routine Electrical / หลอดไฟ
  if (/(?:หลอดไฟ|ไฟทางเดิน|ไฟห้องน้ำ|สวิตช์ไฟ|ปลั๊กไฟ|ไฟกะพริบ)/i.test(text)) {
    return {
      category_id: 4,
      subcategory_id: 26,
      category_name: 'กายภาพ สิ่งแวดล้อม และความปลอดภัย',
      subcategory_name: 'ไฟฟ้า',
      incident_type: 'electrical_routine',
      display_label: 'ไฟฟ้าและแสงสว่าง',
      system_entity: 'electrical_routine',
    };
  }

  // 7. Genuine Personnel / HR (บริหารงานบุคคล) ONLY when truly HR/Personnel administrative matters
  if (/(?:ตำแหน่งทางวิชาการ|การอนุมัติตัวบุคคล|ขอลาพักร้อน|ลากิจ|ลาป่วย|สวัสดิการข้าราชการ|ประเมินผลการปฏิบัติงาน)/i.test(text)) {
    return {
      category_id: 3,
      subcategory_id: 15,
      category_name: 'บริหารงานบุคคล',
      subcategory_name: 'ตำแหน่งทางวิชาการ',
      incident_type: 'personnel_hr',
      display_label: 'บริหารงานบุคคล',
      system_entity: 'personnel_administration',
    };
  }

  // 8. Academic / การเรียนการสอน
  if (/(?:ตารางเรียน|ตารางสอบ|ลงทะเบียนเรียน|ผลการเรียน|เกรด|หลักสูตร|คลาสเรียน)/i.test(text)) {
    return {
      category_id: 1,
      subcategory_id: 1,
      category_name: 'วิชาการและการเรียนการสอน',
      subcategory_name: 'การลงทะเบียนเรียน',
      incident_type: 'academic',
      display_label: 'วิชาการและการเรียนการสอน',
      system_entity: 'academic_inquiry',
    };
  }

  // Default: General
  return {
    category_id: 7,
    subcategory_id: 53,
    category_name: 'ร้องเรียน ข้อเสนอแนะ และเรื่องทั่วไป',
    subcategory_name: 'เรื่องทั่วไป',
    incident_type: 'general',
    display_label: 'เรื่องทั่วไป',
    system_entity: 'general',
  };
}
