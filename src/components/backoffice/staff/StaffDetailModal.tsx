import React, { useState, useEffect } from "react";
import { X, Clock, CheckCircle2, AlertTriangle, XCircle, Ban, Activity } from "lucide-react";


interface StaffDetailModalProps {
  staff: any;
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const StaffDetailModal: React.FC<StaffDetailModalProps> = ({ staff, isOpen, onClose, token }) => {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/backoffice/staff/${staff.id}/timeline`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setTimeline(data.timeline || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && staff) {
      fetchTimeline();
    }
  }, [isOpen, staff, token]);

  if (!isOpen || !staff) return null;

  const { stats } = staff;
  const initial = staff.full_name ? staff.full_name.charAt(0) : "?";

  return (
    <>
      <div className={`fixed inset-0 z-[100] flex justify-end bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <div
          onClick={onClose}
          className="absolute inset-0"
        />
        <div
          className={`relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-100 dark:border-slate-800 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">รายละเอียดเจ้าหน้าที่</h2>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {/* Profile Section */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-[#D1350F] text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-red-500/20">
                  {initial}
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-slate-800 dark:text-slate-100">{staff.full_name}</h3>
                  <p className="text-sm text-slate-500 font-medium">{staff.email}</p>
                  <p className="text-xs text-slate-400 mt-1">{staff.departments?.name_th || "ไม่มีสังกัด"}</p>
                </div>
              </div>
            </div>

            {/* Performance Summary */}
            <div className="p-6">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Performance Summary
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-500 mb-1">งานทั้งหมด</p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{stats.total}</p>
                </div>
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
                  <p className="text-xs font-bold text-green-600 mb-1">เสร็จสิ้น</p>
                  <p className="text-2xl font-extrabold text-green-700 dark:text-green-400">{stats.completed}</p>
                </div>
              </div>
            </div>

            {/* Timeline Section */}
            <div className="p-6 pt-0">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6">Timeline การทำงาน</h4>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-400">ยังไม่มีประวัติการทำงาน</p>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {timeline.map((log, i) => (
                    <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-primary">{log.reports?.public_id}</span>
                          <time className="text-[10px] font-medium text-slate-400">
                            {new Date(log.created_at).toLocaleDateString('th-TH')}
                          </time>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{log.action}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2">{log.remark || log.reports?.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
