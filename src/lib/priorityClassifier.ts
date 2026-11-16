/**
 * Priority Classification Service
 * 
 * Classifies reports into:
 *  - 'emergency': Urgent risk to life, physical safety, or critical infrastructure/property.
 *  - 'normal': Routine maintenance, general inquiries, or non-hazardous issues.
 *  - 'needs_review': Ambiguous, incomplete information, or conflicting signals requiring staff evaluation.
 * 
 * Core Rules:
 *  - Explainable: Always returns human-readable rationale and detected factors.
 *  - Contextual: Disambiguates words (e.g. "ไฟฉาย" is not a fire emergency; "ไฟไหม้" is).
 *  - Safety First: Never auto-downgrades an existing emergency.
 *  - Report count is NEVER used alone as a priority determinant.
 */

export type PriorityLevel = 'emergency' | 'normal' | 'needs_review';

export interface PriorityClassificationInput {
  category_id?: number | null;
  subcategory_id?: number | null;
  description?: string | null;
  location?: string | null;
  current_priority?: PriorityLevel | string | null;
}

export interface PriorityClassificationResult {
  priority: PriorityLevel;
  reason: string;
  priorityReason: string;
  matchedRules: string[];
  confidence: 'high' | 'medium' | 'low';
  factors: {
    subcategorySignal?: string;
    keywordSignals: string[];
    contextSignals: string[];
    dangerLevel: 'critical' | 'moderate' | 'none';
  };
}

// Emergency keywords and their danger categories
const EMERGENCY_PATTERNS = [
  // 1. Fire, smoke, explosion, gas/chemical leak
  {
    regex: /(?:ไฟไหม้|ไฟลุก|เพลิงไหม้|เกิดเพลิง|เกิดไฟ|ควัน(?:หนาทึบ|พวยพุ่ง|ไฟ)?|กลุ่มควัน|กลิ่นไหม้|แก๊สรั่ว|สารเคมีรั่ว|ระเบิด)/i,
    label: 'ตรวจพบควัน ไฟไหม้ หรือสัญญาณระเบิด/สารเคมีรั่วไหล',
    dangerLevel: 'critical' as const,
  },
  // 2. Electrical hazard (shock, electrocution, exposed live wire, transformer blowout)
  {
    regex: /(?:ไฟดูด|ไฟช็อต|ประกายไฟ|สายไฟ(?:ขาด|ห้อย|ชำรุด|พาด)|หม้อแปลง(?:ไฟฟ้าระเบิด|ระเบิด)|เสาไฟเอียง|ไฟรั่ว)/i,
    label: 'พบความเสี่ยงอันตรายจากไฟฟ้าแรงสูง ไฟดูด หรือสายไฟชำรุดมีประกายไฟ',
    dangerLevel: 'critical' as const,
  },
  // 3. Structural collapse & severe water inundation
  {
    regex: /(?:ถล่ม|เพดานถล่ม|ฝ้าเพดานพัง|คานร้าว|ตลิ่งทรุด|ดินสไลด์|น้ำท่วม(?:ฉับพลัน|ทะลัก|เข้าห้องไฟ|สูงอันตราย)?)/i,
    label: 'ตรวจพบความเสี่ยงต่อโครงสร้างอาคารถล่ม หรือน้ำท่วมจุดเสี่ยงอันตราย',
    dangerLevel: 'critical' as const,
  },
  // 4. Physical violence, medical emergency, life-threatening situation
  {
    regex: /(?:ทำร้ายร่างกาย|มีอาวุธ|คนหมดสติ|ล้มหมดสติ|ไม่หายใจ|ชักเกร็ง|เลือดออกมาก|อันตรายถึงชีวิต|ติดอยู่ในลิฟต์|ลิฟต์ค้างมีคนติด)/i,
    label: 'มีผู้บาดเจ็บ หมดสติ มีอาวุธ หรือสถานการณ์ฉุกเฉินต่อสวัสดิภาพบุคคล',
    dangerLevel: 'critical' as const,
  },
];

