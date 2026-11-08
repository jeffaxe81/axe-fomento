-- Independent internal review: different municipal admin from evidence submitter.
-- Even eight accepted gate reports never grant production authorization automatically.
ALTER TABLE public.pilot_gate_evidence
 ADD CONSTRAINT pilot_evidence_author_ref UNIQUE(id,municipality_id,created_by);
CREATE TABLE public.pilot_gate_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
 evidence_id uuid NOT NULL,
 evidence_author_id uuid NOT NULL,
 reviewed_by uuid NOT NULL,
 decision text NOT NULL CHECK(decision IN('accepted','rejected')),
 acceptance_url text CHECK(acceptance_url IS NULL OR
  (length(acceptance_url) BETWEEN 12 AND 500 AND acceptance_url LIKE 'https://%')),
 notes text NOT NULL CHECK(length(btrim(notes)) BETWEEN 30 AND 1500),
 reviewed_on date NOT NULL CHECK(reviewed_on BETWEEN DATE '2020-01-01' AND DATE '2100-01-01'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(evidence_id,reviewed_by),
 FOREIGN KEY(evidence_id,municipality_id,evidence_author_id)
  REFERENCES public.pilot_gate_evidence(id,municipality_id,created_by),
 FOREIGN KEY(reviewed_by,municipality_id) REFERENCES public.users(id,municipality_id),
 CHECK(reviewed_by<>evidence_author_id),
 CHECK(decision<>'accepted' OR acceptance_url IS NOT NULL)
);
CREATE INDEX pilot_gate_reviews_lookup ON public.pilot_gate_reviews
(municipality_id,evidence_id,created_at DESC,id DESC);
ALTER TABLE public.pilot_gate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_gate_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY pilot_gate_reviews_tenant ON public.pilot_gate_reviews
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND reviewed_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
