-- ============================================================
-- Migration 018: School Registration & Klerebank Admin Role
--
-- Schools apply to become NextKid drop-off points (Klerebank).
-- Praesignis approves each application, then the school nominates
-- one or more Klerebank Admins who get a waybill-only view.
-- ============================================================


-- ── 1. Extend schools table with Klerebank registration fields ─────────────

ALTER TABLE schools ADD COLUMN IF NOT EXISTS klerebank_status   text DEFAULT NULL
  CHECK (klerebank_status IN ('pending', 'active', 'rejected'));
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_name       text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_email      text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_phone      text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS referral_code      text UNIQUE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS referred_by_school_id text REFERENCES schools(id);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS applied_at         timestamptz;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS approved_at        timestamptz;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS approved_by        uuid REFERENCES auth.users(id);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS rejection_reason   text;

CREATE INDEX IF NOT EXISTS idx_schools_klerebank ON schools(klerebank_status)
  WHERE klerebank_status IS NOT NULL;


-- ── 2. school_admins — links users to schools as Klerebank Admins ──────────
-- A user with an active row here gets the waybill-only admin view.
-- RULE: They may also hold a normal buyer/seller account — independent modes.

CREATE TABLE IF NOT EXISTS school_admins (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  school_id    text        NOT NULL REFERENCES schools(id),
  role         text        NOT NULL DEFAULT 'klerebank_admin'
               CHECK (role IN ('klerebank_admin')),
  active       boolean     NOT NULL DEFAULT false, -- false until invite accepted
  invited_by   uuid        REFERENCES auth.users(id),
  invite_token text        UNIQUE,                 -- one-time accept link token
  invited_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,                        -- set when admin accepts
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_admins_user_school
  ON school_admins(user_id, school_id);
CREATE INDEX IF NOT EXISTS idx_school_admins_school ON school_admins(school_id);
CREATE INDEX IF NOT EXISTS idx_school_admins_token  ON school_admins(invite_token)
  WHERE invite_token IS NOT NULL;


-- ── 3. school_bank_details — payout account for the school ─────────────────

CREATE TABLE IF NOT EXISTS school_bank_details (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           text NOT NULL REFERENCES schools(id) UNIQUE,
  bank_name           text NOT NULL,
  account_number      text NOT NULL,
  branch_code         text NOT NULL,
  account_holder_name text NOT NULL,
  verified            boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);


-- ── 4. Add super_admin role to profiles ────────────────────────────────────

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('buyer', 'seller', 'admin', 'super_admin'));


-- ── 5. RLS policies ────────────────────────────────────────────────────────

ALTER TABLE school_admins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_bank_details ENABLE ROW LEVEL SECURITY;

-- school_admins: admin can see their own row; super_admin sees all
CREATE POLICY "Admins can view their own school_admin row" ON school_admins FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all school_admins" ON school_admins FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- school_bank_details: only super_admin can view verified accounts
CREATE POLICY "Super admins manage bank details" ON school_bank_details FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Schools can see their own bank details
CREATE POLICY "School admins view their school bank details" ON school_bank_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_admins sa
      WHERE sa.school_id = school_bank_details.school_id
        AND sa.user_id = auth.uid()
        AND sa.active = true
    )
  );
