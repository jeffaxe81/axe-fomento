// Both insertions are atomic: an immutable event is persisted only if its
// corresponding budget stage/item was actually inserted.
export const CREATE_BUDGET_STAGE_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT p.id,p.municipality_id
 FROM projects p
 JOIN users actor ON actor.id=$8::uuid AND actor.municipality_id=p.municipality_id
  AND actor.active=true AND (actor.role='admin' OR actor.id=p.owner_user_id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid AND demo.id IS NULL
 FOR SHARE OF p
), inserted AS (
 INSERT INTO project_budget_stages
 (municipality_id,project_id,stage_number,title,starts_on,ends_on,assumptions,created_by)
 SELECT municipality_id,id,$3::integer,$4::text,$5::date,$6::date,$7::text,$8::uuid
 FROM eligible
 ON CONFLICT(municipality_id,project_id,stage_number) DO NOTHING
 RETURNING id,municipality_id,project_id,assumptions
), logged AS (
 INSERT INTO project_budget_events
 (municipality_id,project_id,stage_id,action,note,amount_cents,actor_id)
 SELECT municipality_id,project_id,id,'etapa_criada',assumptions,0,$8::uuid
 FROM inserted RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT id FROM inserted) AS id,EXISTS(SELECT 1 FROM logged) AS saved
`;

export const CREATE_BUDGET_ITEM_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT s.id AS stage_id,s.project_id,s.municipality_id
 FROM project_budget_stages s
 JOIN projects p ON p.id=s.project_id AND p.municipality_id=s.municipality_id
 JOIN users actor ON actor.id=$10::uuid AND actor.municipality_id=p.municipality_id
  AND actor.active=true AND (actor.role='admin' OR actor.id=p.owner_user_id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example=true
 WHERE s.id=$3::uuid AND s.project_id=$2::uuid AND s.municipality_id=$1::uuid
  AND demo.id IS NULL
 FOR SHARE OF p
), inserted AS (
 INSERT INTO project_budget_items
 (municipality_id,project_id,stage_id,line_number,title,unit,quantity_milli,
  unit_cost_cents,assumptions,created_by)
 SELECT municipality_id,project_id,stage_id,$4::integer,$5::text,$6::text,
  $7::bigint,$8::bigint,$9::text,$10::uuid
 FROM eligible
 ON CONFLICT(municipality_id,stage_id,line_number) DO NOTHING
 RETURNING id,municipality_id,project_id,stage_id,assumptions,line_total_cents
), logged AS (
 INSERT INTO project_budget_events
 (municipality_id,project_id,stage_id,item_id,action,note,amount_cents,actor_id)
 SELECT municipality_id,project_id,stage_id,id,'item_adicionado',
  assumptions,line_total_cents,$10::uuid FROM inserted RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT id FROM inserted) AS id,
 (SELECT line_total_cents::text FROM inserted) AS line_total_cents,
 EXISTS(SELECT 1 FROM logged) AS saved
`;

export const READ_BUDGET_STAGES_SQL=`
SELECT s.id,s.stage_number,s.title,
 to_char(s.starts_on,'YYYY-MM-DD') AS starts_on,
 to_char(s.ends_on,'YYYY-MM-DD') AS ends_on,
 s.assumptions,s.created_at,u.full_name AS author_name,
 COUNT(i.id)::integer AS item_count,
 COALESCE(SUM(i.line_total_cents::numeric),0)::text AS subtotal_cents
FROM project_budget_stages s
LEFT JOIN project_budget_items i ON i.stage_id=s.id
 AND i.municipality_id=s.municipality_id AND i.project_id=s.project_id
JOIN users u ON u.id=s.created_by AND u.municipality_id=s.municipality_id
WHERE s.municipality_id=$1::uuid AND s.project_id=$2::uuid
GROUP BY s.id,s.stage_number,s.title,s.starts_on,s.ends_on,s.assumptions,
 s.created_at,u.full_name
ORDER BY s.stage_number,s.id
`;

export const READ_BUDGET_TOTAL_SQL=`
SELECT COUNT(*)::integer AS item_count,
 COALESCE(SUM(line_total_cents::numeric),0)::text AS total_cents
FROM project_budget_items
WHERE municipality_id=$1::uuid AND project_id=$2::uuid
`;
