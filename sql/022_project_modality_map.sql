-- AF-029: manually declared eligibility map per project/modality.
-- Criteria are tied to an immutable normative version; no legal eligibility inference.
CREATE TABLE public.project_modality_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 modality text NOT NULL CHECK (modality IN ('convenio','transferencia','financiamento','cooperacao','outra')),
 rule_number integer NOT NULL CHECK (rule_number BETWEEN 1 AND 200),
 criterion text NOT NULL CHECK (length(btrim(criterion)) BETWEEN 10 AND 500),
 normative_source_id uuid NOT NULL,
 normative_version_id uuid NOT NULL,
 normative_version integer NOT NULL CHECK (normative_version BETWEEN 1 AND 1000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (id,municipality_id,project_id),
 UNIQUE (municipality_id,project_id,modality,rule_number),
 FOREIGN KEY (project_id,municipality_id)
  REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY (normative_version_id,normative_source_id,normative_version,municipality_id)
  REFERENCES public.municipal_normative_versions(id,source_id,version,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY (created_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_modality_checks_tenant ON public.project_modality_checks
 (municipality_id,project_id,modality,rule_number);

CREATE TABLE public.project_modality_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 check_id uuid NOT NULL,
 revision integer NOT NULL CHECK (revision BETWEEN 1 AND 10000),
 status text NOT NULL CHECK (status IN ('pendente','atendido','nao_atendido','nao_aplicavel')),
 justification text NOT NULL CHECK(length(btrim(justification)) BETWEEN 10 AND 1000),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(check_id,revision),
 FOREIGN KEY(check_id,municipality_id,project_id)
  REFERENCES public.project_modality_checks(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_id,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_modality_review_tenant ON public.project_modality_review_events
 (municipality_id,project_id,check_id,revision DESC);

ALTER TABLE public.project_modality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_modality_checks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_modality_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_modality_review_events FORCE ROW LEVEL SECURITY;
CREATE POLICY modality_checks_tenant ON public.project_modality_checks
 USING (municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY modality_reviews_tenant ON public.project_modality_review_events
 USING (municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
