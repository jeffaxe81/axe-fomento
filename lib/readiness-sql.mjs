// AF-045/049: insert-only immutable evaluation snapshots.
// Concurrent writers race on UNIQUE(case_id,revision); one receives 409.
export const CREATE_READINESS_ASSESSMENT_SQL=`
WITH eligible AS MATERIALIZED(
 SELECT c.id,c.municipality_id,c.kind,c.project_id
 FROM readiness_cases c JOIN users u ON u.id=$3::uuid AND u.municipality_id=c.municipality_id
  AND u.active AND (u.role='admin' OR c.created_by=u.id)
 WHERE c.municipality_id=$1::uuid AND c.id=$2::uuid
), rubric AS MATERIALIZED(
 SELECT id,version,criteria FROM readiness_rubric_versions
 WHERE municipality_id=$1::uuid AND id=$4::uuid
), previous AS MATERIALIZED(
 SELECT a.id,a.revision FROM readiness_assessments a
 JOIN eligible c ON c.id=a.case_id AND c.municipality_id=a.municipality_id
 ORDER BY a.revision DESC LIMIT 1
), evidence AS MATERIALIZED(
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'versionId',v.id,'version',v.version,'itemId',v.item_id,'sha256',v.sha256,
  'note',e.note,'addedAt',e.added_at) ORDER BY v.id),'[]'::jsonb) AS snapshot
 FROM readiness_case_evidence e
 JOIN eligible c ON c.id=e.case_id AND c.municipality_id=e.municipality_id
 JOIN project_document_versions v ON v.id=e.version_id AND v.municipality_id=e.municipality_id
  AND v.project_id=e.project_id
), saved AS(
 INSERT INTO readiness_assessments(
  municipality_id,case_id,revision,previous_id,previous_revision,rubric_id,rubric_version,
  rubric_snapshot,scores_snapshot,blockers_snapshot,action_plan_snapshot,evidence_snapshot,
  score,maximum_possible_score,evaluated_weight,snapshot_sha256,revision_note,created_by
 )
 SELECT c.municipality_id,c.id,COALESCE(prev.revision,0)+1,
  prev.id,prev.revision,r.id,r.version,r.criteria,
  $5::jsonb,$6::jsonb,$7::jsonb,ev.snapshot,$8::numeric,$9::numeric,$10::smallint,
  encode(digest(jsonb_build_object(
   'caseId',c.id,'revision',COALESCE(prev.revision,0)+1,'rubricId',r.id,
   'rubricVersion',r.version,'rubric',r.criteria,'scores',$5::jsonb,
   'blockers',$6::jsonb,'actions',$7::jsonb,'evidence',ev.snapshot,
   'score',$8::numeric,'maximumPossible',$9::numeric,'evaluatedWeight',$10::smallint,
   'revisionNote',$11::text
  )::text,'sha256'),'hex'),$11::text,$3::uuid
 FROM eligible c CROSS JOIN rubric r CROSS JOIN evidence ev
 LEFT JOIN previous prev ON true
 WHERE COALESCE(prev.revision,0)=$12::integer AND COALESCE(prev.revision,0)<1000
  AND (c.kind='idea' OR jsonb_array_length(ev.snapshot)>0)
 ON CONFLICT(case_id,revision) DO NOTHING
 RETURNING id,revision
)
SELECT EXISTS(SELECT 1 FROM eligible) AS authorized,
 EXISTS(SELECT 1 FROM rubric) AS rubric_found,
 (SELECT kind FROM eligible) AS kind,
 jsonb_array_length((SELECT snapshot FROM evidence))::integer AS evidence_count,
 (SELECT revision FROM previous) AS prior_revision,
 (SELECT id FROM saved) AS id,(SELECT revision FROM saved) AS saved_revision`;
