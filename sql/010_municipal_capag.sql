-- AF-012: histórico da classificação CAPAG digitada e documentada por administrador.
-- Não integra automaticamente a Prévia Fiscal nem certifica aprovação do Tesouro.
CREATE TABLE public.municipal_capag (
 municipality_id uuid PRIMARY KEY REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 classification text NOT NULL CHECK (classification IN ('A+','A','B+','B','C','D','N.D.')),
 base_year integer NOT NULL CHECK (base_year BETWEEN 2017 AND 2100),
 reference_date date NOT NULL CHECK (reference_date >= DATE '2018-01-01'),
 official_url text NOT NULL CHECK(length(official_url)<=600 AND official_url ~
   '^https://(www[.])?(tesourotransparente[.]gov[.]br|gov[.]br)(/|$)'),
 source_label text NOT NULL CHECK(length(btrim(source_label)) BETWEEN 5 AND 180),
 recorded_by uuid NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>=1),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(recorded_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE TABLE public.municipal_capag_history (
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version>=1),
 classification text NOT NULL CHECK(classification IN ('A+','A','B+','B','C','D','N.D.')),
 base_year integer NOT NULL,
 reference_date date NOT NULL,
 official_url text NOT NULL,
 source_label text NOT NULL,
 recorded_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL,
 PRIMARY KEY(municipality_id,version),
 FOREIGN KEY(recorded_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
ALTER TABLE public.municipal_capag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_capag FORCE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_capag_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_capag_history FORCE ROW LEVEL SECURITY;
CREATE POLICY municipal_capag_tenant ON public.municipal_capag
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
   AND recorded_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY municipal_capag_history_tenant ON public.municipal_capag_history
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
   AND recorded_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