// Critical danger patterns that strictly override routine false alarm words
const OVERRIDE_CRITICAL_PATTERN = /(?:ระเบิด|ไฟไหม้|ไฟลุก|ประกายไฟ|อันตรายถึงชีวิต|สายไฟขาด|ไฟดูด|สารเคมีรั่ว)/i;

// False alarm patterns for emergency words (context disambiguation)
// e.g. "หลอดไฟเสีย", "ไฟตก", "ไฟทางเดินไม่ติด", "ไฟฉายหาย", "โปรเจคเตอร์ไฟไม่เข้า", "ซ้อมหนีไฟ"
const FALSE_EMERGENCY_PATTERNS = [
  /หลอดไฟ(?:เสีย|ขาด|กะพริบ|ดับ|ไม่สว่าง|ไม่ติด)/i,
  /(?<!สาย)ไฟ(?:ทางเดิน|บันได|ส่องสว่าง|ดาวน์ไลท์|นีออน|ห้องน้ำ|ห้องเรียน)?\s*(?:ดับ|ไม่ติด|เสีย)/i,
  /ไฟฉาย/i,
  /ไฟตก/i,
  /ไฟสถานะ/i,
  /สวิตช์ไฟ(?:หลุด|แตก|หลวม)/i,
  /ปลั๊กไฟ(?:หลวม|ไม่ติด)/i,
  /โปรเจคเตอร์ไฟไม่เข้า/i,
  /คอมพิวเตอร์ไฟไม่เข้า/i,
  /ซ้อมหนีไฟ|ซ้อมดับเพลิง/i,
];

// Routine normal keywords (routine campus maintenance / requests)
const ROUTINE_PATTERNS = [
  /ขี้นก|นกพิราบ|มีฝุ่น|ขยะล้น|ทำความสะอาด/i,
  /อินเทอร์เน็ต|เน็ตหลุด|ไวไฟ|wifi|wi-fi|สายแลน/i,
  /แอร์ไม่เย็น|แอร์มีน้ำหยด|น้ำแอร์หยด|แอร์เสียงดัง/i,
  /โปรเจคเตอร์|ไมโครโฟน|จอทีวี|คอมพิวเตอร์|เครื่องพิมพ์|ปริ้นเตอร์/i,
  /ตารางสอน|ตารางสอบ|ลงทะเบียน|เกรด|ผลการเรียน|ใบรับรอง/i,
  /ของหาย|พบของ|ทำของตก|กระเป๋าหาย|บัตรนิสิตหาย/i,
  /จอดรถขวาง|จอดรถซ้อนคัน|ไม่มีที่จอด/i,
  /โต๊ะชำรุด|เก้าอี้ชำรุด|ประตูฝืด|ก๊อกน้ำหยด/i,
];

// Ambiguous or vague distress expressions
const AMBIGUOUS_PATTERNS = [
  /(?:ช่วยดูให้ที|ช่วยดูที|ช่วยหน่อย|รบกวนตรวจสอบ|อยากให้ตรวจสอบ|ตรวจดูหน่อย|มีปัญหา|มีความเสี่ยง|ไม่แน่ใจ)/i,
  /มีกลิ่นแปลกๆ|เสียงดังผิดปกติ|น้ำซึม|ประตูเปิดไม่ได้/i,
  /^(?:ท่อ|เสี่ยง|ด่วน|ช่วยด้วย)$/i,
];

/**
 * Classify report priority with explainable reasoning
 */
