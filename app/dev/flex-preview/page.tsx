import React from 'react';
import { LineFlexPreview } from '@/components/dev/LineFlexPreview';
import { AppContainer } from '@/components/design-system/AppContainer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dev: LINE Flex Preview',
};

export default function FlexPreviewPage() {
  const mockData = {
    publicId: "SOC-78992",
    categoryLabel: "เทคโนโลยีสารสนเทศ (IT)",
    description: "อินเทอร์เน็ตใช้งานไม่ได้",
    location: "อาคาร 1 ห้อง 1104",
    date: "8 ก.ค. 2569 16:14 น.",
    mappedStatus: "🟡 รอรับเรื่อง"
  };

  return (
    <AppContainer className="!bg-[#8bb0c6] dark:!bg-[#8bb0c6] !p-0">
      <div className="flex flex-col h-full w-full relative max-h-screen">
        {/* Header simulation */}
        <div className="bg-[#262626] text-white flex items-center px-4 py-3 sticky top-0 z-10 shadow-sm shrink-0">
          <div className="flex-1 flex items-center">
            <span className="text-2xl mr-4 leading-none pb-1 font-light">&lsaquo;</span>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">ONE STOP SERVICE</span>
            </div>
          </div>
          <div className="flex space-x-4 text-xl">
            <span>&#9787;</span>
            <span>&#8801;</span>
          </div>
        </div>
        
        {/* Chat area */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col bg-[#8bb0c6]">
          <div className="flex justify-center mb-6 mt-2">
            <div className="bg-black/20 text-white text-[11px] px-3 py-1 rounded-full">
              วันนี้
            </div>
          </div>
          
          <div className="w-full flex justify-start items-start mb-4">
            <div className="w-9 h-9 rounded-full bg-[#D1350F] flex-shrink-0 mr-2 flex items-center justify-center text-white font-bold text-[10px] shadow-sm mt-1 overflow-hidden">
              <img src="/images/notification.svg" alt="bot" className="w-5 h-5 opacity-80" />
            </div>
            <div className="flex flex-col max-w-[calc(100%-3rem)]">
              <span className="text-xs text-white/90 mb-1 ml-1 text-shadow-sm font-medium">ONE STOP SERVICE</span>
              <div className="flex items-end">
                <LineFlexPreview data={mockData} />
                <span className="text-[10px] text-white/80 ml-2 mb-1 whitespace-nowrap">16:14</span>
              </div>
            </div>
          </div>

          <div className="mt-8 mx-auto bg-black/10 text-white/80 text-[10px] px-4 py-2 rounded-lg text-center max-w-[250px]">
            <p className="font-semibold mb-1">Development Only</p>
            <p>This is a simulated LINE environment.</p>
            <p>No real API calls are made here.</p>
          </div>
        </div>
        
        {/* Input simulation */}
        <div className="bg-white p-3 flex items-center gap-3 shrink-0 border-t border-gray-200">
          <div className="w-6 h-6 rounded-full border-[1.5px] border-gray-400 flex items-center justify-center text-gray-400 pb-0.5 font-medium text-lg">+</div>
          <div className="w-6 h-6 rounded-full border-[1.5px] border-gray-400 flex items-center justify-center text-gray-400 pb-1 font-medium text-lg">-</div>
          <div className="flex-1 bg-gray-100 rounded-full h-9 px-4 flex items-center text-gray-400 text-sm">Aa</div>
          <div className="w-6 h-6 flex items-center justify-center text-gray-400 text-xl font-bold">☺</div>
        </div>
      </div>
    </AppContainer>
  );
}
