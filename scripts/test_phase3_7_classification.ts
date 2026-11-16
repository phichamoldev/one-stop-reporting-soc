import { classifyReportTaxonomy } from '../src/lib/taxonomyClassifier';

const testCases = [
  // Fire scenario messages from Section D
  { text: "พบควันไฟบริเวณชั้น 1 อาคารเรียน", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "มีเปลวไฟออกมาจากห้องเก็บอุปกรณ์", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "พบกลุ่มควันหนาแน่นบริเวณทางเดินชั้น 2", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "ได้กลิ่นไหม้และเห็นควันออกมาจากห้องเก็บของ", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "มีไฟลุกบริเวณสายไฟใกล้ห้องเก็บอุปกรณ์", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "พบควันไฟออกมาจากหน้าต่างอาคารเรียน", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "พบเปลวไฟบริเวณห้องเก็บของ", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "พบควันหนาทึบใกล้บันไดทางขึ้นชั้น 2", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },

  // Table cases from Section D
  { text: "พบไฟไหม้ในอาคาร", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "พบควันไฟจากห้องเก็บของ", expected: "เพลิงไหม้", expectedCat: 4, expectedSubcat: 34 },
  { text: "ท่อก๊าซรั่ว", expected: "ก๊าซรั่ว", expectedCat: 4, expectedSubcat: 34 },
  { text: "ลิฟต์ค้างมีคนติดอยู่", expected: "ลิฟต์ / เหตุฉุกเฉินเกี่ยวกับบุคคล", expectedCat: 4, expectedSubcat: 34 },
  { text: "พบผู้บาดเจ็บจากไฟไหม้", expected: "ประเภทอุบัติเหตุ/ผู้บาดเจ็บตาม Taxonomy", expectedCat: 4, expectedSubcat: 34 },
];

console.log("=== RUNNING SECTION D CLASSIFICATION TEST ===");
let allPassed = true;

for (const tc of testCases) {
  const result = classifyReportTaxonomy(tc.text);
  const pass = result.display_label === tc.expected &&
               result.category_id === tc.expectedCat &&
               result.category_id !== 3; // STRICT GUARD: MUST NEVER BE CATEGORY 3 (บริหารงานบุคคล)

  console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc.text}"`);
  console.log(`       -> Label: ${result.display_label} (Cat: ${result.category_id} [${result.category_name}], Subcat: ${result.subcategory_id} [${result.subcategory_name}])`);

  if (!pass) {
    allPassed = false;
  }
}

console.log(`\nClassification Test Result: ${allPassed ? 'ALL PASS (13/13)' : 'FAIL'}`);
if (!allPassed) process.exit(1);

