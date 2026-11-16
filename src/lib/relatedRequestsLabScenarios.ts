import {
  CandidateIncidentGroup,
  CandidateGroupCorrelation,
} from "@/components/backoffice/SimilarReportsCard";

export interface LabAnchorReport {
  id?: string;
  public_id: string;
  location: string;
  description: string;
  status: string;
  priority?: string;
  category_id?: number;
  subcategory_id?: number;
  categoryName: string;
  subcategoryName: string;
  created_at: string;
}

export interface LabScoreBreakdown {
  categoryScore: number;
  locationScore: number;
  timeScore: number;
  textScore: number;
  totalScore: number;
}

export interface LabSuggestionItem {
  public_id: string;
  score: number;
  confidence: "high" | "medium" | "low";
  confidenceLabel: string;
  reasons: string[];
  differences?: string[];
  evidence?: string[];
  candidateDecision?: string;
  isSameIncidentCandidate?: boolean;
  incidentGroup?: CandidateIncidentGroup | null;
  breakdown: LabScoreBreakdown;
  isPersonalPropertyDuplicate: boolean;
  report: {
    public_id: string;
    categoryName: string;
    subcategoryName: string;
    location: string;
    description: string;
    status: string;
    created_at: string;
  };
}

export interface LabScenario {
  id: string;
  code: string;
  groupId: "group_a" | "group_b" | "group_c" | "group_d" | "group_e";
  groupTitle: string;
  title: string;
  description: string;
  isRealData: boolean;
  dataSourceLabel: string;
  anchorReport: LabAnchorReport;
  currentIncident: CandidateIncidentGroup | null;
  candidateGroups: CandidateGroupCorrelation[];
  suggestions: LabSuggestionItem[];
  expectedDisplayCase: "A" | "B" | "C";
  expectedToolbarVisible: boolean;
  explanation: string;
  interactiveDefaults?: {
    selectedReportIds?: string[];
    bulkFormOpen?: boolean;
    bulkTargetStatus?: string;
    bulkReplyMessage?: string;
    filterType?: "all" | "similar_not_grouped" | "matching_existing_group" | "already_grouped";
    simulateLoading?: boolean;
    simulateError?: boolean;
    simulateEmpty?: boolean;
    modalPreview?: "none" | "confirm" | "result_partial" | "ineligible_alert";
  };
}

// =========================================================================
// Real Data Presets (Extracted from Real Database Snapshot: reports)
// =========================================================================

export const REAL_REPORT_FAN_ANCHOR: LabAnchorReport = {
  id: "fan-anchor-1",
  public_id: "SOC-21518",
  location: "ซุ้มสังมา",
  description: "พัดลมพัง 1 ตัว หมุนช้าและมีกลิ่นไหม้",
  status: "received",
  priority: "normal",
  category_id: 4,
  subcategory_id: 24,
  categoryName: "อาคารและสถานที่",
  subcategoryName: "พัดลมและระบบระบายอากาศ",
  created_at: "2026-08-28T04:15:00.000Z",
};

export const REAL_REPORT_FAN_CANDIDATE_1: LabSuggestionItem = {
  public_id: "SOC-28934",
  score: 92,
  confidence: "high",
  confidenceLabel: "แนวโน้มสูงมาก",
  reasons: ["หมวดหมู่ตรงกัน: อาคารและสถานที่", "สถานที่เดียวกัน: ซุ้มสังมา", "ปัญหาเดียวกัน: พัดลมชำรุด"],
  breakdown: { categoryScore: 35, locationScore: 30, timeScore: 12, textScore: 15, totalScore: 92 },
  isPersonalPropertyDuplicate: false,
  report: {
    public_id: "SOC-28934",
    categoryName: "อาคารและสถานที่",
    subcategoryName: "พัดลมและระบบระบายอากาศ",
    location: "ซุ้มสังมา",
    description: "มีเรื่องพัดลมเสีย 1 ตัว และเปิดไม่ติดเลยครับ",
    status: "received",
    created_at: "2026-08-28T04:45:00.000Z",
  },
};

