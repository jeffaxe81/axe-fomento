-- V1 municipal pilot: self-reported evidence, not independent operational approval.
CREATE TABLE public.pilot_gate_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id),
 gate_id text NOT NULL CHECK(gate_id IN('OP-01','OP-02','OP-03','OP-04','OP-05','OP-06','OP-07','OP-08')),
 environment_label text NOT NULL CHECK(length(btrim(environment_label)) BETWEEN 5 AND 100),
 result_claimed text NOT NULL CHECK(result_claimed IN('pass','fail','blocked')),
 evidence_url text NOT NULL CHECK(length(evidence_url) BETWEEN 12 AND 500 AND evidence_url LIKE 'https://%'),
 evidence_sha256 char(64) CHECK(evidence_sha256 IS NULL OR evidence_sha256 ~ '^[a-f0-9]{64}$'),
 performed_on date NOT NULL CHECK(performed_on BETWEEN DATE '2020-01-01' AND DATE '2100-01-01'),
 notes text NOT NULL CHECK(length(btrim(notes)) BETWEEN 30 AND 1500),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX pilot_gate_evidence_latest ON public.pilot_gate_evidence
(municipality_id,gate_id,created_at DESC,id DESC);
ALTER TABLE public.pilot_gate_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_gate_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY pilot_gate_evidence_tenant ON public.pilot_gate_evidence
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
