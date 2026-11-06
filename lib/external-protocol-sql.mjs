export const INSERT_EXTERNAL_PROTOCOL_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT p.id,p.municipality_id,r.revision,
   proof.id AS proof_id,proof.item_id,proof.version,proof.sha256
 FROM projects p
 JOIN project_internal_reviews r ON r.project_id=p.id AND r.municipality_id=p.municipality_id
   AND r.state='autorizada' AND r.revision=$4::integer
 JOIN project_internal_review_events event ON event.project_id=r.project_id
   AND event.revision=r.revision AND event.action='authorized'
 JOIN project_document_versions proof ON proof.municipality_id=p.municipality_id
   AND proof.project_id=p.id AND proof.id=$9::uuid
 JOIN users actor ON actor.id=$3::uuid AND actor.municipality_id=p.municipality_id
   AND actor.active=true
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid AND demo.id IS NULL
   AND (actor.role='admin' OR p.owner_user_id=actor.id)
 FOR SHARE OF p,r
), created AS (
 INSERT INTO project_external_protocols
 (municipality_id,project_id,review_revision,portal_name,portal_url,portal_host,
  protocol_number,submitted_on,proof_version_id,proof_item_id,proof_version,proof_sha256,
  note,recorded_by)
 SELECT municipality_id,id,revision,$5::text,$6::text,$7::text,
  $8::text,$10::date,proof_id,item_id,version,sha256,
  $11::text,$3::uuid FROM eligible WHERE true
 ON CONFLICT(municipality_id,portal_host,protocol_number) DO NOTHING
 RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT id FROM created) AS id
`;
