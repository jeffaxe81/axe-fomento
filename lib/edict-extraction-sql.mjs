// A single statement inserts the batch and all suggestions atomically.
export const CREATE_EDICT_EXTRACTION_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT p.id AS project_id,p.municipality_id,v.id AS doc_id
 FROM projects p
 JOIN project_document_versions v ON v.project_id=p.id
  AND v.municipality_id=p.municipality_id AND v.id=$3::uuid
 JOIN users u ON u.id=$8::uuid AND u.municipality_id=p.municipality_id
  AND u.active AND (u.role='admin' OR u.id=p.owner_user_id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid AND demo.id IS NULL
 FOR SHARE OF p
), batch AS (
 INSERT INTO project_edict_extraction_batches
 (municipality_id,project_id,document_version_id,input_sha256,input_length,
 suggestion_count,note,created_by)
 SELECT e.municipality_id,e.project_id,e.doc_id,$4::text,$5::integer,
  $6::integer,$7::text,$8::uuid FROM eligible e
 RETURNING id,municipality_id,project_id
), suggestions AS (
 INSERT INTO project_edict_suggestions
 (municipality_id,project_id,batch_id,seq,source_page,source_excerpt,
 suggested_requirement,evidence_state)
 SELECT b.municipality_id,b.project_id,b.id,r.seq,r.source_page,
  r.source_excerpt,r.suggested_requirement,r.evidence_state
 FROM batch b
 CROSS JOIN jsonb_to_recordset($9::jsonb) AS r(
  seq integer,source_page integer,source_excerpt text,
  suggested_requirement text,evidence_state text
 )
 RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT id FROM batch) AS batch_id,
 (SELECT COUNT(*)::integer FROM suggestions) AS inserted
`;

export const REVIEW_EDICT_SUGGESTION_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT s.id,s.municipality_id,s.project_id,
  s.source_excerpt,s.evidence_state
 FROM project_edict_suggestions s
 JOIN projects p ON p.id=s.project_id AND p.municipality_id=s.municipality_id
 JOIN users u ON u.id=$7::uuid AND u.municipality_id=s.municipality_id
  AND u.active AND (u.role='admin' OR u.id=p.owner_user_id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE s.id=$3::uuid AND s.municipality_id=$1::uuid
  AND s.project_id=$2::uuid AND demo.id IS NULL
 FOR SHARE OF p
), current_revision AS (
 SELECT COALESCE(MAX(r.revision),0)::integer AS revision
 FROM project_edict_suggestion_reviews r
 JOIN eligible e ON e.id=r.suggestion_id
 WHERE r.municipality_id=$1::uuid AND r.project_id=$2::uuid
), saved AS (
 INSERT INTO project_edict_suggestion_reviews
 (municipality_id,project_id,suggestion_id,revision,decision,review_note,reviewed_by)
 SELECT e.municipality_id,e.project_id,e.id,$4::integer+1,$5::text,$6::text,$7::uuid
 FROM eligible e CROSS JOIN current_revision r
 WHERE r.revision=$4::integer AND r.revision BETWEEN 0 AND 999
  AND ($5::text<>'aprovada' OR
   (e.evidence_state='excerpt' AND e.source_excerpt IS NOT NULL))
 ON CONFLICT(suggestion_id,revision) DO NOTHING
 RETURNING id,revision
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 EXISTS(SELECT 1 FROM eligible
  WHERE evidence_state='excerpt' AND source_excerpt IS NOT NULL) AS has_evidence,
 (SELECT revision FROM current_revision) AS current_revision,
 (SELECT revision FROM saved) AS saved_revision
`;

export const READ_EDICT_BATCHES_SQL=`
SELECT b.id,b.project_id,b.document_version_id,b.input_sha256,b.input_length,
 b.suggestion_count,b.note,b.created_at,v.version AS document_version,
 v.file_name,v.sha256 AS document_sha256,u.full_name AS author_name
FROM project_edict_extraction_batches b
JOIN project_document_versions v ON v.id=b.document_version_id
 AND v.project_id=b.project_id AND v.municipality_id=b.municipality_id
JOIN users u ON u.id=b.created_by AND u.municipality_id=b.municipality_id
WHERE b.project_id=$2::uuid AND b.municipality_id=$1::uuid
ORDER BY b.created_at DESC,b.id DESC LIMIT 50
`;

export const READ_EDICT_SUGGESTIONS_SQL=`
SELECT s.id,s.batch_id,s.seq,s.source_page,s.source_excerpt,
 s.suggested_requirement,s.evidence_state,
 r.revision,r.decision,r.review_note,r.reviewed_at,u.full_name AS reviewer_name
FROM project_edict_suggestions s
LEFT JOIN LATERAL(
 SELECT revision,decision,review_note,reviewed_by,reviewed_at
 FROM project_edict_suggestion_reviews
 WHERE suggestion_id=s.id AND municipality_id=s.municipality_id
  AND project_id=s.project_id ORDER BY revision DESC LIMIT 1
) r ON true
LEFT JOIN users u ON u.id=r.reviewed_by AND u.municipality_id=s.municipality_id
WHERE s.batch_id=$3::uuid AND s.project_id=$2::uuid AND s.municipality_id=$1::uuid
ORDER BY s.seq,s.id
`;
