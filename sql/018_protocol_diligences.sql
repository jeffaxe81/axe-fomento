-- AF-023: diligências municipais DECLARADAS, vinculadas a protocolo registrado.
-- Sem comunicação com portal e sem validação oficial do prazo ou resposta.
ALTER TABLE public.project_external_protocols
 ADD CONSTRAINT external_protocol_project_key UNIQUE(id,municipality_id,project_id);

CREATE TABLE public.project_protocol_diligences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 protocol_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 180),
 details text NOT NULL CHECK(length(btrim(details)) BETWEEN 10 AND 1200),
 due_on date NOT NULL CHECK(due_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 assigned_to uuid NOT NULL,
 state text NOT NULL DEFAULT 'pendente' CHECK(state IN ('pendente','respondida')),
 response_text text,
 proof_version_id uuid,
 proof_item_id uuid,
 proof_version integer,
 proof_sha256 char(64),
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 10000),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 responded_by uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 responded_at timestamptz,
 UNIQUE(id,municipality_id,project_id),
 CHECK((state='pendente' AND response_text IS NULL AND proof_version_id IS NULL AND
  proof_item_id IS NULL AND proof_version IS NULL AND proof_sha256 IS NULL AND
  responded_by IS NULL AND responded_at IS NULL)
  OR (state='respondida' AND length(btrim(response_text)) BETWEEN 10 AND 1500 AND
  proof_version_id IS NOT NULL AND proof_item_id IS NOT NULL AND proof_version IS NOT NULL AND
  proof_sha256 IS NOT NULL AND responded_by IS NOT NULL AND responded_at IS NOT NULL)),
 FOREIGN KEY(protocol_id,municipality_id,project_id)
  REFERENCES public.project_external_protocols(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,municipality_id)
  REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(assigned_to,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(updated_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(responded_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(proof_version_id,municipality_id,project_id,proof_item_id,proof_version,proof_sha256)
  REFERENCES public.project_document_versions(id,municipality_id,project_id,item_id,version,sha256)
  ON DELETE RESTRICT
);
CREATE INDEX idx_diligences_tenant_due
 ON public.project_protocol_diligences(municipality_id,state,due_on,project_id);
CREATE INDEX idx_diligences_tenant_assignee
 ON public.project_protocol_diligences(municipality_id,assigned_to,state,due_on);
CREATE INDEX idx_diligences_protocol
 ON public.project_protocol_diligences(municipality_id,protocol_id,created_at DESC);

CREATE TABLE public.project_protocol_diligence_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 diligence_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('criada','respondida')),
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 10000),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 1500),
 proof_version_id uuid,
 proof_sha256 char(64),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(diligence_id,revision),
 FOREIGN KEY(diligence_id,municipality_id,project_id)
  REFERENCES public.project_protocol_diligences(id,municipality_id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_id,municipality_id) REFERENCES public.users(id,municipality_id),
 CHECK((action='criada' AND revision=1 AND proof_version_id IS NULL AND proof_sha256 IS NULL)
  OR (action='respondida' AND revision>1 AND proof_version_id IS NOT NULL AND proof_sha256 IS NOT NULL))
);
CREATE INDEX idx_diligence_events ON public.project_protocol_diligence_events
 (municipality_id,project_id,diligence_id,revision DESC);

ALTER TABLE public.project_protocol_diligences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_protocol_diligences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_protocol_diligence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_protocol_diligence_events FORCE ROW LEVEL SECURITY;
CREATE POLICY protocol_diligences_tenant ON public.project_protocol_diligences
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND updated_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY protocol_diligence_events_tenant ON public.project_protocol_diligence_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
