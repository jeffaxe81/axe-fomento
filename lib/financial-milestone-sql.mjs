// Multi-step mutations are atomic and always run under verified municipal RLS context.
export const CREATE_FINANCIAL_MILESTONE_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT p.id AS project_id,p.municipality_id,pr.id AS protocol_id
 FROM projects p
 JOIN project_external_protocols pr ON pr.project_id=p.id
  AND pr.municipality_id=p.municipality_id AND pr.id=$3::uuid
 JOIN users actor ON actor.id=$9::uuid AND actor.municipality_id=p.municipality_id
  AND actor.active=true
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid AND demo.id IS NULL
  AND (actor.role='admin' OR p.owner_user_id=actor.id)
 FOR SHARE OF p
), created AS (
 INSERT INTO project_financial_milestones
 (municipality_id,project_id,protocol_id,kind,title,planned_on,
  planned_amount_cents,plan_note,created_by,updated_by)
 SELECT municipality_id,project_id,protocol_id,$4::text,$5::text,$6::date,
  $7::bigint,$8::text,$9::uuid,$9::uuid
 FROM eligible
 RETURNING id,municipality_id,project_id,planned_on,planned_amount_cents,plan_note,revision
), event AS (
 INSERT INTO project_financial_milestone_events
 (municipality_id,project_id,milestone_id,action,revision,effective_on,
  amount_cents,note,actor_id)
 SELECT municipality_id,project_id,id,'planned',revision,planned_on,
  planned_amount_cents,plan_note,$9::uuid FROM created RETURNING id
)
SELECT (SELECT id FROM created) AS id,EXISTS(SELECT 1 FROM event) AS created
`;

export const REALIZE_FINANCIAL_MILESTONE_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT m.id,m.project_id,m.municipality_id,m.revision,m.status,m.kind,
  v.id AS proof_id,v.item_id,v.version,v.sha256
 FROM project_financial_milestones m
 JOIN projects p ON p.id=m.project_id AND p.municipality_id=m.municipality_id
 JOIN users actor ON actor.id=$3::uuid AND actor.municipality_id=m.municipality_id
  AND actor.active=true AND (actor.role='admin' OR p.owner_user_id=actor.id)
 JOIN project_document_versions v ON v.id=$4::uuid AND v.project_id=m.project_id
  AND v.municipality_id=m.municipality_id
 WHERE m.id=$2::uuid AND m.municipality_id=$1::uuid
 FOR UPDATE OF m
), changed AS (
 UPDATE project_financial_milestones m
 SET status='realizado',realized_on=$6::date,realized_amount_cents=$7::bigint,
  realization_note=$8::text,proof_version_id=e.proof_id,proof_item_id=e.item_id,
  proof_version=e.version,proof_sha256=e.sha256,realized_by=$3::uuid,
  realized_at=clock_timestamp(),revision=m.revision+1,updated_by=$3::uuid,
  updated_at=clock_timestamp()
 FROM eligible e WHERE m.id=e.id AND m.municipality_id=e.municipality_id
  AND m.status='previsto' AND m.revision=$5::integer
  AND m.revision=1 AND (e.kind='marco' OR $7::bigint>0)
 RETURNING m.id,m.project_id,m.municipality_id,m.revision,m.realized_on,
  m.realized_amount_cents,m.realization_note,m.proof_version_id,m.proof_sha256
), event AS (
 INSERT INTO project_financial_milestone_events
 (municipality_id,project_id,milestone_id,action,revision,effective_on,
  amount_cents,note,proof_version_id,proof_sha256,actor_id)
 SELECT municipality_id,project_id,id,'realized',revision,realized_on,
  realized_amount_cents,realization_note,proof_version_id,proof_sha256,$3::uuid
 FROM changed RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT revision FROM eligible) AS current_revision,
 EXISTS(SELECT 1 FROM event) AS changed
`;
