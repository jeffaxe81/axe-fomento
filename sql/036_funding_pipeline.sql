-- AF-051..065: evidenced municipal financing pipeline. No automatic eligibility/award.
-- Append-only observations and case events; operational GO remains gated.
CREATE TABLE public.funding_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
 source text NOT NULL CHECK(source IN('transferegov','bndes','tesouro_capag','other_official')),
 external_code text NOT NULL CHECK(length(btrim(external_code)) BETWEEN 2 AND 100),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 6 AND 220),
 source_url text NOT NULL CHECK(length(source_url) BETWEEN 16 AND 500),
 modality text NOT NULL CHECK(modality IN('transferencia','convenio','credito','cooperacao','outro')),
 observation_kind text NOT NULL CHECK(observation_kind IN('programa_observado','linha_referenciada','capag_publicacao','oportunidade_conferida')),
 reference_status text NOT NULL CHECK(reference_status IN('nao_confirmada','conferida_por_operador','atualizacao_necessaria')),
 opens_on date,
 closes_on date,
 terms jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(terms)='object'),
 checked_on date,
 evidence_note text NOT NULL CHECK(length(btrim(evidence_note)) BETWEEN 15 AND 1500),
 fingerprint char(64) NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id),
 CHECK(closes_on IS NULL OR opens_on IS NULL OR closes_on>=opens_on),
 CHECK(observation_kind <> 'oportunidade_conferida' OR
  (reference_status='conferida_por_operador' AND checked_on IS NOT NULL))
);
CREATE INDEX funding_observations_lookup ON public.funding_observations
 (municipality_id,source,external_code,created_at DESC,id DESC);
CREATE TABLE public.funding_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
 project_id uuid NOT NULL,
 observation_id uuid NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id),
 UNIQUE(id,municipality_id,project_id),
 UNIQUE(municipality_id,project_id,observation_id),
 FOREIGN KEY(project_id,municipality_id) REFERENCES public.projects(id,municipality_id),
 FOREIGN KEY(observation_id,municipality_id) REFERENCES public.funding_observations(id,municipality_id),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX funding_cases_lookup ON public.funding_cases(municipality_id,created_at DESC,id);
CREATE TABLE public.funding_case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 case_id uuid NOT NULL,
 event_kind text NOT NULL CHECK(event_kind IN(
  'eligibility','line_comparison','financial_simulation','documentation_check',
  'dossier','submission_handoff','protocol_update','diligence_alert',
  'award_verification','disbursement_verification','decision_review')),
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 10000),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 15 AND 1500),
 evidence_url text,
 evidence_version_id uuid,
 value_cents bigint CHECK(value_cents>=0),
 event_date date,
 content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(content)='object'),
 fingerprint char(64) NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(case_id,revision),UNIQUE(id,municipality_id),
 FOREIGN KEY(case_id,municipality_id) REFERENCES public.funding_cases(id,municipality_id),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX funding_events_lookup ON public.funding_case_events
 (municipality_id,case_id,revision DESC);
CREATE TABLE public.funding_alert_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
 user_id uuid NOT NULL,
 modality text NOT NULL CHECK(modality IN('transferencia','convenio','credito','cooperacao','outro','todas')),
 days_ahead smallint NOT NULL CHECK(days_ahead IN(7,30,90)),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(municipality_id,user_id,modality,days_ahead),
 FOREIGN KEY(user_id,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX funding_alert_subscriptions_lookup ON public.funding_alert_subscriptions(municipality_id,user_id,is_active);
DO $$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY[
 'funding_observations','funding_cases','funding_case_events','funding_alert_subscriptions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',name);
 END LOOP;
END $$;
CREATE POLICY funding_observations_tenant ON public.funding_observations
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY funding_cases_tenant ON public.funding_cases
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY funding_events_tenant ON public.funding_case_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY funding_alerts_tenant ON public.funding_alert_subscriptions
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND user_id=NULLIF(current_setting('app.actor_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND user_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
