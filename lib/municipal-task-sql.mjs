// Operações transacionais atômicas; resultados permitem diferenciar 404, 409 e idempotência.
export const CREATE_SECRETARIAT_SQL = `
WITH created AS (
 INSERT INTO municipal_secretariats(municipality_id,name,created_by)
 VALUES($1::uuid,$2::text,$3::uuid)
 ON CONFLICT(municipality_id,name) DO NOTHING
 RETURNING id,municipality_id,created_by
), linked AS (
 INSERT INTO municipal_secretariat_members(municipality_id,secretariat_id,user_id,granted_by)
 SELECT municipality_id,id,$3::uuid,$3::uuid FROM created
 RETURNING municipality_id,secretariat_id,user_id
), event AS (
 INSERT INTO municipal_secretariat_member_events(municipality_id,secretariat_id,user_id,action,actor_id)
 SELECT municipality_id,secretariat_id,user_id,'granted',$3::uuid FROM linked
 RETURNING id
)
SELECT (SELECT id FROM created) AS id,
 EXISTS(SELECT 1 FROM event) AS linked
`;

export const GRANT_SECRETARIAT_MEMBER_SQL = `
WITH eligible AS (
 SELECT s.id,s.municipality_id,u.id AS user_id
 FROM municipal_secretariats s
 JOIN users u ON u.municipality_id=s.municipality_id AND u.id=$3::uuid AND u.active=true
 WHERE s.id=$2::uuid AND s.municipality_id=$1::uuid
), changed AS (
 INSERT INTO municipal_secretariat_members
 (municipality_id,secretariat_id,user_id,granted_by)
 SELECT municipality_id,id,user_id,$4::uuid FROM eligible WHERE true
 ON CONFLICT(municipality_id,secretariat_id,user_id)
 DO UPDATE SET revoked_at=NULL,granted_at=clock_timestamp(),granted_by=EXCLUDED.granted_by
 WHERE municipal_secretariat_members.revoked_at IS NOT NULL
 RETURNING municipality_id,secretariat_id,user_id
), event AS (
 INSERT INTO municipal_secretariat_member_events
 (municipality_id,secretariat_id,user_id,action,actor_id)
 SELECT municipality_id,secretariat_id,user_id,'granted',$4::uuid FROM changed
 RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible, EXISTS(SELECT 1 FROM event) AS changed
`;

export const REVOKE_SECRETARIAT_MEMBER_SQL = `
WITH eligible AS (
 SELECT m.municipality_id,m.secretariat_id,m.user_id
 FROM municipal_secretariat_members m
 WHERE m.municipality_id=$1::uuid AND m.secretariat_id=$2::uuid
   AND m.user_id=$3::uuid AND m.revoked_at IS NULL
 FOR UPDATE OF m
), changed AS (
 UPDATE municipal_secretariat_members m
 SET revoked_at=clock_timestamp(),granted_by=$4::uuid
 FROM eligible e
 WHERE m.municipality_id=e.municipality_id AND m.secretariat_id=e.secretariat_id
 AND m.user_id=e.user_id AND m.revoked_at IS NULL
 AND NOT EXISTS(
   SELECT 1 FROM municipal_tasks t
   WHERE t.municipality_id=m.municipality_id AND t.secretariat_id=m.secretariat_id
   AND t.assigned_to=m.user_id AND t.status IN ('pendente','em_andamento')
 )
 RETURNING m.municipality_id,m.secretariat_id,m.user_id
), event AS (
 INSERT INTO municipal_secretariat_member_events
 (municipality_id,secretariat_id,user_id,action,actor_id)
 SELECT municipality_id,secretariat_id,user_id,'revoked',$4::uuid FROM changed
 RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible, EXISTS(SELECT 1 FROM event) AS changed
`;

export const CREATE_MUNICIPAL_TASK_SQL = `
WITH eligible AS (
 SELECT p.id AS project_id,p.municipality_id,s.id AS secretariat_id,m.user_id
 FROM projects p
 JOIN municipal_secretariats s ON s.id=$3::uuid AND s.municipality_id=p.municipality_id
 JOIN municipal_secretariat_members m ON m.municipality_id=p.municipality_id
   AND m.secretariat_id=s.id AND m.user_id=$4::uuid AND m.revoked_at IS NULL
 JOIN users u ON u.id=m.user_id AND u.municipality_id=p.municipality_id AND u.active=true
 WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid
 FOR SHARE OF m
), created AS (
 INSERT INTO municipal_tasks
 (municipality_id,project_id,secretariat_id,assigned_to,title,details,due_on,created_by,updated_by)
 SELECT municipality_id,project_id,secretariat_id,user_id,
   $5::text,$6::text,$7::date,$8::uuid,$8::uuid FROM eligible
 RETURNING id,municipality_id,project_id,assigned_to,status,due_on,revision
), event AS (
 INSERT INTO municipal_task_events
 (municipality_id,project_id,task_id,event_type,next_assignee,next_status,next_due_on,note,revision,actor_id)
 SELECT municipality_id,project_id,id,'created',assigned_to,status,due_on,
   'Tarefa registrada para acompanhamento municipal.',revision,$8::uuid
 FROM created RETURNING id
)
SELECT (SELECT id FROM created) AS id, EXISTS(SELECT 1 FROM event) AS created
`;

