import { Metadata } from "next";
import { RelatedRequestsLabView } from "@/components/backoffice/RelatedRequestsLabView";

export const metadata: Metadata = {
  title: "Related Requests UX Lab | SOC Backoffice",
  description: "Database-based UX Test Playground for Related Requests and Bulk Toolbar Scenarios",
};

export default function RelatedRequestsLabPage() {
  return <RelatedRequestsLabView />;
}
