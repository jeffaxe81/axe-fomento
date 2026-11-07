-- AF-037: manually reported international cooperation calls; no live scraping or inferred availability.
CREATE TABLE public.international_cooperation_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 call_code text NOT NULL CHECK(call_code ~ '^[A-Z0-9][A-Z0-9_-]{2,59}$'),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 6 AND 180),
 institution text NOT NULL CHECK(length(btrim(institution)) BETWEEN 4 AND 160),
 language_code text NOT NULL CHECK(language_code IN ('pt','en','es','fr','other')),
 scope_code text NOT NULL CHECK(scope_code IN ('municipal','regional','national','international','to_confirm')),
 modality text NOT NULL CHECK(modality IN ('loan','grant','technical_cooperation','guarantee','to_confirm')),
 official_url text NOT NULL CHECK(length(official_url) BETWEEN 12 AND 500 AND official_url ~ '^https://'),
 review_state text NOT NULL CHECK(review_state IN ('to_verify','checked_reference','review_required')),
 checked_on date CHECK(checked_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 notes text NOT NULL CHECK(length(btrim(notes)) BETWEEN 20 AND 1000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(municipality_id,call_code), UNIQUE(id,municipality_id),
 CHECK(review_state<>'checked_reference' OR checked_on IS NOT NULL),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_intl_cooperation_filter ON public.international_cooperation_calls
(municipality_id,review_state,institution,title);
ALTER TABLE public.international_cooperation_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.international_cooperation_calls FORCE ROW LEVEL SECURITY;
CREATE POLICY intl_calls_municipal ON public.international_cooperation_calls
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
