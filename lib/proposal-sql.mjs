// AF-032: one read statement captures internally declared project sources.
export const READ_PROPOSAL_SOURCE_SQL=`
SELECT p.id,p.title,p.status,p.owner_user_id,p.opportunity_id,
 m.name AS municipality_name,m.uf AS municipality_uf,
 o.title AS opportunity_title,o.provider AS opportunity_provider,
 o.source_url AS opportunity_source_url,o.is_example,
 (SELECT count(*)::integer FROM project_budget_items i
  WHERE i.municipality_id=p.municipality_id AND i.project_id=p.id) AS budget_items,
 (SELECT COALESCE(sum(i.line_total_cents),0)::text FROM project_budget_items i
  WHERE i.municipality_id=p.municipality_id AND i.project_id=p.id) AS budget_total_cents,
 (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM (
   SELECT stage_number AS number,title,
    to_char(starts_on,'YYYY-MM-DD') AS "startsOn",
    to_char(ends_on,'YYYY-MM-DD') AS "endsOn",assumptions
   FROM project_budget_stages
   WHERE municipality_id=p.municipality_id AND project_id=p.id
   ORDER BY stage_number,id LIMIT 20
 ) s) AS stages,
 (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (
   SELECT rq.id,rq.requirement,COALESCE(a.status,'pendente') AS status,
    rq.source_version AS "sourceVersion",rq.source_section AS "sourceSection",
    rq.source_url AS "sourceUrl"
   FROM opportunity_requirements rq
   LEFT JOIN project_requirement_assessments a ON a.requirement_id=rq.id
    AND a.project_id=p.id AND a.municipality_id=rq.municipality_id
   WHERE rq.municipality_id=p.municipality_id
     AND rq.opportunity_id=p.opportunity_id
   ORDER BY rq.created_at,rq.id LIMIT 20
 ) r) AS requirements,
 (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM (
  SELECT s.id,s.suggested_requirement AS requirement,s.source_page AS page,
   s.source_excerpt AS excerpt,b.document_version_id AS "documentVersionId"
  FROM project_edict_suggestions s
  JOIN project_edict_extraction_batches b ON b.id=s.batch_id
   AND b.municipality_id=s.municipality_id AND b.project_id=s.project_id
  JOIN LATERAL (
   SELECT decision FROM project_edict_suggestion_reviews
   WHERE suggestion_id=s.id AND municipality_id=s.municipality_id
    AND project_id=s.project_id ORDER BY revision DESC LIMIT 1
  ) last_review ON last_review.decision='aprovada'
  WHERE s.municipality_id=p.municipality_id AND s.project_id=p.id
   AND s.evidence_state='excerpt' AND s.source_excerpt IS NOT NULL
  ORDER BY s.created_at,s.id LIMIT 12
 ) e) AS edict_evidence
FROM projects p
JOIN municipalities m ON m.id=p.municipality_id
LEFT JOIN opportunities o ON o.id=p.opportunity_id
WHERE p.municipality_id=$1::uuid AND p.id=$2::uuid
`;

export const CREATE_PROPOSAL_SQL=`
WITH eligible AS MATERIALIZED(
 SELECT p.id,p.municipality_id
 FROM projects p
 JOIN users u ON u.municipality_id=p.municipality_id AND u.id=$6::uuid
  AND u.active AND (u.role='admin' OR p.owner_user_id=u.id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example
 WHERE p.municipality_id=$1::uuid AND p.id=$2::uuid AND demo.id IS NULL
 FOR SHARE OF p
), inserted AS (
 INSERT INTO project_proposal_drafts(municipality_id,project_id,created_by)
 SELECT municipality_id,id,$6::uuid FROM eligible
 ON CONFLICT(municipality_id,project_id) DO NOTHING
 RETURNING id,municipality_id,project_id
), revision AS(
 INSERT INTO project_proposal_versions(
  municipality_id,project_id,draft_id,version,sections,source_snapshot,
  missing_fields,revision_note,origin,created_by)
 SELECT municipality_id,project_id,id,1,$3::jsonb,$4::jsonb,
  $5::text[],'Rascunho inicial com dados declarados pelo município.',
  'template_from_local_data',$6::uuid
 FROM inserted RETURNING id,version
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT id FROM inserted) AS draft_id,
 (SELECT version FROM revision) AS version
`;

export const EDIT_PROPOSAL_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT d.id,d.project_id,d.municipality_id
 FROM project_proposal_drafts d
 JOIN projects p ON p.id=d.project_id AND p.municipality_id=d.municipality_id
 JOIN users u ON u.id=$6::uuid AND u.municipality_id=d.municipality_id
  AND u.active AND (u.role='admin' OR p.owner_user_id=u.id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example
 WHERE d.municipality_id=$1::uuid AND d.project_id=$2::uuid
  AND d.id=$3::uuid AND demo.id IS NULL
 FOR SHARE OF p
), previous AS MATERIALIZED(
 SELECT v.version,v.source_snapshot,v.missing_fields
 FROM project_proposal_versions v JOIN eligible e ON v.draft_id=e.id
  AND v.project_id=e.project_id AND v.municipality_id=e.municipality_id
 ORDER BY v.version DESC LIMIT 1
), inserted AS(
 INSERT INTO project_proposal_versions(
  municipality_id,project_id,draft_id,version,sections,source_snapshot,
  missing_fields,revision_note,origin,created_by)
 SELECT e.municipality_id,e.project_id,e.id,p.version+1,$4::jsonb,
  p.source_snapshot,p.missing_fields,$5::text,'manual_revision',$6::uuid
 FROM eligible e CROSS JOIN previous p
 WHERE p.version=$7::integer AND p.version BETWEEN 1 AND 499
 ON CONFLICT(draft_id,version) DO NOTHING
 RETURNING version
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT version FROM previous) AS current_version,
 (SELECT version FROM inserted) AS saved_version
`;

export const READ_PROPOSAL_VERSIONS_SQL=`
SELECT v.id,v.draft_id,v.version,v.sections,v.source_snapshot,v.missing_fields,
 v.revision_note,v.origin,v.created_at,v.created_by AS author_id,u.full_name AS author_name
FROM project_proposal_versions v
JOIN users u ON u.id=v.created_by AND u.municipality_id=v.municipality_id
WHERE v.municipality_id=$1::uuid AND v.project_id=$2::uuid AND v.draft_id=$3::uuid
ORDER BY v.version DESC LIMIT 50
`;
