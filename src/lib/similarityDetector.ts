/**
 * Duplicate & Similar Request Detection Service
 * Step 3 Enhancement: Separation of Similarity from Real-World Incident Identity
 * 
 * Three Distinct Levels:
 *  1. Similar Request: Surface/topical textual and categorical similarity for discovery/search.
 *  2. Same Incident Candidate: Real-world physical alignment (location anchor, system entity,
 *     time window, root cause, and zero contradictions) for group drafting proposals.
 *  3. Confirmed Incident Group: Verified by human officer with official group code.
 * 
 * Safety & Quality:
 *  - Categorical hard boundary & entity incompatibility guard
 *  - Room-level, floor-level, and facility-specific contradiction detection
 *  - Personal property guard (lost items belonging to individual people never merged)
 *  - Insufficient evidence handling (vague/missing locations flagged for manual inspection)
 *  - Human-in-the-loop: Purely produces proposals, NEVER auto-merges or auto-updates DB.
 */

import { getConflictLabel } from "./conflictLocalization";

export interface ReportItem {
  id?: string;
  public_id: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  location?: string | null;
  description?: string | null;
  created_at: string | Date;
  status?: string | null;
  priority?: 'emergency' | 'normal' | 'needs_review' | string | null;
  reporter_name?: string | null;
}

export type SimilarityConfidence = 'high' | 'medium' | 'low';

export type ProblemDomain =
  | 'network'
  | 'hvac'
  | 'plumbing'
  | 'electrical_routine'
  | 'safety_emergency'
  | 'cleaning'
  | 'it_av'
  | 'commencement_schedule'
  | 'commencement_reporting'
  | 'commencement_personal'
  | 'personal_property'
  | 'general';

export type SystemEntity =
  | 'network_wifi'
  | 'hvac_cooling'
  | 'plumbing_drainage'
  | 'flood_storm'
  | 'electrical_routine'
  | 'electrical_macro'
  | 'safety_emergency'
  | 'fire_emergency'
  | 'gas_leak_emergency'
  | 'elevator_emergency'
  | 'injury_medical_emergency'
  | 'it_av'
  | 'civil_facility'
  | 'cleaning_sanitation'
  | 'personal_property'
  | 'academic_inquiry'
  | 'registration_inquiry'
  | 'registration_discrepancy'
  | 'commencement_schedule'
  | 'commencement_venue'
  | 'commencement_registration'
  | 'commencement_traffic'
  | 'general';

export type SpatialGranularity =
  | 'exact_spot'
  | 'floor_area'
  | 'building'
  | 'campus_vague'
  | 'unspecified';

export interface SpatialAnchor {
  landmark: string | null;
  floor: string | null;
  room: string | null;
  specificSpot: string | null;
  granularity: SpatialGranularity;
  summary: string;
}

export type IncidentCandidateDecision =
  | 'same_incident'
  | 'similar_request'
  | 'insufficient_evidence'
  | 'different_incident';

export interface IncidentIdentityEvaluation {
  candidateDecision: IncidentCandidateDecision;
  isSameIncidentCandidate: boolean;
  isInsufficientEvidence: boolean;
  isContradiction: boolean;
  ruleConfidence: 'high' | 'medium' | 'low';
  ruleScore: number;
  evidence: string[];
  differences: string[];
  contradictions: string[];
  spatialGranularity: SpatialGranularity;
  sharedRootCause?: string | null;
  affectedScope: 'localized_equipment' | 'room_level' | 'floor_wide' | 'building_wide' | 'campus_wide';
  targetAnchor: SpatialAnchor;
  candidateAnchor: SpatialAnchor;
  targetEntity: SystemEntity;
  candidateEntity: SystemEntity;
}

export interface ScoreBreakdown {
  categoryScore: number;       // 0 - 35
  locationScore: number;       // 0 - 25
  timeScore: number;           // 0 - 20
  textScore: number;           // 0 - 20
  totalScore: number;          // 0 - 100
}

export interface SimilarityResult {
  candidate: ReportItem;
  score: number;               // 0 - 100
  confidence: SimilarityConfidence;
  confidenceLabel: string;     // มีแนวโน้มซ้ำสูง / มีความคล้ายคลึง / หลักฐานไม่เพียงพอ
  reasons: string[];
  breakdown: ScoreBreakdown;
  isPersonalPropertyDuplicate: boolean;
  problemDomain?: ProblemDomain;
}

/**
 * Normalizes Thai text for similarity comparison
 */
