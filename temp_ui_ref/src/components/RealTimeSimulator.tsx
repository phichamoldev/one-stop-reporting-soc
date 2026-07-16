/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Zap, Send, BellRing, ChevronUp, ChevronDown } from 'lucide-react';
import { Report } from '../types';

interface RealTimeSimulatorProps {
  onTriggerNewReport: (newReport: Report) => void;
  isSimulating: boolean;
}

export const RealTimeSimulator: React.FC<RealTimeSimulatorProps> = ({
  onTriggerNewReport,
  isSimulating
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const mockTemplates = [
    {
      title: 'ปลั๊กไฟกำแพงชำรุด มีเสียงสปาร์กเบาๆ',
      description: 'เต้ารับตัวเมียบริเวณข้างกระดานไวท์บอร์ดห้องเรียน 1204 หลวมมาก เวลาเสียบสายชาร์จโน้ตบุ๊กแล้วเกิดประกายไฟแลบและมีกลิ่นไหม้เกรียม เกรงว่าจะเกิดเพลิงไหม้ได้ครับ',
      mainCategory: 'อาคารสถานที่' as const,
      subCategory: 'ระบบไฟฟ้าและแสงสว่าง',
      location: 'ห้องบรรยาย 1204 ชั้น 2 อาคาร 3 คณะสังคมศาสตร์',
      priority: 'เร่งด่วน' as const,
      reporterName: 'นายจักรภพ สุขดี',
      reporterEmail: 'jakkrapob.s@ku.th',
      reporterPhone: '081-112-2334',
      department: 'ภาควิชารัฐศาสตร์',
      imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop&q=80'
    },
    {
      title: 'แผ่นฝ้าเพดานชำรุดทรุดตัวลงมา เกรงว่าจะร่วงหล่น',
      description: 'แผ่นฝ้าบริเวณทางเดินตรงข้ามห้องสมุดเริ่มแอ่นตัวโค้งลงมาต่ำมากและมีรอยเปียกซึมสีน้ำตาลขนาดใหญ่จากน้ำแอร์รั่ว คาดว่าถ้าน้ำซึมต่อเนื่องฝ้าแผ่นนี้จะหักตกลงมาทับคนเดินผ่านไปมา',
      mainCategory: 'อาคารสถานที่' as const,
      subCategory: 'โครงสร้างและเฟอร์นิเจอร์',
      location: 'โถงทางเดินหลัก ชั้น 2 ตึก 1 ฝั่งซ้าย',
      priority: 'สูง' as const,
      reporterName: 'นางสาวพิจิตรา แก้วใส',
      reporterEmail: 'pijitra.k@soc.ku.ac.th',
      reporterPhone: '085-778-9900',
      department: 'ห้องสมุดคณะสังคมศาสตร์',
      imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&auto=format&fit=crop&q=80'
    },
    {
      title: 'อินเทอร์เน็ตของหน่วยงานขัดข้อง เข้าระบบไม่ได้',
      description: 'สายแลนและกล่องรับสัญญาณอินเทอร์เน็ตประจำแผนกศูนย์วิจัยสังคมศาสตร์มีไฟสีส้มกะพริบค้าง คอมพิวเตอร์ส่วนกลางทุกตัวเชื่อมต่อเครือข่ายไม่ได้ มีงานส่งรายงานด่วนบ่ายนี้',
      mainCategory: 'อินเทอร์เน็ต' as const,
      subCategory: 'สัญญาณเครือข่ายไร้สาย',
      location: 'ห้องศูนย์วิจัยสังคมศาสตร์ ชั้น 3 อาคาร 2',
      priority: 'สูง' as const,
      reporterName: 'ดร.พงศ์พันธุ์ ชูดี',
      reporterEmail: 'pongphan.c@ku.ac.th',
      reporterPhone: '089-665-1122',
      department: 'ศูนย์วิจัยสังคมศาสตร์',
      imageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'
    },
    {
      title: 'พบกลิ่นแก๊สเหม็นไหม้รุนแรงบริเวณลานเชื่อมต่ออาคาร',
      description: 'ได้กลิ่นสารเคมีหรือแก๊สหุงต้มลอยฟุ้งมาจากท่อน้ำทิ้งบริเวณระเบียงชั้น 1 ฝั่งสวนเชื่อมต่ออาคาร พยายามมองหาแหล่งกำเนิดกลิ่นแล้วแต่ไม่พบ รบกวนเจ้าหน้าที่มาช่วยตรวจวัดด่วน',
      mainCategory: 'สิ่งแวดล้อม' as const,
      subCategory: 'การขจัดขยะและสิ่งปฏิกูล',
      location: 'ทางเดินเชื่อมต่ออาคาร 1 และอาคาร 2 ชั้น 1',
      priority: 'เร่งด่วน' as const,
      reporterName: 'นางกาญจนา มั่นดี',
      reporterEmail: 'kanjana.m@soc.ku.ac.th',
      reporterPhone: '083-456-7890',
      department: 'สำนักงานคณบดี',
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop&q=80'
    }
  ];

  const handleSimulate = (template: typeof mockTemplates[0]) => {
    const timestamp = new Date().getTime();
    const formattedId = `SS-2026-0${Math.floor(Math.random() * 900) + 100}`;
    const newReport: Report = {
      ...template,
      id: formattedId,
      status: 'รับเรื่องแล้ว',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: ''
    };
    onTriggerNewReport(newReport);
  };

  if (!isSimulating) return null;

  return (
    <div className="fixed bottom-5 left-5 z-[80] max-w-xs w-full bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl overflow-hidden no-print">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-900 transition-colors text-xs font-black tracking-wider text-slate-200 outline-hidden cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-ring shrink-0" />
          <Zap className="w-4.5 h-4.5 text-amber-500 shrink-0" />
          <span>แผงส่งข้อมูลทดสอบ (Supabase Socket)</span>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {/* Templates body list */}
      {isExpanded && (
        <div className="p-4 space-y-3 max-h-72 overflow-y-auto no-scrollbar">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
            เลือกส่งคำร้องเรียนจากแบบฟอร์มด้านล่างจำลองการเชื่อมต่อ Real-time ของผู้ใช้งานผ่านแอปพลิเคชันหลักของคณะสังคมศาสตร์:
          </p>
          <div className="space-y-2">
            {mockTemplates.map((tpl, idx) => (
              <button
                key={idx}
                onClick={() => handleSimulate(tpl)}
                className="w-full text-left p-2.5 bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded-xl transition-all cursor-pointer text-[11px] font-semibold space-y-1 block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase bg-red-950/60 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded-md">
                    {tpl.priority}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold">{tpl.mainCategory}</span>
                </div>
                <p className="text-slate-100 truncate font-extrabold">{tpl.title}</p>
                <p className="text-[9px] text-slate-400 truncate font-semibold">📌 {tpl.location}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
