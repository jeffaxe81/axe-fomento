-- 002: protect municipal data at PostgreSQL level.
-- The migration/owner account is ONLY for setup; web uses fomento_app.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_id_municipality ON public.users(id, municipality_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_owner_same_municipality') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_owner_same_municipality
      FOREIGN KEY (owner_user_id, municipality_id) REFERENCES public.users(id, municipality_id)
      ON DELETE SET NULL (owner_user_id);
  END IF;
END $$;

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS municipalities_tenant ON public.municipalities;
CREATE POLICY municipalities_tenant ON public.municipalities
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS users_tenant ON public.users;
CREATE POLICY users_tenant ON public.users
  USING (municipality_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (municipality_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS projects_tenant ON public.projects;
CREATE POLICY projects_tenant ON public.projects
  USING (municipality_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (municipality_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Authentication executes as migration/table owner without exposing users' password hashes.
CREATE OR REPLACE FUNCTION public.auth_login(p_email text, p_password text)
RETURNS TABLE(id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE found_id uuid; found_hash text;
BEGIN
  SELECT u.id, u.password_hash INTO found_id, found_hash
    FROM public.users u WHERE lower(u.email)=lower(p_email) AND u.active = true LIMIT 1;
  IF found_hash IS NULL THEN
    PERFORM public.crypt(p_password, '$2a$12$C6UzMDM.H6dfI/f/IKcEeO8F2gEqMqCrxU63lSu3JH8p2JQfLQKGS');
    RETURN;
  END IF;
  IF found_hash = public.crypt(p_password, found_hash) THEN
    id := found_id;
    RETURN NEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.auth_session_user(p_id uuid)
RETURNS TABLE(id uuid, full_name text, email text, role text, municipality_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT u.id, u.full_name, u.email, u.role, u.municipality_id
  FROM public.users u WHERE u.id=p_id AND u.active = true
$$;
REVOKE ALL ON FUNCTION public.auth_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_session_user(uuid) FROM PUBLIC;
