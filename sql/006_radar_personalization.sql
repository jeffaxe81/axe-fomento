-- AF-007/008: preferências isoladas por município e pelo usuário autenticado.
CREATE TABLE IF NOT EXISTS public.opportunity_favorites (
  municipality_id uuid NOT NULL,
  user_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (municipality_id, user_id, opportunity_id),
  FOREIGN KEY (user_id, municipality_id) REFERENCES public.users(id, municipality_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_favorites_user_recent
  ON public.opportunity_favorites(municipality_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.saved_opportunity_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name varchar(60) NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 60),
  search_text varchar(120) NOT NULL DEFAULT '',
  area varchar(60) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (user_id, municipality_id) REFERENCES public.users(id, municipality_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_searches_unique_name
  ON public.saved_opportunity_searches (municipality_id, user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_recent
  ON public.saved_opportunity_searches (municipality_id, user_id, updated_at DESC);

ALTER TABLE public.opportunity_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunity_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_favorites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunity_searches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunity_favorites_owner ON public.opportunity_favorites;
CREATE POLICY opportunity_favorites_owner ON public.opportunity_favorites
  USING (
    municipality_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    municipality_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );

DROP POLICY IF EXISTS saved_opportunity_searches_owner ON public.saved_opportunity_searches;
CREATE POLICY saved_opportunity_searches_owner ON public.saved_opportunity_searches
  USING (
    municipality_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    municipality_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );
