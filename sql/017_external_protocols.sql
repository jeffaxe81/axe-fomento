-- AF-022: protocolo externo DECLARADO por usuário, vinculado a comprovante imutável.
-- Não existe envio externo nem confirmação automática pelo portal informado.
CREATE UNIQUE INDEX idx_document_version_protocol_proof
 ON public.project_document_versions(id,municipality_id,project_id,item_id,version,sha256);

ALTER TABLE public.project_internal_review_events
 ADD CONSTRAINT review_event_version_uniq UNIQUE(project_id,revision,action);

CREATE TABLE public.project_external_protocols(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 review_revision integer NOT NULL CHECK(review_revision BETWEEN 1 AND 10000),
 review_action text NOT NULL DEFAULT 'authorized' CHECK(review_action='authorized'),
 portal_name varchar(120) NOT NULL CHECK(length(btrim(portal_name)) BETWEEN 3 AND 120),
 portal_url varchar(500) NOT NULL CHECK(portal_url ~ '^https://'),
 portal_host varchar(253) NOT NULL CHECK(length(btrim(portal_host)) BETWEEN 4 AND 253),
 protocol_number varchar(160) NOT NULL CHECK(length(btrim(protocol_number)) BETWEEN 3 AND 160),
 submitted_on date NOT NULL CHECK(submitted_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 proof_version_id uuid NOT NULL,
 proof_item_id uuid NOT NULL,
 proof_version integer NOT NULL CHECK(proof_version BETWEEN 1 AND 20),
 proof_sha256 char(64) NOT NULL CHECK(proof_sha256 ~ '^[a-f0-9]{64}$'),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 recorded_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(municipality_id,portal_host,protocol_number),
 FOREIGN KEY(project_id,municipality_id) REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,review_revision,review_action)
 REFERENCES public.project_internal_review_events(project_id,revision,action) ON DELETE RESTRICT,
 FOREIGN KEY(proof_version_id,municipality_id,project_id,proof_item_id,proof_version,proof_sha256)
 REFERENCES public.project_document_versions(id,municipality_id,project_id,item_id,version,sha256)
 ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_external_protocols_project
 ON public.project_external_protocols(municipality_id,project_id,recorded_at DESC,id);
ALTER TABLE public.project_external_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_external_protocols FORCE ROW LEVEL SECURITY;
CREATE POLICY external_protocols_tenant ON public.project_external_protocols
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
   AND recorded_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
