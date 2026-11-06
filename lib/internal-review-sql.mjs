// CTEs garantem transição + evento na mesma transação e controlo por revisão.
export const REVIEW_READINESS_SQL = `
SELECT
 EXISTS(SELECT 1 FROM project_document_checklists c
   WHERE c.project_id=$2::uuid AND c.municipality_id=$1::uuid) AS has_checklist,
 (SELECT count(*)::int FROM project_document_items i
   WHERE i.project_id=$2::uuid AND i.municipality_id=$1::uuid
     AND i.status='pendente') AS pending_documents,
 (SELECT count(*)::int FROM municipal_tasks t
   WHERE t.project_id=$2::uuid AND t.municipality_id=$1::uuid
     AND t.status IN ('pendente','em_andamento')) AS open_tasks,
 (SELECT count(*)::int FROM opportunity_requirements req
   JOIN projects p ON p.opportunity_id=req.opportunity_id
     AND p.municipality_id=req.municipality_id
   WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid AND req.mandatory=true
   AND NOT EXISTS(SELECT 1 FROM project_requirement_assessments a
     WHERE a.requirement_id=req.id AND a.project_id=p.id AND a.municipality_id=p.municipality_id
     AND a.status='atendido')) AS mandatory_requirements_missing
`;

export const REVIEW_GATES_SQL = `
 EXISTS(SELECT 1 FROM project_document_checklists c
   WHERE c.project_id=r.project_id AND c.municipality_id=r.municipality_id)
 AND NOT EXISTS(SELECT 1 FROM project_document_items i
   WHERE i.project_id=r.project_id AND i.municipality_id=r.municipality_id
     AND i.status='pendente')
 AND NOT EXISTS(SELECT 1 FROM municipal_tasks t
   WHERE t.project_id=r.project_id AND t.municipality_id=r.municipality_id
     AND t.status IN ('pendente','em_andamento'))
 AND NOT EXISTS(SELECT 1 FROM opportunity_requirements req
   JOIN projects p ON p.opportunity_id=req.opportunity_id
     AND p.municipality_id=req.municipality_id
   WHERE p.id=r.project_id AND p.municipality_id=r.municipality_id AND req.mandatory=true
     AND NOT EXISTS(SELECT 1 FROM project_requirement_assessments a
       WHERE a.requirement_id=req.id AND a.project_id=p.id AND a.municipality_id=p.municipality_id
       AND a.status='atendido'))
`;

export const SUBMIT_INTERNAL_REVIEW_SQL = `
WITH allowed AS (
 SELECT p.id AS project_id,p.municipality_id
 FROM projects p JOIN users u ON u.id=$3::uuid AND u.municipality_id=p.municipality_id AND u.active=true
 WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid
 AND (p.owner_user_id=u.id OR u.role='admin')
), changed AS (
 INSERT INTO project_internal_reviews AS current
 (project_id,municipality_id,state,revision,submitted_by,submitted_at,updated_by,updated_at)
 SELECT project_id,municipality_id,'em_revisao',1,$3::uuid,clock_timestamp(),$3::uuid,clock_timestamp()
 FROM allowed a WHERE $4::integer=0
   OR EXISTS(SELECT 1 FROM project_internal_reviews old
     WHERE old.project_id=a.project_id AND old.municipality_id=a.municipality_id
     AND old.state='devolvida' AND old.revision=$4::integer)
 ON CONFLICT(project_id) DO UPDATE SET
   state='em_revisao',revision=current.revision+1,
   submitted_by=$3::uuid,submitted_at=clock_timestamp(),
   technically_reviewed_by=NULL,technically_reviewed_at=NULL,
   authorized_by=NULL,authorized_at=NULL,
   updated_by=$3::uuid,updated_at=clock_timestamp()
 WHERE current.state='devolvida' AND current.revision=$4::integer AND current.revision<10000
 RETURNING project_id,municipality_id,revision
), audit AS (
 INSERT INTO project_internal_review_events
 (project_id,municipality_id,revision,action,previous_state,new_state,note,actor_id)
 SELECT project_id,municipality_id,revision,
   CASE WHEN revision=1 THEN 'submitted' ELSE 'resubmitted' END,
   CASE WHEN revision=1 THEN NULL ELSE 'devolvida' END,
   'em_revisao',$5::text,$3::uuid FROM changed
 RETURNING revision
)
SELECT EXISTS(SELECT 1 FROM allowed) AS allowed,
 (SELECT revision FROM audit) AS revision
`;