export const UPDATE_TASK_STATUS_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT t.id,t.municipality_id,t.project_id,t.assigned_to,t.status,t.revision
 FROM municipal_tasks t
 JOIN users actor ON actor.id=$3::uuid AND actor.municipality_id=t.municipality_id AND actor.active=true
 WHERE t.id=$2::uuid AND t.municipality_id=$1::uuid
 AND (actor.role='admin' OR (
   t.assigned_to=actor.id AND EXISTS(
     SELECT 1 FROM municipal_secretariat_members m
     WHERE m.municipality_id=t.municipality_id AND m.secretariat_id=t.secretariat_id
       AND m.user_id=actor.id AND m.revoked_at IS NULL)))
 AND ($4::text IN ('concluida','cancelada') OR EXISTS (
   SELECT 1 FROM municipal_secretariat_members am
   JOIN users active_assignee ON active_assignee.id=am.user_id
     AND active_assignee.municipality_id=am.municipality_id
     AND active_assignee.active=true
   WHERE am.municipality_id=t.municipality_id
    AND am.secretariat_id=t.secretariat_id AND am.user_id=t.assigned_to
    AND am.revoked_at IS NULL))
 FOR UPDATE OF t
), changed AS (
 UPDATE municipal_tasks t SET status=$4::text,revision=t.revision+1,
   updated_by=$3::uuid,updated_at=clock_timestamp()
 FROM eligible e
 WHERE t.id=e.id AND t.municipality_id=e.municipality_id
 AND t.revision=$5::integer AND t.revision<10000 AND t.status IS DISTINCT FROM $4::text
 RETURNING t.id,t.municipality_id,t.project_id,t.assigned_to,
  t.status AS next_status,t.revision,e.status AS previous_status
), event AS (
 INSERT INTO municipal_task_events
 (municipality_id,project_id,task_id,event_type,previous_status,next_status,note,revision,actor_id)
 SELECT municipality_id,project_id,id,'status_changed',previous_status,
   next_status,$6::text,revision,$3::uuid FROM changed RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT revision FROM eligible) AS current_revision,
 EXISTS(SELECT 1 FROM event) AS changed
`;

export const TRANSFER_MUNICIPAL_TASK_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT t.id,t.municipality_id,t.project_id,t.secretariat_id,t.assigned_to,t.revision
 FROM municipal_tasks t
 JOIN users actor ON actor.id=$3::uuid AND actor.municipality_id=t.municipality_id
   AND actor.active=true AND actor.role='admin'
 JOIN municipal_secretariat_members m ON m.municipality_id=t.municipality_id
   AND m.secretariat_id=t.secretariat_id AND m.user_id=$4::uuid AND m.revoked_at IS NULL
 JOIN users recipient ON recipient.municipality_id=t.municipality_id
   AND recipient.id=m.user_id AND recipient.active=true
 WHERE t.id=$2::uuid AND t.municipality_id=$1::uuid
 FOR UPDATE OF t
), changed AS (
 UPDATE municipal_tasks t SET assigned_to=$4::uuid,revision=t.revision+1,
   updated_by=$3::uuid,updated_at=clock_timestamp()
 FROM eligible e
 WHERE t.id=e.id AND t.municipality_id=e.municipality_id
   AND t.revision=$5::integer AND t.revision<10000 AND t.assigned_to IS DISTINCT FROM $4::uuid
 RETURNING t.id,t.municipality_id,t.project_id,t.assigned_to,
 t.revision,e.assigned_to AS previous_assignee
), event AS (
 INSERT INTO municipal_task_events
 (municipality_id,project_id,task_id,event_type,previous_assignee,next_assignee,note,revision,actor_id)
 SELECT municipality_id,project_id,id,'transferred',previous_assignee,
 assigned_to,$6::text,revision,$3::uuid FROM changed RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT revision FROM eligible) AS current_revision,
 EXISTS(SELECT 1 FROM event) AS changed
`;

export const CHANGE_TASK_DEADLINE_SQL = `
WITH eligible AS MATERIALIZED (
 SELECT t.id,t.municipality_id,t.project_id,t.due_on,t.revision
 FROM municipal_tasks t JOIN users actor ON actor.id=$3::uuid
   AND actor.municipality_id=t.municipality_id AND actor.active=true AND actor.role='admin'
 WHERE t.id=$2::uuid AND t.municipality_id=$1::uuid
 FOR UPDATE OF t
), changed AS (
 UPDATE municipal_tasks t SET due_on=$4::date,revision=t.revision+1,
   updated_by=$3::uuid,updated_at=clock_timestamp()
 FROM eligible e WHERE t.id=e.id AND t.municipality_id=e.municipality_id
   AND t.revision=$5::integer AND t.revision<10000 AND t.due_on IS DISTINCT FROM $4::date
 RETURNING t.id,t.municipality_id,t.project_id,t.due_on,
   t.revision,e.due_on AS previous_due_on
), event AS (
 INSERT INTO municipal_task_events
 (municipality_id,project_id,task_id,event_type,previous_due_on,next_due_on,note,revision,actor_id)
 SELECT municipality_id,project_id,id,'deadline_changed',previous_due_on,
 due_on,$6::text,revision,$3::uuid FROM changed RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT revision FROM eligible) AS current_revision,
 EXISTS(SELECT 1 FROM event) AS changed
`;
