-- AF-033: strictly human reviews of exact immutable AF-032 proposal versions.
-- A decision is internal editorial review only, not a legal or formal approval.
CREATE UNIQUE INDEX idx_proposal_version_tenant_review
 ON public.project_proposal_versions(id,municipality_id,project_id,draft_id);

CREATE TABLE public.project_proposal_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 draft_id uuid NOT NULL,
 version_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 decision text NOT NULL CHECK(decision IN ('aprovada','devolvida')),
 review_note text NOT NULL CHECK(length(btrim(review_note)) BETWEEN 15 AND 1000),
 acknowledged_missing_sources boolean NOT NULL DEFAULT false,
 reviewer_id uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(version_id,revision),
 CHECK(decision<>'aprovada' OR acknowledged_missing_sources),
 FOREIGN KEY(version_id,municipality_id,project_id,draft_id)
  REFERENCES public.project_proposal_versions(id,municipality_id,project_id,draft_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_id,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_proposal_review_tenant
 ON public.project_proposal_review_events(municipality_id,project_id,version_id,revision DESC);

ALTER TABLE public.project_proposal_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_proposal_review_events FORCE ROW LEVEL SECURITY;
CREATE POLICY proposal_review_events_tenant ON public.project_proposal_review_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND reviewer_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
