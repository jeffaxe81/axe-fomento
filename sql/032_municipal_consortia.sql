-- AF-039: bilateral consortium membership. Invitation does not give access to projects.
CREATE TABLE public.municipal_consortia(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 6 AND 160),
 purpose text NOT NULL CHECK(length(btrim(purpose)) BETWEEN 20 AND 800),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,owner_municipality_id),
 UNIQUE(owner_municipality_id,title),
 FOREIGN KEY(created_by,owner_municipality_id)
 REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE TABLE public.consortium_memberships(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consortium_id uuid NOT NULL,
 owner_municipality_id uuid NOT NULL,
 member_municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'invited' CHECK(state IN ('invited','active','declined','revoked')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 1000),
 updated_by uuid NOT NULL,
 updated_actor_municipality_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(consortium_id,member_municipality_id),
 UNIQUE(id,owner_municipality_id,member_municipality_id),
 CHECK(owner_municipality_id<>member_municipality_id),
 FOREIGN KEY(consortium_id,owner_municipality_id)
 REFERENCES public.municipal_consortia(id,owner_municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,updated_actor_municipality_id)
 REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT,
 CHECK(updated_actor_municipality_id IN(owner_municipality_id,member_municipality_id))
);
CREATE INDEX idx_consortium_memberships_tenant
 ON public.consortium_memberships(member_municipality_id,state,consortium_id);
CREATE TABLE public.consortium_membership_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 membership_id uuid NOT NULL,
 consortium_id uuid NOT NULL,
 owner_municipality_id uuid NOT NULL,
 member_municipality_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 action text NOT NULL CHECK(action IN('invited','accepted','declined','revoked')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 actor_id uuid NOT NULL,
 actor_municipality_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(membership_id,revision),
 FOREIGN KEY(membership_id,owner_municipality_id,member_municipality_id)
 REFERENCES public.consortium_memberships(id,owner_municipality_id,member_municipality_id),
 FOREIGN KEY(actor_id,actor_municipality_id)
 REFERENCES public.users(id,municipality_id),
 CHECK(actor_municipality_id IN (owner_municipality_id,member_municipality_id))
);
ALTER TABLE public.municipal_consortia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_consortia FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_membership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_membership_events FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_participants ON public.consortium_memberships
 USING(owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 OR member_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(
  (owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
   OR member_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  AND updated_actor_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND updated_by=NULLIF(current_setting('app.actor_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=updated_by
   AND u.municipality_id=updated_actor_municipality_id
   AND u.active AND u.role='admin')
 );
CREATE POLICY consortium_owners_and_invitees ON public.municipal_consortia
 USING(owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 OR EXISTS(SELECT 1 FROM public.consortium_memberships m
    WHERE m.consortium_id=id
    AND m.member_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
    AND m.state IN('invited','active')))
 WITH CHECK(owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=created_by AND u.active AND u.role='admin'));
CREATE POLICY consortium_event_participants ON public.consortium_membership_events
 USING(owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 OR member_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(
 (owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 OR member_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 AND actor_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=actor_id
 AND u.active AND u.role='admin'));

-- Safe institutional directory: only municipality name/UF/UUID, no private profile or users.
CREATE FUNCTION public.consortium_municipality_directory(p_actor uuid,p_tenant uuid)
RETURNS TABLE(id uuid,name text,uf char(2)) LANGUAGE sql STABLE
SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT m.id,m.name,m.uf FROM public.municipalities m
 WHERE m.id<>p_tenant
 AND p_tenant=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND p_actor=NULLIF(current_setting('app.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_actor
  AND u.municipality_id=p_tenant AND u.active AND u.role='admin')
 ORDER BY m.name,m.uf,m.id LIMIT 150
$$;
REVOKE ALL ON FUNCTION public.consortium_municipality_directory(uuid,uuid) FROM PUBLIC;
