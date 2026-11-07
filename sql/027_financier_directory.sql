-- AF-034: municipal registry of NATIONAL funder references, manually curated.
-- This is NOT an authoritative live funder or currently-open credit catalog.
-- Historical sources are immutable. The web role only gets SELECT and INSERT.
CREATE TABLE public.municipal_financiers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 reference_code text NOT NULL CHECK(length(btrim(reference_code)) BETWEEN 3 AND 60
  AND reference_code ~ '^[A-Z0-9][A-Z0-9 ._/-]{2,59}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 5 AND 180),
 institution_type text NOT NULL CHECK(institution_type IN
  ('banco_publico','agencia_publica','fundacao','banco_privado','cooperativa','outro')),
 financing_modalities text[] NOT NULL CHECK(
  cardinality(financing_modalities) BETWEEN 1 AND 6
  AND financing_modalities <@ ARRAY[
   'credito','transferencia','subvencao','doacao','garantia','cooperacao_tecnica']::text[]),
 thematic_areas text[] NOT NULL CHECK(
  cardinality(thematic_areas) BETWEEN 1 AND 12
  AND thematic_areas <@ ARRAY[
   'saude','educacao','saneamento','mobilidade','habitacao','agricultura',
   'cultura','esporte','assistencia','tecnologia','meio_ambiente',
   'infraestrutura','multissetorial']::text[]),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(municipality_id,reference_code),
 UNIQUE(id,municipality_id),
 FOREIGN KEY(created_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_financiers_tenant ON public.municipal_financiers
 (municipality_id,institution_type,name,id);

CREATE TABLE public.municipal_financier_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 financier_id uuid NOT NULL,
 version integer NOT NULL CHECK(version BETWEEN 1 AND 1000),
 reference_url text NOT NULL
  CHECK(length(reference_url) BETWEEN 12 AND 500 AND reference_url ~ '^https://'),
 reference_title text NOT NULL CHECK(length(btrim(reference_title)) BETWEEN 5 AND 180),
 reference_section text NOT NULL CHECK(length(btrim(reference_section)) BETWEEN 3 AND 120),
 check_status text NOT NULL CHECK(check_status IN
  ('referencia_informada','consultada_internamente','revisao_necessaria')),
 checked_on date CHECK(checked_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 evidence_note text NOT NULL CHECK(length(btrim(evidence_note)) BETWEEN 20 AND 1000),
 snapshot_sha256 char(64) NOT NULL CHECK(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 recorded_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(financier_id,version),
 UNIQUE(id,financier_id,municipality_id),
 CHECK(check_status <> 'consultada_internamente' OR checked_on IS NOT NULL),
 FOREIGN KEY(financier_id,municipality_id)
  REFERENCES public.municipal_financiers(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_financier_versions_tenant ON public.municipal_financier_versions
 (municipality_id,financier_id,version DESC);

ALTER TABLE public.municipal_financiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_financiers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_financier_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_financier_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY financiers_tenant ON public.municipal_financiers
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY financier_versions_tenant ON public.municipal_financier_versions
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND recorded_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
