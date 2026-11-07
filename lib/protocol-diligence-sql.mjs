// CTEs atômicas: auditoria e atualização entram na mesma transação da conexão RLS.
export const CREATE_PROTOCOL_DILIGENCE_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT p.id AS project_id,p.municipality_id,proto.id AS protocol_id,u.id AS assignee
 FROM projects p
 JOIN project_external_protocols proto
   ON proto.project_id=p.id AND proto.municipality_id=p.municipality_id
   AND proto.id=$3::uuid
 JOIN users actor ON actor.id=$8::uuid AND actor.municipality_id=p.municipality_id
   AND actor.active=true
 JOIN users u ON u.id=$4::uuid AND u.municipality_id=p.municipality_id
   AND u.active=true
 WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid
   AND (actor.role='admin' OR p.owner_user_id=actor.id)
 FOR SHARE OF p
), created AS (
 INSERT INTO project_protocol_diligences
 (municipality_id,project_id,protocol_id,assigned_to,title,details,due_on,created_by,updated_by)
 SELECT municipality_id,project_id,protocol_id,assignee,
  $5::text,$6::text,$7::date,$8::uuid,$8::uuid FROM eligible
 RETURNING id,municipality_id,project_id,details,revision
), event AS (
 INSERT INTO project_protocol_diligence_events
 (municipality_id,project_id,diligence_id,action,revision,note,actor_id)
 SELECT municipality_id,project_id,id,'criada',revision,details,$8::uuid
 FROM created RETURNING id
)
SELECT (SELECT id FROM created) AS id,EXISTS(SELECT 1 FROM event) AS created
`;

export const REPLY_PROTOCOL_DILIGENCE_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT d.id,d.project_id,d.municipality_id,d.revision,d.state,
  proof.id AS proof_id,proof.item_id,proof.version,proof.sha256
 FROM project_protocol_diligences d
 JOIN users actor ON actor.id=$3::uuid AND actor.municipality_id=d.municipality_id
  AND actor.active=true AND (actor.role='admin' OR actor.id=d.assigned_to)
 JOIN project_document_versions proof ON proof.id=$4::uuid
   AND proof.project_id=d.project_id AND proof.municipality_id=d.municipality_id
 WHERE d.id=$2::uuid AND d.municipality_id=$1::uuid
 FOR UPDATE OF d
), changed AS (
 UPDATE project_protocol_diligences d
 SET state='respondida',response_text=$6::text,proof_version_id=e.proof_id,
  proof_item_id=e.item_id,proof_version=e.version,proof_sha256=e.sha256,
  responded_by=$3::uuid,responded_at=clock_timestamp(),
  updated_by=$3::uuid,updated_at=clock_timestamp(),revision=d.revision+1
 FROM eligible e WHERE d.id=e.id AND d.municipality_id=e.municipality_id
   AND d.revision=$5::integer AND d.revision<10000 AND d.state='pendente'
 RETURNING d.id,d.project_id,d.municipality_id,d.revision,d.response_text,
  d.proof_version_id,d.proof_sha256
), event AS (
 INSERT INTO project_protocol_diligence_events
 (municipality_id,project_id,diligence_id,action,revision,note,
  proof_version_id,proof_sha256,actor_id)
 SELECT municipality_id,project_id,id,'respondida',revision,response_text,
  proof_version_id,proof_sha256,$3::uuid FROM changed RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT revision FROM eligible) AS current_revision,
 EXISTS(SELECT 1 FROM event) AS changed
`;