export const REAL_REPORT_FAN_CANDIDATE_2: LabSuggestionItem = {
  public_id: "SOC-82781",
  score: 88,
  confidence: "high",
  confidenceLabel: "แนวโน้มสูง",
  reasons: ["หมวดหมู่ตรงกัน: อาคารและสถานที่", "สถานที่ใกล้เคียง: ซุ้มสังคมวิทยาและมานุษยวิทยา (ซุ้มสังมา)"],
  breakdown: { categoryScore: 35, locationScore: 28, timeScore: 10, textScore: 15, totalScore: 88 },
  isPersonalPropertyDuplicate: false,
  report: {
    public_id: "SOC-82781",
    categoryName: "อาคารและสถานที่",
    subcategoryName: "พัดลมและระบบระบายอากาศ",
    location: "ซุ้มสังคมวิทยาและมานุษยวิทยา",
    description: "พัดลมเสีย 1 ตัว ต้องการให้ช่างเข้ามาตรวจสอบ",
    status: "received",
    created_at: "2026-08-28T05:10:00.000Z",
  },
};

export const REAL_REPORT_FAN_CANDIDATE_3: LabSuggestionItem = {
  public_id: "SOC-99230",
  score: 84,
  confidence: "high",
  confidenceLabel: "แนวโน้มสูง",
  reasons: ["หมวดหมู่ตรงกัน: อาคารและสถานที่", "สถานที่เดียวกัน: ซุ้มสาขาสังคมวิทยาและมานุษยวิทยา"],
  breakdown: { categoryScore: 35, locationScore: 25, timeScore: 9, textScore: 15, totalScore: 84 },
  isPersonalPropertyDuplicate: false,
  report: {
    public_id: "SOC-99230",
    categoryName: "อาคารและสถานที่",
    subcategoryName: "พัดลมและระบบระบายอากาศ",
    location: "ซุ้มสาขาสังคมวิทยาและมานุษยวิทยา",
    description: "พัดลมเสีย 1 ตัว นกพิราบบินเข้ามาเกาะ",
    status: "received",
    created_at: "2026-08-28T06:00:00.000Z",
  },
};

// =========================================================================
// All Scenarios Catalog
// =========================================================================

