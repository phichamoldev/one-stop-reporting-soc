/**
 * Conflict Localization and Test Data Identification Utility
 * 
 * Provides:
 * 1. Mapping from internal system entity / conflict codes to clear, professional Thai labels.
 * 2. Robust text localization that replaces embedded English tokens with Thai explanations.
 * 3. Reliable metadata-based detection for test reports vs production reports.
 */

export const CONFLICT_LABEL_MAP: Record<string, string> = {
  // Commencement & Event Sub-domains
  commencement_venue: 'สถานที่จัดพิธีหรือจุดรายงานตัวรับปริญญา',
  commencement_schedule: 'กำหนดการและช่วงเวลารับปริญญา',
  commencement_registration: 'ข้อมูลการขึ้นทะเบียนหรือรายชื่อบัณฑิต',
  commencement_reporting: 'จุดตรวจเครื่องแต่งกายและรายงานตัวบัณฑิต',
  commencement_traffic: 'การจราจรและพื้นที่จอดรถงานพิธี',
  commencement_personal: 'ของใช้ส่วนบุคคลในงานพิธี',
  commencement_event: 'งานพิธีพระราชทานปริญญาบัตร',

  // Registration & Academic Services
  registration_discrepancy: 'ข้อมูลการลงทะเบียนไม่ตรงกัน',
  registration_inquiry: 'ขั้นตอนและวิธียื่นคำร้องการลงทะเบียน',
  academic_inquiry: 'ข้อมูลหลักสูตรและการสอบ',

  // Facility, Infrastructure & Utility Services
  network_wifi: 'ระบบเครือข่ายและสัญญาณ Wi-Fi',
  hvac_cooling: 'ระบบปรับอากาศและเครื่องทำความเย็น',
  plumbing_drainage: 'ระบบประปา ท่อน้ำ และการระบายน้ำ',
  flood_storm: 'ปัญหาน้ำท่วมขังและพายุฝน',
  electrical_routine: 'ระบบไฟฟ้าแสงสว่างและเต้ารับทั่วไป',
  electrical_macro: 'ระบบไฟฟ้าหลักขัดข้องวงกว้าง',
  safety_emergency: 'ความปลอดภัยและเหตุฉุกเฉินอันตราย',
  fire_emergency: 'เหตุเพลิงไหม้และกลุ่มควัน',
  gas_leak_emergency: 'เหตุก๊าซและสารเคมีรั่วไหล',
  elevator_emergency: 'เหตุลิฟต์โดยสารขัดข้อง',
  injury_medical_emergency: 'อุบัติเหตุและผู้บาดเจ็บ',
  it_av: 'อุปกรณ์โสตทัศนูปกรณ์และเครื่องเสียง',
  civil_facility: 'สิ่งอำนวยความสะดวกและกายภาพอาคาร',
  cleaning_sanitation: 'การทำความสะอาดและสุขอนามัย',
  personal_property: 'ทรัพย์สินส่วนบุคคลสูญหาย',
  general: 'ปัญหาทั่วไป',

  // High-level Conflict & Discrepancy Codes
  location_mismatch: 'สถานที่เกิดเหตุไม่ตรงกัน',
  category_mismatch: 'ประเภทปัญหาไม่ตรงกัน',
  different_issue: 'ลักษณะปัญหาเป็นคนละเรื่อง',
  sub_location_mismatch: 'จุดเกิดเหตุย่อยต่างกัน',
  time_gap: 'ช่วงเวลาเกิดเหตุมีระยะห่างเกินเกณฑ์',
  insufficient_evidence: 'ข้อมูลไม่เพียงพอในการยืนยันกลุ่ม',
  power_grid_failure: 'ไฟฟ้าดับวงกว้าง',
  storm_heavy_rain: 'พายุฝนและน้ำหลาก',
};

/**
 * Fallback message when an unknown internal code is encountered.
 * Conforms to Rule 4: "หากพบรหัสที่ยังไม่มี Mapping ให้แสดงข้อความกลางภาษาไทย เช่น 'พบข้อมูลที่แตกต่างกันและควรตรวจสอบ' แทนการแสดงรหัสดิบ"
 */
export const UNKNOWN_CONFLICT_FALLBACK = 'พบข้อมูลที่แตกต่างกันและควรตรวจสอบ';

