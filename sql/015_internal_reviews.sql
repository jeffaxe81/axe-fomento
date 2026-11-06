-- AF-021: revisão técnica e autorização INTERNA, sem submissão externa.
-- Projeto mantém status operacional separado; nenhuma mudança automática para "submetido".
CREATE TABLE public.project_internal_reviews (
 project_id uuid PRIMARY KEY,
 municipality_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('em_revisao','revisada','devolvida','autorizada')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 10000),
 submitted_by uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 technically_reviewed_by uuid,
 technically_reviewed_at timestamptz,
 authorized_by uuid,
 authorized_at timestamptz,
 updated_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(project_id,municipality_id),
 FOREIGN KEY(project_id,municipality_id) REFERENCES public.projects(id,municipality_id) ON DELETE CASCADE,
 FOREIGN KEY(submitted_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(technically_reviewed_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(authorized_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(updated_by,municipality_id) REFERENCES public.users(id,municipality_id),
 CONSTRAINT review_technical_pair CHECK (
   (technically_reviewed_by IS NULL AND technically_reviewed_at IS NULL)
   OR (technically_reviewed_by IS NOT NULL AND technically_reviewed_at IS NOT NULL)),
 CONSTRAINT review_authorization_pair CHECK (
   (authorized_by IS NULL AND authorized_at IS NULL)
   OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL)),
 CONSTRAINT review_state_consistent CHECK (
   (state IN ('em_revisao','devolvida') AND technically_reviewed_by IS NULL AND authorized_by IS NULL)
   OR (state='revisada' AND technically_reviewed_by IS NOT NULL AND authorized_by IS NULL)
   OR (state='autorizada' AND technically_reviewed_by IS NOT NULL AND authorized_by IS NOT NULL)),
 CONSTRAINT review_separation CHECK (
   submitted_by IS DISTINCT FROM technically_reviewed_by
   AND submitted_by IS DISTINCT FROM authorized_by
   AND technically_reviewed_by IS DISTINCT FROM authorized_by)
);
CREATE INDEX idx_internal_reviews_tenant
 ON public.project_internal_reviews(municipality_id,state,updated_at DESC,project_id);
CREATE TABLE public.project_internal_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL,
 municipality_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 10000),
 action text NOT NULL CHECK(action IN ('submitted','resubmitted','technical_approved','returned','authorized')),
 previous_state text CHECK(previous_state IS NULL OR previous_state IN
   ('em_revisao','revisada','devolvida','autorizada')),
 new_state text NOT NULL CHECK(new_state IN ('em_revisao','revisada','devolvida','autorizada')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(project_id,revision),
 FOREIGN KEY(project_id,municipality_id)
  REFERENCES public.project_internal_reviews(project_id,municipality_id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_internal_review_events_tenant
 ON public.project_internal_review_events(municipality_id,project_id,revision DESC);
ALTER TABLE public.project_internal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_internal_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_internal_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_internal_review_events FORCE ROW LEVEL SECURITY;
CREATE POLICY internal_reviews_tenant ON public.project_internal_reviews
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
   AND updated_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY internal_review_events_tenant ON public.project_internal_review_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
   AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
