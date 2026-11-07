-- AF-018: anexo privado versionado com limites e acesso municipal.
ALTER TABLE public.project_document_items
 ADD COLUMN current_version integer NOT NULL DEFAULT 0 CHECK(current_version BETWEEN 0 AND 20);

CREATE TABLE public.project_document_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 item_id uuid NOT NULL,
 version integer NOT NULL CHECK(version BETWEEN 1 AND 20),
 file_name varchar(120) NOT NULL CHECK(length(btrim(file_name)) BETWEEN 1 AND 120),
 media_type text NOT NULL CHECK(media_type IN ('application/pdf','image/png','image/jpeg')),
 content_length integer NOT NULL CHECK(content_length BETWEEN 1 AND 2097152),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 ciphertext bytea NOT NULL CHECK(octet_length(ciphertext)=content_length),
 nonce bytea NOT NULL CHECK(octet_length(nonce)=12),
 auth_tag bytea NOT NULL CHECK(octet_length(auth_tag)=16),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 uploaded_by uuid NOT NULL,
 uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(item_id,version),
 FOREIGN KEY(item_id,municipality_id,project_id)
  REFERENCES public.project_document_items(id,municipality_id,project_id) ON DELETE CASCADE,
 FOREIGN KEY(uploaded_by,municipality_id)
  REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_document_versions_tenant ON public.project_document_versions(municipality_id,project_id,item_id,version DESC);
ALTER TABLE public.project_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY document_versions_tenant ON public.project_document_versions
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND uploaded_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
