/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, Fragment } from 'react';
import { 
  Menu, 
  User, 
  Bell, 
  Search, 
  ExternalLink, 
  Activity, 
  Home, 
  Building,
  Wrench,
  ShieldCheck,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { ReportDetailView } from './components/ReportDetailView';
import { AnalyticsView } from './components/AnalyticsView';
import { DepartmentsView } from './components/DepartmentsView';
import { StaffView } from './components/StaffView';
import { SettingsView } from './components/SettingsView';
import { RealTimeSimulator } from './components/RealTimeSimulator';
import { ToastContainer, ToastMessage } from './components/Toast';

import { 
  getSavedReports, 
  saveReports, 
  getSavedLogs, 
  saveLogs, 
  getSavedStaff, 
  saveStaff, 
  getSavedSettings, 
  saveSettings 
} from './data/mockData';
import { Report, ReportLog, ReportStatus, SystemSettings, Staff } from './types';

export default function App() {
  // 1. App State
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Layout UI States
  const [activeView, setActiveView] = useState<string>('dashboard'); // dashboard, reports, report-detail, departments, staff, analytics, settings
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSimulating, setIsSimulating] = useState(true);

  // Toast System State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastMessage['type'], title: string, description?: string, action?: ToastMessage['action']) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description, action }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 2. Initial Data Loading & Persistence Sync
  useEffect(() => {
    // Load from local storage
    setReports(getSavedReports());
    setLogs(getSavedLogs());
    setStaff(getSavedStaff());
    setSettings(getSavedSettings());

    // Sync Dark Mode class from storage
    const storedDarkMode = localStorage.getItem('soc_backoffice_darkmode') === 'true';
    setIsDarkMode(storedDarkMode);
    if (storedDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Sync Simulation state
    const storedSim = localStorage.getItem('soc_backoffice_simulating') !== 'false';
    setIsSimulating(storedSim);
  }, []);

  // Sync Dark mode state with document DOM
  const handleToggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    localStorage.setItem('soc_backoffice_darkmode', String(nextDark));
    if (nextDark) {
      document.documentElement.classList.add('dark');
      addToast('info', 'เปลี่ยนเป็นโหมดมืดเรียบร้อย', 'ปรับแต่งพื้นผิวสำหรับความปลอดภัยสายตากลางคืน');
    } else {
      document.documentElement.classList.remove('dark');
      addToast('info', 'เปลี่ยนเป็นโหมดสว่างเรียบร้อย', 'ปรับแต่งพื้นผิวแสงสว่างกระจายสม่ำเสมอ');
    }
  };

  const handleToggleSimulation = () => {
    const nextSim = !isSimulating;
    setIsSimulating(nextSim);
    localStorage.setItem('soc_backoffice_simulating', String(nextSim));
    addToast(
      nextSim ? 'success' : 'info',
      nextSim ? 'เปิดระบบจำลองแจ้งซ่อมแล้ว' : 'ปิดระบบจำลองแจ้งซ่อมแล้ว',
      nextSim ? 'คุณสามารถกดส่งใบคำร้องซ่อมใหม่เข้ามาที่ระบบในเวลาใดก็ได้' : 'ระบบจำลองจะไม่ทำงานในเบื้องหลัง'
    );
  };

  // 3. Simulated Real-time Report Trigger
  const handleTriggerNewReport = (newReport: Report) => {
    // Append report
    const updatedReports = [newReport, ...reports];
    setReports(updatedReports);
    saveReports(updatedReports);

    // Create a log entry
    const newLog: ReportLog = {
      id: `LOG-${Math.floor(Math.random() * 900000) + 100000}`,
      reportId: newReport.id,
      action: 'แจ้งเรื่องเข้าสู่ระบบ',
      oldStatus: null,
      newStatus: 'รับเรื่องแล้ว',
      note: 'คำร้องใหม่จำลองส่งผ่านหน้าแอปพลิเคชันนิสิตคณะสังคมศาสตร์สำเร็จ',
      createdBy: `${newReport.reporterName} (ผู้แจ้งเรื่อง)`,
      createdAt: newReport.createdAt
    };
    
    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    saveLogs(updatedLogs);

    // Notify administrator with Toast + Quick View Action
    addToast(
      'warning',
      `🚨 มีคำร้องเข้ามาใหม่! [${newReport.id}]`,
      `${newReport.title} - ${newReport.location}`,
      {
        label: 'ดูรายละเอียดทันที',
        onClick: () => {
          setSelectedReportId(newReport.id);
          setActiveView('report-detail');
        }
      }
    );
  };

  // 4. Report Status and Note updates from Detail View
  const handleUpdateReport = (
    id: string, 
    newStatus: ReportStatus, 
    notes: string, 
    operatorName: string
  ) => {
    let oldStatus: ReportStatus = 'รับเรื่องแล้ว';
    
    const updatedReports = reports.map(r => {
      if (r.id === id) {
        oldStatus = r.status;
        return {
          ...r,
          status: newStatus,
          notes: notes,
          updatedAt: new Date().toISOString()
        };
      }
      return r;
    });

    setReports(updatedReports);
    saveReports(updatedReports);

    // Create status change log
    const newLog: ReportLog = {
      id: `LOG-${Math.floor(Math.random() * 900000) + 100000}`,
      reportId: id,
      action: oldStatus === newStatus ? 'อัปเดตหมายเหตุงาน' : 'ปรับปรุงสถานะคำร้อง',
      oldStatus: oldStatus,
      newStatus: newStatus,
      note: notes || 'ปรับสถานะเรียบร้อยโดยเจ้าหน้าที่หลังบ้าน',
      createdBy: operatorName,
      createdAt: new Date().toISOString()
    };

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    saveLogs(updatedLogs);

    // Simulate smart Staff load updates
    // If we mark the report as completed, reduce that staff's active task count!
    const targetReport = reports.find(r => r.id === id);
    if (targetReport && targetReport.assignedStaff) {
      const updatedStaff = staff.map(st => {
        if (st.name === targetReport.assignedStaff) {
          if (newStatus === 'เสร็จสิ้น' && oldStatus !== 'เสร็จสิ้น') {
            return {
              ...st,
              activeTasks: Math.max(st.activeTasks - 1, 0),
              completedTasks: st.completedTasks + 1
            };
          }
          if (newStatus === 'กำลังดำเนินการ' && oldStatus === 'รับเรื่องแล้ว') {
            return {
              ...st,
              activeTasks: st.activeTasks + 1
            };
          }
        }
        return st;
      });
      setStaff(updatedStaff);
      saveStaff(updatedStaff);
    }

    addToast(
      'success',
      `บันทึกข้อมูลใบงาน ${id} สำเร็จ`,
      `ปรับสถานะเป็น [${newStatus}] พร้อมจัดเก็บประวัติบันทึก Log เรียบร้อย`
    );
  };

  // 5. System Settings Update Handler
  const handleSaveSettings = (updated: SystemSettings) => {
    setSettings(updated);
    saveSettings(updated);
    addToast('success', 'บันทึกการตั้งค่าแผงควบคุมหลักแล้ว', 'ปรับโครงสร้างเซิร์ฟเวอร์และระบบจ่ายงานเสร็จสิ้น');
  };

  // 6. CSV (Excel-Compatible) Report Exporter
  const handleExportExcel = (reportsToExport: Report[]) => {
    try {
      // Create headers
      const headers = ['เลขที่คำร้อง', 'หมวดหมู่หลัก', 'หมวดหมู่ย่อย', 'หัวข้อคำร้อง', 'สถานที่', 'ผู้แจ้ง', 'หน่วยงาน', 'เบอร์โทร', 'ความเร่งด่วน', 'สถานะล่าสุด', 'วันที่แจ้ง'];
      
      const csvRows = [headers.join(',')];

      reportsToExport.forEach(r => {
        const row = [
          `"${r.id}"`,
          `"${r.mainCategory}"`,
          `"${r.subCategory}"`,
          `"${r.title.replace(/"/g, '""')}"`,
          `"${r.location.replace(/"/g, '""')}"`,
          `"${r.reporterName}"`,
          `"${r.department}"`,
          `"${r.reporterPhone}"`,
          `"${r.priority}"`,
          `"${r.status}"`,
          `"${new Date(r.createdAt).toLocaleDateString('th-TH')}"`
        ];
        csvRows.push(row.join(','));
      });

      // Join rows with CRLF
      const csvString = csvRows.join('\r\n');
      
      // UTF-8 BOM to prevent Thai garbled characters in Excel!
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `รายงานรวมงานแจ้งซ่อม_คณะสังคมศาสตร์_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast('success', 'ดาวน์โหลดไฟล์รายงานเสร็จสมบูรณ์', `ดาวน์โหลดข้อมูลกรองจำนวน ${reportsToExport.length} แถว เรียบร้อย`);
    } catch (err) {
      addToast('error', 'ส่งออกข้อมูลล้มเหลว', 'กรุณาลองใหม่อีกครั้ง');
    }
  };

  // Navigation router helper
  const navigateToReportDetail = (id: string) => {
    setSelectedReportId(id);
    setActiveView('report-detail');
  };

  const getRouteLabel = () => {
    switch (activeView) {
      case 'dashboard':
        return '/backoffice';
      case 'reports':
        return '/backoffice/reports';
      case 'report-detail':
        return `/backoffice/reports/${selectedReportId}`;
      case 'departments':
        return '/backoffice/departments';
      case 'staff':
        return '/backoffice/staff';
      case 'analytics':
        return '/backoffice/reports/analytics';
      case 'settings':
        return '/backoffice/settings';
      default:
        return '/backoffice';
    }
  };

  const getViewHeaderName = () => {
    switch (activeView) {
      case 'dashboard':
        return '📊 แผงสรุปผลแอดมิน (Dashboard)';
      case 'reports':
        return '📋 บัญชีควบคุมคำร้องทั้งหมด';
      case 'report-detail':
        return '📑 รายละเอียดประกอบคำร้องเรียน';
      case 'departments':
        return '🏢 โครงสร้างและหน่วยงานในสังกัด';
      case 'staff':
        return '👥 รายงานรายชื่อพนักงานช่าง';
      case 'analytics':
        return '📈 รายงานสถิติผลงานเชิงวิเคราะห์';
      case 'settings':
        return '⚙️ แผงตั้งค่าและควบคุม RLS';
      default:
        return 'หน้าบริหารจัดการ';
    }
  };

  const getBreadcrumbs = () => {
    switch (activeView) {
      case 'dashboard':
        return [{ label: 'แดชบอร์ด', view: 'dashboard', active: true }];
      case 'reports':
        return [
          { label: 'แดชบอร์ด', view: 'dashboard' },
          { label: 'จัดการคำร้อง', view: 'reports', active: true }
        ];
      case 'report-detail':
        return [
          { label: 'แดชบอร์ด', view: 'dashboard' },
          { label: 'จัดการคำร้อง', view: 'reports' },
          { label: `รายละเอียดใบงาน ${selectedReportId}`, view: 'report-detail', active: true }
        ];
      case 'departments':
        return [
          { label: 'แดชบอร์ด', view: 'dashboard' },
          { label: 'โครงสร้างหน่วยงาน', view: 'departments', active: true }
        ];
      case 'staff':
        return [
          { label: 'แดชบอร์ด', view: 'dashboard' },
          { label: 'รายชื่อเจ้าหน้าที่', view: 'staff', active: true }
        ];
      case 'analytics':
        return [
          { label: 'แดชบอร์ด', view: 'dashboard' },
          { label: 'สถิติและวิเคราะห์', view: 'analytics', active: true }
        ];
      case 'settings':
        return [
          { label: 'แดชบอร์ด', view: 'dashboard' },
          { label: 'ตั้งค่าระบบ', view: 'settings', active: true }
        ];
      default:
        return [{ label: 'แดชบอร์ด', view: 'dashboard', active: true }];
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex transition-colors duration-200">
      
      {/* Toast Notification Mount point */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar Navigation */}
      <Sidebar 
        activeView={activeView} 
        onViewChange={(view) => {
          setActiveView(view);
          window.scrollTo(0, 0);
        }}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        isSimulating={isSimulating}
        onToggleSimulation={handleToggleSimulation}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 xl:pl-60">
        
        {/* Universal Top Header bar */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/60 h-16 flex items-center justify-between px-4 sm:px-6 md:px-8 no-print">
          
          <div className="flex items-center gap-3">
            {/* Hamburger trigger menu for mobile layout */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 xl:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer"
            >
              <Menu className="w-5.5 h-5.5" />
            </button>

            {/* Elegant Dynamic Breadcrumbs */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-850/50 px-4 py-1.5 rounded-full border border-slate-100/80 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 font-bold select-none text-[9px] uppercase tracking-wider bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">SYS</span>
              <span className="text-slate-400 dark:text-slate-500 font-bold select-none">คณะสังคมศาสตร์</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
              {getBreadcrumbs().map((bc, idx) => (
                <Fragment key={bc.view}>
                  {idx > 0 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  {bc.active ? (
                    <span className="text-slate-800 dark:text-slate-200 font-extrabold truncate max-w-[160px]">
                      {bc.label}
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveView(bc.view as any);
                        window.scrollTo(0, 0);
                      }}
                      className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer text-slate-500 dark:text-slate-400"
                    >
                      {bc.label}
                    </button>
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* User profile dropdown and simulated notices */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Simulation status indicator dot */}
            {isSimulating && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-lg animate-pulse-ring select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Real-time Active
              </span>
            )}

            {/* Notification placeholder */}
            <button 
              onClick={() => addToast('info', 'ไม่มีข้อความแจ้งเตือนค้างอยู่', 'ระบบตรวจพบการดำเนินงานล่าสุดทั้งหมดเป็นปกติ')}
              className="p-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full cursor-pointer relative"
            >
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </button>

            {/* User credentials banner */}
            <div className="flex items-center gap-2.5 pl-1.5 sm:border-l border-slate-100 dark:border-slate-800 h-8">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs select-none">
                <User className="w-4.5 h-4.5" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">แอดมินคณะสังคมศาสตร์</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">เจ้าหน้าที่ดูแลระบบกลาง</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Route View rendering with smooth fade transitions */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto no-scrollbar">
          
          {activeView === 'dashboard' && (
            <DashboardView 
              reports={reports} 
              onViewReport={navigateToReportDetail}
              onNavigateToReports={() => setActiveView('reports')}
            />
          )}

          {activeView === 'reports' && (
            <ReportsView 
              reports={reports} 
              onViewReport={navigateToReportDetail}
              onExportExcel={handleExportExcel}
            />
          )}

          {activeView === 'report-detail' && (
            <ReportDetailView 
              reportId={selectedReportId} 
              reports={reports}
              logs={logs}
              staff={staff}
              onBack={() => setActiveView('reports')}
              onUpdateReport={handleUpdateReport}
            />
          )}

          {activeView === 'departments' && (
            <DepartmentsView reports={reports} />
          )}

          {activeView === 'staff' && (
            <StaffView staff={staff} />
          )}

          {activeView === 'analytics' && (
            <AnalyticsView reports={reports} staff={staff} />
          )}

          {activeView === 'settings' && settings && (
            <SettingsView 
              settings={settings} 
              onSaveSettings={handleSaveSettings}
            />
          )}

        </main>
      </div>

      {/* Floating Real-time mock compiler client */}
      <RealTimeSimulator 
        onTriggerNewReport={handleTriggerNewReport}
        isSimulating={isSimulating}
      />
    </div>
  );
}