export function classifyPriority(input: PriorityClassificationInput): PriorityClassificationResult {
  const { category_id, subcategory_id, description = '', location = '', current_priority } = input;
  const text = `${description || ''} ${location || ''}`.trim();
  const keywordSignals: string[] = [];
  const contextSignals: string[] = [];

  // Consider category context (e.g. category 4 is facility & safety)
  if (category_id === 4) {
    contextSignals.push('หมวดกายภาพและสิ่งแวดล้อม');
  }

  // Safety Principle: If already an emergency set by officer or previous check, never auto-downgrade!
  if (current_priority === 'emergency') {
    const r = 'คงสถานะเหตุฉุกเฉินเดิมตามที่บันทึกไว้ (ระบบไม่อนุญาตให้ลดระดับฉุกเฉินโดยอัตโนมัติ)';
    return {
      priority: 'emergency',
      reason: r,
      priorityReason: r,
      matchedRules: ['existing_emergency_preserved'],
      confidence: 'high',
      factors: {
        keywordSignals: ['existing_emergency_preserved'],
        contextSignals: ['preserved_from_previous_state'],
        dangerLevel: 'critical',
      },
    };
  }

  // 1. Direct Emergency Subcategory Check
  // Subcategory 34 is explicitly "เหตุฉุกเฉิน"
  if (subcategory_id === 34) {
    const r = 'หมวดหมู่ย่อยถูกระบุเป็น "เหตุฉุกเฉิน" (Subcategory 34)';
    return {
      priority: 'emergency',
      reason: r,
      priorityReason: r,
      matchedRules: ['subcategory_34_emergency'],
      confidence: 'high',
      factors: {
        subcategorySignal: 'เหตุฉุกเฉิน',
        keywordSignals: ['subcategory_34_emergency'],
        contextSignals: ['explicit_category_declaration'],
        dangerLevel: 'critical',
      },
    };
  }

  // 2. Check for Context Disambiguation / False Alarms
  const hasCriticalOverride = OVERRIDE_CRITICAL_PATTERN.test(text);
  const isFalseAlarm = !hasCriticalOverride && FALSE_EMERGENCY_PATTERNS.some((pat) => pat.test(text));

  // 3. Check for Emergency Danger Signals
  let matchedEmergency: (typeof EMERGENCY_PATTERNS)[0] | null = null;
  if (!isFalseAlarm) {
    for (const pat of EMERGENCY_PATTERNS) {
      if (pat.regex.test(text)) {
        matchedEmergency = pat;
        keywordSignals.push(pat.label);
        break;
      }
    }
  }

  // 4. If confirmed danger pattern matches without false alarm context
  if (matchedEmergency) {
    // Check if subcategory reinforces or if context is clear
    if (subcategory_id === 32) {
      contextSignals.push('ตรงกับหมวดความปลอดภัย');
    }
    return {
      priority: 'emergency',
      reason: matchedEmergency.label,
      priorityReason: matchedEmergency.label,
      matchedRules: keywordSignals,
      confidence: 'high',
      factors: {
        keywordSignals,
        contextSignals,
        dangerLevel: 'critical',
      },
    };
  }

  // 5. Check for Ambiguous / Needs Review Signals
  const isAmbiguous = AMBIGUOUS_PATTERNS.some((pat) => pat.test(text));
  const isVeryShort = text.length > 0 && text.length < 15;
  const isCategoryUnknown = subcategory_id === 54;

  if (isAmbiguous || (isVeryShort && /ด่วน|ช่วย|พัง|แตก|รั่ว|กลิ่น/i.test(text))) {
    const r = 'ข้อความคำร้องสั้นหรือมีความคลุมเครือ อาจมีสัญญาณความเสี่ยงที่ต้องให้เจ้าหน้าที่ตรวจสอบรายละเอียดเพิ่มเติม';
    return {
      priority: 'needs_review',
      reason: r,
      priorityReason: r,
      matchedRules: ['ambiguous_or_vague_description'],
      confidence: 'medium',
      factors: {
        keywordSignals: ['ambiguous_or_vague_description'],
        contextSignals: isVeryShort ? ['short_text_warning'] : [],
        dangerLevel: 'moderate',
      },
    };
  }

  if (isCategoryUnknown && text.length < 25) {
    const r = 'ไม่ทราบหมวดหมู่และข้อมูลคำร้องมีจำกัด ควรให้เจ้าหน้าที่คัดกรองเบื้องต้น';
    return {
      priority: 'needs_review',
      reason: r,
      priorityReason: r,
      matchedRules: ['unknown_subcategory_with_sparse_details'],
      confidence: 'medium',
      factors: {
        keywordSignals: ['unknown_subcategory_with_sparse_details'],
        contextSignals: ['sparse_text'],
        dangerLevel: 'moderate',
      },
    };
  }

  // 6. Routine / Normal Check
  const isRoutineSubcategory = [
    1, 2, 3, 4, 5, 6, 7, // Academic
    8, 9, 10, 11, 12, 13, 14, 55, // Student
    15, 16, 17, 18, 19, 20, 21, 22, // HR
    28, 29, 30, 31, 33, // Facility routine
    36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, // IT / AV
    49, 50, 51, 52, 53 // Library / General
  ].includes(subcategory_id || 0);

  const hasRoutineKeyword = ROUTINE_PATTERNS.some((pat) => pat.test(text));

  if (isRoutineSubcategory || hasRoutineKeyword) {
    let reasonText = 'ปัญหาการใช้งานและงานบริการทั่วไป ไม่พบสัญญาณความเสี่ยงเร่งด่วน';
    if (subcategory_id === 36 || /wifi|อินเทอร์เน็ต/i.test(text)) {
      reasonText = 'ระบบเครือข่าย/Wi-Fi ขัดข้อง เป็นงานบริการด้านไอทีทั่วไป';
    } else if (subcategory_id === 29 || /ขี้นก|ขยะ/i.test(text)) {
      reasonText = 'งานดูแลรักษาความสะอาดและสิ่งแวดล้อมทั่วไป';
    } else if (subcategory_id === 33 || /ของหาย/i.test(text)) {
      reasonText = 'การแจ้งทรัพย์สินส่วนบุคคลสูญหาย/พบของ จัดเป็นเรื่องทั่วไป';
    } else if (isFalseAlarm) {
      reasonText = 'อุปกรณ์ส่องสว่างหรือเครื่องใช้ไฟฟ้าชำรุดตามปกติ ไม่มีประกายไฟหรือความเสี่ยงต่อชีวิต';
    }

    return {
      priority: 'normal',
      reason: reasonText,
      priorityReason: reasonText,
      matchedRules: hasRoutineKeyword ? ['routine_keywords_matched'] : ['routine_subcategory'],
      confidence: 'high',
      factors: {
        keywordSignals: hasRoutineKeyword ? ['routine_keywords_matched'] : [],
        contextSignals: isRoutineSubcategory ? ['routine_subcategory'] : [],
        dangerLevel: 'none',
      },
    };
  }

  // 7. Fallback for unclassified text:
  if (text.length >= 20) {
    const r = 'รายละเอียดคำร้องทั่วไป ไม่พบสัญญาณอันตรายหรือความเร่งด่วน';
    return {
      priority: 'normal',
      reason: r,
      priorityReason: r,
      matchedRules: ['sufficient_detail_no_danger_signals'],
      confidence: 'medium',
      factors: {
        keywordSignals: [],
        contextSignals: ['sufficient_detail_no_danger_signals'],
        dangerLevel: 'none',
      },
    };
  }

  // If text is scarce and doesn't match routine patterns, conservatively suggest needs_review
  const r = 'ข้อมูลคำร้องไม่เพียงพอสำหรับการระบุระดับความเร่งด่วนได้อย่างมั่นใจ แนะนำให้เจ้าหน้าที่ตรวจสอบ';
  return {
    priority: 'needs_review',
    reason: r,
    priorityReason: r,
    matchedRules: ['sparse_text_fallback'],
    confidence: 'low',
    factors: {
      keywordSignals: [],
      contextSignals: ['sparse_text_fallback'],
      dangerLevel: 'moderate',
    },
  };
}
