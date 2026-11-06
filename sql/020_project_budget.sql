-- AF-025: orçamento físico-financeiro *declarado* por projeto municipal.
-- Quantidades em milésimos de unidade, preço unitário em centavos e
-- arredondamento half-up por item. O total é exclusivamente SUM(itens).
-- Nenhum preço é cotação pública/atualizada, e não há execução orçamentária.
CREATE TABLE public.project_budget_stages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 stage_number integer NOT NULL CHECK(stage_number BETWEEN 1 AND 200),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 160),
 starts_on date NOT NULL CHECK(starts_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 ends_on date NOT NULL CHECK(ends_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 assumptions text NOT NULL CHECK(length(btrim(assumptions)) BETWEEN 10 AND 1200),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id),
 UNIQUE(municipality_id,project_id,stage_number),
 CHECK(starts_on<=ends_on),
 FOREIGN KEY(project_id,municipality_id)
  REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_budget_stages_tenant
 ON public.project_budget_stages(municipality_id,project_id,stage_number);

CREATE TABLE public.project_budget_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 stage_id uuid NOT NULL,
 line_number integer NOT NULL CHECK(line_number BETWEEN 1 AND 9999),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 160),
 unit text NOT NULL CHECK(unit IN
  ('un','m','m2','m3','km','kg','hora','dia','mes','servico')),
 quantity_milli bigint NOT NULL CHECK(quantity_milli BETWEEN 1 AND 999999999),
 unit_cost_cents bigint NOT NULL CHECK(unit_cost_cents BETWEEN 0 AND 99999999999999),
 line_total_cents bigint GENERATED ALWAYS AS
  (floor((quantity_milli::numeric*unit_cost_cents::numeric+500)/1000)::bigint) STORED,
 assumptions text NOT NULL CHECK(length(btrim(assumptions)) BETWEEN 10 AND 1200),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id,stage_id),
 UNIQUE(municipality_id,stage_id,line_number),
 CHECK(line_total_cents BETWEEN 0 AND 99999999999999),
 FOREIGN KEY(stage_id,municipality_id,project_id)
  REFERENCES public.project_budget_stages(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_budget_items_stage
 ON public.project_budget_items(municipality_id,project_id,stage_id,line_number);

CREATE TABLE public.project_budget_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 stage_id uuid NOT NULL,
 item_id uuid,
 action text NOT NULL CHECK(action IN ('etapa_criada','item_adicionado')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 1200),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 0 AND 99999999999999),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((action='etapa_criada' AND item_id IS NULL AND amount_cents=0) OR
       (action='item_adicionado' AND item_id IS NOT NULL)),
 FOREIGN KEY(stage_id,municipality_id,project_id)
  REFERENCES public.project_budget_stages(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(item_id,municipality_id,project_id,stage_id)
  REFERENCES public.project_budget_items(id,municipality_id,project_id,stage_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_id,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX idx_budget_events_one_per_stage
 ON public.project_budget_events(stage_id) WHERE action='etapa_criada';
CREATE UNIQUE INDEX idx_budget_events_one_per_item
 ON public.project_budget_events(item_id) WHERE action='item_adicionado';
CREATE INDEX idx_budget_events_tenant
 ON public.project_budget_events(municipality_id,project_id,recorded_at,id);

ALTER TABLE public.project_budget_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_stages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_events FORCE ROW LEVEL SECURITY;

CREATE POLICY budget_stages_tenant ON public.project_budget_stages
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY budget_items_tenant ON public.project_budget_items
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY budget_events_tenant ON public.project_budget_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
