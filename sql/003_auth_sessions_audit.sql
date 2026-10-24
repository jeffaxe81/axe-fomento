-- 003: Persistent login throttling, server-side session revocation and append-only tenant audit.
-- Apply using the migration/table owner, never as fomento_app.
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  bucket text PRIMARY KEY CHECK (bucket ~ '^(acct|ip):[a-f0-9]{64}$'),
  attempts integer NOT NULL DEFAULT 0,
  window_end timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_expiry ON public.auth_rate_limits(window_end);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT session_user_municipality FOREIGN KEY(user_id,municipality_id)
    REFERENCES public.users(id,municipality_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.user_sessions(user_id,expires_at DESC);
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_sessions_tenant ON public.user_sessions;
CREATE POLICY user_sessions_tenant ON public.user_sessions
  USING (municipality_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (municipality_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id bigserial PRIMARY KEY,
  municipality_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL CHECK(action IN ('project.insert','project.update','project.delete','municipality.update')),
  record_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_audit_municipal_date ON public.audit_events(municipality_id,occurred_at DESC);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_events_tenant ON public.audit_events;
CREATE POLICY audit_events_tenant ON public.audit_events
  USING (municipality_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (municipality_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);

CREATE OR REPLACE FUNCTION public.audit_tenant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE row_id uuid; tenant uuid; actor uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    row_id := OLD.id; tenant := OLD.municipality_id;
  ELSIF TG_TABLE_NAME='municipalities' THEN
    row_id := NEW.id; tenant := NEW.id;
  ELSE
    row_id := NEW.id; tenant := NEW.municipality_id;
  END IF;
  actor := NULLIF(current_setting('app.actor_id',true),'')::uuid;
  INSERT INTO public.audit_events(municipality_id,actor_user_id,action,record_id)
  VALUES (tenant,actor,
    CASE WHEN TG_TABLE_NAME='projects' THEN 'project.' || lower(TG_OP)
         ELSE 'municipality.update' END,row_id);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS audit_projects ON public.projects;
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_tenant_change();
DROP TRIGGER IF EXISTS audit_municipality ON public.municipalities;
CREATE TRIGGER audit_municipality AFTER UPDATE ON public.municipalities
  FOR EACH ROW EXECUTE FUNCTION public.audit_tenant_change();
REVOKE ALL ON FUNCTION public.audit_tenant_change() FROM PUBLIC;

-- Atomic, persistent counter across multiple app replicas; no raw IP or email is stored.
CREATE OR REPLACE FUNCTION public.auth_consume_limit(p_bucket text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE permitted boolean; cap integer;
BEGIN
  IF p_bucket !~ '^(acct|ip):[a-f0-9]{64}$' THEN RETURN false; END IF;
  cap := CASE WHEN left(p_bucket,5)='acct:' THEN 5 ELSE 30 END;
  WITH attempt AS (
    INSERT INTO public.auth_rate_limits(bucket,attempts,window_end)
    VALUES (p_bucket,1,clock_timestamp()+interval '15 minutes')
    ON CONFLICT(bucket) DO UPDATE SET
      attempts=CASE WHEN auth_rate_limits.window_end <= clock_timestamp()
                    THEN 1 ELSE auth_rate_limits.attempts+1 END,
      window_end=CASE WHEN auth_rate_limits.window_end <= clock_timestamp()
                      THEN clock_timestamp()+interval '15 minutes' ELSE auth_rate_limits.window_end END
    RETURNING attempts
  ) SELECT attempts <= cap INTO permitted FROM attempt;
  RETURN coalesce(permitted,false);
END $$;
REVOKE ALL ON FUNCTION public.auth_consume_limit(text) FROM PUBLIC;

-- Replace legacy login/lookup functions: previous JWTs without a session UUID expire immediately.
DROP FUNCTION IF EXISTS public.auth_login(text,text);
DROP FUNCTION IF EXISTS public.auth_session_user(uuid);

CREATE FUNCTION public.auth_login(p_email text,p_password text)
RETURNS TABLE(id uuid,sid uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE found_id uuid; found_hash text; tenant uuid;
BEGIN
  SELECT u.id,u.password_hash,u.municipality_id INTO found_id,found_hash,tenant
  FROM public.users u WHERE lower(u.email)=lower(p_email) AND u.active=true LIMIT 1;
  IF found_hash IS NULL THEN
    PERFORM public.crypt(p_password,'$2a$12$C6UzMDM.H6dfI/f/IKcEeO8F2gEqMqCrxU63lSu3JH8p2JQfLQKGS');
    RETURN;
  END IF;
  IF found_hash = public.crypt(p_password,found_hash) THEN
    INSERT INTO public.user_sessions(user_id,municipality_id,expires_at)
    VALUES (found_id,tenant,clock_timestamp()+interval '8 hours')
    RETURNING user_sessions.id INTO sid;
    id := found_id; RETURN NEXT;
  END IF;
END $$;

CREATE FUNCTION public.auth_session_user(p_user_id uuid,p_sid uuid)
RETURNS TABLE(id uuid,full_name text,email text,role text,municipality_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog,public AS $$
  SELECT u.id,u.full_name,u.email,u.role,u.municipality_id
  FROM public.users u
  JOIN public.user_sessions s ON s.user_id=u.id AND s.municipality_id=u.municipality_id
  WHERE u.id=p_user_id AND s.id=p_sid AND u.active=true
    AND s.revoked_at IS NULL AND s.expires_at > now()
$$;

CREATE OR REPLACE FUNCTION public.auth_revoke_session(p_user_id uuid,p_sid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
BEGIN
  UPDATE public.user_sessions
  SET revoked_at=coalesce(revoked_at,clock_timestamp())
  WHERE id=p_sid AND user_id=p_user_id;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.auth_login(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_session_user(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_revoke_session(uuid,uuid) FROM PUBLIC;
