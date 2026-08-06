# HOTFIX: Completion Note on Timeline Bug Report

## 1. Audit Results

ตามที่ได้ตรวจสอบปัญหาการแสดงผล Completion Note ใน Timeline ของ Staff Report Form (ไฟล์ `app/report/[publicId]/page.tsx`) พบข้อเท็จจริงดังนี้:

1. **ตรวจสอบว่า Textarea ใช้ state ตัวไหน:**
   - Textarea สำหรับช่อง "บันทึกข้อความภายใน" ใช้ state ชื่อ `updateRemark`
   - เมื่อเริ่มต้น จะดึงค่าเดิมจาก `report.admin_remark` มาเก็บไว้ใน `updateRemark` ทำให้ข้อความเดิมปรากฏในช่องเสมอเมื่อเข้าสู่หน้ารายงานที่เคยมีบันทึกแล้ว

2. **ตรวจสอบว่า payload ที่ส่งตอน Submit ใช้ state ตัวไหน:**
   - ใช้ `updateRemark` เช่นกัน **แต่** มีเงื่อนไขการส่งคือ:
     `remark: isRemarkChanged || (updateStatus as string) === 'transfer' ? updateRemark : undefined`
   - ซึ่งตัวแปร `isRemarkChanged` จะเปรียบเทียบว่า `updateRemark` แตกต่างจาก `report.admin_remark` เดิมหรือไม่
   - หากไม่มีการแก้ไขข้อความในช่อง Textarea ตัวแปร `isRemarkChanged` จะเป็น `false` ทำให้ payload ส่งค่า `remark: undefined` ออกไป

3. **ตรวจสอบว่า Timeline ใช้ completion_note จาก request หรือจาก report:**
   - ข้อมูลใน Timeline แสดงผลจากข้อมูล `report_logs` ซึ่ง field `remark` ถูกสร้างขึ้นมาใหม่ (Insert) ใน API Route (`app/api/reports/[publicId]/status/route.ts`) 
   - Backend จะรับค่าจาก payload และนำไปบันทึกลงใน `report_logs.remark`

4. **ตรวจสอบว่ามี logic ที่ส่ง completion_note เฉพาะตอนข้อความเปลี่ยนหรือไม่:**
   - **มี** ตามที่ได้ระบุในข้อ 2 (`isRemarkChanged`) ส่งผลให้หากผู้ใช้เปลี่ยนเฉพาะ Status โดยไม่ได้แตะต้อง Completion Note ตัวแอปพลิเคชันจะไม่ส่ง Completion Note ใน Payload ไปที่ API

5. **ตรวจสอบว่ามีการแทนที่ completion_note ด้วย "" หรือ null ก่อนบันทึกหรือไม่:**
   - **มี** ใน API Route `app/api/reports/[publicId]/status/route.ts` มีคำสั่ง:
     `let logRemark = remark || null;`
   - เนื่องจาก payload ของ remark ถูกส่งไปเป็น `undefined` ตัวแปร `logRemark` จึงถูกปรับเป็น `null` ทำให้ Timeline อ่านค่าไม่ได้ และตกไปแสดงผล default text ว่า `"ไม่มีหมายเหตุเพิ่มเติม"` 

## 2. Fix Implementation

เพื่อแก้ไขปัญหานี้ให้ตรงตาม Requirements (แสดงข้อความเดียวกับที่อยู่ใน Textarea เสมอ แม้ไม่ได้ทำการแก้ไข):

1. ทำการแก้ไขไฟล์ `app/report/[publicId]/page.tsx`
2. ถอดเงื่อนไข `isRemarkChanged` ออกจาก Property `remark` ในขั้นตอนสร้าง Payload
3. ปรับโค้ดให้ส่ง `remark: updateRemark` ไปยัง API ทุกครั้งที่มีการ Submit
4. ค่าใน Textarea (`updateRemark`) จะถูกส่งไปใน Payload อย่างแน่ชัด (ถ้าเว้นว่างไว้ จะเป็น Empty String `""` ซึ่งตรงกับที่ต้องการ)
5. Backend จะนำค่าที่ได้รับไปอัปเดตลงใน Timeline (`report_logs`) ได้อย่างถูกต้องตามที่ปรากฏให้เห็นใน Textarea

> การแก้ไขนี้เสร็จสิ้นโดยไม่ได้แก้ไข View Mode, Summary Card, ระบบ Authentication หรือโครงสร้าง Database Schema ตาม Requirement ที่กำหนดไว้
