-- AF-042..049: preparação, evidências exatas, rubricas e avaliações imutáveis.
-- Registros internos não atestam elegibilidade, aprovação ou viabilidade jurídica.
CREATE UNIQUE INDEX idx_readiness_document_tenant ON public.project_document_versions(id,municipality_id,project_id);
CREATE UNIQUE INDEX idx_readiness_budget_tenant ON public.project_budget_items(id,municipality_id,project_id);

CREATE TABLE public.project_readiness_ideas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 version integer NOT NULL CHECK(version BETWEEN 1 AND 1000),
 problem text NOT NULL CHECK(length(btrim(problem)) BETWEEN 20 AND 2000),
 audience text NOT NULL CHECK(length(btrim(audience)) BETWEEN 10 AND 1000),
 objective text NOT NULL CHECK(length(btrim(objective)) BETWEEN 20 AND 2000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id),
 UNIQUE(project_id,version),
 FOREIGN KEY(project_id,municipality_id) REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);

CREATE TABLE public.municipal_readiness_rubrics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version BETWEEN 1 AND 1000),
 criteria jsonb NOT NULL CHECK(jsonb_typeof(criteria)='array' AND jsonb_array_length(criteria) BETWEEN 2 AND 30),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id),
 UNIQUE(municipality_id,version),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);

CREATE TABLE public.project_readiness_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('document','budget')),
 document_version_id uuid,
 budget_item_id uuid,
 snapshot_sha256 char(64) NOT NULL CHECK(snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 180),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 1000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id),
 CHECK((kind='document' AND document_version_id IS NOT NULL AND budget_item_id IS NULL)
    OR (kind='budget' AND budget_item_id IS NOT NULL AND document_version_id IS NULL)),
 FOREIGN KEY(project_id,municipality_id) REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(document_version_id,municipality_id,project_id)
  REFERENCES public.project_document_versions(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(budget_item_id,municipality_id,project_id)
  REFERENCES public.project_budget_items(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX readiness_evidence_one_doc ON public.project_readiness_evidence(project_id,document_version_id)
 WHERE document_version_id IS NOT NULL;
CREATE UNIQUE INDEX readiness_evidence_one_budget ON public.project_readiness_evidence(project_id,budget_item_id)
 WHERE budget_item_id IS NOT NULL;

CREATE TABLE public.project_readiness_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 version integer NOT NULL CHECK(version BETWEEN 1 AND 1000),
 stage text NOT NULL CHECK(stage IN ('idea','documented')),
 idea_id uuid,
 rubric_id uuid NOT NULL,
 previous_assessment_id uuid,
 criteria_input jsonb NOT NULL CHECK(jsonb_typeof(criteria_input)='array'),
 evidence_snapshot jsonb NOT NULL CHECK(jsonb_typeof(evidence_snapshot)='array'),
 result_snapshot jsonb NOT NULL CHECK(jsonb_typeof(result_snapshot)='object'),
 blockers jsonb NOT NULL CHECK(jsonb_typeof(blockers)='array'),
 actions jsonb NOT NULL CHECK(jsonb_typeof(actions)='array'),
 snapshot_sha256 char(64) NOT NULL CHECK(snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 1000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id),
 UNIQUE(project_id,version),
 FOREIGN KEY(project_id,municipality_id) REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(idea_id,municipality_id,project_id) REFERENCES public.project_readiness_ideas(id,municipality_id,project_id),
 FOREIGN KEY(rubric_id,municipality_id) REFERENCES public.municipal_readiness_rubrics(id,municipality_id),
 FOREIGN KEY(previous_assessment_id,municipality_id,project_id)
  REFERENCES public.project_readiness_assessments(id,municipality_id,project_id),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX readiness_project_history ON public.project_readiness_assessments(municipality_id,project_id,version DESC);

CREATE TABLE public.readiness_action_assignment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 assessment_id uuid NOT NULL,
 action_key text NOT NULL CHECK(action_key ~ '^[a-zA-Z0-9_-]{1,50}$'),
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 assigned_to uuid,
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(assessment_id,action_key,revision),
 FOREIGN KEY(assessment_id,municipality_id,project_id)
  REFERENCES public.project_readiness_assessments(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(assigned_to,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(actor_id,municipality_id) REFERENCES public.users(id,municipality_id)
);

CREATE TABLE public.readiness_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 assessment_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 decision text NOT NULL CHECK(decision IN ('reviewed','needs_changes')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 15 AND 1000),
 reviewer_id uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(assessment_id,revision),
 FOREIGN KEY(assessment_id,municipality_id,project_id)
  REFERENCES public.project_readiness_assessments(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_id,municipality_id) REFERENCES public.users(id,municipality_id)
);

ALTER TABLE public.project_readiness_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_readiness_ideas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_readiness_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_readiness_rubrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_readiness_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_readiness_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_readiness_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_readiness_assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_action_assignment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_action_assignment_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_review_events FORCE ROW LEVEL SECURITY;

CREATE POLICY readiness_idea_scope ON public.project_readiness_ideas
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_rubric_scope ON public.municipal_readiness_rubrics
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_evidence_scope ON public.project_readiness_evidence
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_assessment_scope ON public.project_readiness_assessments
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_assignment_scope ON public.readiness_action_assignment_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_review_scope ON public.readiness_review_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid AND reviewer_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
