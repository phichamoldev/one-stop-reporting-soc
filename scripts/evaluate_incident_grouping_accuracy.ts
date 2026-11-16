import {
  evaluateIncidentIdentity,
  compareReports,
  detectIncidentContradiction,
  extractSpatialAnchor,
  extractSystemEntity,
  ReportItem,
  IncidentIdentityEvaluation
} from '../src/lib/similarityDetector';
import { generateIncidentDrafts } from '../src/lib/incidentDraftService';
import { detectIncidentCorrelations } from '../src/lib/incidentDetector';

interface TestCase {
  id: string;
  scenarioNumber: number;
  scenarioName: string;
  description: string;
  repA: ReportItem;
  repB: ReportItem;
  groundTruth: 'same_incident' | 'different_incident' | 'insufficient_evidence';
  groundTruthReason: string;
}

const EVALUATION_DATASET: TestCase[] = [
  // -------------------------------------------------------------
  // 1. Same Incident, Different Wording
  // -------------------------------------------------------------
  {
    id: 'TC-01',
    scenarioNumber: 1,
    scenarioName: 'Same incident, different wording',
    description: 'ท่อน้ำรั่วซึมบริเวณเดียวกันแต่คนละสำนวนภาษา',
    repA: {
      public_id: 'SOC-EVAL-001',
      category_id: 1,
      subcategory_id: 101,
      location: 'อาคาร 1 ชั้น 2 หน้าลิฟต์',
      description: 'น้ำรั่วซึมจากเพดานหยดลงมาบนพื้นทางเดิน มีน้ำขังเจิ่งนอง',
      created_at: '2026-10-21T08:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-002',
      category_id: 1,
      subcategory_id: 101,
      location: 'อาคาร 1 ชั้น 2 โถงบันไดใกล้ลิฟต์',
      description: 'มีน้ำหยดจากฝ้าเพดานลงมา พื้นเปียกลื่นมากอันตรายคนเดินผ่าน',
      created_at: '2026-10-21T08:30:00Z',
    },
    groundTruth: 'same_incident',
    groundTruthReason: 'สถานที่ทางกายภาพเดียวกัน (อาคาร 1 ชั้น 2) ช่วงเวลาต่อเนื่อง 30 นาที และปัญหาเดียวกัน (น้ำรั่วจากเพดาน/ฝ้าลงพื้น)',
  },

  // -------------------------------------------------------------
  // 2. Keyword Overlap Trap (Different problems sharing keywords)
  // -------------------------------------------------------------
  {
    id: 'TC-02',
    scenarioNumber: 2,
    scenarioName: 'Keyword overlap trap',
    description: 'ปัญหาเครือข่าย กับ แอร์เสีย ในอาคารเดียวกัน มีคำว่า "ใช้งานไม่ได้/ไฟ" ซ้ำ',
    repA: {
      public_id: 'SOC-EVAL-003',
      category_id: 3,
      subcategory_id: 36,
      location: 'อาคาร 1 ชั้น 3',
      description: 'สัญญาณ Wi-Fi หลุดบ่อยมาก เชื่อมต่ออินเทอร์เน็ตไม่ได้เลย ไฟเราเตอร์กระพริบสีส้ม',
      created_at: '2026-10-21T09:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-004',
      category_id: 1,
      subcategory_id: 28,
      location: 'อาคาร 1 ชั้น 3',
      description: 'เครื่องปรับอากาศเปิดไม่ติด ไฟสถานะแอร์ดับ แอร์ไม่เย็น ลมไม่ออก',
      created_at: '2026-10-21T09:15:00Z',
    },
    groundTruth: 'different_incident',
    groundTruthReason: 'คนละระบบอย่างสิ้นเชิง (Wi-Fi/Network vs HVAC/แอร์) แม้จะแชร์สถานที่และคำว่าไฟ/ใช้งานไม่ได้',
  },

  // -------------------------------------------------------------
  // 3. Same Problem Category, Different Buildings
  // -------------------------------------------------------------
  {
    id: 'TC-03',
    scenarioNumber: 3,
    scenarioName: 'Same problem, different buildings',
    description: 'แอร์เสียเหมือนกัน แต่อยู่คนละอาคาร (อาคาร 1 vs อาคาร 14)',
    repA: {
      public_id: 'SOC-EVAL-005',
      category_id: 1,
      subcategory_id: 28,
      location: 'อาคาร 1 ห้อง 1302',
      description: 'แอร์ห้องเรียนไม่เย็น มีแต่ลมร้อน อากาศอบอ้าวมาก',
      created_at: '2026-10-21T10:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-006',
      category_id: 1,
      subcategory_id: 28,
      location: 'อาคาร 14 ห้อง 1402',
      description: 'แอร์ห้องบรรยายไม่เย็น คอมเพรสเซอร์ไม่ทำงาน',
      created_at: '2026-10-21T10:20:00Z',
    },
    groundTruth: 'different_incident',
    groundTruthReason: 'คนละอาคารทางกายภาพ (อาคาร 1 vs อาคาร 14) ต้องไม่ถูกนำมารวมกลุ่มกัน',
  },

  // -------------------------------------------------------------
  // 4. Same Problem, Vague / Unspecified Location
  // -------------------------------------------------------------
  {
    id: 'TC-04',
    scenarioNumber: 4,
    scenarioName: 'Same problem, vague location',
    description: 'แอร์ไม่เย็นแต่ระบุสถานที่กว้างเกินไป (มหาวิทยาลัย vs คณะสังคมศาสตร์)',
    repA: {
      public_id: 'SOC-EVAL-007',
      category_id: 1,
      subcategory_id: 28,
      location: 'มหาวิทยาลัย',
      description: 'แอร์ไม่เย็น ร้อนมากช่วยเปิดให้หน่อย',
      created_at: '2026-10-21T11:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-008',
      category_id: 1,
      subcategory_id: 28,
      location: 'คณะสังคมศาสตร์',
      description: 'แอร์ไม่เย็นเลย ช่วยส่งช่างมาดูหน่อย',
      created_at: '2026-10-21T11:10:00Z',
    },
    groundTruth: 'insufficient_evidence',
    groundTruthReason: 'ข้อมูลสถานที่กว้างเกินไประดับมหาวิทยาลัย/คณะ ไม่มีหลักฐานยืนยันว่าเป็นเครื่องเดียวกัน ควรแยกเป็น Similar Requests',
  },

  // -------------------------------------------------------------
  // 5. Different Time Windows (Separated by days)
  // -------------------------------------------------------------
  {
    id: 'TC-05',
    scenarioNumber: 5,
    scenarioName: 'Different time windows',
    description: 'ปัญหา Wi-Fi อาคารเดียวกันแต่เกิดคนละสัปดาห์ (ห่างกัน 120 ชม.)',
    repA: {
      public_id: 'SOC-EVAL-009',
      category_id: 3,
      subcategory_id: 36,
      location: 'อาคาร 2 ชั้น 4',
      description: 'Wi-Fi หอสมุดเชื่อมต่อไม่ได้ ขึ้น No Internet',
      created_at: '2026-10-15T09:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-010',
      category_id: 3,
      subcategory_id: 36,
      location: 'อาคาร 2 ชั้น 4',
      description: 'อินเทอร์เน็ตไวไฟใช้งานไม่ได้ สัญญาณหลุด',
      created_at: '2026-10-20T10:00:00Z',
    },
    groundTruth: 'different_incident',
    groundTruthReason: 'ปัญหาเน็ตหลุดชั่วคราวที่เวลาห่างกันเกิน 3 วัน (120 ชม.) ถือเป็นคนละครั้งของเหตุการณ์ขัดข้อง',
  },

  // -------------------------------------------------------------
  // 6. Multi-Category Shared Root Cause (Storm / Heavy Rain)
  // -------------------------------------------------------------
  {
    id: 'TC-06',
    scenarioNumber: 6,
    scenarioName: 'Multi-category shared root cause',
    description: 'พายุฝนทำให้เกิดทั้งน้ำท่วมทางลาด และน้ำรั่วซึมฝ้าเพดานในบริเวณเชื่อมต่อ',
    repA: {
      public_id: 'SOC-EVAL-011',
      category_id: 4, // ภัยธรรมชาติ
      subcategory_id: 23,
      location: 'ลานหน้าอาคาร 1',
      description: 'พายุฝนตกหนัก น้ำท่วมขังเอ่อล้นทะลักเข้ามาตรงทางลาดหน้าอาคาร 1 ระบายไม่ทัน',
      created_at: '2026-10-21T13:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-012',
      category_id: 1, // อาคารและสถานที่
      subcategory_id: 24,
      location: 'ทางเดินเชื่อมอาคาร 1-2',
      description: 'ฝนตกหนักพายุพัดแรง น้ำฝนสาดและฝ้าเพดานรั่ว น้ำหยดลงมาที่ทางเดินเชื่อม',
      created_at: '2026-10-21T13:20:00Z',
    },
    groundTruth: 'same_incident',
    groundTruthReason: 'เกิดจากต้นเหตุร่วม (พายุฝนตกหนัก/น้ำท่วม) ในพื้นที่เชื่อมต่อและช่วงเวลาเดียวกัน แม้จะอยู่คนละหมวดหมู่ย่อย',
  },

  // -------------------------------------------------------------
  // 7. Connected Components / Transitive Chaining Error Trap
  // -------------------------------------------------------------
  {
    id: 'TC-07',
    scenarioNumber: 7,
    scenarioName: 'Connected components chaining trap',
    description: 'คำร้องแอร์เสียห้อง 301 กับ แอร์เสียห้อง 309 ในอาคารเดียวกัน (โดยไม่มีไฟดับทั้งตึก)',
    repA: {
      public_id: 'SOC-EVAL-013',
      category_id: 1,
      subcategory_id: 28,
      location: 'อาคาร 1 ห้อง 301',
      description: 'แอร์ห้อง 301 น้ำหยดลงโต๊ะทำงาน เสียงดังผิดปกติ',
      created_at: '2026-10-21T14:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-014',
      category_id: 1,
      subcategory_id: 28,
      location: 'อาคาร 1 ห้อง 309',
      description: 'แอร์ห้อง 309 ไม่เย็นเลย คอมเพรสเซอร์ไม่ตัด',
      created_at: '2026-10-21T14:15:00Z',
    },
    groundTruth: 'different_incident',
    groundTruthReason: 'แอร์เป็นอุปกรณ์ประจำห้อง การเสียคนละห้อง (ห้อง 301 vs 309) ต้องไม่ถูกรวบเป็นกลุ่มเดียวกันแม้จะอยู่อาคารเดียวกัน',
  },

  // -------------------------------------------------------------
  // 8. Duplicate or Near-Duplicate Emergency
  // -------------------------------------------------------------
  {
    id: 'TC-08',
    scenarioNumber: 8,
    scenarioName: 'Duplicate or near-duplicate emergency',
    description: 'ลิฟต์ค้างมีคนติดอยู่ ผู้ประสบเหตุแจ้งซ้ำกัน 2 รายการ',
    repA: {
      public_id: 'SOC-EVAL-015',
      category_id: 1,
      subcategory_id: 34,
      location: 'อาคาร 1 ลิฟต์ตัวที่ 1 ค้างชั้น 3',
      description: 'ลิฟต์โดยสารตัวที่ 1 อาคาร 1 ค้างอยู่ที่ชั้น 3 ประตูเปิดไม่ได้ มีคนติดอยู่ข้างใน 2 คน',
      created_at: '2026-10-21T15:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-016',
      category_id: 1,
      subcategory_id: 34,
      location: 'อาคาร 1 ลิฟต์ตัว 1 ชั้น 3',
      description: 'ลิฟต์ตัว 1 อาคาร 1 ค้างชั้น 3 ช่วยด้วยมีคนติดอยู่ข้างในด่วนมาก',
      created_at: '2026-10-21T15:05:00Z',
    },
    groundTruth: 'same_incident',
    groundTruthReason: 'เหตุฉุกเฉินเดียวกันเป๊ะ ลิฟต์ตัวเดียวกัน ชั้นเดียวกัน เวลาห่างกัน 5 นาที',
  },

  // -------------------------------------------------------------
  // 9. Recurring Incident After Previous Closed Incident
  // -------------------------------------------------------------
  {
    id: 'TC-09',
    scenarioNumber: 9,
    scenarioName: 'Recurring incident after closed',
    description: 'ท่อน้ำแตกซ้ำจุดเดิมหลังจากงานเดิมปิดไปแล้ว 2 สัปดาห์',
    repA: {
      public_id: 'SOC-EVAL-017',
      category_id: 1,
      subcategory_id: 27,
      location: 'อาคาร 3 ชั้น 1 ห้องน้ำชาย',
      description: 'ท่อชักโครกแตก น้ำรั่วซึมนองพื้นห้องน้ำ (กลุ่มเก่าที่ปิดแล้ว)',
      created_at: '2026-10-01T08:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-018',
      category_id: 1,
      subcategory_id: 27,
      location: 'อาคาร 3 ชั้น 1 ห้องน้ำชาย',
      description: 'ท่อน้ำรั่วซึมใหม่อีกรอบ มีน้ำนองพื้นห้องน้ำชาย',
      created_at: '2026-10-21T08:00:00Z',
    },
    groundTruth: 'different_incident',
    groundTruthReason: 'เป็นปัญหาที่เกิดขึ้นใหม่หลังเหตุการณ์เดิมปิดแล้ว (ห่างกัน 20 วัน) ควรเสนอเป็นประวัติเพื่อตรวจสอบ แต่ไม่รวมเข้ากลุ่มเดิม',
  },

  // -------------------------------------------------------------
  // 10. Insufficient Evidence Cases (Personal Property & Vague Reports)
  // -------------------------------------------------------------
  {
    id: 'TC-10',
    scenarioNumber: 10,
    scenarioName: 'Personal property protection',
    description: 'บัตรนักศึกษาหาย vs กระเป๋าสตางค์หาย แถวโรงอาหาร',
    repA: {
      public_id: 'SOC-EVAL-019',
      category_id: 5,
      subcategory_id: 33,
      location: 'โรงอาหารกลาง',
      description: 'ทำบัตรนักศึกษาหายที่โต๊ะอาหารแถวร้านข้าวแกง ช่วยติดต่อกลับด้วยครับ',
      created_at: '2026-10-21T12:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-020',
      category_id: 5,
      subcategory_id: 33,
      location: 'โรงอาหารกลาง',
      description: 'ลืมกระเป๋าสตางค์สีดำไว้ที่โรงอาหาร มีเงินสดและบัตรประชาชน',
      created_at: '2026-10-21T12:15:00Z',
    },
    groundTruth: 'different_incident',
    groundTruthReason: 'ของหายส่วนบุคคลของแต่ละคน แม้จะหายที่โรงอาหารในวันเดียวกัน ก็เป็นคนละเหตุการณ์ส่วนตัว ห้ามรวมกลุ่มคำร้องของหาย',
  },
  {
    id: 'TC-11',
    scenarioNumber: 10,
    scenarioName: 'Vague lighting issue',
    description: 'ไฟทางเดินเสียแต่ไม่บอกอาคารและชั้น',
    repA: {
      public_id: 'SOC-EVAL-021',
      category_id: 1,
      subcategory_id: 26,
      location: 'ทางเดิน',
      description: 'หลอดไฟทางเดินเสีย มืดมากอันตราย',
      created_at: '2026-10-21T18:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-022',
      category_id: 1,
      subcategory_id: 26,
      location: 'มหาวิทยาลัย',
      description: 'ไฟทางเดินดับ ช่วยเปลี่ยนหลอดไฟที',
      created_at: '2026-10-21T18:20:00Z',
    },
    groundTruth: 'insufficient_evidence',
    groundTruthReason: 'สถานที่ทางเดินกว้างเกินไปและไม่ระบุอาคาร/ชั้น เป็น Similar Request แต่ข้อมูลไม่พอสร้าง Incident Group',
  },
  {
    id: 'TC-12',
    scenarioNumber: 7,
    scenarioName: 'Restroom gender contradiction',
    description: 'ห้องน้ำชาย vs ห้องน้ำหญิง ในชั้นเดียวกัน',
    repA: {
      public_id: 'SOC-EVAL-023',
      category_id: 1,
      subcategory_id: 27,
      location: 'อาคาร 1 ชั้น 2 ห้องน้ำชาย',
      description: 'ก๊อกน้ำอ่างล้างมือรั่ว ปิดไม่สนิท',
      created_at: '2026-10-21T11:00:00Z',
    },
    repB: {
      public_id: 'SOC-EVAL-024',
      category_id: 1,
      subcategory_id: 27,
      location: 'อาคาร 1 ชั้น 2 ห้องน้ำหญิง',
      description: 'สายชำระห้องน้ำหญิงรั่ว น้ำไหลตลอดเวลา',
      created_at: '2026-10-21T11:15:00Z',
    },
    groundTruth: 'different_incident',
    groundTruthReason: 'คนละห้องน้ำทางกายภาพ (ห้องน้ำชาย vs ห้องน้ำหญิง) สุขภัณฑ์เฉพาะจุดคนละตัว',
  },
];

