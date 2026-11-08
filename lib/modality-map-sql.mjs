// Atomic creation of criteria and initial pending event. No partial registration.
export const CREATE_MODALITY_CHECK_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT p.id,p.municipality_id,v.id AS version_id,v.source_id,v.version
 FROM projects p
 JOIN users u ON u.id=$7::uuid AND u.municipality_id=p.municipality_id
  AND u.active AND (u.role='admin' OR p.owner_user_id=u.id)
 JOIN municipal_normative_versions v
  ON v.id=$6::uuid AND v.municipality_id=p.municipality_id
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid AND demo.id IS NULL
 FOR SHARE OF p
), created AS (
 INSERT INTO project_modality_checks
 (municipality_id,project_id,modality,rule_number,criterion,
  normative_source_id,normative_version_id,normative_version,created_by)
 SELECT municipality_id,id,$3::text,$4::integer,$5::text,
  source_id,version_id,version,$7::uuid
 FROM eligible
 ON CONFLICT(municipality_id,project_id,modality,rule_number) DO NOTHING
 RETURNING id,municipality_id,project_id
), logged AS (
 INSERT INTO project_modality_review_events
 (municipality_id,project_id,check_id,revision,status,justification,actor_id)
 SELECT municipality_id,project_id,id,1,'pendente',
 'Critério registrado para avaliação humana, sem conclusão automática.',
 $7::uuid FROM created RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT id FROM created) AS id,
 EXISTS(SELECT 1 FROM logged) AS saved
`;

// The unique (check_id,revision) index is the optimistic concurrency guard.
export const REVIEW_MODALITY_CHECK_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT c.id,c.project_id,c.municipality_id
 FROM project_modality_checks c
 JOIN projects p ON p.id=c.project_id AND p.municipality_id=c.municipality_id
 JOIN users u ON u.id=$7::uuid AND u.municipality_id=c.municipality_id
  AND u.active AND (u.role='admin' OR p.owner_user_id=u.id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE c.municipality_id=$1::uuid AND c.project_id=$2::uuid
  AND c.id=$3::uuid AND demo.id IS NULL
 FOR SHARE OF p
), current_revision AS (
 SELECT COALESCE(MAX(e.revision),0)::integer AS revision FROM
 project_modality_review_events e JOIN eligible a ON e.check_id=a.id
 WHERE e.municipality_id=$1::uuid AND e.project_id=$2::uuid
), logged AS (
 INSERT INTO project_modality_review_events
 (municipality_id,project_id,check_id,revision,status,justification,actor_id)
 SELECT municipality_id,project_id,id,$4::integer+1,$5::text,$6::text,$7::uuid
 FROM eligible CROSS JOIN current_revision
 WHERE current_revision.revision=$4::integer
  AND current_revision.revision BETWEEN 1 AND 9999
 ON CONFLICT(check_id,revision) DO NOTHING
 RETURNING id,revision
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT revision FROM current_revision) AS current_revision,
 (SELECT revision FROM logged) AS saved_revision
`;

export const READ_MODALITY_CHECKS_SQL=`
SELECT c.id,c.modality,c.rule_number,c.criterion,c.normative_source_id,
 c.normative_version_id,c.normative_version,c.created_at,
 s.reference_code,s.title AS normative_title,s.jurisdiction,s.state_uf,
 v.source_url,v.source_section,v.excerpt,v.snapshot_sha256,
 to_char(v.valid_from,'YYYY-MM-DD') AS valid_from,
 to_char(v.valid_until,'YYYY-MM-DD') AS valid_until,
 e.revision,e.status,e.justification,e.actor_id,e.recorded_at,
 u.full_name AS reviewer_name
FROM project_modality_checks c
JOIN municipal_normative_versions v ON v.id=c.normative_version_id
 AND v.source_id=c.normative_source_id AND v.municipality_id=c.municipality_id
 AND v.version=c.normative_version
JOIN municipal_normative_sources s ON s.id=c.normative_source_id
 AND s.municipality_id=c.municipality_id
LEFT JOIN LATERAL(
 SELECT revision,status,justification,actor_id,recorded_at FROM
 project_modality_review_events
 WHERE check_id=c.id AND municipality_id=c.municipality_id AND project_id=c.project_id
 ORDER BY revision DESC LIMIT 1
) e ON true
LEFT JOIN users u ON u.id=e.actor_id AND u.municipality_id=c.municipality_id
WHERE c.municipality_id=$1::uuid AND c.project_id=$2::uuid
ORDER BY c.modality,c.rule_number,c.id
`;
