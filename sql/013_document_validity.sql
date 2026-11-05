-- AF-019: validade declarada dos documentos e responsável pela renovação.
-- A data é informada pela equipe: não existe inferência de validade jurídica.
ALTER TABLE public.project_document_items
 ADD COLUMN valid_until date,
 ADD COLUMN renewal_owner_user_id uuid,
 ADD COLUMN validity_evidence_note text NOT NULL DEFAULT '',
 ADD COLUMN validity_updated_by uuid,
 ADD COLUMN validity_updated_at timestamptz,
 ADD CONSTRAINT document_validity_fields CHECK (
  (valid_until IS NULL AND renewal_owner_user_id IS NULL AND validity_evidence_note=''
   AND validity_updated_by IS NULL AND validity_updated_at IS NULL)
  OR
  (valid_until IS NOT NULL AND valid_until BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
   AND renewal_owner_user_id IS NOT NULL
   AND length(btrim(validity_evidence_note)) BETWEEN 10 AND 500
   AND validity_updated_by IS NOT NULL AND validity_updated_at IS NOT NULL)
 ),
 ADD CONSTRAINT renewal_owner_same_municipality FOREIGN KEY(renewal_owner_user_id,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT,
 ADD CONSTRAINT validity_actor_same_municipality FOREIGN KEY(validity_updated_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT;

CREATE INDEX idx_document_expiry_tenant
 ON public.project_document_items(municipality_id,valid_until,project_id)
 WHERE valid_until IS NOT NULL;

CREATE TABLE public.project_document_validity_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 item_id uuid NOT NULL,
 valid_until date,
 renewal_owner_user_id uuid,
 evidence_note text NOT NULL DEFAULT '' CHECK(length(evidence_note)<=500),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(item_id,municipality_id,project_id)
  REFERENCES public.project_document_items(id,municipality_id,project_id) ON DELETE CASCADE,
 FOREIGN KEY(renewal_owner_user_id,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_id,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT,
 CONSTRAINT validity_event_consistent CHECK(
   (valid_until IS NULL AND renewal_owner_user_id IS NULL AND evidence_note='')
   OR (valid_until IS NOT NULL AND renewal_owner_user_id IS NOT NULL
       AND length(btrim(evidence_note)) BETWEEN 10 AND 500))
);
CREATE INDEX idx_document_validity_events_tenant
 ON public.project_document_validity_events(municipality_id,project_id,recorded_at DESC);

ALTER TABLE public.project_document_validity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_validity_events FORCE ROW LEVEL SECURITY;
CREATE POLICY document_validity_events_tenant ON public.project_document_validity_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
