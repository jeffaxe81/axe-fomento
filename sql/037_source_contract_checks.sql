-- V1 preflight: immutable proof of OpenAPI documentation snapshots.
-- This is NOT verification that a loan/edital is live or that a municipality qualifies.
CREATE TABLE public.source_contract_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
 source text NOT NULL CHECK(source IN('parcerias','discricionarias')),
 schema_url text NOT NULL CHECK(schema_url IN(
  'https://api-publica.transferegov.gestao.gov.br/parcerias/openapi.json',
  'https://api-publica.transferegov.gestao.gov.br/discricionarias/openapi.json'
 )),
 result text NOT NULL CHECK(result IN('documented','incompatible','unavailable')),
 schema_digest char(64) CHECK(schema_digest IS NULL OR schema_digest ~ '^[a-f0-9]{64}$'),
 openapi_version text CHECK(length(openapi_version)<=20),
 route_count integer CHECK(route_count BETWEEN 0 AND 2000),
 candidate_routes jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK(jsonb_typeof(candidate_routes)='array' AND jsonb_array_length(candidate_routes)<=30),
 message text NOT NULL CHECK(length(message) BETWEEN 20 AND 300),
 created_by uuid NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id),
 CHECK((result='documented' AND schema_digest IS NOT NULL AND route_count>0) OR
  (result<>'documented' AND schema_digest IS NULL))
);
CREATE INDEX source_contract_checks_latest ON public.source_contract_checks
 (municipality_id,source,checked_at DESC,id DESC);
ALTER TABLE public.source_contract_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_contract_checks FORCE ROW LEVEL SECURITY;
CREATE POLICY source_contract_checks_tenant ON public.source_contract_checks
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
