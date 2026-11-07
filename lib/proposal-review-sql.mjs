// All inserts, permission checks, version freshness and review revision
// comparison are evaluated atomically by a single PostgreSQL statement.
// Review history is append-only and tied to a specific immutable version.
export const INSERT_PROPOSAL_REVIEW_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT v.id AS version_id,v.version,v.municipality_id,v.project_id,v.draft_id,
  v.sections,v.missing_fields,v.created_by AS version_author
 FROM project_proposal_versions v
 JOIN project_proposal_drafts d
  ON d.id=v.draft_id AND d.municipality_id=v.municipality_id
  AND d.project_id=v.project_id
 JOIN projects p
  ON p.id=v.project_id AND p.municipality_id=v.municipality_id
 JOIN users u ON u.id=$8::uuid AND u.municipality_id=v.municipality_id
  AND u.active AND u.role='admin' AND v.created_by<>u.id
 LEFT JOIN opportunities demo
  ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE v.municipality_id=$1::uuid AND v.project_id=$2::uuid
  AND v.draft_id=$3::uuid AND v.id=$4::uuid
  AND demo.id IS NULL
  AND v.version=(SELECT max(latest.version) FROM project_proposal_versions latest
   WHERE latest.municipality_id=v.municipality_id
    AND latest.project_id=v.project_id AND latest.draft_id=v.draft_id)
), previous AS MATERIALIZED (
 SELECT coalesce(max(r.revision),0)::integer AS revision
 FROM project_proposal_review_events r
 JOIN eligible e ON e.version_id=r.version_id
 WHERE r.municipality_id=$1::uuid AND r.project_id=$2::uuid
), saved AS (
 INSERT INTO project_proposal_review_events(
  municipality_id,project_id,draft_id,version_id,revision,decision,
  review_note,acknowledged_missing_sources,reviewer_id)
 SELECT e.municipality_id,e.project_id,e.draft_id,e.version_id,
  p.revision+1,$5::text,$6::text,$7::boolean,$8::uuid
 FROM eligible e CROSS JOIN previous p
 WHERE p.revision=$9::integer AND p.revision BETWEEN 0 AND 999
  AND ($5::text<>'aprovada' OR
   (position('[PREENCHER E VALIDAR' IN e.sections::text)=0 AND $7::boolean))
 ON CONFLICT(version_id,revision) DO NOTHING
 RETURNING id,revision
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 EXISTS(SELECT 1 FROM eligible
  WHERE position('[PREENCHER E VALIDAR' IN sections::text)>0) AS placeholders,
 (SELECT revision FROM previous) AS current_revision,
 (SELECT revision FROM saved) AS saved_revision
`;

export const READ_PROPOSAL_REVIEW_SUMMARIES_SQL=`
SELECT DISTINCT ON (r.version_id)
 r.version_id,r.revision,r.decision,r.review_note,r.acknowledged_missing_sources,
 r.reviewed_at,u.full_name AS reviewer_name
FROM project_proposal_review_events r
JOIN users u ON u.id=r.reviewer_id AND u.municipality_id=r.municipality_id
WHERE r.municipality_id=$1::uuid AND r.project_id=$2::uuid AND r.draft_id=$3::uuid
ORDER BY r.version_id,r.revision DESC
`;

export const READ_PROPOSAL_REVIEW_HISTORY_SQL=`
SELECT r.id,r.revision,r.decision,r.review_note,r.acknowledged_missing_sources,
 r.reviewed_at,u.full_name AS reviewer_name,
 v.version,v.created_by AS version_author
FROM project_proposal_review_events r
JOIN project_proposal_versions v ON v.id=r.version_id
 AND v.municipality_id=r.municipality_id AND v.project_id=r.project_id
 AND v.draft_id=r.draft_id
JOIN users u ON u.id=r.reviewer_id AND u.municipality_id=r.municipality_id
WHERE r.municipality_id=$1::uuid AND r.project_id=$2::uuid AND r.version_id=$3::uuid
ORDER BY r.revision DESC LIMIT 1000
`;
