import { redirect } from "next/navigation";

export default function ReportRedirectPage() {
  // เปลี่ยนเส้นทางกลับสู่หน้าแรกที่มีแบบฟอร์มหลักโดยตรง
  redirect("/");
}
