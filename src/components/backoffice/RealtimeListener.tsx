"use client";

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/contexts/NotificationContext';
import useSWR, { useSWRConfig } from 'swr';
import { fetcherWithAuth } from '@/lib/fetcher';
import { useStaffAuth } from '@/hooks/useStaffAuth';

export const RealtimeListener = () => {
  const { addNotification } = useNotification();
  const { user } = useStaffAuth();
  const { mutate } = useSWRConfig();
  const hasFetchedInitial = useRef(false);
  const { data } = useSWR(
    user && !hasFetchedInitial.current ? `/api/backoffice/pending-summary` : null,
    fetcherWithAuth,
    { 
      dedupingInterval: 60000,
      shouldRetryOnError: false,
      revalidateOnFocus: false
    }
  );

  useEffect(() => {
    if (data?.reports && !hasFetchedInitial.current) {
      hasFetchedInitial.current = true;
      const recentPending = data.reports.slice(0, 7);
      
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
  }, [data, addNotification]);

  useEffect(() => {
    const channel = supabase
      .channel('public:reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          // Invalidate all dashboard caches when new report arrives
          mutate(
            (key) => typeof key === 'string' && key.startsWith('/api/backoffice/dashboard'),
            undefined,
            { revalidate: true }
          );
          
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
          // Invalidate all dashboard caches when report is updated
          mutate(
            (key) => typeof key === 'string' && key.startsWith('/api/backoffice/dashboard'),
            undefined,
            { revalidate: true }
          );

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
