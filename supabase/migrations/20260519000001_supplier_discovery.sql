-- ============================================================
-- Supplier Discovery Module
-- Tables: discovered_suppliers, supplier_discovery_jobs
-- ============================================================

-- Discovered suppliers (candidates found via scraping/research)
CREATE TABLE IF NOT EXISTS discovered_suppliers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  company_name     TEXT NOT NULL,
  contact_person   TEXT,
  email            TEXT,
  phone            TEXT,
  website          TEXT,

  -- Location
  address          TEXT,
  state            TEXT,
  location         TEXT,

  -- Business / compliance
  gst_number       TEXT,
  iec_code         TEXT,
  fssai_license    TEXT,
  certifications   TEXT[]  DEFAULT '{}',
  organic_certified BOOLEAN DEFAULT false,

  -- Quality signals
  rating           DECIMAL(3,2),
  verified         BOOLEAN DEFAULT false,
  iec_verified     BOOLEAN DEFAULT false,

  -- Scraping metadata
  source           TEXT,
  source_url       TEXT,

  -- Scoring (0-100)
  total_score      INTEGER DEFAULT 0,

  -- Review status
  status           TEXT DEFAULT 'new'
                   CHECK (status IN ('new', 'approved', 'rejected')),
  rejection_reason TEXT,

  -- Testing flag — set true for sample/demo data
  is_test          BOOLEAN DEFAULT false,

  -- Timestamps
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disc_supp_score  ON discovered_suppliers(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_disc_supp_state  ON discovered_suppliers(state);
CREATE INDEX IF NOT EXISTS idx_disc_supp_status ON discovered_suppliers(status);
CREATE INDEX IF NOT EXISTS idx_disc_supp_source ON discovered_suppliers(source);
CREATE INDEX IF NOT EXISTS idx_disc_supp_test   ON discovered_suppliers(is_test);

-- auto-update updated_at (reuses the handle_updated_at() function from initial schema)
CREATE TRIGGER trg_discovered_suppliers_updated_at
  BEFORE UPDATE ON discovered_suppliers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE discovered_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discovered_suppliers: anon read"
  ON discovered_suppliers FOR SELECT TO anon USING (true);
CREATE POLICY "discovered_suppliers: anon insert"
  ON discovered_suppliers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "discovered_suppliers: anon update"
  ON discovered_suppliers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "discovered_suppliers: anon delete"
  ON discovered_suppliers FOR DELETE TO anon USING (true);

-- ============================================================

-- Scraping job tracking
CREATE TABLE IF NOT EXISTS supplier_discovery_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          TEXT UNIQUE NOT NULL,
  status          TEXT DEFAULT 'running'
                  CHECK (status IN ('running', 'completed', 'failed')),
  suppliers_found INTEGER DEFAULT 0,
  error_message   TEXT,
  is_test         BOOLEAN DEFAULT false,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disc_jobs_status ON supplier_discovery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_disc_jobs_start  ON supplier_discovery_jobs(started_at DESC);

ALTER TABLE supplier_discovery_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_discovery_jobs: anon read"
  ON supplier_discovery_jobs FOR SELECT TO anon USING (true);
CREATE POLICY "supplier_discovery_jobs: anon insert"
  ON supplier_discovery_jobs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "supplier_discovery_jobs: anon update"
  ON supplier_discovery_jobs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "supplier_discovery_jobs: anon delete"
  ON supplier_discovery_jobs FOR DELETE TO anon USING (true);
