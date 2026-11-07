-- AF-042..049: municipal pre-viability/advisory tool, never official eligibility.
CREATE TABLE public.readiness_cases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('idea','documented')),
 project_id uuid,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 6 AND 180),
 problem text NOT NULL CHECK(length(btrim(problem)) BETWEEN 20 AND 2000),
 target_audience text NOT NULL CHECK(length(btrim(target_audience)) BETWEEN 10 AND 1000),
 objective text NOT NULL CHECK(length(btrim(objective)) BETWEEN 20 AND 2000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id),
 UNIQUE(id,municipality_id,project_id),
 CHECK((kind='idea' AND project_id IS NULL) OR (kind='documented' AND project_id IS NOT NULL)),
 FOREIGN KEY(project_id,municipality_id) REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX readiness_cases_tenant ON public.readiness_cases(municipality_id,created_at DESC,id);

CREATE UNIQUE INDEX readiness_document_version_scope
 ON public.project_document_versions(id,municipality_id,project_id);
CREATE TABLE public.readiness_case_evidence(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 case_id uuid NOT NULL,
 project_id uuid NOT NULL,
 version_id uuid NOT NULL,
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 added_by uuid NOT NULL,
 added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(case_id,version_id),
 FOREIGN KEY(case_id,municipality_id,project_id)
  REFERENCES public.readiness_cases(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(version_id,municipality_id,project_id)
  REFERENCES public.project_document_versions(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(added_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX readiness_evidence_tenant ON public.readiness_case_evidence(municipality_id,case_id,version_id);

CREATE TABLE public.readiness_rubric_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 rubric_key text NOT NULL CHECK(rubric_key ~ '^[a-z][a-z0-9_-]{3,39}$'),
 version integer NOT NULL CHECK(version BETWEEN 1 AND 100),
 criteria jsonb NOT NULL CHECK(jsonb_typeof(criteria)='array'),
 change_note text NOT NULL CHECK(length(btrim(change_note)) BETWEEN 10 AND 500),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(municipality_id,rubric_key,version),
 UNIQUE(id,municipality_id),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX readiness_rubrics_tenant ON public.readiness_rubric_versions(municipality_id,rubric_key,version DESC);

CREATE TABLE public.readiness_assessments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 case_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 previous_id uuid,
 previous_revision integer,
 rubric_id uuid NOT NULL,
 rubric_version integer NOT NULL,
 rubric_snapshot jsonb NOT NULL CHECK(jsonb_typeof(rubric_snapshot)='array'),
 scores_snapshot jsonb NOT NULL CHECK(jsonb_typeof(scores_snapshot)='array'),
 blockers_snapshot jsonb NOT NULL CHECK(jsonb_typeof(blockers_snapshot)='array'),
 action_plan_snapshot jsonb NOT NULL CHECK(jsonb_typeof(action_plan_snapshot)='array'),
 evidence_snapshot jsonb NOT NULL CHECK(jsonb_typeof(evidence_snapshot)='array'),
 score numeric(5,2) NOT NULL CHECK(score BETWEEN 0 AND 100),
 maximum_possible_score numeric(5,2) NOT NULL CHECK(maximum_possible_score BETWEEN 0 AND 100),
 evaluated_weight smallint NOT NULL CHECK(evaluated_weight BETWEEN 0 AND 100),
 snapshot_sha256 char(64) NOT NULL CHECK(snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 revision_note text NOT NULL CHECK(length(btrim(revision_note)) BETWEEN 15 AND 500),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(case_id,revision),
 UNIQUE(id,municipality_id,case_id,revision),
 UNIQUE(id,municipality_id,case_id),
 CHECK((revision=1 AND previous_id IS NULL AND previous_revision IS NULL)
  OR (revision>1 AND previous_id IS NOT NULL AND previous_revision=revision-1)),
 CHECK(score<=maximum_possible_score),
 FOREIGN KEY(case_id,municipality_id) REFERENCES public.readiness_cases(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(previous_id,municipality_id,case_id,previous_revision)
  REFERENCES public.readiness_assessments(id,municipality_id,case_id,revision) ON DELETE RESTRICT,
 FOREIGN KEY(rubric_id,municipality_id) REFERENCES public.readiness_rubric_versions(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX readiness_assessments_tenant ON public.readiness_assessments(municipality_id,case_id,revision DESC);

CREATE TABLE public.readiness_review_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 case_id uuid NOT NULL,
 assessment_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 100),
 decision text NOT NULL CHECK(decision IN ('revisada','devolvida')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 20 AND 1000),
 reviewer_id uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(assessment_id,revision),
 FOREIGN KEY(assessment_id,municipality_id,case_id)
  REFERENCES public.readiness_assessments(id,municipality_id,case_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_id,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX readiness_reviews_tenant ON public.readiness_review_events(municipality_id,case_id,reviewed_at DESC,id);

CREATE TABLE public.readiness_action_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 case_id uuid NOT NULL,
 assessment_id uuid NOT NULL,
 action_code text NOT NULL CHECK(action_code ~ '^[a-z0-9_-]{3,80}$'),
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 100),
 responsible_user_id uuid NOT NULL,
 justification text NOT NULL CHECK(length(btrim(justification)) BETWEEN 10 AND 500),
 assigned_by uuid NOT NULL,
 assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(assessment_id,action_code,revision),
 FOREIGN KEY(assessment_id,municipality_id,case_id)
  REFERENCES public.readiness_assessments(id,municipality_id,case_id) ON DELETE RESTRICT,
 FOREIGN KEY(responsible_user_id,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(assigned_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX readiness_assignments_tenant ON public.readiness_action_assignments(municipality_id,case_id,assessment_id);

DO $$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY['readiness_cases','readiness_case_evidence','readiness_rubric_versions',
   'readiness_assessments','readiness_review_events','readiness_action_assignments'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',name);
 END LOOP;
END $$;
CREATE POLICY readiness_cases_tenant ON public.readiness_cases
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_evidence_tenant ON public.readiness_case_evidence
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND added_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_rubrics_tenant ON public.readiness_rubric_versions
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_assessments_tenant ON public.readiness_assessments
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_reviews_tenant ON public.readiness_review_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND reviewer_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY readiness_assignments_tenant ON public.readiness_action_assignments
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND assigned_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