export const TECHNICAL_REVIEW_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT r.project_id,r.municipality_id,r.state,r.revision
 FROM project_internal_reviews r
 JOIN users actor ON actor.id=$3::uuid AND actor.municipality_id=r.municipality_id
   AND actor.active=true AND actor.role='admin'
 WHERE r.project_id=$2::uuid AND r.municipality_id=$1::uuid
   AND r.submitted_by<>actor.id
 FOR UPDATE OF r
), changed AS (
 UPDATE project_internal_reviews r
 SET state='revisada',revision=r.revision+1,
  technically_reviewed_by=$3::uuid,technically_reviewed_at=clock_timestamp(),
  updated_by=$3::uuid,updated_at=clock_timestamp()
 FROM eligible e
 WHERE r.project_id=e.project_id AND r.municipality_id=e.municipality_id
 AND e.state='em_revisao' AND e.revision=$4::integer AND r.revision<10000
 AND ${REVIEW_GATES_SQL}
 RETURNING r.project_id,r.municipality_id,r.revision
), audit AS (
 INSERT INTO project_internal_review_events
 (project_id,municipality_id,revision,action,previous_state,new_state,note,actor_id)
 SELECT project_id,municipality_id,revision,'technical_approved',
   'em_revisao','revisada',$5::text,$3::uuid FROM changed
 RETURNING revision
)
SELECT EXISTS(SELECT 1 FROM eligible) AS allowed,
 (SELECT revision FROM eligible) AS current_revision,
 (SELECT revision FROM audit) AS revision
`;

export const RETURN_INTERNAL_REVIEW_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT r.project_id,r.municipality_id,r.state,r.revision
 FROM project_internal_reviews r
 JOIN users actor ON actor.id=$3::uuid AND actor.municipality_id=r.municipality_id
   AND actor.active=true AND actor.role='admin'
 WHERE r.project_id=$2::uuid AND r.municipality_id=$1::uuid
 AND r.submitted_by<>actor.id
 FOR UPDATE OF r
), changed AS (
 UPDATE project_internal_reviews r SET
  state='devolvida',revision=r.revision+1,
  technically_reviewed_by=NULL,technically_reviewed_at=NULL,
  authorized_by=NULL,authorized_at=NULL,updated_by=$3::uuid,updated_at=clock_timestamp()
 FROM eligible e WHERE r.project_id=e.project_id AND r.municipality_id=e.municipality_id
 AND e.state IN ('em_revisao','revisada')
 AND e.revision=$4::integer AND r.revision<10000
 RETURNING r.project_id,r.municipality_id,r.revision,e.state AS previous_state
), audit AS (
 INSERT INTO project_internal_review_events
 (project_id,municipality_id,revision,action,previous_state,new_state,note,actor_id)
 SELECT project_id,municipality_id,revision,'returned',previous_state,
 'devolvida',$5::text,$3::uuid FROM changed RETURNING revision
)
SELECT EXISTS(SELECT 1 FROM eligible) AS allowed,
 (SELECT revision FROM eligible) AS current_revision,
 (SELECT revision FROM audit) AS revision
`;

export const AUTHORIZE_INTERNAL_REVIEW_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT r.project_id,r.municipality_id,r.state,r.revision
 FROM project_internal_reviews r
 JOIN users actor ON actor.id=$3::uuid AND actor.municipality_id=r.municipality_id
   AND actor.active=true AND actor.role='admin'
 WHERE r.project_id=$2::uuid AND r.municipality_id=$1::uuid
   AND r.submitted_by<>actor.id
   AND r.technically_reviewed_by IS DISTINCT FROM actor.id
 FOR UPDATE OF r
), changed AS (
 UPDATE project_internal_reviews r SET
  state='autorizada',revision=r.revision+1,
  authorized_by=$3::uuid,authorized_at=clock_timestamp(),
  updated_by=$3::uuid,updated_at=clock_timestamp()
 FROM eligible e WHERE r.project_id=e.project_id AND r.municipality_id=e.municipality_id
 AND e.state='revisada' AND e.revision=$4::integer AND r.revision<10000
 AND ${REVIEW_GATES_SQL}
 RETURNING r.project_id,r.municipality_id,r.revision
), audit AS (
 INSERT INTO project_internal_review_events
 (project_id,municipality_id,revision,action,previous_state,new_state,note,actor_id)
 SELECT project_id,municipality_id,revision,'authorized','revisada','autorizada',$5::text,$3::uuid
 FROM changed RETURNING revision
)
SELECT EXISTS(SELECT 1 FROM eligible) AS allowed,
 (SELECT revision FROM eligible) AS current_revision,
 (SELECT revision FROM audit) AS revision
`;
