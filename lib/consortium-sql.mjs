export const CREATE_CONSORTIUM_SQL=`
WITH actor AS MATERIALIZED(
 SELECT id FROM users WHERE id=$2::uuid AND municipality_id=$1::uuid
  AND active AND role='admin'
), created AS (
 INSERT INTO municipal_consortia(owner_municipality_id,title,purpose,created_by)
 SELECT $1::uuid,$3::text,$4::text,id FROM actor
 ON CONFLICT(owner_municipality_id,title) DO NOTHING RETURNING id
) SELECT EXISTS(SELECT 1 FROM actor) AS eligible,(SELECT id FROM created) AS id
`;
export const INVITE_CONSORTIUM_MEMBER_SQL=`
WITH eligible AS MATERIALIZED(
 SELECT c.id,c.owner_municipality_id FROM municipal_consortia c
 JOIN users u ON u.id=$2::uuid AND u.municipality_id=c.owner_municipality_id
 AND u.active AND u.role='admin'
 WHERE c.id=$3::uuid AND c.owner_municipality_id=$1::uuid
 AND $4::uuid<>c.owner_municipality_id
), member AS (
 INSERT INTO consortium_memberships(consortium_id,owner_municipality_id,
 member_municipality_id,updated_by,updated_actor_municipality_id)
 SELECT id,owner_municipality_id,$4::uuid,$2::uuid,$1::uuid FROM eligible
 ON CONFLICT(consortium_id,member_municipality_id) DO NOTHING
 RETURNING id,consortium_id,owner_municipality_id,member_municipality_id,revision
), logged AS (
 INSERT INTO consortium_membership_events(membership_id,consortium_id,
 owner_municipality_id,member_municipality_id,revision,action,note,actor_id,actor_municipality_id)
 SELECT id,consortium_id,owner_municipality_id,member_municipality_id,revision,
 'invited',$5::text,$2::uuid,$1::uuid FROM member RETURNING id
) SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,(SELECT id FROM member) AS id,
 EXISTS(SELECT 1 FROM logged) AS logged
`;
export const CHANGE_CONSORTIUM_MEMBERSHIP_SQL=`
WITH actor AS MATERIALIZED(
 SELECT id FROM users WHERE id=$2::uuid AND municipality_id=$1::uuid
 AND role='admin' AND active
), changed AS (
 UPDATE consortium_memberships m
 SET state=CASE $4::text WHEN 'accept' THEN 'active'
 WHEN 'decline' THEN 'declined' ELSE 'revoked' END,
 revision=m.revision+1,updated_by=$2::uuid,
 updated_actor_municipality_id=$1::uuid,updated_at=clock_timestamp()
 FROM actor WHERE m.id=$3::uuid AND m.revision=$5::integer
 AND m.revision BETWEEN 1 AND 999
 AND (
  (m.member_municipality_id=$1::uuid AND m.state='invited'
   AND $4::text IN('accept','decline'))
  OR (m.state IN('invited','active') AND $4::text='revoke'
   AND (m.owner_municipality_id=$1::uuid
   OR m.member_municipality_id=$1::uuid))
 )
 RETURNING m.id,m.consortium_id,m.owner_municipality_id,
 m.member_municipality_id,m.revision
), logged AS (
 INSERT INTO consortium_membership_events(membership_id,consortium_id,
 owner_municipality_id,member_municipality_id,revision,action,note,actor_id,actor_municipality_id)
 SELECT id,consortium_id,owner_municipality_id,member_municipality_id,revision,
 CASE $4::text WHEN 'accept' THEN 'accepted' WHEN 'decline' THEN 'declined'
 ELSE 'revoked' END,$6::text,$2::uuid,$1::uuid FROM changed RETURNING id
) SELECT EXISTS(SELECT 1 FROM actor) AS eligible,
 (SELECT id FROM changed) AS id,EXISTS(SELECT 1 FROM logged) AS logged
`;
export const LIST_CONSORTIA_SQL=`
SELECT c.id,c.owner_municipality_id,c.title,c.purpose,c.created_at,
 (c.owner_municipality_id=$1::uuid) AS is_owner,
 coalesce(jsonb_agg(jsonb_build_object('id',m.id,'tenant',m.member_municipality_id,
 'state',m.state,'revision',m.revision)) FILTER (WHERE m.id IS NOT NULL),'[]'::jsonb) AS members
FROM municipal_consortia c
LEFT JOIN consortium_memberships m ON m.consortium_id=c.id
WHERE c.owner_municipality_id=$1::uuid
 OR EXISTS(SELECT 1 FROM consortium_memberships own
  WHERE own.consortium_id=c.id AND own.member_municipality_id=$1::uuid
  AND own.state IN('invited','active'))
GROUP BY c.id ORDER BY c.created_at DESC,c.id LIMIT 100
`;
export const CREATE_CONSORTIUM_SHARE_SQL=`
WITH eligible AS MATERIALIZED(
 SELECT c.id AS consortium_id,p.id AS project_id,p.municipality_id
 FROM municipal_consortia c
 JOIN projects p ON p.id=$4::uuid AND p.municipality_id=c.owner_municipality_id
 JOIN users u ON u.id=$2::uuid AND u.municipality_id=c.owner_municipality_id
 AND u.active AND (u.role='admin' OR p.owner_user_id=u.id)
 LEFT JOIN opportunities demo ON demo.id=p.opportunity_id AND demo.is_example
 WHERE c.id=$3::uuid AND c.owner_municipality_id=$1::uuid AND demo.id IS NULL
), shared AS (
 INSERT INTO consortium_project_shares(
 consortium_id,owner_municipality_id,project_id,public_title,shared_summary,
 created_by,updated_by)
 SELECT consortium_id,municipality_id,project_id,$5::text,$6::text,
 $2::uuid,$2::uuid FROM eligible
 ON CONFLICT(consortium_id,project_id) DO NOTHING
 RETURNING id,owner_municipality_id,revision
), logged AS (
 INSERT INTO consortium_share_events(
 share_id,owner_municipality_id,revision,action,actor_id,note)
 SELECT id,owner_municipality_id,revision,'created',$2::uuid,$7::text
 FROM shared RETURNING id
) SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT id FROM shared) AS id,EXISTS(SELECT 1 FROM logged) AS logged
`;
export const REVOKE_CONSORTIUM_SHARE_SQL=`
WITH eligible AS MATERIALIZED(
 SELECT s.id FROM consortium_project_shares s
 JOIN projects p ON p.id=s.project_id AND p.municipality_id=s.owner_municipality_id
 JOIN users u ON u.id=$2::uuid AND u.municipality_id=s.owner_municipality_id
 AND u.active AND (u.role='admin' OR p.owner_user_id=u.id)
 WHERE s.owner_municipality_id=$1::uuid AND s.id=$3::uuid
 AND s.enabled AND s.revision=$4::integer AND s.revision<1000
), changed AS (
 UPDATE consortium_project_shares s SET enabled=false,
 revision=s.revision+1,updated_by=$2::uuid,updated_at=clock_timestamp()
 FROM eligible e WHERE e.id=s.id
 RETURNING s.id,s.owner_municipality_id,s.revision
), logged AS (
 INSERT INTO consortium_share_events(share_id,owner_municipality_id,
 revision,action,actor_id,note)
 SELECT id,owner_municipality_id,revision,'revoked',$2::uuid,$5::text
 FROM changed RETURNING id
) SELECT (SELECT id FROM changed) AS id,EXISTS(SELECT 1 FROM logged) AS logged
`;