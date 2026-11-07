-- AF-032: draft proposal authoring with immutable versions and frozen source snapshot.
-- A human-edited draft is never an approved submission or legal compliance finding.
CREATE TABLE public.project_proposal_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id),
 UNIQUE(municipality_id,project_id),
 FOREIGN KEY(project_id,municipality_id)
  REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);

CREATE TABLE public.project_proposal_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 draft_id uuid NOT NULL,
 version integer NOT NULL CHECK(version BETWEEN 1 AND 500),
 sections jsonb NOT NULL CHECK (
  jsonb_typeof(sections)='object'
  AND sections ?& ARRAY['summary','justification','objectives','execution','budget','requirements']
  AND jsonb_typeof(sections->'summary')='string'
  AND jsonb_typeof(sections->'justification')='string'
  AND jsonb_typeof(sections->'objectives')='string'
  AND jsonb_typeof(sections->'execution')='string'
  AND jsonb_typeof(sections->'budget')='string'
  AND jsonb_typeof(sections->'requirements')='string'
  AND length(btrim(sections->>'summary')) BETWEEN 10 AND 4000
  AND length(btrim(sections->>'justification')) BETWEEN 10 AND 4000
  AND length(btrim(sections->>'objectives')) BETWEEN 10 AND 4000
  AND length(btrim(sections->>'execution')) BETWEEN 10 AND 4000
  AND length(btrim(sections->>'budget')) BETWEEN 10 AND 4000
  AND length(btrim(sections->>'requirements')) BETWEEN 10 AND 4000
 ),
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 missing_fields text[] NOT NULL DEFAULT '{}' CHECK (cardinality(missing_fields) <= 15),
 revision_note text NOT NULL CHECK(length(btrim(revision_note)) BETWEEN 10 AND 500),
 origin text NOT NULL CHECK(origin IN ('template_from_local_data','manual_revision')),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(draft_id,version),
 FOREIGN KEY(draft_id,municipality_id,project_id)
  REFERENCES public.project_proposal_drafts(id,municipality_id,project_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_proposal_versions_lookup
 ON public.project_proposal_versions(municipality_id,project_id,draft_id,version DESC);

ALTER TABLE public.project_proposal_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_proposal_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_proposal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_proposal_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY proposal_drafts_tenant ON public.project_proposal_drafts
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY proposal_versions_tenant ON public.project_proposal_versions
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
