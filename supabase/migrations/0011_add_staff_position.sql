-- Migration 0011: Add position column to public.staff_users and populate verified official positions
ALTER TABLE public.staff_users
ADD COLUMN IF NOT EXISTS position TEXT NULL;

-- Update verified positions by email (strictly preserving id, email, full_name, department_id, role, auth_user_id, status)
UPDATE public.staff_users SET position = 'เจ้าหน้าที่บริหารงานทั่วไป' WHERE email = 'kasem.pu@ku.th';
UPDATE public.staff_users SET position = 'หัวหน้าหน่วยส่งเสริมการเรียนรู้' WHERE email = 'kewarin.y@ku.th';
UPDATE public.staff_users SET position = 'หัวหน้างานพัฒนากายภาพและสิ่งสนับสนุนการเรียนรู้' WHERE email = 'anchana.to@ku.th';
UPDATE public.staff_users SET position = 'หัวหน้าหน่วยกิจการนิสิต' WHERE email = 'patharakorn.s@ku.th';
UPDATE public.staff_users SET position = 'หัวหน้าหน่วยเทคโนโลยีการศึกษา' WHERE email = 'sorasak.m@ku.th';
UPDATE public.staff_users SET position = 'นักวิชาการศึกษา (ชำนาญการ)' WHERE email = 'wissanee.p@ku.th';
UPDATE public.staff_users SET position = 'หัวหน้าหน่วยพัฒนากายภาพ' WHERE email = 'akarawin.g@ku.th';
UPDATE public.staff_users SET position = 'นักวิชาการโสตทัศนศึกษา' WHERE email = 'panupong.piy@ku.th';
UPDATE public.staff_users SET position = 'บรรณารักษ์' WHERE email = 'phanintra.k@ku.th';
UPDATE public.staff_users SET position = 'เจ้าหน้าที่บริหารงานทั่วไป' WHERE email = 'chisanuphong.t@ku.th';
UPDATE public.staff_users SET position = 'หัวหน้างานบริการการศึกษา' WHERE email = 'nipaporn.i@ku.th';
UPDATE public.staff_users SET position = 'นักวิชาการโสตทัศนศึกษา' WHERE email = 'pasatorn.m@ku.th';
UPDATE public.staff_users SET position = 'นักวิชาการศึกษา' WHERE email = 'intuon.ra@ku.th';

-- Pending verification accounts: strictly keep NULL until verified
UPDATE public.staff_users SET position = NULL WHERE email IN ('pitchaya.s@ku.th', 'aeuranuch.t@ku.th');