export const LAB_SCENARIOS: LabScenario[] = [
  // -----------------------------------------------------------------------
  // GROUP A: Related Requests Display Cases
  // -----------------------------------------------------------------------
  {
    id: "a1-no-related",
    code: "A1",
    groupId: "group_a",
    groupTitle: "Group A — Related Requests Display",
    title: "Scenario A1: No Related Requests (ไม่มีคำร้องที่เกี่ยวข้อง)",
    description: "คำร้องยังไม่มีกลุ่ม และไม่พบ Candidate ที่ผ่านเกณฑ์ความคล้ายคลึง แสดง Empty State สะอาดตาโดยไม่แสดงข้อมูลตัวอย่าง และซ่อน Bulk Toolbar 100%",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: SOC-67509)",
    anchorReport: {
      public_id: "SOC-67509",
      location: "ไม่แน่ใจ",
      description: "ทำบัตร BTS ลาย 2 of cups ตกหายเมื่อเช้า",
      status: "received",
      categoryName: "ของหาย",
      subcategoryName: "บัตรโดยสาร",
      created_at: "2026-09-01T08:00:00.000Z",
    },
    currentIncident: null,
    candidateGroups: [],
    suggestions: [],
    expectedDisplayCase: "C",
    expectedToolbarVisible: false,
    explanation: "แสดง Case C (Empty State): คำร้องยังไม่มีกลุ่ม และไม่พบคำร้องที่เข้าเกณฑ์ความคล้ายคลึง | Bulk Toolbar ไม่แสดง เพราะ Candidate = 0 รายการ (เกณฑ์ขั้นต่ำ >= 2)",
  },
  {
    id: "a2-one-candidate",
    code: "A2",
    groupId: "group_a",
    groupTitle: "Group A — Related Requests Display",
    title: "Scenario A2: One Related Candidate (พบคำร้องคล้ายกันเพียง 1 รายการ)",
    description: "พบ Candidate ที่เข้าเกณฑ์ความคล้ายคลึงเพียง 1 รายการ แสดงการ์ดคำร้อง แต่ไม่แสดง Bulk Toolbar เนื่องจากไม่ถึงเกณฑ์ขั้นต่ำ 2 รายการ และไม่แสดง Checkbox",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: SOC-21518 + 1 Match)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1],
    expectedDisplayCase: "C",
    expectedToolbarVisible: false,
    explanation: "แสดง Case C (Single Candidate): คำร้องยังไม่มีกลุ่ม แสดงการ์ดคำร้อง 1 รายการ | Bulk Toolbar ไม่แสดง เพราะ Candidate = 1 รายการ ซึ่งไม่ถึงเกณฑ์ขั้นต่ำ 2 รายการ และไม่มี Checkbox",
  },
  {
    id: "a3-multiple-candidates",
    code: "A3",
    groupId: "group_a",
    groupTitle: "Group A — Related Requests Display",
    title: "Scenario A3: Multiple Related Candidates (พบหลายคำร้องที่เกี่ยวข้อง >= 2)",
    description: "พบ Candidate ที่ผ่านเกณฑ์ความคล้ายคลึง 3 รายการ แสดงการ์ดคำร้องทั้งหมด พร้อมแสดง Bulk Reply & Auto-Grouping Toolbar และ Checkbox ให้เจ้าหน้าที่เลือกดำเนินการได้",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: ซุ้มสังมา 3 รายการจริง)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2, REAL_REPORT_FAN_CANDIDATE_3],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "แสดง Case C (Multiple Candidates): คำร้องยังไม่มีกลุ่ม มี Candidate ที่ผ่านเกณฑ์ 3 รายการ | Bulk Toolbar แสดงผลเพราะ Candidate >= 2 รายการ เปิดให้เลือกรายคำร้องหรือเลือกทั้งหมด",
    interactiveDefaults: {
      selectedReportIds: ["SOC-21518", "SOC-28934", "SOC-82781"],
    },
  },
  {
    id: "a4-request-already-grouped",
    code: "A4",
    groupId: "group_a",
    groupTitle: "Group A — Related Requests Display",
    title: "Scenario A4: Request Already Grouped (คำร้องอยู่ในกลุ่มเหตุการณ์แล้ว)",
    description: "คำร้องมี Group Membership ที่ยืนยันแล้วในฐานข้อมูล แสดงเฉพาะการ์ดสถานะกลุ่มกระชับ ระบุรหัสกลุ่ม ชื่อกลุ่ม สถานะ และปุ่มดูกลุ่ม โดยไม่แสดงสมาชิกกลุ่มซ้ำ และไม่แสดง Bulk Toolbar",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: test_incident_groups)",
    anchorReport: {
      public_id: "SOC-T-00256",
      location: "อาคาร 1 ชั้น 2",
      description: "สัญญาณอินเทอร์เน็ต Wi-Fi หลุดบ่อย",
      status: "in_progress",
      categoryName: "ระบบเครือข่าย",
      subcategoryName: "Wi-Fi",
      created_at: "2026-09-02T10:00:00.000Z",
    },
    currentIncident: {
      id: "inc-t-00001",
      group_code: "INC-T-00001",
      title: "ปัญหาเครือข่ายอาคาร 1 ชั้น 2 ไม่สามารถเชื่อมต่อได้",
      status: "open",
    },
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1],
    expectedDisplayCase: "A",
    expectedToolbarVisible: false,
    explanation: "แสดง Case A (Group Membership Card): คำร้องสังกัดกลุ่ม INC-T-00001 แล้ว แสดงเฉพาะการ์ดกลุ่ม ไม่แสดงสมาชิกซ้ำ และไม่แสดง Bulk Toolbar",
  },
  {
    id: "a5-ungrouped-related-existing-group",
    code: "A5",
    groupId: "group_a",
    groupTitle: "Group A — Related Requests Display",
    title: "Scenario A5: Ungrouped Request Related to an Existing Group (พบกลุ่มที่อาจเกี่ยวข้อง)",
    description: "คำร้องยังไม่มีกลุ่ม แต่ระบบตรวจพบ Incident Group เดิมที่เปิดอยู่และมีความสัมพันธ์ แสดงการ์ดแนะนำกลุ่มเหตุการณ์ พร้อมเหตุผลความเกี่ยวข้อง ปุ่มตรวจสอบกลุ่ม และปุ่มพิจารณาเชื่อมเข้ากลุ่มแบบ Demo",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario A5)",
    anchorReport: {
      public_id: "SOC-NEW-101",
      location: "ซุ้มสังมา",
      description: "พัดลมตัวที่ 2 เริ่มมีเสียงดังและไม่หมุน",
      status: "received",
      categoryName: "อาคารและสถานที่",
      subcategoryName: "พัดลมและระบบระบายอากาศ",
      created_at: "2026-09-03T11:00:00.000Z",
    },
    currentIncident: null,
    candidateGroups: [
      {
        id: "inc-t-77771",
        group: {
          id: "inc-t-77771",
          group_code: "INC-T-77771",
          title: "ซ่อมแซมพัดลมและระบบไฟ ซุ้มสังมา",
          status: "open",
        },
        score: 89,
        confidence: "high",
        confidenceLabel: "แนวโน้มสูง",
        reasons: ["สถานที่ตรงกัน: ซุ้มสังมา", "หมวดหมู่งานซ่อมแซมพัดลมเหมือนกัน"],
      },
    ],
    suggestions: [],
    expectedDisplayCase: "B",
    expectedToolbarVisible: false,
    explanation: "แสดง Case B (Suggested Group Card): คำร้องยังไม่มีกลุ่ม และตรวจพบกลุ่ม INC-T-77771 ที่อาจเกี่ยวข้อง แสดงการ์ดกลุ่มให้เจ้าหน้าที่ตรวจสอบก่อนเชื่อม ไม่แสดงสมาชิกซ้ำ และไม่แสดง Bulk Toolbar",
  },
  {
    id: "a6-multiple-related-groups",
    code: "A6",
    groupId: "group_a",
    groupTitle: "Group A — Related Requests Display",
    title: "Scenario A6: Multiple Related Groups (พบหลายกลุ่มเหตุการณ์ที่อาจเกี่ยวข้อง)",
    description: "คำร้องยังไม่มีกลุ่ม แต่ตรวจพบ 2 กลุ่มเหตุการณ์เดิมที่อาจเกี่ยวข้อง แสดงการ์ดแยกตาม Group ID โดยไม่แสดงรายการซ้ำและไม่แสดงสมาชิกซ้ำของแต่ละกลุ่ม",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario A6)",
    anchorReport: {
      public_id: "SOC-NEW-102",
      location: "อาคาร 2 ชั้น 1",
      description: "ไฟทางเดินกะพริบและพัดลมติดๆ ดับๆ",
      status: "received",
      categoryName: "ไฟฟ้าและแสงสว่าง",
      subcategoryName: "ระบบไฟฟ้า",
      created_at: "2026-09-04T09:00:00.000Z",
    },
    currentIncident: null,
    candidateGroups: [
      {
        id: "grp-elec-1",
        group: {
          id: "grp-elec-1",
          group_code: "INC-T-00010",
          title: "ซ่อมระบบไฟฟ้าแสงสว่าง อาคาร 2",
          status: "open",
        },
        score: 85,
        reasons: ["หมวดหมู่งานไฟฟ้าและแสงสว่างตรงกัน", "อาคาร 2 ชั้น 1"],
      },
      {
        id: "grp-fan-2",
        group: {
          id: "grp-fan-2",
          group_code: "INC-T-00020",
          title: "เปลี่ยนพัดลมระบายอากาศ อาคาร 2 ชั้น 1",
          status: "closed",
        },
        score: 78,
        reasons: ["อาคาร 2 ชั้น 1 ตรงกัน", "มีปัญหาเรื่องพัดลมคล้ายกัน"],
      },
    ],
    suggestions: [],
    expectedDisplayCase: "B",
    expectedToolbarVisible: false,
    explanation: "แสดง Case B (Multiple Group Cards): แยก 2 กลุ่มตาม Group ID ชัดเจน (INC-T-00010 เปิดอยู่, INC-T-00020 ปิดแล้วไม่อนุญาตให้เชื่อม) ไม่แสดงสมาชิกซ้ำ",
  },

  // -----------------------------------------------------------------------
  // GROUP B: Candidate Quality and Group Membership
  // -----------------------------------------------------------------------
  {
    id: "b1-same-incident-different-wording",
    code: "B1",
    groupId: "group_b",
    groupTitle: "Group B — Candidate Quality & Group Membership",
    title: "Scenario B1: Same Incident, Different Wording (ข้อความต่างกัน แต่เป็นเหตุการณ์เดียวกัน)",
    description: "ผู้แจ้ง 2 คนใช้สำนวนต่างกัน (เช่น 'พัดลมไม่หมุน' กับ 'พัดลมพัง 1 ตัว มีเสียงดัง') แต่ระบบวิเคราะห์ Entity, หมวดหมู่ และสถานที่ตรงกัน พร้อมแสดงเหตุผลสนับสนุนความสัมพันธ์",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: พัดลมซุ้มสังมา)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [
      {
        ...REAL_REPORT_FAN_CANDIDATE_1,
        evidence: ["ตรวจพบอุปกรณ์ชิ้นเดียวกัน (พัดลมเพดานตัวกลาง)", "เวลาแจ้งห่างกันเพียง 30 นาที"],
      },
      {
        ...REAL_REPORT_FAN_CANDIDATE_2,
        evidence: ["สถานที่เดียวกันแต่สะกดคนละแบบ (ซุ้มสังมา vs ซุ้มสังคมวิทยาฯ)"],
      },
    ],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "แสดง Case C พร้อม Evidence ชัดเจน: เจ้าหน้าที่สามารถเห็นว่าแม้ข้อความจะต่างกัน แต่หลักฐานสนับสนุนชี้ว่าเป็นเหตุการณ์เดียวกัน",
  },
  {
    id: "b2-similar-topic-different-incident",
    code: "B2",
    groupId: "group_b",
    groupTitle: "Group B — Candidate Quality & Group Membership",
    title: "Scenario B2: Similar Topic, Different Incident (หัวข้อคล้ายกัน แต่คนละเหตุการณ์)",
    description: "หัวข้อเกี่ยวกับพัดลมเสียเหมือนกัน แต่สถานที่คนละอาคาร (ซุ้มสังมา vs ห้องสมุด อาคาร 4) ระบบตรวจพบข้อขัดแย้งด้านสถานที่ และแสดงป้ายความแตกต่างชัดเจน ห้ามยืนยันว่าเป็นเหตุการณ์เดียวกัน",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario B2)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [
      {
        public_id: "SOC-DIFF-301",
        score: 55,
        confidence: "low",
        confidenceLabel: "ต่างสถานที่",
        reasons: ["หมวดหมู่ตรงกัน: พัดลมและระบบระบายอากาศ"],
        differences: ["คนละสถานที่: ซุ้มสังมา กับ ห้องสมุด อาคาร 4 ชั้น 6", "คนละระบบการดูแล"],
        breakdown: { categoryScore: 35, locationScore: 0, timeScore: 10, textScore: 10, totalScore: 55 },
        isPersonalPropertyDuplicate: false,
        report: {
          public_id: "SOC-DIFF-301",
          categoryName: "อาคารและสถานที่",
          subcategoryName: "พัดลมและระบบระบายอากาศ",
          location: "ห้องสมุด อาคาร 4 ชั้น 6",
          description: "พัดลมเพดานในห้องสมุดไม่ทำงาน",
          status: "received",
          created_at: "2026-08-28T05:00:00.000Z",
        },
      },
    ],
    expectedDisplayCase: "C",
    expectedToolbarVisible: false,
    explanation: "แสดง Case C (1 Candidate มีข้อแตกต่าง): แสดงป้ายความแตกต่างด้านสถานที่ชัดเจน ไม่นับว่าเป็นเหตุการณ์เดียวกัน และ Toolbar ไม่แสดง",
  },
  {
    id: "b3-candidate-already-grouped-elsewhere",
    code: "B3",
    groupId: "group_b",
    groupTitle: "Group B — Candidate Quality & Group Membership",
    title: "Scenario B3: Candidate Already Grouped Elsewhere (Candidate อยู่ในกลุ่มอื่นแล้ว)",
    description: "Candidate คำร้องมีความคล้ายคลึงกัน แต่มี Group Membership ในกลุ่ม INC-T-99001 อยู่แล้ว ระบบแสดงป้าย 'รวมกลุ่มนี้แล้ว' ไม่แสดง Checkbox และไม่นับเป็น Candidate ที่พร้อมเพิ่มเข้ากลุ่มอัตโนมัติ",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario B3)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [
      {
        ...REAL_REPORT_FAN_CANDIDATE_1,
        incidentGroup: {
          id: "grp-other-99",
          group_code: "INC-T-99001",
          title: "กลุ่มงานซ่อมแซมระบบระบายอากาศเร่งด่วน",
          status: "open",
        },
      },
      REAL_REPORT_FAN_CANDIDATE_2,
    ],
    expectedDisplayCase: "C",
    expectedToolbarVisible: false,
    explanation: "Candidate SOC-28934 อยู่ในกลุ่ม INC-T-99001 แล้ว จึงถูกตัดออกจาก Eligible Candidate ทำให้เหลือ Candidate ที่พร้อมดำเนินการเพียง 1 รายการ -> Toolbar ซ่อนอัตโนมัติตาม Rule 4",
  },
  {
    id: "b4-duplicate-candidate",
    code: "B4",
    groupId: "group_b",
    groupTitle: "Group B — Candidate Quality & Group Membership",
    title: "Scenario B4: Duplicate Candidate Prevention (ป้องกัน Candidate ซ้ำซ้อน)",
    description: "รายการ Candidate ส่งข้อมูลซ้ำของรหัสคำร้องเดียวกัน (SOC-28934 ซ้ำ 2 ครั้ง) UI ต้องกรองเหลือรายการเดียว และ Candidate Count ต้องไม่เพิ่มเกินจริง",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario B4)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [
      REAL_REPORT_FAN_CANDIDATE_1,
      { ...REAL_REPORT_FAN_CANDIDATE_1, score: 90 }, // Duplicate ID
      REAL_REPORT_FAN_CANDIDATE_2,
    ],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "Deduplication ตาม Rule 2: ตัด Candidate ที่มี ID ซ้ำ (SOC-28934) ออก ทำให้เหลือ Candidate ที่แท้จริงเพียง 2 รายการ และ Toolbar แสดงตัวเลขถูกต้อง",
  },
  {
    id: "b5-candidate-data-changes",
    code: "B5",
    groupId: "group_b",
    groupTitle: "Group B — Candidate Quality & Group Membership",
    title: "Scenario B5: Candidate Data Changes / Membership Shift (ข้อมูล Candidate เปลี่ยนแปลง)",
    description: "จำลองคำร้องถูกเชื่อมโยงเข้ากลุ่มหรือถูกปิดไประหว่างเปิดหน้า UI คำนวณจำนวน Candidate ใหม่แบบ Reactive และทำความสะอาด Selection อย่างปลอดภัย",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario B5)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "จำลองสถานะ Candidate เปลี่ยนแปลง: เจ้าหน้าที่สามารถทดลองคลิกปุ่ม 'จำลอง Candidate กลายเป็น Ineligible' เพื่อดู Toolbar ซ่อนและ Selection เคลียร์อัตโนมัติ",
  },

  // -----------------------------------------------------------------------
  // GROUP C: Bulk Toolbar Visibility Testing
  // -----------------------------------------------------------------------
  {
    id: "c1-zero-candidates",
    code: "C1",
    groupId: "group_c",
    groupTitle: "Group C — Bulk Toolbar Visibility (4 Levels)",
    title: "Level 1: 0 Candidates -> Toolbar ซ่อน 100%",
    description: "เมื่อไม่มี Candidate ที่เข้าเงื่อนไข Toolbar การดำเนินการแบบชุดต้องซ่อน และไม่มี Empty Box ตกค้างในหน้าจอ",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: 0 Candidates)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [],
    expectedDisplayCase: "C",
    expectedToolbarVisible: false,
    explanation: "Rule Test: 0 Candidates -> canShowBulkToolbar = false (Toolbar ซ่อน 100%)",
  },
  {
    id: "c2-one-candidate",
    code: "C2",
    groupId: "group_c",
    groupTitle: "Group C — Bulk Toolbar Visibility (4 Levels)",
    title: "Level 2: 1 Candidate (+ คำร้องต้นทาง = 2 รายการ) -> Toolbar แสดงผล",
    description: "เมื่อพบ Candidate 1 รายการ เมื่อนับรวมกับคำร้องต้นทางเป็น 2 รายการ ผ่านเกณฑ์ขั้นต่ำสำหรับการจัดกลุ่ม Toolbar แสดงผลพร้อม Checkbox และคำร้องต้นทางรวมอัตโนมัติ",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: 1 Candidate)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "Rule Test: 1 Candidate + 1 Source = 2 รายการ -> canShowBulkToolbar = true (Toolbar แสดงผลตามเกณฑ์ขั้นต่ำ 2 รายการ)",
    interactiveDefaults: {
      selectedReportIds: [REAL_REPORT_FAN_ANCHOR.public_id, REAL_REPORT_FAN_CANDIDATE_1.public_id],
    },
  },
  {
    id: "c3-two-candidates",
    code: "C3",
    groupId: "group_c",
    groupTitle: "Group C — Bulk Toolbar Visibility (4 Levels)",
    title: "Level 3: 2 Candidates -> Toolbar แสดงผล",
    description: "เมื่อมี Candidate ตั้งแต่ 2 รายการขึ้นไป Toolbar แสดงผลพร้อมแสดงปุ่มเลือกทั้งหมดและฟอร์มตอบกลับ",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: 2 Candidates)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "Rule Test: 2 Candidates -> canShowBulkToolbar = true (Toolbar แสดงผลตามเกณฑ์ขั้นต่ำ)",
    interactiveDefaults: {
      selectedReportIds: [REAL_REPORT_FAN_ANCHOR.public_id, REAL_REPORT_FAN_CANDIDATE_1.public_id],
    },
  },
  {
    id: "c4-three-plus-candidates",
    code: "C4",
    groupId: "group_c",
    groupTitle: "Group C — Bulk Toolbar Visibility (4 Levels)",
    title: "Level 4: 3+ Candidates -> Toolbar แสดงผลพร้อมนับจำนวนถูกต้อง",
    description: "เมื่อมี Candidate 3 รายการขึ้นไป Toolbar แสดงผลและระบุจำนวน Candidate และรายการที่เลือกอย่างถูกต้อง",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot: 3 Candidates)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2, REAL_REPORT_FAN_CANDIDATE_3],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "Rule Test: 3 Candidates -> canShowBulkToolbar = true (Toolbar แสดงผลพร้อม Selected Count ที่อัปเดตแบบเรียลไทม์)",
    interactiveDefaults: {
      selectedReportIds: [REAL_REPORT_FAN_ANCHOR.public_id, REAL_REPORT_FAN_CANDIDATE_1.public_id, REAL_REPORT_FAN_CANDIDATE_2.public_id],
    },
  },

  // -----------------------------------------------------------------------
  // GROUP D: Selection and Bulk Reply Preview
  // -----------------------------------------------------------------------
  {
    id: "d1-select-one",
    code: "D1",
    groupId: "group_d",
    groupTitle: "Group D — Selection & Bulk Reply Preview",
    title: "Scenario D1: Select One Candidate (เลือกคำร้อง 1 รายการ)",
    description: "ทดลองเลือกคำร้อง Candidate 1 รายการ ตรวจสอบ Selected Count และป้ายระบุจำนวนคำร้องที่เลือก",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "ทดสอบการเลือก 1 รายการ: Selected Count = 1 รายการ | Toolbar ยังคงแสดงเพราะ Candidate รวมมี 2 รายการ",
    interactiveDefaults: {
      selectedReportIds: [REAL_REPORT_FAN_CANDIDATE_1.public_id],
    },
  },
  {
    id: "d2-select-all-deselect-all",
    code: "D2",
    groupId: "group_d",
    groupTitle: "Group D — Selection & Bulk Reply Preview",
    title: "Scenario D2: Select All & Deselect All (เลือกทั้งหมด / ยกเลิกทั้งหมด)",
    description: "ทดลองคลิกปุ่ม 'เลือกทั้งหมด' เพื่อเลือกทุก Candidate ที่มีสิทธิ์ และปุ่ม 'ยกเลิกทั้งหมด' เพื่อเคลียร์การเลือกกลับสู่ Anchor Report",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2, REAL_REPORT_FAN_CANDIDATE_3],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "ทดสอบ Select All / Deselect All: คลิกปุ่มใน Toolbar เพื่อสลับการเลือกทั้งหมดได้ทันที",
    interactiveDefaults: {
      selectedReportIds: [REAL_REPORT_FAN_ANCHOR.public_id, REAL_REPORT_FAN_CANDIDATE_1.public_id, REAL_REPORT_FAN_CANDIDATE_2.public_id, REAL_REPORT_FAN_CANDIDATE_3.public_id],
    },
  },
  {
    id: "d3-remove-one-selection",
    code: "D3",
    groupId: "group_d",
    groupTitle: "Group D — Selection & Bulk Reply Preview",
    title: "Scenario D3: Remove One Candidate from Selection (ยกเลิกการเลือกเฉพาะรายการ)",
    description: "ทดลองคลิก Checkbox ของ Candidate รายการหนึ่งเพื่อยกเลิกการเลือก โดยที่รายการอื่นที่เลือกไว้ยังคงอยู่",
    isRealData: true,
    dataSourceLabel: "ฐานข้อมูลจริง (Database Snapshot)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2, REAL_REPORT_FAN_CANDIDATE_3],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "ทดสอบการยกเลิกการเลือกเฉพาะรายการ: Selection ของรายการอื่นยังคงเดิมอย่างอิสระ",
    interactiveDefaults: {
      selectedReportIds: [REAL_REPORT_FAN_ANCHOR.public_id, REAL_REPORT_FAN_CANDIDATE_1.public_id],
    },
  },
  {
    id: "d4-bulk-confirm-modal-preview",
    code: "D4",
    groupId: "group_d",
    groupTitle: "Group D — Selection & Bulk Reply Preview",
    title: "Scenario D4: Bulk Reply Confirmation Modal Preview (พรีวิว Modal ยืนยันการตอบกลับ)",
    description: "เปิด Modal ยืนยันการตอบกลับแบบชุด แสดงรายการรหัสคำร้อง, ข้อความสรุป, ข้อความตอบกลับที่จะส่ง, และสถานะเป้าหมายที่เลือกไว้ก่อนกดดำเนินการจริง",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario D4)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "Modal Confirmation Preview: เปิดแสดงรายการคำร้องที่จะได้รับผลกระทบอย่างละเอียดเพื่อให้เจ้าหน้าที่ตรวจสอบก่อนดำเนินการ",
    interactiveDefaults: {
      selectedReportIds: [REAL_REPORT_FAN_ANCHOR.public_id, REAL_REPORT_FAN_CANDIDATE_1.public_id],
      bulkFormOpen: true,
      bulkTargetStatus: "in_progress",
      bulkReplyMessage: "เจ้าหน้าที่ฝ่ายอาคารและสถานที่ได้รับเรื่องแล้ว และกำลังประสานงานช่างเข้าซ่อมแซมพัดลมครับ",
      modalPreview: "confirm",
    },
  },
  {
    id: "d5-partial-failure-preview",
    code: "D5",
    groupId: "group_d",
    groupTitle: "Group D — Selection & Bulk Reply Preview",
    title: "Scenario D5: Partial Failure Preview & Isolated Retry (พรีวิวกรณีสำเร็จบางส่วนและ Retry)",
    description: "จำลองผลการตอบกลับแบบชุดที่มีบางรายการสำเร็จ (2 รายการ) และบางรายการล้มเหลว (1 รายการ เช่น SOC-INVALID-99) พร้อมปุ่ม Retry เฉพาะรายการที่ล้มเหลว (Demo Mode)",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario D5)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1, REAL_REPORT_FAN_CANDIDATE_2],
    expectedDisplayCase: "C",
    expectedToolbarVisible: true,
    explanation: "จำลอง Partial Failure: 2 สำเร็จ, 1 ล้มเหลว แสดงปุ่ม Retry เฉพาะคำร้องที่ล้มเหลวโดยไม่ทำซ้ำคำร้องที่สำเร็จแล้ว",
    interactiveDefaults: {
      modalPreview: "result_partial",
    },
  },
  {
    id: "d6-candidate-becomes-ineligible",
    code: "D6",
    groupId: "group_d",
    groupTitle: "Group D — Selection & Bulk Reply Preview",
    title: "Scenario D6: Candidate Becomes Ineligible (จำลอง Candidate หมดสิทธิ์ระหว่างเลือก)",
    description: "จำลองกรณี Candidate ที่เลือกไว้ถูกนำเข้ากลุ่มโดยเจ้าหน้าที่ท่านอื่นในขณะเปิดหน้า ระบบจะนำออกจาก Selection และแสดงข้อความแจ้งเตือนอย่างชัดเจน",
    isRealData: false,
    dataSourceLabel: "ข้อมูลจำลอง (Mock Scenario D6)",
    anchorReport: REAL_REPORT_FAN_ANCHOR,
    currentIncident: null,
    candidateGroups: [],
    suggestions: [REAL_REPORT_FAN_CANDIDATE_1],
    expectedDisplayCase: "C",
    expectedToolbarVisible: false,
    explanation: "จำลอง Candidate Ineligible: เมื่อ Candidate กลายเป็น Ineligible ระบบนำออกจาก Selection และซ่อน Toolbar ทันที",
    interactiveDefaults: {
      modalPreview: "ineligible_alert",
    },
  },
];
