-- =============================================================================
-- P0 Security Foundation: user_profiles, account_requests, RLS by role
-- Date: 2026-10-15
-- Ref: docs/PRD.md §5.1
--
-- ORDER (important — do not skip):
-- 1. Run this migration
-- 2. Bootstrap admin (SQL at bottom) — esahuda9900@gmail.com
-- 3. Supabase Dashboard → Auth → Providers → Email → DISABLE "Enable sign ups"
-- 4. Deploy frontend that gates on user_profiles
--
-- Rollback: see end of file
-- =============================================================================

-- 1. user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  cabang text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles (role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles (is_active);

-- 2. account_requests
CREATE TABLE IF NOT EXISTS public.account_requests (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  full_name text NOT NULL,
  email text NOT NULL,
  cabang text,
  requested_role text NOT NULL CHECK (requested_role IN ('operator', 'viewer')),
  reason text,
  phone text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_requests_status ON public.account_requests (status);
CREATE INDEX IF NOT EXISTS idx_account_requests_email ON public.account_requests (email);
CREATE INDEX IF NOT EXISTS idx_account_requests_created_at ON public.account_requests (created_at DESC);

-- 3. Helper: current user role (SECURITY DEFINER, fixed search_path)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'operator')
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
REVOKE ALL ON FUNCTION public.can_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write() TO authenticated;

-- 4. updated_at trigger for user_profiles
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. RLS: user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON public.user_profiles;

CREATE POLICY "users_read_own_profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "admin_manage_profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. RLS: account_requests
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_account_request" ON public.account_requests;
DROP POLICY IF EXISTS "admin_read_account_requests" ON public.account_requests;
DROP POLICY IF EXISTS "admin_update_account_requests" ON public.account_requests;

CREATE POLICY "anon_insert_account_request" ON public.account_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "admin_read_account_requests" ON public.account_requests
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_update_account_requests" ON public.account_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. Harden core tables
DROP POLICY IF EXISTS "Authenticated users can read units" ON public.units;
DROP POLICY IF EXISTS "Authenticated users can update units" ON public.units;
DROP POLICY IF EXISTS "Authenticated users can insert units" ON public.units;
DROP POLICY IF EXISTS "Authenticated users can delete units" ON public.units;

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_users_select_units" ON public.units
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "writers_insert_units" ON public.units
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write());

CREATE POLICY "writers_update_units" ON public.units
  FOR UPDATE TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

CREATE POLICY "admin_delete_units" ON public.units
  FOR DELETE TO authenticated
  USING (public.is_admin());

ALTER TABLE public.unit_process ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "active_users_select_unit_process" ON public.unit_process;
DROP POLICY IF EXISTS "writers_write_unit_process" ON public.unit_process;

CREATE POLICY "active_users_select_unit_process" ON public.unit_process
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "writers_write_unit_process" ON public.unit_process
  FOR ALL TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

ALTER TABLE public.unit_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "active_users_select_unit_documents" ON public.unit_documents;
DROP POLICY IF EXISTS "writers_write_unit_documents" ON public.unit_documents;

CREATE POLICY "active_users_select_unit_documents" ON public.unit_documents
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "writers_write_unit_documents" ON public.unit_documents
  FOR ALL TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "active_users_select_document_types" ON public.document_types;
DROP POLICY IF EXISTS "admin_write_document_types" ON public.document_types;

CREATE POLICY "active_users_select_document_types" ON public.document_types
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "admin_write_document_types" ON public.document_types
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "active_users_select_audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "writers_insert_audit_log" ON public.audit_log;

CREATE POLICY "active_users_select_audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "writers_insert_audit_log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write() AND changed_by = auth.uid());

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'unit_sales', 'unit_deliveries', 'work_orders', 'crm_records',
    'unit_warranty', 'import_logs', 'unit_oldp_flags'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS active_users_select_%I ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS writers_write_%I ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY active_users_select_%I ON public.%I FOR SELECT TO authenticated USING (public.is_active_user())',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY writers_write_%I ON public.%I FOR ALL TO authenticated USING (public.can_write()) WITH CHECK (public.can_write())',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- BOOTSTRAP ADMIN (run as service role after migration):
-- INSERT INTO public.user_profiles (id, full_name, role, is_active)
-- SELECT id, 'Admin ITU', 'admin', true
-- FROM auth.users
-- WHERE email = 'esahuda9900@gmail.com'
-- ON CONFLICT (id) DO UPDATE
--   SET role = 'admin', is_active = true;

-- ROLLBACK: DROP TABLE account_requests, user_profiles; DROP FUNCTIONS; restore old policies from supabase-schema.sql
