export const CREATE_COOPERATION_CALL_SQL=`
WITH actor AS MATERIALIZED(
 SELECT id FROM users WHERE id=$2::uuid AND municipality_id=$1::uuid
 AND active AND role='admin'
), created AS (
 INSERT INTO international_cooperation_calls(
 municipality_id,call_code,title,institution,language_code,scope_code,modality,
 official_url,review_state,checked_on,notes,created_by)
 SELECT $1::uuid,$3::text,$4::text,$5::text,$6::text,$7::text,$8::text,
 $9::text,$10::text,$11::date,$12::text,actor.id FROM actor
 ON CONFLICT(municipality_id,call_code) DO NOTHING RETURNING id
)
SELECT EXISTS(SELECT 1 FROM actor) AS eligible,(SELECT id FROM created) AS id
`;
export const CREATE_APPLICATION_ROUTE_SQL=`
WITH eligible AS MATERIALIZED(
 SELECT c.id FROM international_cooperation_calls c
 JOIN users u ON u.id=$2::uuid AND u.municipality_id=c.municipality_id
 AND u.active AND u.role='admin'
 WHERE c.municipality_id=$1::uuid AND c.id=$3::uuid
), saved AS (
 INSERT INTO international_application_routes(
 municipality_id,call_id,route_type,institutional_contact,contact_url,
 verification_state,checked_on,application_steps,created_by)
 SELECT $1::uuid,e.id,$4::text,$5::text,$6::text,
 $7::text,$8::date,$9::text,$2::uuid FROM eligible e
 ON CONFLICT(call_id,route_type,contact_url) DO NOTHING RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,(SELECT id FROM saved) AS id
`;
export const LIST_COOPERATION_SQL=`
SELECT c.id,c.call_code,c.title,c.institution,c.language_code,c.scope_code,
 c.modality,c.official_url,c.review_state,
 to_char(c.checked_on,'YYYY-MM-DD') AS checked_on,c.notes,c.created_at,
 coalesce(jsonb_agg(jsonb_build_object(
 'id',r.id,'type',r.route_type,'contact',r.institutional_contact,
 'url',r.contact_url,'verification',r.verification_state,
 'checked_on',to_char(r.checked_on,'YYYY-MM-DD'),
 'steps',r.application_steps)) FILTER (WHERE r.id IS NOT NULL),'[]'::jsonb) AS routes
 FROM international_cooperation_calls c
 LEFT JOIN international_application_routes r ON r.call_id=c.id
 AND r.municipality_id=c.municipality_id
 WHERE c.municipality_id=$1::uuid
 GROUP BY c.id ORDER BY c.created_at DESC,c.id LIMIT 150
`;