export function normalizeThaiText(text: string = ''): string {
  if (!text) return '';
  return text
    // Strip zero-width & invisible characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize synonyms
    .replace(/ตึก\s*([0-9]+)/g, 'อาคาร $1')
    .replace(/ตึก/g, 'อาคาร')
    .replace(/ม\.เกษตร/g, 'มหาวิทยาลัย')
    .replace(/ม\./g, 'มหาวิทยาลัย')
    .replace(/ชม\./g, 'ชั่วโมง')
    .replace(/วศ\./g, 'วิศวกรรม')
    .replace(/รบ\./g, 'รัฐศาสตร์')
    .replace(/ศศ\./g, 'ศิลปศาสตร์')
    .replace(/รร\./g, 'โรงเรียน')
    .replace(/ห้องน้ำ\s*ช\b/g, 'ห้องน้ำชาย')
    .replace(/ห้องน้ำ\s*ญ\b/g, 'ห้องน้ำหญิง')
    // Remove special punctuation
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Generates character n-grams from a string
 */
export function getCharacterNgrams(text: string, n = 3): Set<string> {
  const clean = normalizeThaiText(text).replace(/\s/g, '');
  const ngrams = new Set<string>();
  if (clean.length < n) {
    if (clean.length > 0) ngrams.add(clean);
    return ngrams;
  }
  for (let i = 0; i <= clean.length - n; i++) {
    ngrams.add(clean.substring(i, i + n));
  }
  return ngrams;
}

/**
 * Calculates Dice coefficient similarity between two text strings using trigrams
 */
export function calculateTextSimilarity(textA: string = '', textB: string = ''): number {
  const normA = normalizeThaiText(textA);
  const normB = normalizeThaiText(textB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const ngramsA = getCharacterNgrams(normA, 3);
  const ngramsB = getCharacterNgrams(normB, 3);

  if (ngramsA.size === 0 || ngramsB.size === 0) return 0;

  let intersectionCount = 0;
  for (const gram of ngramsA) {
    if (ngramsB.has(gram)) intersectionCount++;
  }

  return (2 * intersectionCount) / (ngramsA.size + ngramsB.size);
}

/**
 * Known campus landmark patterns for location extraction
 * Order matters: Compound/specific locations must come first!
 */
const KNOWN_LANDMARKS = [
  { pattern: /(?:ลานจอดรถ|ที่จอดรถ).*(?:ข้างอาคาร\s*1|ข้างตึก\s*1)|ลานจอดรถข้าง|ที่จอดรถข้าง/i, name: 'ลานจอดรถข้างอาคาร 1' },
  { pattern: /ลานจอดรถ|ที่จอดรถ/i, name: 'ลานจอดรถ' },
  { pattern: /ทางเดินเชื่อม|ทางเชื่อม|สะพานเชื่อม|สะพานทางเดิน/i, name: 'ทางเดินเชื่อมอาคาร 1-2' },
  { pattern: /ลานกิจกรรมบ่อปลา|ลานบ่อปลา|บ่อปลา|ซุ้มถ่ายรูป/i, name: 'ลานกิจกรรมบ่อปลา' },
  { pattern: /หอประชุมใหญ่|หอประชุม/i, name: 'หอประชุมใหญ่' },
  { pattern: /โรงอาหารกลาง\s*2|โรงอาหารกลาง|โรงอาหาร/i, name: 'โรงอาหารกลาง' },
  { pattern: /ประตูงามวงศ์วาน\s*[1-3]?/i, name: 'ประตูงามวงศ์วาน' },
  { pattern: /ประตูพหลโยธิน/i, name: 'ประตูพหลโยธิน' },
  { pattern: /ประตูวิภาวดี(?:รังสิต)?/i, name: 'ประตูวิภาวดี' },
  { pattern: /ประตูทางเข้า|ประตูหน้า|ประตูใหญ่|รอบมหาวิทยาลัย/i, name: 'ประตูทางเข้ามหาวิทยาลัย' },
  { pattern: /(?:อาคาร|ตึก)\s*14\b/i, name: 'อาคาร 14' },
  { pattern: /(?:อาคาร|ตึก)\s*1\b|คณะสังคมศาสตร์/i, name: 'อาคาร 1' },
  { pattern: /(?:อาคาร|ตึก)\s*2\b/i, name: 'อาคาร 2' },
  { pattern: /(?:อาคาร|ตึก)\s*3\b/i, name: 'อาคาร 3' },
  { pattern: /(?:อาคาร|ตึก)\s*4\b/i, name: 'อาคาร 4' },
  { pattern: /(?:อาคาร|ตึก)\s*5\b/i, name: 'อาคาร 5' },
  { pattern: /(?:อาคาร|ตึก)\s*(?:เรียนรวม|บรรยายรวม)\b/i, name: 'อาคารเรียนรวม' },
  { pattern: /(?:อาคาร|ตึก)\s*(?:วิศวกรรมศาสตร์|วิศวะ)\b/i, name: 'อาคารวิศวกรรมศาสตร์' },
  { pattern: /(?:อาคาร|ตึก)\s*(?:วิทยาศาสตร์|วิทย์)\b/i, name: 'อาคารวิทยาศาสตร์' },
  { pattern: /(?:อาคาร|ตึก)\s*(?:เกษตรศาสตร์|เกษตร)\b/i, name: 'อาคารเกษตรศาสตร์' },
  { pattern: /(?:อาคาร|ตึก)\s*(?:บริหารธุรกิจ|บริหาร)\b/i, name: 'อาคารบริหารธุรกิจ' },
  { pattern: /(?:อาคาร|ตึก)\s*(?:มนุษยศาสตร์|มนุษย์)\b/i, name: 'อาคารมนุษยศาสตร์' },
  { pattern: /(?:อาคาร|ตึก)\s*(?:อเนกประสงค์|กิจกรรม)\b/i, name: 'อาคารอเนกประสงค์' },
];

export function extractLandmark(locationText: string = ''): string | null {
  if (!locationText) return null;
  const norm = normalizeThaiText(locationText);

  for (const landmark of KNOWN_LANDMARKS) {
    if (landmark.pattern.test(norm)) {
      return landmark.name;
    }
  }

  // Dynamic regex for any building number
  const bldgMatch = norm.match(/(?:อาคาร|ตึก)\s*([0-9]+)\b/i);
  if (bldgMatch) {
    return `อาคาร ${bldgMatch[1]}`;
  }

  // Dynamic regex for named buildings e.g. อาคารเรียนรวม, อาคารวิศวกรรมศาสตร์
  const namedBldgMatch = norm.match(/(?:อาคาร|ตึก)\s*([ก-๙a-zA-Z0-9_\-]+)/i);
  if (namedBldgMatch) {
    const rawName = namedBldgMatch[1].trim();
    if (!/^(?:ชั้น|ห้อง|พัก)/.test(rawName)) {
      return `อาคาร ${rawName}`;
    }
  }

  return null;
}

export function extractFloor(text: string = ''): string | null {
  if (!text) return null;
  const norm = normalizeThaiText(text);
  const match = norm.match(/(?:ชั้น|fl(?:oor)?\.?)\s*([0-9]+|ใต้ดิน|g|b[1-2])/i);
  return match ? match[1].toLowerCase() : null;
}

export function extractRoom(text: string = ''): string | null {
  if (!text) return null;
  const norm = normalizeThaiText(text);

  // Match room number preceded by room descriptor words
  // e.g. ห้อง 301, ห้องประชุม 301, ห้องเรียน 1302, ห้องแล็บ 2401, ห้อง 502, ห้อง 101, room 301
  const match = norm.match(/(?:ห้อง(?:เรียน|ปฏิบัติการ|แล็บ|คอม|ประชุม|พักอาจารย์|อาจารย์|สมุด)?|room)\s*([0-9]{1,4}[a-z]?)\b/i);
  if (match) return match[1].toLowerCase();

  // Also check stand-alone 3-4 digit numbers following building or floor tokens
  const afterBldgOrFloor = norm.match(/(?:อาคาร|ตึก|ชั้น)\s*[0-9]+\s+(?:ห้อง\s*)?([0-9]{3,4}[a-z]?)\b/i);
  if (afterBldgOrFloor) return afterBldgOrFloor[1].toLowerCase();

  return null;
}

export function extractSpecificSpot(text: string = ''): string | null {
  if (!text) return null;
  const norm = normalizeThaiText(text);

  if (/ห้องน้ำ\s*ชาย/i.test(norm)) return 'ห้องน้ำชาย';
  if (/ห้องน้ำ\s*หญิง/i.test(norm)) return 'ห้องน้ำหญิง';
  if (/ทางลาด|บันไดทางขึ้น|บันไดทางเข้า/i.test(norm)) return 'ทางลาดหน้าอาคาร';
  if (/ทางเดินเชื่อม|สะพานเชื่อม/i.test(norm)) return 'ทางเดินเชื่อมอาคาร 1-2';
  if (/ลานจอดรถ.*(?:ข้าง|หลัง|มอเตอร์ไซค์)|ที่จอดรถ.*ข้าง/i.test(norm)) return 'ลานจอดรถข้างอาคาร 1';
  if (/ลานกิจกรรมบ่อปลา|ลานบ่อปลา|บ่อปลา|ซุ้มถ่ายรูป/i.test(norm)) return 'ลานกิจกรรมบ่อปลา';
  if (/ป้อมยาม|ป้อม รปภ/i.test(norm)) return 'ป้อมยาม';
  if (/โรงอาหาร/i.test(norm)) return 'โรงอาหารกลาง';
  if (/ห้องสมุด|หอสมุด/i.test(norm)) return 'ห้องสมุด';

  const room = extractRoom(norm);
  if (room) {
    if (/ห้องประชุม/i.test(norm)) return `ห้องประชุม ${room}`;
    if (/ห้องแล็บ|ห้องคอม/i.test(norm)) return `ห้องแล็บ ${room}`;
    return `ห้อง ${room}`;
  }

  return null;
}

export function extractSpatialAnchor(locationText: string = '', descriptionText: string = ''): SpatialAnchor {
  const combined = `${locationText || ''} ${descriptionText || ''}`.trim();
  if (!combined) {
    return {
      landmark: null,
      floor: null,
      room: null,
      specificSpot: null,
      granularity: 'unspecified',
      summary: 'ไม่ระบุสถานที่'
    };
  }

  const landmark = extractLandmark(locationText) || extractLandmark(combined);
  const floor = extractFloor(locationText) || extractFloor(descriptionText);
  const room = extractRoom(locationText) || extractRoom(descriptionText);
  const specificSpot = extractSpecificSpot(locationText) || extractSpecificSpot(descriptionText);

  const cleanLoc = normalizeThaiText(locationText || '');
  const isVagueOnly = !cleanLoc || /^(?:มหาวิทยาลัย|ม\.เกษตร|มก\.?|คณะสังคมศาสตร์|คณะ|พื้นที่ทั่วไป|ทางเดิน|รอบมหาลัย|ไม่ระบุ|แถวนี้|ตรงนี้)$/i.test(cleanLoc);

  let granularity: SpatialGranularity = 'unspecified';
  if (room || specificSpot) {
    granularity = 'exact_spot';
  } else if (floor && landmark) {
    granularity = 'floor_area';
  } else if (landmark) {
    granularity = 'building';
  } else if (isVagueOnly || (!landmark && !floor && !room && !specificSpot)) {
    granularity = 'campus_vague';
  }

  const parts: string[] = [];
  if (landmark) parts.push(landmark);
  if (floor) parts.push(`ชั้น ${floor}`);
  if (specificSpot) {
    parts.push(specificSpot);
  } else if (room) {
    parts.push(`ห้อง ${room}`);
  }

  const summary = parts.length > 0 ? parts.join(' ') : (locationText || 'ไม่ระบุสถานที่ชัดเจน');

  return {
    landmark,
    floor,
    room,
    specificSpot,
    granularity,
    summary
  };
}

/**
 * Extracts fine-grained system entity from report content
 */
export function extractSystemEntity(
  description: string = '',
  location: string = '',
  subcategoryId?: number | null
): SystemEntity {
  const text = `${description || ''} ${location || ''}`.toLowerCase();
  const subId = subcategoryId || 0;

  if (subId === 33 || /ของหาย|บัตร.*หาย|กระเป๋า.*หาย|ลืมของ|เก็บของได้|รองเท้า.*หาย|กระเป๋าเงิน|ร่ม.*หาย/i.test(text)) {
    return 'personal_property';
  }

  // 1. Injury & Medical Emergency
  if (/(?:ผู้บาดเจ็บ|คนเจ็บ|หมดสติ|เลือดออก|ปฐมพยาบาล|กู้ชีพ|บาดเจ็บสาหัส|ล้มหมดสติ)/i.test(text)) {
    return 'injury_medical_emergency';
  }

  // 2. Fire & Smoke Emergency
  if (/(?:ไฟไหม้|ไฟลุก|เพลิงไหม้|เกิดเพลิง|ควัน(?:หนาทึบ|พวยพุ่ง|ไฟ)?|กลุ่มควัน|เปลวไฟ|กลิ่นไหม้|ประกายไฟ|แสงเพลิง|ดับเพลิง|เกิดไฟ|มีไฟลุก)/i.test(text)) {
    return 'fire_emergency';
  }

  // 3. Gas & Chemical Leak Emergency
  if (/(?:ก๊าซรั่ว|แก๊สรั่ว|ท่อก๊าซ|ท่อแก๊ส|กลิ่นก๊าซ|กลิ่นแก๊ส|สารเคมีรั่ว|ถังก๊าซ|ถังแก๊ส)/i.test(text)) {
    return 'gas_leak_emergency';
  }

  // 4. Elevator Incident
  if (/ลิฟต์/i.test(text)) {
    return 'elevator_emergency';
  }

  if (
    subId === 34 ||
    /(?:ถล่ม|ตึกพัง|คานร้าว|ตลิ่งทรุด)/i.test(text)
  ) {
    return 'safety_emergency';
  }

  if (/(?:หม้อแปลง.*ระเบิด|ระเบิด|สายไฟขาด|ไฟดูด|ไฟฟ้า?ดับทั้ง(?:ตึก|อาคาร|ชั้น|ระบบ)|เบรกเกอร์ทริป)/i.test(text)) {
    return 'electrical_macro';
  }

  if (subId === 2 || /เลื่อนสอบ|ตารางสอบ|คลาสเรียน|วิชาการ|ยกเลิกคลาส|ผลการเรียน|หน่วยกิต/i.test(text)) {
    return 'academic_inquiry';
  }

  if (/(?:วิธี(?:การ)?ลงทะเบียน|ขั้นตอน(?:การ)?ลงทะเบียน|ลงทะเบียนอย่างไร|ลงทะเบียนยังไง|เปิดลงทะเบียนวันไหน|เปิดระบบลงทะเบียน)/i.test(text)) {
    return 'registration_inquiry';
  }
  if (/(?:ลงทะเบียนแล้ว)?(?:ไม่พบรายชื่อ|ไม่มีรายชื่อ|ชื่อตกหล่น|ไม่มีชื่อในระบบ|รายชื่อหาย|รายชื่อตกหล่น)/i.test(text)) {
    return 'registration_discrepancy';
  }

  if (subId === 55 || /รับปริญญา|บัณฑิต|ซ้อมใหญ่|ซ้อมย่อย/i.test(text)) {
    if (/กำหนดการ|วันเวลา|ตารางเวลา|กี่โมง|เวลาใด/i.test(text)) return 'commencement_schedule';
    if (/(?:จุด|โต๊ะ).*(?:รายงานตัว|ลงทะเบียน)|จุดรายงานตัว|จุดลงทะเบียน|โต๊ะรายงานตัว|จุดตรวจเครื่องแต่งกาย|จุดตั้งแถว|ตั้งขบวน/i.test(text)) return 'commencement_venue';
    if (/ไม่พบรายชื่อ|ชื่อตกหล่น|ยังไม่ได้รับบัตร|ไม่มีชื่อ|สิทธิ์|เอกสารไม่สมบูรณ์/i.test(text)) return 'commencement_registration';
    if (/ที่จอดรถ.*รับปริญญา|การจราจร.*รับปริญญา|รถติด/i.test(text)) return 'commencement_traffic';
  }

  if (
    subId === 36 ||
    /(?:wi-?fi|ไวไฟ|อินเทอร์เน็ต|เน็ตหลุด|เน็ตช้า|เชื่อมต่อเน็ตไม่ได้|สัญญาณเน็ต|สายแลน|lan|เร้าเตอร์|router|wifi|เน็ตล่ม|access point|\bap\b|ตัวกระจายสัญญาณ|เน็ตไร้สาย|ไร้สาย|ชื่อเครือข่าย|ssid)/i.test(text)
  ) {
    return 'network_wifi';
  }

  if (
    subId === 28 ||
    /(?:แอร์|เครื่องปรับอากาศ|พัดลมไอน้ำ|พัดลมระบาย|แอร์ไม่เย็น|แอร์รั่ว|น้ำแอร์|คอมเพรสเซอร์|แอร์เสียงดัง|อากาศอบอ้าว)/i.test(text)
  ) {
    return 'hvac_cooling';
  }

  if (
    [23, 24, 31].includes(subId) ||
    /(?:น้ำท่วมขัง|น้ำท่วม|น้ำขัง|น้ำฝนสาด|ฝ้าเพดานรั่ว|หลังคารั่ว|น้ำซึมเข้า|น้ำเอ่อ|น้ำนอง)/i.test(text)
  ) {
    return 'flood_storm';
  }

  if (
    subId === 27 ||
    /(?:ท่อน้ำ|ท่อระบาย|ท่อตัน|ท่อแตก|อ่างล้างมือ|ก๊อกน้ำ|ส้วมตัน|ชักโครก|น้ำไม่ไหล|น้ำรั่วซึม|ท่อน้ำทิ้ง)/i.test(text)
  ) {
    return 'plumbing_drainage';
  }

  if (
    subId === 26 ||
    /(?:หลอดไฟ|ไฟเพดาน|ไฟทางเดิน|ไฟห้องน้ำ|สวิตช์ไฟ|ปลั๊กไฟ|ไฟไม่ติด|ไฟเสีย)/i.test(text)
  ) {
    return 'electrical_routine';
  }

  if (
    subId === 29 ||
    /(?:ขี้นก|นกพิราบ|ขยะ|ถังขยะ|สกปรก|ทำความสะอาด|กลิ่นเหม็น|คราบ|ขยะล้น)/i.test(text)
  ) {
    return 'cleaning_sanitation';
  }

  if (
    [37, 38, 39, 45].includes(subId) ||
    /(?:โปรเจคเตอร์|ไมโครโฟน|จอทีวี|ลำโพง|เสียงตามสาย|คอมพิวเตอร์|เครื่องพิมพ์|ปริ้นเตอร์)/i.test(text)
  ) {
    return 'it_av';
  }

  if (/(?:ลูกบิด|ประตู|ล็อกไม่ได้|หน้าต่าง|โต๊ะ|เก้าอี้|กระเบื้อง)/i.test(text)) {
    return 'civil_facility';
  }

  return 'general';
}

/**
 * Extracts macro incident root causes (e.g. storm, blackout, commencement)
 */
export function extractProbableRootCause(text: string = ''): string | null {
  const norm = normalizeThaiText(text);
  if (/พายุ|ฝนตกหนัก|ฝนฟ้าคะนอง|น้ำฝนสาด|ฟ้าร้อง|ลมกระโชกแรง|พายุฝน/i.test(norm)) {
    return 'storm_heavy_rain';
  }
  if (/หม้อแปลง.*ระเบิด|ไฟดับทั้งตึก|ไฟดับทั้งอาคาร|ไฟดับทั้งชั้น|ไฟฟ้าแรงสูง/i.test(norm)) {
    return 'power_grid_failure';
  }
  if (/รับปริญญา|พิธีพระราชทานปริญญาบัตร|ซ้อมใหญ่|ซ้อมย่อย|บัณฑิต/i.test(norm)) {
    return 'commencement_event';
  }
  return null;
}

/**
 * Detects hard physical, logical, or temporal contradictions between two reports
 */
export function detectIncidentContradiction(
  target: ReportItem,
  candidate: ReportItem
): { isContradiction: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const anchorA = extractSpatialAnchor(target.location || '', target.description || '');
  const anchorB = extractSpatialAnchor(candidate.location || '', candidate.description || '');

  const entityA = extractSystemEntity(target.description || '', target.location || '', target.subcategory_id);
  const entityB = extractSystemEntity(candidate.description || '', candidate.location || '', candidate.subcategory_id);

  const causeA = extractProbableRootCause(`${target.description || ''} ${target.location || ''}`);
  const causeB = extractProbableRootCause(`${candidate.description || ''} ${candidate.location || ''}`);
  const sharedMacroCause = (causeA && causeA === causeB) ? causeA : null;

  // 1. Spatial Contradictions
  // A. Different physical buildings (unless campus-wide macro incident)
  if (anchorA.landmark && anchorB.landmark && anchorA.landmark !== anchorB.landmark) {
    const isCampusMacro = (
      sharedMacroCause === 'commencement_event' && (
        ['หอประชุมใหญ่', 'อาคาร 1', 'ลานกิจกรรมบ่อปลา', 'ประตูทางเข้ามหาวิทยาลัย'].includes(anchorA.landmark) &&
        ['หอประชุมใหญ่', 'อาคาร 1', 'ลานกิจกรรมบ่อปลา', 'ประตูทางเข้ามหาวิทยาลัย'].includes(anchorB.landmark)
      )
    ) || (
      sharedMacroCause === 'storm_heavy_rain' && (
        (anchorA.landmark.includes('อาคาร 1') && anchorB.landmark.includes('อาคาร 1-2')) ||
        (anchorB.landmark.includes('อาคาร 1') && anchorA.landmark.includes('อาคาร 1-2'))
      )
    ) || (
      sharedMacroCause === 'power_grid_failure'
    );

    if (!isCampusMacro) {
      reasons.push(`คนละสถานที่ทางกายภาพ (${anchorA.landmark} กับ ${anchorB.landmark})`);
    }
  }

  // B. Same building, but different rooms for localized equipment
  const isLocalized = ['hvac_cooling', 'electrical_routine', 'it_av', 'civil_facility'].includes(entityA) ||
                      ['hvac_cooling', 'electrical_routine', 'it_av', 'civil_facility'].includes(entityB);

  const mentionsWholeBuilding = /ทั้งอาคาร|ทั้งตึก|ทั้งชั้น|ระบบส่วนกลาง/i.test(`${target.description || ''} ${candidate.description || ''}`);

  if (isLocalized && !mentionsWholeBuilding) {
    if (anchorA.room && anchorB.room && anchorA.room !== anchorB.room) {
      reasons.push(`อุปกรณ์เฉพาะห้องแต่ระบุคนละห้อง (ห้อง ${anchorA.room} กับห้อง ${anchorB.room})`);
    }

    if (anchorA.floor && anchorB.floor && anchorA.floor !== anchorB.floor) {
      reasons.push(`ระบุคนละชั้นสำหรับอุปกรณ์เฉพาะจุด (ชั้น ${anchorA.floor} กับชั้น ${anchorB.floor})`);
    }
  }

  // C. Men's restroom vs Women's restroom
  if (anchorA.specificSpot && anchorB.specificSpot) {
    if (
      (anchorA.specificSpot === 'ห้องน้ำชาย' && anchorB.specificSpot === 'ห้องน้ำหญิง') ||
      (anchorA.specificSpot === 'ห้องน้ำหญิง' && anchorB.specificSpot === 'ห้องน้ำชาย')
    ) {
      reasons.push('คนละห้องน้ำ (ห้องน้ำชาย กับ ห้องน้ำหญิง)');
    }
  }

  // 2. System Entity & Problem Nature Contradictions
  const isDomainConflict = (
    // Wi-Fi is strictly incompatible with water flood, plumbing, AC, electrical routine, civil, cleaning, safety emergency
    (entityA === 'network_wifi' && ['flood_storm', 'plumbing_drainage', 'hvac_cooling', 'electrical_routine', 'civil_facility', 'cleaning_sanitation', 'safety_emergency', 'academic_inquiry', 'personal_property', 'registration_inquiry', 'registration_discrepancy'].includes(entityB)) ||
    (entityB === 'network_wifi' && ['flood_storm', 'plumbing_drainage', 'hvac_cooling', 'electrical_routine', 'civil_facility', 'cleaning_sanitation', 'safety_emergency', 'academic_inquiry', 'personal_property', 'registration_inquiry', 'registration_discrepancy'].includes(entityA)) ||

    // HVAC / AC is strictly incompatible with routine electrical (e.g. bulb/switch), plumbing, civil, cleaning
    (entityA === 'hvac_cooling' && ['electrical_routine', 'plumbing_drainage', 'civil_facility', 'cleaning_sanitation', 'academic_inquiry', 'personal_property', 'registration_inquiry', 'registration_discrepancy'].includes(entityB)) ||
    (entityB === 'hvac_cooling' && ['electrical_routine', 'plumbing_drainage', 'civil_facility', 'cleaning_sanitation', 'academic_inquiry', 'personal_property', 'registration_inquiry', 'registration_discrepancy'].includes(entityA)) ||

    // Flood/Storm vs Routine Electrical / IT AV
    (entityA === 'flood_storm' && ['electrical_routine', 'it_av', 'academic_inquiry', 'registration_inquiry', 'registration_discrepancy'].includes(entityB)) ||
    (entityB === 'flood_storm' && ['electrical_routine', 'it_av', 'academic_inquiry', 'registration_inquiry', 'registration_discrepancy'].includes(entityA)) ||

    // Plumbing vs IT AV / Routine Electrical
    (entityA === 'plumbing_drainage' && ['it_av', 'electrical_routine', 'academic_inquiry', 'registration_inquiry', 'registration_discrepancy'].includes(entityB)) ||
    (entityB === 'plumbing_drainage' && ['it_av', 'electrical_routine', 'academic_inquiry', 'registration_inquiry', 'registration_discrepancy'].includes(entityA)) ||

    // Specific Emergency Incompatibilities (Fire vs Gas vs Elevator vs Injury vs Safety vs Routine)
    (entityA === 'fire_emergency' && entityB !== 'fire_emergency') ||
    (entityB === 'fire_emergency' && entityA !== 'fire_emergency') ||

    (entityA === 'gas_leak_emergency' && entityB !== 'gas_leak_emergency') ||
    (entityB === 'gas_leak_emergency' && entityA !== 'gas_leak_emergency') ||

    (entityA === 'elevator_emergency' && entityB !== 'elevator_emergency') ||
    (entityB === 'elevator_emergency' && entityA !== 'elevator_emergency') ||

    (entityA === 'injury_medical_emergency' && entityB !== 'injury_medical_emergency') ||
    (entityB === 'injury_medical_emergency' && entityA !== 'injury_medical_emergency') ||

    // Routine electrical vs safety emergency
    (entityA === 'electrical_routine' && entityB === 'safety_emergency') ||
    (entityB === 'electrical_routine' && entityA === 'safety_emergency') ||
    (entityA === 'safety_emergency' && entityB !== 'safety_emergency') ||
    (entityB === 'safety_emergency' && entityA !== 'safety_emergency') ||

    // Academic inquiry vs non-academic
    (entityA === 'academic_inquiry' && entityB !== 'academic_inquiry') ||
    (entityB === 'academic_inquiry' && entityA !== 'academic_inquiry') ||

    // Registration procedure/inquiry vs missing roster name discrepancy
    (entityA === 'registration_inquiry' && entityB === 'registration_discrepancy') ||
    (entityB === 'registration_inquiry' && entityA === 'registration_discrepancy') ||
    (entityA === 'registration_inquiry' && entityB !== 'registration_inquiry') ||
    (entityB === 'registration_inquiry' && entityA !== 'registration_inquiry') ||
    (entityA === 'registration_discrepancy' && entityB !== 'registration_discrepancy') ||
    (entityB === 'registration_discrepancy' && entityA !== 'registration_discrepancy') ||

    // Commencement / Event sub-domain conflicts
    (entityA === 'commencement_schedule' && entityB === 'commencement_registration') ||
    (entityB === 'commencement_schedule' && entityA === 'commencement_registration') ||
    (entityA === 'commencement_schedule' && entityB === 'commencement_venue') ||
    (entityB === 'commencement_schedule' && entityA === 'commencement_venue') ||
    (entityA === 'commencement_venue' && entityB === 'commencement_registration') ||
    (entityB === 'commencement_venue' && entityA === 'commencement_registration')
  );

  if (isDomainConflict) {
    reasons.push(`คนละประเภทปัญหา (${getConflictLabel(entityA)} กับ ${getConflictLabel(entityB)}) ไม่สามารถจัดเป็นเหตุการณ์เดียวกันได้`);
  }

  // 3. Personal Property Protection
  // Lost personal belongings of distinct people cannot be grouped
  if (entityA === 'personal_property' || entityB === 'personal_property') {
    reasons.push('แจ้งของหาย/ทรัพย์สินส่วนบุคคลของแต่ละบุคคล ไม่จัดเป็นเหตุการณ์เดียวกัน');
  }

  // 4. Temporal Contradiction
  const timeA = new Date(target.created_at).getTime();
  const timeB = new Date(candidate.created_at).getTime();
  if (!isNaN(timeA) && !isNaN(timeB)) {
    const diffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);
    // Transient network issues or crowd questions beyond 24 hours are distinct
    const isTransient = ['network_wifi', 'commencement_schedule', 'commencement_traffic', 'registration_inquiry'].includes(entityA) ||
                        ['network_wifi', 'commencement_schedule', 'commencement_traffic', 'registration_inquiry'].includes(entityB);
    if (isTransient && diffHours > 24) {
      reasons.push(`เวลาห่างกันเกินไป (${diffHours.toFixed(1)} ชม.) สำหรับปัญหาชั่วคราว`);
    } else if (diffHours > 72) {
      reasons.push(`เวลาห่างกันเกิน 3 วัน (${Math.round(diffHours / 24)} วัน)`);
    }
  }

  return {
    isContradiction: reasons.length > 0,
    reasons,
  };
}

/**
 * Evaluates whether two reports represent the Same Real-World Incident
 * Separates Same Incident Candidate from surface Similar Request
 */
export function evaluateIncidentIdentity(
  target: ReportItem,
  candidate: ReportItem
): IncidentIdentityEvaluation {
  const evidence: string[] = [];
  const differences: string[] = [];

  const anchorA = extractSpatialAnchor(target.location || '', target.description || '');
  const anchorB = extractSpatialAnchor(candidate.location || '', candidate.description || '');

  const entityA = extractSystemEntity(target.description || '', target.location || '', target.subcategory_id);
  const entityB = extractSystemEntity(candidate.description || '', candidate.location || '', candidate.subcategory_id);

  const causeA = extractProbableRootCause(`${target.description || ''} ${target.location || ''}`);
  const causeB = extractProbableRootCause(`${candidate.description || ''} ${candidate.location || ''}`);
  const sharedMacroCause = (causeA && causeA === causeB) ? causeA : null;

  // 1. Contradiction Check
  const contradictionCheck = detectIncidentContradiction(target, candidate);
  if (contradictionCheck.isContradiction) {
    return {
      candidateDecision: 'different_incident',
      isSameIncidentCandidate: false,
      isInsufficientEvidence: false,
      isContradiction: true,
      ruleConfidence: 'low',
      ruleScore: 10,
      evidence: [],
      differences: contradictionCheck.reasons,
      contradictions: contradictionCheck.reasons,
      spatialGranularity: anchorA.granularity,
      sharedRootCause: sharedMacroCause,
      affectedScope: 'localized_equipment',
      targetAnchor: anchorA,
      candidateAnchor: anchorB,
      targetEntity: entityA,
      candidateEntity: entityB,
    };
  }

  // 2. Insufficient Evidence Check
  // If either report lacks clear location or has vague description without verifiable specifics
  const isTargetVague = anchorA.granularity === 'campus_vague' || anchorA.granularity === 'unspecified';
  const isCandidateVague = anchorB.granularity === 'campus_vague' || anchorB.granularity === 'unspecified';

  const isShortDesc = (t: string) => normalizeThaiText(t).replace(/\s/g, '').length < 8;
  const isTargetShort = isShortDesc(target.description || '');
  const isCandidateShort = isShortDesc(candidate.description || '');

  // For access-point or localized room-level services (network_wifi, hvac_cooling, electrical_routine, it_av):
  // If neither mentions whole-building failure, and one or both only has building-level granularity without floor/room,
  // we do NOT have sufficient evidence that they share the exact same access point / localized device!
  const isAPorLocalizedService = ['network_wifi', 'hvac_cooling', 'electrical_routine', 'it_av'].includes(entityA) ||
                                 ['network_wifi', 'hvac_cooling', 'electrical_routine', 'it_av'].includes(entityB);
  const mentionsWholeBuildingFailure = /ทั้งอาคาร|ทั้งตึก|ทั้งระบบ|ล่มทั้งตึก|ดับทั้งตึก|ล่มทั้งระบบ/i.test(`${target.description || ''} ${candidate.description || ''}`);

  const lacksSpecificSpotOrFloor = isAPorLocalizedService && !mentionsWholeBuildingFailure && (
    (!anchorA.floor && !anchorA.room && !anchorA.specificSpot) ||
    (!anchorB.floor && !anchorB.room && !anchorB.specificSpot)
  );

  if ((isTargetVague || isCandidateVague || lacksSpecificSpotOrFloor) && !sharedMacroCause) {
    const insufficientReasons = [];
    if (isTargetVague) insufficientReasons.push(`คำร้อง ${target.public_id} ไม่ได้ระบุสถานที่ชัดเจน`);
    if (isCandidateVague) insufficientReasons.push(`คำร้อง ${candidate.public_id} ไม่ได้ระบุสถานที่ชัดเจน`);
    if (lacksSpecificSpotOrFloor) insufficientReasons.push('ไม่ระบุชั้นหรือจุดย่อยที่ชัดเจน ข้อมูลไม่พอสำหรับยืนยันว่าเป็นอุปกรณ์หรือ Access Point เดียวกัน');
    if (isTargetShort || isCandidateShort) insufficientReasons.push('รายละเอียดสั้นเกินไป ไม่เพียงพอสำหรับยืนยันว่าเป็นเหตุการณ์เดียวกัน');

    return {
      candidateDecision: 'insufficient_evidence',
      isSameIncidentCandidate: false,
      isInsufficientEvidence: true,
      isContradiction: false,
      ruleConfidence: 'low',
      ruleScore: 40,
      evidence: ['หมวดหมู่หรือลักษณะปัญหามีความสอดคล้องกันบางส่วน'],
      differences: insufficientReasons,
      contradictions: [],
      spatialGranularity: 'campus_vague',
      sharedRootCause: sharedMacroCause,
      affectedScope: 'room_level',
      targetAnchor: anchorA,
      candidateAnchor: anchorB,
      targetEntity: entityA,
      candidateEntity: entityB,
    };
  }

  // 3. Positive Incident Evaluation
  let ruleScore = 0;

  // Spatial alignment score
  if (anchorA.granularity === 'exact_spot' && anchorB.granularity === 'exact_spot') {
    if (anchorA.specificSpot === anchorB.specificSpot || (anchorA.room && anchorA.room === anchorB.room)) {
      ruleScore += 45;
      evidence.push(`ระบุจุดเกิดเหตุตรงกันเป๊ะ (${anchorA.summary})`);
    } else {
      differences.push(`ระบุจุดย่อยต่างกัน (${anchorA.summary} vs ${anchorB.summary})`);
      ruleScore += 15;
    }
  } else if (anchorA.landmark && anchorB.landmark && anchorA.landmark === anchorB.landmark) {
    if (anchorA.floor && anchorB.floor && anchorA.floor === anchorB.floor) {
      ruleScore += 40;
      evidence.push(`สถานที่เดียวกันและชั้นเดียวกัน (${anchorA.landmark} ชั้น ${anchorA.floor})`);
    } else {
      ruleScore += 30;
      evidence.push(`สถานที่ทางกายภาพบริเวณเดียวกัน (${anchorA.landmark})`);
    }
  } else if (sharedMacroCause) {
    ruleScore += 30;
    evidence.push(`อยู่ในพื้นที่เหตุการณ์เดียวกันจากต้นเหตุร่วม (${sharedMacroCause})`);
  }

  // System entity alignment score
  if (entityA === entityB && entityA !== 'general') {
    ruleScore += 35;
    evidence.push(`ปัญหาในระบบ/อุปกรณ์เดียวกัน (${getConflictLabel(entityA)})`);
  } else if (sharedMacroCause) {
    ruleScore += 25;
    evidence.push(`ได้รับผลกระทบจากเหตุการณ์ต้นเหตุเดียวกัน (${sharedMacroCause})`);
  } else if (target.category_id && target.category_id === candidate.category_id) {
    ruleScore += 20;
    evidence.push('หมวดหมู่หลักตรงกัน');
  }

  // Time proximity
  const timeEval = calculateTimeSimilarity(target.created_at, candidate.created_at);
  if (timeEval.score >= 0.75) {
    ruleScore += 20;
    evidence.push(timeEval.reason);
  } else if (timeEval.score >= 0.45) {
    ruleScore += 12;
    evidence.push(timeEval.reason);
  } else {
    ruleScore += 5;
    differences.push(timeEval.reason);
  }

  // Text context similarity
  const textSim = calculateTextSimilarity(target.description || '', candidate.description || '');
  if (textSim >= 0.4) {
    ruleScore += 10;
    evidence.push(`เนื้อหาคำร้องสอดคล้องกัน (${Math.round(textSim * 100)}%)`);
  } else if (textSim >= 0.15) {
    ruleScore += 5;
  } else {
    differences.push('ผู้แจ้งบรรยายด้วยถ้อยคำและมุมมองที่แตกต่างกัน');
  }

  const finalScore = Math.min(100, Math.max(0, ruleScore));

  const isSameIncidentCandidate = finalScore >= 70 && !contradictionCheck.isContradiction;
  const decision: IncidentCandidateDecision = isSameIncidentCandidate ? 'same_incident' : 'similar_request';
  const ruleConfidence: 'high' | 'medium' | 'low' = finalScore >= 80 ? 'high' : (finalScore >= 65 ? 'medium' : 'low');

  let scope: IncidentIdentityEvaluation['affectedScope'] = 'room_level';
  if (anchorA.granularity === 'exact_spot') scope = 'exact_spot' as unknown as typeof scope;
  if (anchorA.granularity === 'floor_area') scope = 'floor_wide';
  if (anchorA.granularity === 'building') scope = 'building_wide';
  if (sharedMacroCause === 'commencement_event' || sharedMacroCause === 'storm_heavy_rain') scope = 'campus_wide';

  return {
    candidateDecision: decision,
    isSameIncidentCandidate,
    isInsufficientEvidence: false,
    isContradiction: false,
    ruleConfidence,
    ruleScore: finalScore,
    evidence,
    differences,
    contradictions: [],
    spatialGranularity: anchorA.granularity,
    sharedRootCause: sharedMacroCause,
    affectedScope: scope,
    targetAnchor: anchorA,
    candidateAnchor: anchorB,
    targetEntity: entityA,
    candidateEntity: entityB,
  };
}

/**
 * Calculates location similarity and extracts human-readable rationale
 */
export function calculateLocationSimilarity(locA: string = '', locB: string = ''): { score: number; reason: string } {
  const normA = normalizeThaiText(locA);
  const normB = normalizeThaiText(locB);

  if (!normA || !normB) {
    return { score: 0.2, reason: 'ไม่ได้ระบุสถานที่ชัดเจนทั้งสองรายการ' };
  }
  if (normA === normB) {
    return { score: 1.0, reason: `สถานที่ตรงกันเป๊ะ ("${locA}")` };
  }

  const landmarkA = extractLandmark(normA);
  const landmarkB = extractLandmark(normB);

  // Both have identified distinct campus landmarks
  if (landmarkA && landmarkB) {
    if (landmarkA !== landmarkB) {
      return { score: 0.0, reason: `คนละสถานที่ทางกายภาพ (${landmarkA} กับ ${landmarkB})` };
    }

    // Check room numbers if inside building
    const roomA = extractRoom(normA);
    const roomB = extractRoom(normB);

    if (roomA && roomB) {
      if (roomA === roomB) {
        return { score: 1.0, reason: `ห้องเรียนเดียวกัน (${landmarkA} ห้อง ${roomA})` };
      } else {
        return { score: 0.1, reason: `อาคารเดียวกัน แต่คนละห้อง (${roomA} กับ ${roomB})` };
      }
    } else if (roomA || roomB) {
      return { score: 0.15, reason: `คนละจุด (${roomA ? `ห้อง ${roomA}` : 'พื้นที่ทั่วไป'} กับ ${roomB ? `ห้อง ${roomB}` : 'พื้นที่ทั่วไป'})` };
    }

    // Check floor
    const floorA = extractFloor(normA);
    const floorB = extractFloor(normB);
    if (floorA && floorB && floorA !== floorB) {
      return { score: 0.2, reason: `อาคารเดียวกัน แต่คนละชั้น (ชั้น ${floorA} กับชั้น ${floorB})` };
    }

    // Same landmark, check sub-location detail
    const textSim = calculateTextSimilarity(normA, normB);
    if (textSim >= 0.5) {
      return { score: 0.95, reason: `สถานที่เดียวกันและจุดเกิดเหตุตรงกัน (${landmarkA})` };
    }
    return { score: 0.75, reason: `บริเวณเดียวกัน (${landmarkA}) แต่ระบุจุดย่อยต่างกัน` };
  }

  // Fallback to text similarity of location string
  const textSim = calculateTextSimilarity(normA, normB);
  if (textSim >= 0.7) {
    return { score: 0.8, reason: `ข้อความสถานที่ใกล้เคียงกัน (${Math.round(textSim * 100)}%)` };
  } else if (textSim >= 0.4) {
    return { score: 0.4, reason: `ข้อความสถานที่มีความคล้ายบางส่วน (${Math.round(textSim * 100)}%)` };
  }

  return { score: 0.1, reason: 'สถานที่ต่างกัน' };
}

/**
 * Calculates time proximity score
 */
export function calculateTimeSimilarity(
  dateA: string | Date,
  dateB: string | Date
): { score: number; diffHours: number; reason: string } {
  const timeA = new Date(dateA).getTime();
  const timeB = new Date(dateB).getTime();

  if (isNaN(timeA) || isNaN(timeB)) {
    return { score: 0.5, diffHours: 0, reason: 'ไม่สามารถคำนวณเวลาได้' };
  }

  const diffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);

  if (diffHours <= 1.0) {
    const mins = Math.round(diffHours * 60);
    return { score: 1.0, diffHours, reason: `เวลาใกล้เคียงกันมาก (ห่างกัน ${mins} นาที)` };
  }
  if (diffHours <= 3.0) {
    return { score: 0.9, diffHours, reason: `เวลาใกล้เคียงกัน (ห่างกัน ${diffHours.toFixed(1)} ชม.)` };
  }
  if (diffHours <= 6.0) {
    return { score: 0.75, diffHours, reason: `เกิดในวันเดียวกัน (ห่างกัน ${diffHours.toFixed(1)} ชม.)` };
  }
  if (diffHours <= 12.0) {
    return { score: 0.6, diffHours, reason: `เกิดในวันเดียวกัน (ห่างกัน ${diffHours.toFixed(1)} ชม.)` };
  }
  if (diffHours <= 24.0) {
    return { score: 0.45, diffHours, reason: `เกิดห่างกันในรอบ 24 ชม. (${diffHours.toFixed(1)} ชม.)` };
  }
  if (diffHours <= 48.0) {
    return { score: 0.25, diffHours, reason: `เกิดห่างกัน 1-2 วัน (${(diffHours / 24).toFixed(1)} วัน)` };
  }
  return { score: 0.05, diffHours, reason: `เวลาห่างกันเกิน 2 วัน (${Math.round(diffHours / 24)} วัน)` };
}