/**
 * Returns a human-friendly Thai label for a given conflict or system entity code.
 * Guaranteed to NEVER return raw English code to staff UI.
 */
export function getConflictLabel(code: string | null | undefined): string {
  if (!code || typeof code !== 'string') {
    return UNKNOWN_CONFLICT_FALLBACK;
  }
  const cleanCode = code.trim().toLowerCase();
  return CONFLICT_LABEL_MAP[cleanCode] || UNKNOWN_CONFLICT_FALLBACK;
}

/**
 * Localizes any contradiction reason string that might contain embedded English codes
 * e.g. "คนละประเภทปัญหา (commencement_venue กับ commencement_registration) ไม่สามารถจัดเป็นเหตุการณ์เดียวกันได้"
 * -> "คนละประเภทปัญหา (สถานที่จัดพิธีหรือจุดรายงานตัวรับปริญญา กับ ข้อมูลการขึ้นทะเบียนหรือรายชื่อบัณฑิต) ไม่สามารถจัดเป็นเหตุการณ์เดียวกันได้"
 */
export function localizeConflictReason(reason: string | null | undefined): string {
  if (!reason || typeof reason !== 'string') {
    return UNKNOWN_CONFLICT_FALLBACK;
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    return UNKNOWN_CONFLICT_FALLBACK;
  }

  // If the reason is a pure code itself (e.g. "commencement_venue")
  if (CONFLICT_LABEL_MAP[trimmed.toLowerCase()]) {
    return CONFLICT_LABEL_MAP[trimmed.toLowerCase()];
  }

  // Replace patterns like "(entityA กับ entityB)"
  let localized = trimmed.replace(
    /\(([\w-]+)\s*(?:กับ|vs|and)\s*([\w-]+)\)/gi,
    (_match, codeA, codeB) => {
      const labelA = getConflictLabel(codeA);
      const labelB = getConflictLabel(codeB);
      return `(${labelA} กับ ${labelB})`;
    }
  );

  // Replace standalone parenthesized codes like "(network_wifi)"
  localized = localized.replace(/\(([\w-]+)\)/gi, (match, singleCode) => {
    // If it's a number (e.g. "(40%)" or "(ชั้น 2)"), keep it
    if (/^\d+%?$/i.test(singleCode)) {
      return match;
    }
    const label = getConflictLabel(singleCode);
    return `(${label})`;
  });

  // Replace any leftover known English entity codes in the text
  for (const [code, label] of Object.entries(CONFLICT_LABEL_MAP)) {
    const regex = new RegExp(`\\b${code}\\b`, 'gi');
    localized = localized.replace(regex, label);
  }

  // Safety Guard: If there are any stray snake_case English words remaining (e.g. unknown_system_xyz),
  // replace with safe Thai fallback rather than leaking raw code
  localized = localized.replace(/\b[a-z]+_[a-z0-9_]+\b/gi, UNKNOWN_CONFLICT_FALLBACK);

  return localized;
}

/**
 * Reliable Test Data Identifier based on DB Sequence format and metadata.
 * Does NOT rely on naive text matching so real reports about graduation/tests are never misclassified.
 */
export function isTestReport(report: {
  public_id?: string | null;
  email?: string | null;
  phone?: string | null;
} | null | undefined): boolean {
  if (!report) return false;

  const publicId = (report.public_id || '').toUpperCase().trim();

  // 1. Explicit Test / Synthetic Public ID prefixes (generated exclusively by test DB sequence or test seeds)
  if (
    publicId.startsWith('SOC-T-') ||
    publicId.startsWith('SOC-TEST-') ||
    publicId.startsWith('SOC-SYN-')
  ) {
    return true;
  }

  // 2. Synthetic Test Email Domains
  const email = (report.email || '').toLowerCase().trim();
  if (email.endsWith('@example.com') || email.endsWith('.test') || email.includes('synthetic')) {
    return true;
  }

  return false;
}

/**
 * Checks whether an incident group is a Real Production Incident Group (INC-xxxxx)
 * vs a Test Incident Group (INC-T-xxxxx)
 */
export function isRealIncidentGroup(group: {
  group_code?: string | null;
} | null | undefined): boolean {
  if (!group || !group.group_code) return false;
  const code = group.group_code.toUpperCase().trim();
  return code.startsWith('INC-') && !code.startsWith('INC-T-');
}
