# Incident Grouping & Bulk Action — Development Blueprint

> **สถานะ: PLANNING ONLY — ยังไม่มีการแก้ไข Source Code, Database, หรือ Production Configuration ใด ๆ**

## เอกสารชุดนี้คืออะไร

เอกสารชุดนี้เป็น **Source of Truth** สำหรับการพัฒนาระบบ Incident Grouping & Bulk Action ของ One Stop Reporting SOC ทุกขั้นตอนการพัฒนาจริงต้องอ้างอิงจากเอกสารเหล่านี้

## สารบัญ

| ไฟล์ | เนื้อหา |
|------|---------|
| [REQUIREMENTS.md](./REQUIREMENTS.md) | Functional & Non-functional Requirements |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System Architecture & Current State |
| [DATABASE-DESIGN.md](./DATABASE-DESIGN.md) | Schema design สำหรับ tables ใหม่ |
| [API-SPECIFICATION.md](./API-SPECIFICATION.md) | API Endpoints, Input/Output, Auth |
| [UI-UX-SPECIFICATION.md](./UI-UX-SPECIFICATION.md) | Screen Specs & Wireframes |
| [NOTIFICATION-DESIGN.md](./NOTIFICATION-DESIGN.md) | LINE Queue, Debounce, Aggregation |
| [MATCHING-RULES.md](./MATCHING-RULES.md) | Duplicate/Similar Detection Algorithm |
| [SECURITY.md](./SECURITY.md) | RLS, Authorization, Permission |
| [TEST-PLAN.md](./TEST-PLAN.md) | Test Cases & Acceptance Criteria |
| [MIGRATION-PLAN.md](./MIGRATION-PLAN.md) | Migration & Rollback Strategy |
| [DEPLOYMENT-PLAN.md](./DEPLOYMENT-PLAN.md) | Deployment Pipeline & Feature Flags |
| [ROADMAP.md](./ROADMAP.md) | 12-week Development Roadmap |
| [TASK-BREAKDOWN.md](./TASK-BREAKDOWN.md) | Developer Tasks with IDs |
| [RISK-REGISTER.md](./RISK-REGISTER.md) | Risk Analysis & Mitigations |
| [TEST-REPORT.md](./TEST-REPORT.md) | Comprehensive Test Report (Track A & Track B) |
| [BASELINE-NOTIFICATION-TEST.md](./BASELINE-NOTIFICATION-TEST.md) | Baseline Test Report (Existing AS-IS LINE Notification Behavior) |

## หลักการออกแบบ

1. **Additive Only** — ไม่แก้ไขหรือทำลาย `reports` table เดิม
2. **Human-in-the-loop** — AI/ระบบแนะนำ แต่ Staff ยืนยันเสมอ
3. **Individual Tracking** — ทุก Request ยังมี tracking, history, status ของตัวเอง
4. **Backward Compatible** — ระบบเดิมต้องทำงานได้แม้ feature ใหม่ยังไม่เปิด

## วันที่จัดทำ

2026-09-25
