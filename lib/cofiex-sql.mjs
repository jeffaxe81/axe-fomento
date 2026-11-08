// AF-036: stage and reference metadata seeded from official sources.
// Project audit decisions are HUMAN/LOCAL and immutable, never PFE submissions.
export const COFIEX_REFERENCES_SQL=`
SELECT code,title,category,source_url,description,
 to_char(identified_on,'YYYY-MM-DD') AS identified_on
FROM cofiex_official_references
ORDER BY CASE category WHEN 'portal' THEN 1 WHEN 'normativo' THEN 2
 WHEN 'calendario' THEN 3 WHEN 'orientacao' THEN 4 ELSE 5 END,title
`;

export const COFIEX_PROJECT_STAGES_SQL=`
SELECT s.code,s.stage_number,s.title,s.description,
 r.title AS reference_title,r.source_url,r.category,
 latest.revision,latest.consultation_state,
 to_char(latest.consulted_on,'YYYY-MM-DD') AS consulted_on,
 latest.note,latest.recorded_at
FROM cofiex_consultation_stages s
JOIN cofiex_official_references r ON r.code=s.reference_code
LEFT JOIN LATERAL(
 SELECT e.revision,e.consultation_state,e.consulted_on,
  e.note,e.recorded_at FROM project_cofiex_consultation_events e
 WHERE e.municipality_id=$1::uuid AND e.project_id=$2::uuid
  AND e.stage_code=s.code
 ORDER BY e.revision DESC LIMIT 1
) latest ON true
ORDER BY s.stage_number
`;

export const COFIEX_STAGE_HISTORY_SQL=`
SELECT e.id,e.stage_code,e.revision,e.consultation_state,
 to_char(e.consulted_on,'YYYY-MM-DD') AS consulted_on,
 e.note,e.source_url_snapshot,e.reference_code,
 e.snapshot_sha256,e.recorded_at,u.full_name AS author_name
FROM project_cofiex_consultation_events e
JOIN users u ON u.id=e.recorded_by AND u.municipality_id=e.municipality_id
WHERE e.municipality_id=$1::uuid AND e.project_id=$2::uuid
 AND e.stage_code=$3::text
ORDER BY e.revision DESC LIMIT 100
`;

export const CREATE_COFIEX_CHECK_SQL=`
WITH eligible AS MATERIALIZED(
 SELECT p.id AS project_id,p.municipality_id
 FROM projects p
 JOIN users u ON u.municipality_id=p.municipality_id AND u.id=$7::uuid
  AND u.active AND (u.role='admin' OR p.owner_user_id=u.id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example
 WHERE p.municipality_id=$1::uuid AND p.id=$2::uuid AND demo.id IS NULL
 FOR SHARE OF p
), stage AS MATERIALIZED(
 SELECT s.code,s.reference_code,r.source_url
 FROM cofiex_consultation_stages s
 JOIN cofiex_official_references r ON r.code=s.reference_code
 WHERE s.code=$3::text
), previous AS MATERIALIZED(
 SELECT COALESCE(max(e.revision),0)::integer AS revision
 FROM project_cofiex_consultation_events e
 JOIN eligible p ON p.project_id=e.project_id AND p.municipality_id=e.municipality_id
 WHERE e.stage_code=$3::text
), saved AS(
 INSERT INTO project_cofiex_consultation_events(
  municipality_id,project_id,stage_code,revision,
  consultation_state,consulted_on,reference_code,source_url_snapshot,
  note,acknowledged_limits,snapshot_sha256,recorded_by)
 SELECT p.municipality_id,p.project_id,s.code,prev.revision+1,
  $4::text,$5::date,s.reference_code,s.source_url,$6::text,$9::boolean,
  encode(digest(jsonb_build_object(
   'project_id',p.project_id,'stage_code',s.code,
   'revision',prev.revision+1,'consultation_state',$4::text,
   'consulted_on',$5::date,'reference_code',s.reference_code,
   'source_url',s.source_url,'note',$6::text
  )::text,'sha256'),'hex'),$7::uuid
 FROM eligible p CROSS JOIN stage s CROSS JOIN previous prev
 WHERE prev.revision=$8::integer AND prev.revision BETWEEN 0 AND 999
  AND $9::boolean
 ON CONFLICT(municipality_id,project_id,stage_code,revision) DO NOTHING
 RETURNING revision
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 EXISTS(SELECT 1 FROM stage) AS recognized,
 (SELECT revision FROM previous) AS current_revision,
 (SELECT revision FROM saved) AS saved_revision
`;
