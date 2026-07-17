-- Migration for Settings Page MVP

-- 1. Add status column to staff_users to support soft delete (disable/enable)
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active';

-- 2. Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial seed for system_settings
INSERT INTO system_settings (key, value) VALUES 
('system_profile', '{"systemName": "One Stop Reporting System", "organizationName": "SOC", "supportEmail": "support@soc.example.com"}'),
('security_config', '{"minPasswordLength": 8, "sessionTimeout": 60, "maxLoginAttempts": 5}')
ON CONFLICT (key) DO NOTHING;

-- 3. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR NOT NULL,
  target VARCHAR,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Assuming existing RLS structure requires it)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Optional policies to secure them
CREATE POLICY "Super Admins can manage system settings" 
ON system_settings 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM staff_users 
    WHERE staff_users.id = auth.uid() 
    AND staff_users.role = 'super_admin'
  )
);

CREATE POLICY "Super Admins can view system settings" 
ON system_settings 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM staff_users 
    WHERE staff_users.id = auth.uid() 
  )
);

CREATE POLICY "Super Admins can view audit logs"
ON audit_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM staff_users 
    WHERE staff_users.id = auth.uid() 
    AND staff_users.role = 'super_admin'
  )
);

CREATE POLICY "Super Admins can insert audit logs"
ON audit_logs
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_users 
    WHERE staff_users.id = auth.uid() 
    AND staff_users.role = 'super_admin'
  )
);
