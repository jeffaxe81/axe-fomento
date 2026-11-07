-- AF-040: only an explicitly authored summary can be read by active consortium participants.
-- Cross-tenant access to projects, records or attachments remains DENIED by existing RLS.
CREATE TABLE public.consortium_project_shares(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consortium_id uuid NOT NULL,
 owner_municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 public_title text NOT NULL CHECK(length(btrim(public_title)) BETWEEN 6 AND 160),
 shared_summary text NOT NULL CHECK(length(btrim(shared_summary)) BETWEEN 40 AND 2000),
 enabled boolean NOT NULL DEFAULT true,
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 1000),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(consortium_id,project_id),
 FOREIGN KEY(consortium_id,owner_municipality_id)
 REFERENCES public.municipal_consortia(id,owner_municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,owner_municipality_id)
 REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,owner_municipality_id)
 REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,owner_municipality_id)
 REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_consortium_shared_for_owner
 ON public.consortium_project_shares(owner_municipality_id,consortium_id,enabled);
CREATE TABLE public.consortium_share_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 share_id uuid NOT NULL REFERENCES public.consortium_project_shares(id) ON DELETE RESTRICT,
 owner_municipality_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 action text NOT NULL CHECK(action IN('created','revoked')),
 actor_id uuid NOT NULL,
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(share_id,revision),
 FOREIGN KEY(actor_id,owner_municipality_id)
 REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
ALTER TABLE public.consortium_project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_project_shares FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_share_events FORCE ROW LEVEL SECURITY;
CREATE POLICY consortium_shared_summary_access ON public.consortium_project_shares
 USING(
 owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 OR (enabled AND EXISTS(
 SELECT 1 FROM public.consortium_memberships m
 WHERE m.consortium_id=consortium_project_shares.consortium_id
 AND m.member_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND m.state='active'
 AND EXISTS(SELECT 1 FROM public.users u
  WHERE u.id=NULLIF(current_setting('app.actor_id',true),'')::uuid
  AND u.municipality_id=m.member_municipality_id AND u.active AND u.role='admin')
 )))
 WITH CHECK(owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND updated_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY consortium_share_audit_owner ON public.consortium_share_events
 USING(owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(owner_municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);

-- Additional barrier: a consortium's invitation must be accepted by the other municipality.
-- The shared table contains NO full project data or attachment identifiers.