async function runEvaluationSuite() {
  console.log('==================================================================');
  console.log('INCIDENT GROUPING ACCURACY EVALUATION SUITE');
  console.log('Comparing Old Similarity Logic vs New Incident Identity Logic');
  console.log('Representative Dataset: 12 Test Cases across 10 Critical Scenarios');
  console.log('==================================================================\n');

  let oldFalseMerges = 0;
  let newFalseMerges = 0;

  let oldMissedGroups = 0;
  let newMissedGroups = 0;

  let oldCorrectDecisions = 0;
  let newCorrectDecisions = 0;

  let candidateRetrievalHits = 0;
  let candidateRetrievalTotal = 0;

  let sameIncidentTruePositives = 0;
  let sameIncidentFalsePositives = 0;
  let sameIncidentFalseNegatives = 0;

  console.log('CASE-BY-CASE EVALUATION RESULTS:\n');

  for (const tc of EVALUATION_DATASET) {
    // 1. Evaluate with Old Method (Legacy compareReports with threshold >= 50)
    const oldComparison = compareReports(tc.repA, tc.repB);
    const oldPredictedSame = oldComparison.score >= 50 && !oldComparison.reasons.some(r => r.includes('คนละสถานที่'));

    // 2. Evaluate with New Method (evaluateIncidentIdentity)
    const newEval = evaluateIncidentIdentity(tc.repA, tc.repB);

    // Track Ground Truth
    if (tc.groundTruth === 'same_incident') {
      candidateRetrievalTotal++;
      if (newEval.isSameIncidentCandidate) {
        candidateRetrievalHits++;
        sameIncidentTruePositives++;
      } else {
        sameIncidentFalseNegatives++;
        newMissedGroups++;
      }
    } else {
      if (newEval.isSameIncidentCandidate) {
        sameIncidentFalsePositives++;
        newFalseMerges++;
      }
    }

    if (oldPredictedSame && tc.groundTruth !== 'same_incident') {
      oldFalseMerges++;
    }
    if (!oldPredictedSame && tc.groundTruth === 'same_incident') {
      oldMissedGroups++;
    }

    // Check accuracy of final decision
    const isNewCorrect = newEval.candidateDecision === tc.groundTruth;
    if (isNewCorrect) newCorrectDecisions++;

    console.log(`[${tc.id}] Scenario ${tc.scenarioNumber}: ${tc.scenarioName}`);
    console.log(`  - Case: ${tc.description}`);
    console.log(`  - Ground Truth: ${tc.groundTruth.toUpperCase()} (Reason: ${tc.groundTruthReason})`);
    console.log(`  - Old Logic: Score ${oldComparison.score}% => ${oldPredictedSame ? 'MERGE (Draft)' : 'NO MERGE'}`);
    console.log(`  - New Logic: Decision = ${newEval.candidateDecision} (Rule Score: ${newEval.ruleScore}/100, Confidence: ${newEval.ruleConfidence})`);
    if (newEval.evidence.length > 0) {
      console.log(`    Evidence: ${newEval.evidence.join('; ')}`);
    }
    if (newEval.differences.length > 0) {
      console.log(`    Differences/Guards: ${newEval.differences.join('; ')}`);
    }
    console.log(`  - Result: ${isNewCorrect ? '✅ CORRECT' : '❌ MISMATCH'}\n`);
  }

  // Calculate Precision and Recall for Incident Grouping
  const precision = sameIncidentTruePositives / (sameIncidentTruePositives + sameIncidentFalsePositives);
  const recall = sameIncidentTruePositives / (sameIncidentTruePositives + sameIncidentFalseNegatives);
  const retrievalRate = candidateRetrievalHits / candidateRetrievalTotal;

  console.log('==================================================================');
  console.log('ACCURACY MEASUREMENT REPORT');
  console.log('==================================================================');
  console.log(`Total Evaluation Pairs: ${EVALUATION_DATASET.length}`);
  console.log(`Candidate Retrieval Rate: ${(retrievalRate * 100).toFixed(1)}% (${candidateRetrievalHits}/${candidateRetrievalTotal} true incidents found)`);
  console.log(`Incident Grouping Precision: ${(precision * 100).toFixed(1)}% (${sameIncidentTruePositives}/${sameIncidentTruePositives + sameIncidentFalsePositives})`);
  console.log(`Incident Grouping Recall: ${(recall * 100).toFixed(1)}% (${sameIncidentTruePositives}/${sameIncidentTruePositives + sameIncidentFalseNegatives})`);
  console.log(`------------------------------------------------------------------`);
  console.log(`False Merge Cases (Crucial Safety Metric):`);
  console.log(`  - Old System: ${oldFalseMerges} False Merges out of ${EVALUATION_DATASET.length - candidateRetrievalTotal} non-identical pairs`);
  console.log(`  - New System: ${newFalseMerges} False Merges (100% False Merge Prevention achieved!)`);
  console.log(`------------------------------------------------------------------`);
  console.log(`Missed Group Cases:`);
  console.log(`  - Old System: ${oldMissedGroups}`);
  console.log(`  - New System: ${newMissedGroups}`);
  console.log(`------------------------------------------------------------------`);
  console.log(`Overall Decision Accuracy:`);
  console.log(`  - New System Correct: ${newCorrectDecisions}/${EVALUATION_DATASET.length} (${((newCorrectDecisions / EVALUATION_DATASET.length) * 100).toFixed(1)}%)`);
  console.log('==================================================================\n');

  // -------------------------------------------------------------
  // Test 7 Transitive Chaining / Clustering Trap Test
  // -------------------------------------------------------------
  console.log('[Clustering & Anti-Chaining Test]');
  console.log('Testing generateIncidentDrafts with a tricky transitive cluster (A ~ B and B ~ C, but A != C):');
  
  const trickyCluster = [
    {
      id: 'cluster-A',
      public_id: 'SOC-CHAIN-A',
      category_id: 1,
      subcategory_id: 28,
      location: 'อาคาร 1 ชั้น 3 ห้อง 301',
      description: 'แอร์ห้อง 301 เสีย มีน้ำหยดลงมา',
      priority: 'normal' as const,
      created_at: '2026-10-21T10:00:00Z',
    },
    {
      id: 'cluster-B',
      public_id: 'SOC-CHAIN-B',
      category_id: 1,
      subcategory_id: 28,
      location: 'อาคาร 1 ชั้น 3 บริเวณทางเดิน',
      description: 'แอร์ทางเดินชั้น 3 ไม่เย็น อากาศร้อน',
      priority: 'normal' as const,
      created_at: '2026-10-21T10:15:00Z',
    },
    {
      id: 'cluster-C',
      public_id: 'SOC-CHAIN-C',
      category_id: 1,
      subcategory_id: 28,
      location: 'อาคาร 1 ชั้น 3 ห้อง 309',
      description: 'แอร์ห้อง 309 เสีย คอมเพรสเซอร์ตัดตลอดเวลา',
      priority: 'normal' as const,
      created_at: '2026-10-21T10:30:00Z',
    },
  ];

  const generatedDrafts = generateIncidentDrafts(trickyCluster);
  console.log(`  Generated Drafts Count: ${generatedDrafts.length}`);
  for (const d of generatedDrafts) {
    console.log(`  - Draft "${d.proposedTitle}":`);
    console.log(`    Members (${d.reports.length}): ${d.reports.map(r => r.public_id).join(', ')}`);
    if (d.reports.some(r => r.public_id === 'SOC-CHAIN-A') && d.reports.some(r => r.public_id === 'SOC-CHAIN-C')) {
      throw new Error('ANTI-CHAINING FAILURE: Room 301 and Room 309 were falsely merged into the same draft!');
    }
  }
  console.log('  ✅ ANTI-CHAINING GUARD VERIFIED: Room 301 and Room 309 were NOT merged into the same group!\n');

  if (newFalseMerges > 0) {
    throw new Error(`Evaluation Failed: Expected 0 False Merges, but got ${newFalseMerges}`);
  }
  if (precision < 1.0) {
    throw new Error(`Evaluation Failed: Precision must be 1.0 (100%), got ${precision}`);
  }
  console.log('✅ ALL ACCURACY BENCHMARKS PASSED SUCCESSFULLY!');
}

runEvaluationSuite().catch((err) => {
  console.error('Evaluation Error:', err);
  process.exit(1);
});
