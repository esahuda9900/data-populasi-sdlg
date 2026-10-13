-- =============================================================================
-- SDLG POPULATION & DOCUMENT MONITOR - PRODUCTION DATABASE SCHEMA & POLICIES
-- Phase 1 hardened (2026-10-13)
-- Execute this script in your Supabase SQL Editor to enforce security, integrity,
-- views, and automated workflow triggers.
-- =============================================================================

-- 1. EXTENSIONS & INDEXES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure indexes for blazing fast search & filtering
CREATE INDEX IF NOT EXISTS idx_units_vin ON public.units (vin);
CREATE INDEX IF NOT EXISTS idx_units_unit_number ON public.units (unit_number);
CREATE INDEX IF NOT EXISTS idx_units_model ON public.units (model);
CREATE INDEX IF NOT EXISTS idx_units_under_cabang ON public.units (under_cabang);
CREATE INDEX IF NOT EXISTS idx_units_status ON public.units (status);
CREATE INDEX IF NOT EXISTS idx_units_year_delivery ON public.units (year_delivery);

CREATE INDEX IF NOT EXISTS idx_unit_process_vin ON public.unit_process (vin);
CREATE INDEX IF NOT EXISTS idx_unit_process_unit_id ON public.unit_process (unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_documents_unit_id ON public.unit_documents (unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_documents_status ON public.unit_documents (status);
CREATE INDEX IF NOT EXISTS idx_unit_documents_document_type_id ON public.unit_documents (document_type_id);
CREATE INDEX IF NOT EXISTS idx_unit_sales_unit_id ON public.unit_sales (unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_deliveries_unit_id ON public.unit_deliveries (unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_warranty_unit_id ON public.unit_warranty (unit_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_unit_id ON public.work_orders (unit_id);
CREATE INDEX IF NOT EXISTS idx_crm_records_unit_id ON public.crm_records (unit_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_imported_by ON public.import_logs (imported_by);

-- 2. STATUS CONSTRAINT (includes 'ready')
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_status_check;
ALTER TABLE public.units ADD CONSTRAINT units_status_check
  CHECK (status = ANY (ARRAY['aktif'::text, 'idle'::text, 'maintenance'::text, 'sold'::text, 'scrapped'::text, 'ready'::text]));

-- 3. ROW LEVEL SECURITY (RLS) HARDENING
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_process ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view/write all core data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read units' AND tablename = 'units') THEN
    CREATE POLICY "Authenticated users can read units" ON public.units FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update units' AND tablename = 'units') THEN
    CREATE POLICY "Authenticated users can update units" ON public.units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert units' AND tablename = 'units') THEN
    CREATE POLICY "Authenticated users can insert units" ON public.units FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete units' AND tablename = 'units') THEN
    CREATE POLICY "Authenticated users can delete units" ON public.units FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- 4. REALTIME REPLICATION
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'units') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.units;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'unit_process') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_process;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'unit_documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_documents;
  END IF;
END $$;

-- 5. VIEWS (SECURITY INVOKER)
CREATE OR REPLACE VIEW public.v_dashboard_compliance_metrics
WITH (security_invoker = true)
AS
SELECT
  COUNT(u.id) AS total_units,
  COUNT(u.id) FILTER (WHERE u.status = 'aktif') AS active_units,
  COUNT(u.id) FILTER (WHERE p.arrival_check = 'DONE') AS sudah_arrival,
  COUNT(u.id) FILTER (WHERE p.arrival_check IS NULL OR p.arrival_check = 'KOSONG') AS belum_arrival,
  COUNT(u.id) FILTER (WHERE p.pdi_check = 'DONE') AS sudah_pdi,
  COUNT(u.id) FILTER (WHERE p.pdi_check IS NULL OR p.pdi_check = 'KOSONG') AS belum_pdi,
  COUNT(u.id) FILTER (WHERE p.comm_check = 'DONE') AS sudah_comm,
  COUNT(u.id) FILTER (WHERE p.comm_check IS NULL OR p.comm_check = 'KOSONG') AS belum_comm,
  COUNT(u.id) FILTER (WHERE u.year_delivery = 2026) AS total_import_2026
FROM public.units u
LEFT JOIN public.unit_process p ON p.vin = u.vin;

-- 6. AUTOMATED WORKFLOW TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_unit_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vin IS NOT NULL AND NEW.vin <> '' THEN
    INSERT INTO public.unit_process (vin, unit_id, arrival_check, pdi_check, comm_check)
    VALUES (NEW.vin, NEW.id, 'KOSONG', 'KOSONG', 'KOSONG')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.unit_documents (unit_id, document_type_id, status)
  SELECT NEW.id, dt.id, 'missing'
  FROM public.document_types dt
  WHERE dt.is_required = true
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_unit_insert ON public.units;
CREATE TRIGGER trg_after_unit_insert
  AFTER INSERT ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_unit_created();

-- 7. handle_updated_at with search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 8. AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  table_name text NOT NULL,
  record_id uuid,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  field_name text,
  old_value text,
  new_value text,
  action text NOT NULL CHECK (action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  source text DEFAULT 'manual' CHECK (source = ANY (ARRAY['manual'::text, 'ai'::text, 'import'::text, 'system'::text])),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_unit_id ON public.audit_log (unit_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.audit_log (changed_by);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read audit_log' AND tablename = 'audit_log') THEN
    CREATE POLICY "Authenticated users can read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert audit_log' AND tablename = 'audit_log') THEN
    CREATE POLICY "Authenticated users can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 9. NOTE: Raw/legacy tables live in schema "staging"
-- (data tarikan oldp, data penjualan unit, data sju, data tarikan dari crm, data wo ax, data kumpulan semua data itr by lookup)
-- They are isolated from the public API surface. Access via service_role only if needed for ETL.
