-- AF-028: base normativa INFORMADA pela equipe, privada por município.
-- Versões são snapshots históricos; não afirmam autenticidade ou vigência oficial.
CREATE TABLE public.municipal_normative_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 reference_code text NOT NULL CHECK(length(btrim(reference_code)) BETWEEN 3 AND 100
  AND reference_code ~ '^[A-Z0-9][A-Z0-9./ -]{2,99}$'),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 180),
 jurisdiction text NOT NULL CHECK(jurisdiction IN ('federal','estadual','municipal')),
 state_uf char(2),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id),
 UNIQUE(municipality_id,reference_code),
 CHECK((jurisdiction='federal' AND state_uf IS NULL)
  OR (jurisdiction IN ('estadual','municipal') AND state_uf ~ '^[A-Z]{2}$')),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
  ON DELETE RESTRICT
);
CREATE INDEX idx_normative_sources_tenant
 ON public.municipal_normative_sources(municipality_id,jurisdiction,reference_code);

CREATE TABLE public.municipal_normative_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 source_id uuid NOT NULL,
 version integer NOT NULL CHECK(version BETWEEN 1 AND 1000),
 source_url text NOT NULL CHECK(length(source_url) BETWEEN 12 AND 500 AND source_url ~ '^https://'),
 published_on date NOT NULL CHECK(published_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 valid_from date NOT NULL CHECK(valid_from BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 valid_until date CHECK(valid_until BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 source_section text NOT NULL CHECK(length(btrim(source_section)) BETWEEN 2 AND 120),
 excerpt text NOT NULL CHECK(length(btrim(excerpt)) BETWEEN 10 AND 1200),
 context_note text NOT NULL CHECK(length(btrim(context_note)) BETWEEN 10 AND 1000),
 snapshot_sha256 char(64) NOT NULL CHECK(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 created_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(source_id,version),
 UNIQUE(id,source_id,version,municipality_id),
 CHECK(valid_until IS NULL OR valid_until >= valid_from),
 FOREIGN KEY(source_id,municipality_id)
  REFERENCES public.municipal_normative_sources(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
  ON DELETE RESTRICT
);
CREATE INDEX idx_normative_versions_tenant
 ON public.municipal_normative_versions(municipality_id,source_id,version DESC);

ALTER TABLE public.municipal_normative_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_normative_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_normative_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_normative_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY normative_sources_tenant ON public.municipal_normative_sources
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY normative_versions_tenant ON public.municipal_normative_versions
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
