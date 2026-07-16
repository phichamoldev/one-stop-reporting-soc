import React from "react";
import { BackofficeLayoutWrapper } from "@/components/backoffice/BackofficeLayoutWrapper";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BackofficeLayoutWrapper>
      {children}
    </BackofficeLayoutWrapper>
  );
}
