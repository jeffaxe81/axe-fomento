-- AF-009/010/011: staging de programas, versões e revisões.
-- Programas não são automaticamente editais ou oportunidades abertas.
CREATE TABLE IF NOT EXISTS public.source_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
  source_key text NOT NULL DEFAULT 'transferegov-parcerias-programa'
    CHECK (source_key = 'transferegov-parcerias-programa'),
  external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 100),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 180),
  source_url text NOT NULL CHECK (source_url = 'https://api-publica.transferegov.gestao.gov.br/parcerias/programa'),
  checksum char(64) NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  review_state text NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewer_id uuid,
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT source_program_identity UNIQUE(municipality_id,source_key,external_id),
  CONSTRAINT source_program_tenant_identity UNIQUE(id,municipality_id),
  CONSTRAINT source_program_reviewer FOREIGN KEY (reviewer_id,municipality_id)
    REFERENCES public.users(id,municipality_id) ON DELETE SET NULL(reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_source_program_pending
  ON public.source_programs(municipality_id,review_state,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.source_program_versions (
  program_id uuid NOT NULL,
  municipality_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>=1),
  checksum char(64) NOT NULL CHECK(checksum ~ '^[0-9a-f]{64}$'),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(program_id,version),
  FOREIGN KEY(program_id,municipality_id)
    REFERENCES public.source_programs(id,municipality_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_source_program_versions_tenant
  ON public.source_program_versions(municipality_id,program_id,version DESC);

CREATE TABLE IF NOT EXISTS public.source_program_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL,
  program_id uuid NOT NULL,
  version integer NOT NULL,
  reviewer_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  justification text NOT NULL CHECK(length(btrim(justification)) BETWEEN 10 AND 1000),
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(program_id,version) REFERENCES public.source_program_versions(program_id,version),
  FOREIGN KEY(program_id,municipality_id)
    REFERENCES public.source_programs(id,municipality_id),
  FOREIGN KEY(reviewer_id,municipality_id)
    REFERENCES public.users(id,municipality_id)
);
CREATE INDEX IF NOT EXISTS idx_source_program_reviews_tenant
  ON public.source_program_reviews(municipality_id,program_id,reviewed_at DESC);

CREATE TABLE IF NOT EXISTS public.source_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  source_key text NOT NULL DEFAULT 'transferegov-parcerias-programa'
    CHECK(source_key='transferegov-parcerias-programa'),
  status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','success','error')),
  found_count integer NOT NULL DEFAULT 0 CHECK(found_count>=0),
  changed_count integer NOT NULL DEFAULT 0 CHECK(changed_count>=0),
  error_summary varchar(240),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  FOREIGN KEY(actor_id,municipality_id)
    REFERENCES public.users(id,municipality_id)
);
CREATE INDEX IF NOT EXISTS idx_source_ingestion_runs_tenant
  ON public.source_ingestion_runs(municipality_id,started_at DESC);

ALTER TABLE public.source_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_program_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_program_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.source_program_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.source_program_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.source_ingestion_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS source_programs_tenant ON public.source_programs;
CREATE POLICY source_programs_tenant ON public.source_programs
  USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS source_program_versions_tenant ON public.source_program_versions;
CREATE POLICY source_program_versions_tenant ON public.source_program_versions
  USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS source_program_reviews_tenant ON public.source_program_reviews;
CREATE POLICY source_program_reviews_tenant ON public.source_program_reviews
  USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS source_ingestion_runs_tenant ON public.source_ingestion_runs;
CREATE POLICY source_ingestion_runs_tenant ON public.source_ingestion_runs
  USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
