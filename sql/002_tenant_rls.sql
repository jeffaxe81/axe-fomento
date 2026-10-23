-- RLS para os dados privativos. O papel da aplicação não pode ser dono das tabelas,
-- superusuário ou ter BYPASSRLS. Sem app.municipality_id válido: zero linhas.
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='municipalities' AND policyname='municipality_tenant_scope') THEN
    CREATE POLICY municipality_tenant_scope ON public.municipalities FOR ALL
      USING (id = NULLIF(current_setting('app.municipality_id', true), '')::uuid)
      WITH CHECK (id = NULLIF(current_setting('app.municipality_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_tenant_scope') THEN
    CREATE POLICY users_tenant_scope ON public.users FOR SELECT
      USING (municipality_id = NULLIF(current_setting('app.municipality_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_tenant_scope') THEN
    CREATE POLICY projects_tenant_scope ON public.projects FOR ALL
      USING (municipality_id = NULLIF(current_setting('app.municipality_id', true), '')::uuid)
      WITH CHECK (municipality_id = NULLIF(current_setting('app.municipality_id', true), '')::uuid);
  END IF;
END
$policy$;

-- Funções autorizadas apenas para descoberta de credenciais e sessão autenticada.
-- Funções SECURITY DEFINER pertencem ao papel de migração, nunca ao papel runtime.
CREATE OR REPLACE FUNCTION public.auth_lookup_credentials(p_email text)
RETURNS TABLE(id uuid, password_hash text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
  SELECT u.id, u.password_hash FROM public.users u
  WHERE lower(u.email) = lower(p_email) AND u.active = true LIMIT 1;
$body$;

CREATE OR REPLACE FUNCTION public.auth_resolve_session(p_user_id uuid)
RETURNS TABLE(id uuid, full_name text, email text, role text, municipality_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
  SELECT u.id, u.full_name, u.email, u.role, u.municipality_id
  FROM public.users u WHERE u.id = p_user_id AND u.active = true LIMIT 1;
$body$;

REVOKE ALL ON FUNCTION public.auth_lookup_credentials(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_resolve_session(uuid) FROM PUBLIC;
