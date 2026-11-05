-- AF-017: modelos documentais manuais por município e modalidade,
-- aplicados como instantâneo ao projeto. Sem geração automática de exigências.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_document_tenant ON public.projects(id,municipality_id);

CREATE TABLE public.municipal_document_templates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 modality text NOT NULL CHECK(modality IN ('convenio','transferencia','financiamento','cooperacao','outra')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 180),
 guidance text NOT NULL DEFAULT '' CHECK(length(guidance)<=600),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,modality),
 UNIQUE(municipality_id,modality,title),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_document_templates_tenant ON public.municipal_document_templates(municipality_id,modality,title);

CREATE TABLE public.project_document_checklists(
 project_id uuid PRIMARY KEY,
 municipality_id uuid NOT NULL,
 modality text NOT NULL CHECK(modality IN ('convenio','transferencia','financiamento','cooperacao','outra')),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(project_id,municipality_id,modality),
 FOREIGN KEY(project_id,municipality_id) REFERENCES public.projects(id,municipality_id) ON DELETE CASCADE,
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
);

CREATE TABLE public.project_document_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 modality text NOT NULL,
 template_id uuid NOT NULL,
 title text NOT NULL,
 guidance text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','apresentado','dispensado')),
 evidence_note text NOT NULL DEFAULT '' CHECK(length(evidence_note)<=1000
   AND (status='pendente' OR length(btrim(evidence_note))>=10)),
 updated_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(project_id,template_id),
 UNIQUE(id,municipality_id,project_id),
 FOREIGN KEY(project_id,municipality_id,modality)
   REFERENCES public.project_document_checklists(project_id,municipality_id,modality) ON DELETE CASCADE,
 FOREIGN KEY(template_id,municipality_id,modality)
   REFERENCES public.municipal_document_templates(id,municipality_id,modality),
 FOREIGN KEY(updated_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_project_document_items_tenant ON public.project_document_items(municipality_id,project_id,status);

CREATE TABLE public.project_document_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 item_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('pendente','apresentado','dispensado')),
 evidence_note text NOT NULL CHECK(length(evidence_note)<=1000),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(item_id,municipality_id,project_id)
   REFERENCES public.project_document_items(id,municipality_id,project_id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_project_document_events_tenant
 ON public.project_document_events(municipality_id,project_id,recorded_at DESC);

ALTER TABLE public.municipal_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_document_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_checklists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_events FORCE ROW LEVEL SECURITY;

CREATE POLICY document_templates_tenant ON public.municipal_document_templates
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY document_checklists_tenant ON public.project_document_checklists
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY document_items_tenant ON public.project_document_items
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND updated_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY document_events_tenant ON public.project_document_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
