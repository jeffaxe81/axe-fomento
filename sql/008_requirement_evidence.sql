-- AF-013/014: regras por fonte declarada e diagnóstico humano por projeto.
-- Estas regras não certificam elegibilidade, vigência ou autenticidade do edital.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_requirement_fk
  ON public.projects(id, municipality_id, opportunity_id);

CREATE TABLE public.opportunity_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  requirement text NOT NULL CHECK(length(btrim(requirement)) BETWEEN 10 AND 500),
  mandatory boolean NOT NULL DEFAULT true,
  source_url text NOT NULL CHECK(length(source_url)<=600 AND source_url ~ '^https://'),
  source_version varchar(100) NOT NULL CHECK(length(btrim(source_version)) BETWEEN 1 AND 100),
  source_section varchar(120) NOT NULL CHECK(length(btrim(source_section)) BETWEEN 1 AND 120),
  evidence_excerpt text NOT NULL CHECK(length(btrim(evidence_excerpt)) BETWEEN 10 AND 1200),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT opportunity_requirements_actor FOREIGN KEY(created_by,municipality_id)
    REFERENCES public.users(id,municipality_id),
  CONSTRAINT opportunity_requirements_ident UNIQUE(id,municipality_id,opportunity_id)
);
CREATE INDEX idx_opportunity_requirements_tenant
  ON public.opportunity_requirements(municipality_id,opportunity_id,created_at,id);

CREATE TABLE public.project_requirement_assessments (
  municipality_id uuid NOT NULL,
  project_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  status text NOT NULL CHECK(status IN ('atendido','nao_atendido','pendente')),
  evidence_note text NOT NULL DEFAULT '' CHECK(length(evidence_note)<=1000
    AND (status='pendente' OR length(btrim(evidence_note))>=10)),
  assessed_by uuid NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(project_id,requirement_id),
  FOREIGN KEY(project_id,municipality_id,opportunity_id)
    REFERENCES public.projects(id,municipality_id,opportunity_id) ON DELETE CASCADE,
  FOREIGN KEY(requirement_id,municipality_id,opportunity_id)
    REFERENCES public.opportunity_requirements(id,municipality_id,opportunity_id),
  FOREIGN KEY(assessed_by,municipality_id)
    REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_requirement_assessments_tenant
  ON public.project_requirement_assessments(municipality_id,project_id,status);

CREATE TABLE public.project_requirement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL,
  project_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  status text NOT NULL CHECK(status IN ('atendido','nao_atendido','pendente')),
  evidence_note text NOT NULL CHECK(length(evidence_note)<=1000),
  actor_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(project_id,municipality_id,opportunity_id)
    REFERENCES public.projects(id,municipality_id,opportunity_id) ON DELETE CASCADE,
  FOREIGN KEY(requirement_id,municipality_id,opportunity_id)
    REFERENCES public.opportunity_requirements(id,municipality_id,opportunity_id),
  FOREIGN KEY(actor_id,municipality_id)
    REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_requirement_events_tenant
  ON public.project_requirement_events(municipality_id,project_id,recorded_at DESC);

ALTER TABLE public.opportunity_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_requirement_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_requirement_assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_requirement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_requirement_events FORCE ROW LEVEL SECURITY;

CREATE POLICY opportunity_requirements_tenant ON public.opportunity_requirements
  USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
    AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY project_requirement_assessments_tenant ON public.project_requirement_assessments
  USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
    AND assessed_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY project_requirement_events_tenant ON public.project_requirement_events
  USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
    AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
