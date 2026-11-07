-- AF-015/016: convites institucionais de uso único e ciclo de vida de contas.
-- Apenas funções SECURITY DEFINER podem alterar convites/usuários; web não recebe grant de escrita.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_casefold ON public.users(lower(email));

CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
  email varchar(254) NOT NULL CHECK(email=lower(btrim(email)) AND length(email)>=5),
  role text NOT NULL CHECK(role IN ('admin','analyst')),
  token_hash char(64) NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  issued_by uuid NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  accepted_user_id uuid,
  FOREIGN KEY(issued_by,municipality_id) REFERENCES public.users(id,municipality_id),
  FOREIGN KEY(accepted_user_id,municipality_id) REFERENCES public.users(id,municipality_id),
  CONSTRAINT invite_dates CHECK(expires_at>issued_at),
  CONSTRAINT invite_terminal CHECK(used_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX idx_invitations_municipal_recent ON public.user_invitations(municipality_id,issued_at DESC);
CREATE INDEX idx_invitations_email_pending ON public.user_invitations(lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitations_tenant ON public.user_invitations
  USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- No table privileges are granted to the application role.

ALTER TABLE public.audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK(action IN (
 'project.insert','project.update','project.delete','municipality.update',
 'security.password_change','security.mfa_reset',
 'security.invite_issued','security.invite_accepted',
 'security.account_deactivated','security.account_reactivated'
));

CREATE OR REPLACE FUNCTION public.auth_admin_issue_invite(
  p_admin uuid,p_sid uuid,p_email text,p_role text,p_hash text)
RETURNS TABLE(invitation_id uuid,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE tenant uuid; created_id uuid; expiry timestamptz; normalized text;
BEGIN
 normalized:=lower(btrim(p_email));
 IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$'
    OR normalized IS NULL OR length(normalized)<5 OR length(normalized)>254
    OR normalized !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    OR p_role NOT IN ('admin','analyst') THEN RETURN; END IF;
 SELECT u.municipality_id INTO tenant FROM public.users u
 JOIN public.user_sessions s ON s.user_id=u.id AND s.municipality_id=u.municipality_id
 WHERE u.id=p_admin AND u.active AND u.role='admin' AND s.id=p_sid
   AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.mfa_verified;
 IF tenant IS NULL THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('fomento.invite:'||normalized,0));
 IF EXISTS(SELECT 1 FROM public.users WHERE lower(email)=normalized) THEN RETURN; END IF;
 UPDATE public.user_invitations
 SET revoked_at=clock_timestamp()
 WHERE municipality_id=tenant AND lower(email)=normalized
   AND used_at IS NULL AND revoked_at IS NULL;
 expiry:=clock_timestamp()+interval '48 hours';
 INSERT INTO public.user_invitations(municipality_id,email,role,token_hash,issued_by,expires_at)
 VALUES(tenant,normalized,p_role,p_hash,p_admin,expiry) RETURNING id INTO created_id;
 INSERT INTO public.audit_events(municipality_id,actor_user_id,action,record_id,metadata)
 VALUES(tenant,p_admin,'security.invite_issued',created_id,jsonb_build_object('role',p_role));
 invitation_id:=created_id; expires_at:=expiry; RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.auth_invite_accept(
  p_hash text,p_full_name text,p_password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE inv record; invited_email text; new_user uuid;
BEGIN
 IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$'
    OR p_full_name IS NULL OR length(btrim(p_full_name))<3
    OR length(btrim(p_full_name))>120 OR p_full_name ~ '[[:cntrl:]]'
    OR p_password IS NULL OR length(p_password)<12 OR length(p_password)>128
    OR p_password !~ '[[:lower:]]' OR p_password !~ '[[:upper:]]'
    OR p_password !~ '[[:digit:]]' OR p_password !~ '[^[:alnum:]]'
 THEN RETURN NULL; END IF;
 SELECT email INTO invited_email FROM public.user_invitations
 WHERE token_hash=p_hash AND used_at IS NULL AND revoked_at IS NULL
 AND expires_at>clock_timestamp();
 IF invited_email IS NULL THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('fomento.invite:'||invited_email,0));
 SELECT i.* INTO inv FROM public.user_invitations i
 WHERE i.token_hash=p_hash AND i.used_at IS NULL AND i.revoked_at IS NULL
   AND i.expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.users WHERE lower(email)=inv.email)
 THEN RETURN NULL; END IF;
 INSERT INTO public.users(municipality_id,full_name,email,password_hash,role,active)
 VALUES(inv.municipality_id,btrim(p_full_name),inv.email,
        public.crypt(p_password,public.gen_salt('bf',12)),inv.role,true)
 RETURNING id INTO new_user;
 UPDATE public.user_invitations SET used_at=clock_timestamp(),accepted_user_id=new_user
 WHERE id=inv.id;
 -- Other municipal invitations for the same email cannot be used after acceptance.
 UPDATE public.user_invitations SET revoked_at=clock_timestamp()
 WHERE lower(email)=inv.email AND id<>inv.id AND used_at IS NULL AND revoked_at IS NULL;
 INSERT INTO public.audit_events(municipality_id,actor_user_id,action,record_id,metadata)
 VALUES(inv.municipality_id,new_user,'security.invite_accepted',new_user,
   jsonb_build_object('role',inv.role,'invitation_id',inv.id));
 RETURN new_user;
END $$;

CREATE OR REPLACE FUNCTION public.auth_admin_set_account_state(
 p_admin uuid,p_sid uuid,p_target uuid,p_active boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE tenant uuid; target_role text; current_active boolean;
BEGIN
 IF p_active IS NULL THEN RETURN 'invalid'; END IF;
 SELECT u.municipality_id INTO tenant FROM public.users u
 JOIN public.user_sessions s ON s.user_id=u.id AND s.municipality_id=u.municipality_id
 WHERE u.id=p_admin AND u.active AND u.role='admin' AND s.id=p_sid
   AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.mfa_verified;
 IF tenant IS NULL THEN RETURN 'unauthorized'; END IF;
 -- Serializes changes to the active-admin count for a municipality.
 PERFORM pg_advisory_xact_lock(hashtextextended('fomento.account:'||tenant::text,0));
 SELECT role,active INTO target_role,current_active FROM public.users
 WHERE id=p_target AND municipality_id=tenant FOR UPDATE;
 IF NOT FOUND THEN RETURN 'not_found'; END IF;
 IF p_target=p_admin AND NOT p_active THEN RETURN 'self'; END IF;
 IF current_active=p_active THEN RETURN 'unchanged'; END IF;
 IF NOT p_active AND target_role='admin' AND (
   SELECT count(*) FROM public.users WHERE municipality_id=tenant
     AND active AND role='admin')<=1 THEN RETURN 'last_admin'; END IF;
 UPDATE public.users SET active=p_active WHERE id=p_target AND municipality_id=tenant;
 IF NOT p_active THEN
  UPDATE public.user_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp())
  WHERE user_id=p_target AND revoked_at IS NULL;
 END IF;
 INSERT INTO public.audit_events(municipality_id,actor_user_id,action,record_id,metadata)
 VALUES(tenant,p_admin,
   CASE WHEN p_active THEN 'security.account_reactivated' ELSE 'security.account_deactivated' END,
   p_target,jsonb_build_object('target_role',target_role));
 RETURN 'updated';
END $$;

CREATE OR REPLACE FUNCTION public.auth_admin_list_invites(p_admin uuid,p_sid uuid)
RETURNS TABLE(id uuid,email text,role text,issued_at timestamptz,expires_at timestamptz,status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE tenant uuid;
BEGIN
 SELECT u.municipality_id INTO tenant FROM public.users u
 JOIN public.user_sessions s ON s.user_id=u.id AND s.municipality_id=u.municipality_id
 WHERE u.id=p_admin AND u.active AND u.role='admin' AND s.id=p_sid
   AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.mfa_verified;
 IF tenant IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT i.id,i.email::text,i.role,i.issued_at,i.expires_at,
 CASE WHEN i.used_at IS NOT NULL THEN 'accepted'
      WHEN i.revoked_at IS NOT NULL THEN 'revoked'
      WHEN i.expires_at<=clock_timestamp() THEN 'expired'
      ELSE 'pending' END
 FROM public.user_invitations i WHERE i.municipality_id=tenant
 ORDER BY i.issued_at DESC,i.id DESC LIMIT 100;
END $$;

REVOKE ALL ON FUNCTION public.auth_admin_issue_invite(uuid,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_invite_accept(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_admin_set_account_state(uuid,uuid,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_admin_list_invites(uuid,uuid) FROM PUBLIC;
