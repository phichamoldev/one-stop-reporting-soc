"use client";

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/contexts/NotificationContext';

export const RealtimeListener = () => {
  const { addNotification } = useNotification();
  const hasFetchedInitial = useRef(false);

  useEffect(() => {
    // Fetch initial recent pending reports via API to bypass RLS
    const fetchInitialNotifications = async () => {
      if (hasFetchedInitial.current) return;
      hasFetchedInitial.current = true;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const params = new URLSearchParams({ status: "pending" });
        const res = await fetch(`/api/backoffice/dashboard?${params.toString()}`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });
        
        if (res.ok) {
          const result = await res.json();
          if (result.reports && Array.isArray(result.reports)) {
            // Take the 7 most recent pending reports
            const recentPending = result.reports.slice(0, 7);
            
            // Reverse so they are added chronologically
            [...recentPending].reverse().forEach((report: any) => {
              addNotification({
                title: `🚨 มีคำร้องเข้ามาใหม่! [${report.public_id}]`,
                message: report.description || 'ไม่มีรายละเอียด',
                type: 'warning',
                link: `/backoffice/reports/${report.public_id}`,
                isSilent: true
              });
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch initial notifications:", error);
      }
    };
    
    fetchInitialNotifications();

    // Subscribe to new reports
    const channel = supabase
      .channel('public:reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          addNotification({
            title: `🚨 มีคำร้องเข้ามาใหม่! [${payload.new.public_id}]`,
            message: payload.new.description || 'ไม่มีรายละเอียด',
            type: 'warning',
            link: `/backoffice/reports/${payload.new.public_id}`
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reports' },
        (payload) => {
          if (payload.old && payload.old.category_id !== payload.new.category_id) {
            addNotification({
              title: '🚨 มีคำร้องถูกโอนมายังหน่วยงานของคุณ',
              message: `[${payload.new.public_id}] ${payload.new.title || 'ไม่มีหัวข้อ'}`,
              type: 'warning',
              link: `/backoffice/reports/${payload.new.public_id}`
            });
          } else if (payload.old && payload.old.status !== payload.new.status) {
            addNotification({
              title: 'สถานะคำร้องถูกอัปเดต',
              message: payload.new.title || 'ไม่มีหัวข้อ',
              type: 'success',
              link: `/backoffice/reports/${payload.new.public_id}`
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to reports real-time updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification]);

  return null;
};
