-- AF-030: suggestions backed by an exact encrypted-document version,
-- but source excerpts are supplied by a human and NOT automatically verified.
-- Versions, suggestions and review events are immutable for the web DB role.
CREATE UNIQUE INDEX idx_project_document_version_tenant_id
 ON public.project_document_versions(id,municipality_id,project_id);

CREATE TABLE public.project_edict_extraction_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 document_version_id uuid NOT NULL,
 input_sha256 char(64) NOT NULL CHECK(input_sha256 ~ '^[a-f0-9]{64}$'),
 input_length integer NOT NULL CHECK(input_length BETWEEN 20 AND 16000),
 suggestion_count integer NOT NULL CHECK(suggestion_count BETWEEN 1 AND 25),
 method text NOT NULL DEFAULT 'heuristic_from_user_text'
  CHECK(method='heuristic_from_user_text'),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id),
 FOREIGN KEY(project_id,municipality_id)
  REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(document_version_id,municipality_id,project_id)
  REFERENCES public.project_document_versions(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_edict_batches_tenant
 ON public.project_edict_extraction_batches(municipality_id,project_id,created_at DESC);

CREATE TABLE public.project_edict_suggestions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 batch_id uuid NOT NULL,
 seq integer NOT NULL CHECK(seq BETWEEN 1 AND 25),
 source_page integer CHECK(source_page BETWEEN 1 AND 9999),
 source_excerpt text CHECK(source_excerpt IS NULL OR
  length(btrim(source_excerpt)) BETWEEN 15 AND 1200),
 suggested_requirement text NOT NULL
  CHECK(length(btrim(suggested_requirement)) BETWEEN 10 AND 500),
 evidence_state text NOT NULL CHECK(evidence_state IN ('excerpt','missing')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(batch_id,seq),
 UNIQUE(id,municipality_id,project_id),
 CHECK((evidence_state='excerpt' AND source_excerpt IS NOT NULL)
  OR (evidence_state='missing' AND source_excerpt IS NULL)),
 FOREIGN KEY(batch_id,municipality_id,project_id)
  REFERENCES public.project_edict_extraction_batches(id,municipality_id,project_id)
  ON DELETE RESTRICT
);
CREATE INDEX idx_edict_suggestions_tenant
 ON public.project_edict_suggestions(municipality_id,project_id,batch_id,seq);

CREATE TABLE public.project_edict_suggestion_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 suggestion_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 decision text NOT NULL CHECK(decision IN ('pendente','aprovada','rejeitada')),
 review_note text NOT NULL CHECK(length(btrim(review_note)) BETWEEN 10 AND 1000),
 reviewed_by uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(suggestion_id,revision),
 FOREIGN KEY(suggestion_id,municipality_id,project_id)
  REFERENCES public.project_edict_suggestions(id,municipality_id,project_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(reviewed_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_edict_reviews_tenant
 ON public.project_edict_suggestion_reviews(municipality_id,project_id,suggestion_id,revision DESC);

ALTER TABLE public.project_edict_extraction_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_edict_extraction_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_edict_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_edict_suggestions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_edict_suggestion_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_edict_suggestion_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY edict_batches_tenant ON public.project_edict_extraction_batches
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY edict_suggestions_tenant ON public.project_edict_suggestions
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY edict_reviews_tenant ON public.project_edict_suggestion_reviews
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND reviewed_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
