-- AF-038: route-specific human-declared institutional contacts and steps.
-- Records do not prove that the named institution accepts direct municipal applications.
CREATE TABLE public.international_application_routes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 call_id uuid NOT NULL,
 route_type text NOT NULL CHECK(route_type IN ('direct','intermediated','to_confirm')),
 institutional_contact text NOT NULL CHECK(length(btrim(institutional_contact)) BETWEEN 5 AND 160),
 contact_url text NOT NULL CHECK(length(contact_url) BETWEEN 12 AND 500 AND contact_url ~ '^https://'),
 verification_state text NOT NULL CHECK(verification_state IN
 ('reported','checked_internally','review_required')),
 checked_on date CHECK(checked_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 application_steps text NOT NULL CHECK(length(btrim(application_steps)) BETWEEN 25 AND 1200),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(call_id,route_type,contact_url),
 CHECK(verification_state<>'checked_internally' OR checked_on IS NOT NULL),
 FOREIGN KEY(call_id,municipality_id) REFERENCES public.international_cooperation_calls(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_intl_routes_tenant ON public.international_application_routes(municipality_id,call_id,route_type);
ALTER TABLE public.international_application_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.international_application_routes FORCE ROW LEVEL SECURITY;
CREATE POLICY intl_routes_municipal ON public.international_application_routes
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