/**
 * Backward-compatible ProblemDomain extractor
 */
export function extractProblemDomain(
  description: string = '',
  location: string = '',
  subcategoryId?: number | null
): ProblemDomain {
  const entity = extractSystemEntity(description, location, subcategoryId);
  switch (entity) {
    case 'network_wifi': return 'network';
    case 'hvac_cooling': return 'hvac';
    case 'plumbing_drainage': return 'plumbing';
    case 'electrical_routine': return 'electrical_routine';
    case 'safety_emergency': return 'safety_emergency';
    case 'cleaning_sanitation': return 'cleaning';
    case 'it_av': return 'it_av';
    case 'commencement_schedule': return 'commencement_schedule';
    case 'commencement_venue': return 'commencement_reporting';
    case 'commencement_registration': return 'commencement_personal';
    case 'personal_property': return 'personal_property';
    default: return 'general';
  }
}

/**
 * Compares two reports for surface and contextual similarity (Explainable Similarity Scoring)
 */
export function compareReports(target: ReportItem, candidate: ReportItem): SimilarityResult {
  const reasons: string[] = [];

  // 1. Category & Subcategory matching (35 points max)
  let categoryScore = 0;
  const isSameCat = target.category_id != null && target.category_id === candidate.category_id;
  const isSameSub = target.subcategory_id != null && target.subcategory_id === candidate.subcategory_id;

  if (isSameCat) {
    if (isSameSub) {
      categoryScore = 35;
      reasons.push('หมวดหมู่หลักและหมวดหมู่ย่อยตรงกัน');
    } else {
      categoryScore = 20;
      reasons.push('หมวดหมู่หลักตรงกัน (แต่หมวดหมู่ย่อยต่างกัน)');
    }
  } else {
    categoryScore = 0;
    reasons.push('คนละหมวดหมู่หลัก');
  }

  // 2. Location matching (25 points max)
  const locEval = calculateLocationSimilarity(target.location || '', candidate.location || '');
  let effectiveLocScore = locEval.score;
  let effectiveLocReason = locEval.reason;

  // Special case for Commencement Event grounds
  if (
    isSameSub &&
    target.subcategory_id === 55 &&
    (locEval.score === 0.0 || locEval.score < 0.7)
  ) {
    const commencementLandmarks = ['หอประชุมใหญ่', 'อาคาร 1', 'ลานกิจกรรมบ่อปลา', 'ประตูทางเข้ามหาวิทยาลัย'];
    const landA = extractLandmark(target.location || '');
    const landB = extractLandmark(candidate.location || '');
    if (commencementLandmarks.includes(landA || '') && commencementLandmarks.includes(landB || '')) {
      effectiveLocScore = 0.75;
      effectiveLocReason = `อยู่ในพื้นที่จัดงานพิธีพระราชทานปริญญาบัตรเดียวกัน (${landA} - ${landB})`;
    }
  }

  const locationScore = Math.round(effectiveLocScore * 25);
  reasons.push(`สถานที่: ${effectiveLocReason}`);

  // 3. Time matching (20 points max)
  const timeEval = calculateTimeSimilarity(target.created_at, candidate.created_at);
  const timeScore = Math.round(timeEval.score * 20);
  reasons.push(`กรอบเวลา: ${timeEval.reason}`);

  // 4. Text n-gram similarity (20 points max)
  const textSim = calculateTextSimilarity(target.description || '', candidate.description || '');
  const textScore = Math.round(textSim * 20);
  if (textSim >= 0.5) {
    reasons.push(`ข้อความคำร้องคล้ายคลึงกัน ${Math.round(textSim * 100)}%`);
  } else if (textSim >= 0.20) {
    reasons.push(`ข้อความคำร้องคล้ายกันบางส่วน (${Math.round(textSim * 100)}%)`);
  }

  let rawTotal = categoryScore + locationScore + timeScore + textScore;

  // Hard category mismatch cap
  if (!isSameCat) {
    rawTotal = Math.min(rawTotal, 18);
  }

  // Evaluate Contradictions via Incident Engine
  const contradiction = detectIncidentContradiction(target, candidate);
  if (contradiction.isContradiction) {
    rawTotal = Math.min(rawTotal, 15);
    for (const cr of contradiction.reasons) {
      reasons.push(`[ข้อขัดแย้ง] ${cr}`);
    }
  }

  const isPersonalProperty = target.subcategory_id === 33 || candidate.subcategory_id === 33 ||
    extractSystemEntity(target.description || '', target.location || '', target.subcategory_id) === 'personal_property';

  // Determine Confidence Level
  let confidence: SimilarityConfidence = 'low';
  let confidenceLabel = 'หลักฐานไม่เพียงพอ';

  if (!isSameCat) {
    confidence = 'low';
    confidenceLabel = 'หลักฐานไม่เพียงพอ (คนละหมวดหมู่)';
  } else if (contradiction.isContradiction) {
    confidence = 'low';
    confidenceLabel = 'หลักฐานไม่เพียงพอ (พบข้อขัดแย้งทางบริบทปัญหา/สถานที่)';
  } else if (isPersonalProperty) {
    confidence = rawTotal >= 45 ? 'medium' : 'low';
    confidenceLabel = 'มีความคล้ายคลึง (ของหายประเภทเดียวกัน แต่คนละบุคคล)';
  } else if (
    rawTotal >= 75 &&
    isSameCat &&
    effectiveLocScore >= 0.7 &&
    timeEval.score >= 0.4 &&
    textSim >= 0.08
  ) {
    confidence = 'high';
    confidenceLabel = 'มีแนวโน้มซ้ำสูง (เสนอให้ตรวจสอบ)';
  } else if (rawTotal >= 50) {
    confidence = 'medium';
    confidenceLabel = 'มีความคล้ายคลึง (ควรตรวจสอบเพิ่มเติม)';
  } else {
    confidence = 'low';
    confidenceLabel = 'หลักฐานไม่เพียงพอ';
  }

  const breakdown: ScoreBreakdown = {
    categoryScore,
    locationScore,
    timeScore,
    textScore,
    totalScore: Math.min(100, Math.max(0, rawTotal))
  };

  return {
    candidate,
    score: breakdown.totalScore,
    confidence,
    confidenceLabel,
    reasons,
    breakdown,
    isPersonalPropertyDuplicate: isPersonalProperty,
    problemDomain: extractProblemDomain(target.description || '', target.location || '', target.subcategory_id)
  };
}

/**
 * Finds and ranks similar reports for a target report among a pool of candidate reports
 */
export function findSimilarReports(
  target: ReportItem,
  candidatePool: ReportItem[],
  options: { minScore?: number; limit?: number } = {}
): SimilarityResult[] {
  const { minScore = 30, limit = 10 } = options;
  const results: SimilarityResult[] = [];

  for (const candidate of candidatePool) {
    if (candidate.public_id === target.public_id) continue;
    if (candidate.id && target.id && candidate.id === target.id) continue;

    const evaluation = compareReports(target, candidate);
    if (evaluation.score >= minScore) {
      results.push(evaluation);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
