-- ==============================================================================
-- SDLG POPULATION & DOCUMENT MONITOR - PRODUCTION DATABASE SCHEMA & POLICIES
-- Execute this script in your Supabase SQL Editor to enforce security, integrity,
-- views, and automated workflow triggers.
-- ==============================================================================

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
CREATE INDEX IF NOT EXISTS idx_unit_documents_unit_id ON public.unit_documents (unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_documents_status ON public.unit_documents (status);

-- 2. ROW LEVEL SECURITY (RLS) HARDENING
-- Enable RLS across all core tables
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_process ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all data
CREATE POLICY "Allow authenticated read on units"
  ON public.units FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update on units"
  ON public.units FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated insert on units"
  ON public.units FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on units"
  ON public.units FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on unit_process"
  ON public.unit_process FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update on unit_process"
  ON public.unit_process FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated insert on unit_process"
  ON public.unit_process FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read on document_types"
  ON public.document_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on unit_documents"
  ON public.unit_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated write on unit_documents"
  ON public.unit_documents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. REALTIME REPLICATION CONFIGURATION
-- Enable realtime publication for units, unit_process, and unit_documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'units'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.units;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'unit_process'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_process;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'unit_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_documents;
  END IF;
END $$;

-- 4. DATABASE VIEW FOR ULTRA-FAST AGGREGATION
-- Replaces heavy client-side calculations with instant database aggregation
CREATE OR REPLACE VIEW public.v_dashboard_compliance_metrics AS
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

-- 5. AUTOMATED WORKFLOW TRIGGER: CREATE CHECKLIST ON NEW UNIT
CREATE OR REPLACE FUNCTION public.handle_new_unit_created()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Ensure a process row exists for this unit
  IF NEW.vin IS NOT NULL AND NEW.vin <> '' THEN
    INSERT INTO public.unit_process (vin, arrival_check, pdi_check, comm_check)
    VALUES (NEW.vin, 'KOSONG', 'KOSONG', 'KOSONG')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 2. Populate required document slots from document_types
  INSERT INTO public.unit_documents (unit_id, document_type_id, status)
  SELECT NEW.id, dt.id, 'missing'
  FROM public.document_types dt
  WHERE dt.is_required = true
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_after_unit_insert ON public.units;
CREATE TRIGGER trg_after_unit_insert
  AFTER INSERT ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_unit_created();
