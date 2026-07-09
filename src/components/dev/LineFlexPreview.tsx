import React from 'react';
export interface LineFlexMessageData {
  publicId: string;
  categoryLabel: string;
  description: string;
  location: string;
  date: string;
  mappedStatus: string;
}

interface LineFlexPreviewProps {
  data: LineFlexMessageData;
}

export const LineFlexPreview: React.FC<LineFlexPreviewProps> = ({ data }) => {
  return (
    <div
      style={{
        width: '100%',
        minWidth: '240px',
        maxWidth: '300px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: '#D1350F',
          alignItems: 'center',
          padding: '10px'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '32px',
            height: '32px',
            backgroundColor: '#E85D40',
            borderRadius: '16px',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <img
            src="/images/notification.svg"
            alt="Notification"
            style={{
              width: "22px",
              height: "22px",
               maxWidth: "none"
            }}
          />

        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: '12px'
          }}
        >
          <span
            style={{
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '12px',
              lineHeight: '1.2'
            }}
          >
            ONE STOP SERVICE
          </span>
          <span
            style={{
              color: '#ffffff',
              fontSize: '12px',
              marginTop: '2px',
              lineHeight: '1.2'
            }}
          >
            มีคำร้องใหม่เข้าสู่ระบบ
          </span>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '20px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
          <span style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: '4px', lineHeight: '1.2' }}>เลขอ้างอิง</span>
          <span style={{ color: '#1A1A2E', fontSize: '12px', wordBreak: 'break-word', lineHeight: '1.4' }}>{data.publicId}</span>
        </div>
        <div style={{ height: '1px', backgroundColor: '#f0f0f0', marginBottom: '12px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
          <span style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: '4px', lineHeight: '1.2' }}>หมวดหมู่</span>
          <span style={{ color: '#1A1A2E', fontSize: '12px', wordBreak: 'break-word', lineHeight: '1.4' }}>{data.categoryLabel}</span>
        </div>
        <div style={{ height: '1px', backgroundColor: '#f0f0f0', marginBottom: '12px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
          <span style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: '4px', lineHeight: '1.2' }}>หัวข้อ</span>
          <span style={{ color: '#1A1A2E', fontSize: '12px', wordBreak: 'break-word', lineHeight: '1.4' }}>{data.description}</span>
        </div>
        <div style={{ height: '1px', backgroundColor: '#f0f0f0', marginBottom: '12px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
          <span style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: '4px', lineHeight: '1.2' }}>สถานที่</span>
          <span style={{ color: '#1A1A2E', fontSize: '12px', wordBreak: 'break-word', lineHeight: '1.4' }}>{data.location}</span>
        </div>
        <div style={{ height: '1px', backgroundColor: '#f0f0f0', marginBottom: '12px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
          <span style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: '4px', lineHeight: '1.2' }}>วันที่แจ้ง</span>
          <span style={{ color: '#1A1A2E', fontSize: '12px', wordBreak: 'break-word', lineHeight: '1.4' }}>{data.date}</span>
        </div>
        <div style={{ height: '1px', backgroundColor: '#f0f0f0', marginBottom: '12px' }} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: '4px', lineHeight: '1.2' }}>สถานะ</span>
          <span style={{ color: '#1A1A2E', fontSize: '12px', wordBreak: 'break-word', lineHeight: '1.4' }}>{data.mappedStatus}</span>
        </div>
      </div>
    </div>
  );
};
