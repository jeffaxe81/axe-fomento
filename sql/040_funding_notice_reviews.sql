-- V1-07: second-person municipal attestation of an individual official notice.
-- This is NOT automatic verification by a funder or an institutional approval.
ALTER TABLE public.funding_observations
 ADD CONSTRAINT funding_observations_author_ref UNIQUE(id,municipality_id,created_by);
CREATE TABLE public.funding_notice_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
 observation_id uuid NOT NULL,
 observation_author_id uuid NOT NULL,
 reviewed_by uuid NOT NULL,
 review_state text NOT NULL CHECK(review_state IN('confirmed_by_reviewer','rejected_by_reviewer','insufficient_evidence')),
 eligibility_state text NOT NULL CHECK(eligibility_state IN('potential','possible_impediment','undetermined')),
 official_document_url text NOT NULL CHECK(length(official_document_url) BETWEEN 20 AND 500 AND official_document_url LIKE 'https://%'),
 reviewed_on date NOT NULL CHECK(reviewed_on BETWEEN DATE '2020-01-01' AND DATE '2100-01-01'),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 60 AND 1500),
 requirements_note text NOT NULL CHECK(length(btrim(requirements_note)) BETWEEN 40 AND 1500),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(observation_id,reviewed_by),
 FOREIGN KEY(observation_id,municipality_id,observation_author_id)
  REFERENCES public.funding_observations(id,municipality_id,created_by),
 FOREIGN KEY(reviewed_by,municipality_id) REFERENCES public.users(id,municipality_id),
 CHECK(reviewed_by<>observation_author_id),
 CHECK(review_state='confirmed_by_reviewer' OR eligibility_state<>'potential')
);
CREATE INDEX funding_notice_reviews_latest
 ON public.funding_notice_reviews(municipality_id,observation_id,created_at DESC,id DESC);
ALTER TABLE public.funding_notice_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_notice_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY funding_notice_reviews_tenant ON public.funding_notice_reviews
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND reviewed_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
