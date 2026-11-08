// Alteração e registro de histórico ocorrem atomicamente por município/projeto/documento.
export const UPDATE_DOCUMENT_VALIDITY_SQL = `
WITH eligible AS (
 SELECT d.id
 FROM project_document_items d
 WHERE d.municipality_id=$1::uuid AND d.project_id=$2::uuid AND d.id=$3::uuid
 AND ($4::date IS NULL OR EXISTS (
   SELECT 1 FROM users u WHERE u.municipality_id=d.municipality_id
   AND u.id=$5::uuid AND u.active=true))
), changed AS (
 UPDATE project_document_items d
 SET valid_until=$4::date,renewal_owner_user_id=$5::uuid,
   validity_evidence_note=$6::text,validity_updated_by=CASE
     WHEN $4::date IS NULL THEN NULL ELSE $7::uuid END,
   validity_updated_at=CASE WHEN $4::date IS NULL THEN NULL ELSE clock_timestamp() END,
   updated_by=$7::uuid,updated_at=clock_timestamp()
 FROM eligible e
 WHERE d.id=e.id AND d.municipality_id=$1::uuid AND d.project_id=$2::uuid
   AND (d.valid_until,d.renewal_owner_user_id,d.validity_evidence_note)
   IS DISTINCT FROM ($4::date,$5::uuid,$6::text)
 RETURNING d.id,d.project_id,d.municipality_id,d.valid_until,
   d.renewal_owner_user_id,d.validity_evidence_note
), audit AS (
 INSERT INTO project_document_validity_events
   (municipality_id,project_id,item_id,valid_until,renewal_owner_user_id,evidence_note,actor_id)
 SELECT municipality_id,project_id,id,valid_until,renewal_owner_user_id,
   validity_evidence_note,$7::uuid FROM changed
 RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS applicable,
       EXISTS(SELECT 1 FROM audit) AS changed
`;
