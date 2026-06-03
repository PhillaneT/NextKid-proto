-- Migration 028: super_admin role
-- Adds a super_admin role that grants Hub Mode access across all schools.
-- school_id is nullable for super_admins (they are not tied to one school).

-- 1. Drop the existing role check constraint
ALTER TABLE public.school_admins
  DROP CONSTRAINT IF EXISTS school_admins_role_check;

-- 2. Make school_id nullable (super_admins don't belong to one school)
ALTER TABLE public.school_admins
  ALTER COLUMN school_id DROP NOT NULL;

-- 3. Re-add the constraint with super_admin included
ALTER TABLE public.school_admins
  ADD CONSTRAINT school_admins_role_check
  CHECK (role IN ('klerebank_admin', 'super_admin'));

-- 4. Insert super_admin rows for both users (if they exist in auth.users)
INSERT INTO public.school_admins (user_id, school_id, role, active)
SELECT id, NULL, 'super_admin', true
FROM auth.users
WHERE email IN (
  'phillane.visagie@gmail.com',
  'phillane.troskie+buyer@gmail.com'
)
ON CONFLICT (user_id, school_id) DO UPDATE
  SET role = 'super_admin', active = true;
