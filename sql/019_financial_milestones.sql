-- AF-024: previsão e realização de repasses/marcos declarados, com comprovação privada.
-- Nenhuma transação bancária ou consulta ao portal é feita pelo sistema.
CREATE TABLE public.project_financial_milestones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 protocol_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('repasse','marco')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 180),
 planned_on date NOT NULL CHECK(planned_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 planned_amount_cents bigint NOT NULL CHECK(planned_amount_cents BETWEEN 0 AND 99999999999999),
 plan_note text NOT NULL CHECK(length(btrim(plan_note)) BETWEEN 10 AND 1000),
 status text NOT NULL DEFAULT 'previsto' CHECK(status IN ('previsto','realizado')),
 realized_on date,
 realized_amount_cents bigint CHECK(realized_amount_cents BETWEEN 0 AND 99999999999999),
 realization_note text,
 proof_version_id uuid,
 proof_item_id uuid,
 proof_version integer,
 proof_sha256 char(64),
 realized_by uuid,
 realized_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 10000),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id),
 CHECK(kind='marco' OR planned_amount_cents>0),
 CHECK((status='previsto' AND realized_on IS NULL AND realized_amount_cents IS NULL
   AND realization_note IS NULL AND proof_version_id IS NULL AND proof_item_id IS NULL
   AND proof_version IS NULL AND proof_sha256 IS NULL AND realized_by IS NULL AND realized_at IS NULL)
  OR (status='realizado' AND realized_on IS NOT NULL AND realized_amount_cents IS NOT NULL
   AND (kind='marco' OR realized_amount_cents>0)
   AND length(btrim(realization_note)) BETWEEN 10 AND 1000
   AND proof_version_id IS NOT NULL AND proof_item_id IS NOT NULL AND proof_version IS NOT NULL
   AND proof_sha256 IS NOT NULL AND realized_by IS NOT NULL AND realized_at IS NOT NULL)),
 FOREIGN KEY(project_id,municipality_id)
   REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(protocol_id,municipality_id,project_id)
   REFERENCES public.project_external_protocols(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(proof_version_id,municipality_id,project_id,proof_item_id,proof_version,proof_sha256)
   REFERENCES public.project_document_versions(id,municipality_id,project_id,item_id,version,sha256)
   ON DELETE RESTRICT,
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(updated_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(realized_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_financial_milestones_project
 ON public.project_financial_milestones(municipality_id,project_id,status,planned_on,id);
CREATE INDEX idx_financial_milestones_protocol
 ON public.project_financial_milestones(municipality_id,protocol_id);

CREATE TABLE public.project_financial_milestone_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 milestone_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('planned','realized')),
 revision integer NOT NULL CHECK(revision IN (1,2)),
 effective_on date NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 0 AND 99999999999999),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 1000),
 proof_version_id uuid,
 proof_sha256 char(64),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(milestone_id,revision),
 CHECK((action='planned' AND revision=1 AND proof_version_id IS NULL AND proof_sha256 IS NULL)
  OR (action='realized' AND revision=2 AND proof_version_id IS NOT NULL AND proof_sha256 IS NOT NULL)),
 FOREIGN KEY(milestone_id,municipality_id,project_id)
  REFERENCES public.project_financial_milestones(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_id,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_financial_events_tenant
 ON public.project_financial_milestone_events(municipality_id,project_id,milestone_id,revision);

ALTER TABLE public.project_financial_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_financial_milestones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_financial_milestone_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_financial_milestone_events FORCE ROW LEVEL SECURITY;
CREATE POLICY financial_milestone_tenant ON public.project_financial_milestones
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND updated_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY financial_milestone_event_tenant ON public.project_financial_milestone_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
