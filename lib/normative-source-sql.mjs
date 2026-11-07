// Only administrators of the verified municipality can register a source/version.
// Both statements insert immutable rows using one PostgreSQL statement/transaction.
// Hash is a fingerprint of DECLARED metadata, not verification of official material.
export const CREATE_NORMATIVE_SOURCE_SQL=`
WITH actor AS MATERIALIZED (
 SELECT u.id,u.municipality_id,m.uf AS tenant_uf
 FROM users u JOIN municipalities m ON m.id=u.municipality_id
 WHERE u.id=$2::uuid AND u.municipality_id=$1::uuid
  AND u.active AND u.role='admin'
), created AS (
 INSERT INTO municipal_normative_sources
 (municipality_id,reference_code,title,jurisdiction,state_uf,created_by)
 SELECT municipality_id,$3::text,$4::text,$5::text,
  CASE WHEN $5::text='federal' THEN NULL::char(2)
       WHEN $5::text='municipal' THEN tenant_uf
       ELSE $6::char(2) END,id FROM actor
 ON CONFLICT(municipality_id,reference_code) DO NOTHING
 RETURNING id,municipality_id
), saved AS (
 INSERT INTO municipal_normative_versions
 (municipality_id,source_id,version,source_url,published_on,valid_from,
 valid_until,source_section,excerpt,context_note,snapshot_sha256,created_by)
 SELECT municipality_id,id,1,$7::text,$8::date,$9::date,$10::date,
  $11::text,$12::text,$13::text,
  encode(digest(jsonb_build_object(
   'source_id',id,'version',1,'source_url',$7::text,
   'published_on',$8::date,'valid_from',$9::date,'valid_until',$10::date,
   'source_section',$11::text,'excerpt',$12::text,'context_note',$13::text
  )::text,'sha256'),'hex'),$2::uuid
 FROM created RETURNING id
)
SELECT EXISTS(SELECT 1 FROM actor) AS eligible,
 (SELECT id FROM created) AS id,EXISTS(SELECT 1 FROM saved) AS created
`;

export const ADD_NORMATIVE_VERSION_SQL=`
WITH eligible AS MATERIALIZED (
 SELECT s.id,s.municipality_id
 FROM municipal_normative_sources s
 JOIN users actor ON actor.id=$2::uuid AND actor.municipality_id=s.municipality_id
  AND actor.active AND actor.role='admin'
 WHERE s.id=$3::uuid AND s.municipality_id=$1::uuid
), newest AS (
 SELECT COALESCE(MAX(v.version),0)::integer AS current_version
 FROM municipal_normative_versions v JOIN eligible e ON
  e.id=v.source_id AND e.municipality_id=v.municipality_id
), saved AS (
 INSERT INTO municipal_normative_versions
 (municipality_id,source_id,version,source_url,published_on,valid_from,
 valid_until,source_section,excerpt,context_note,snapshot_sha256,created_by)
 SELECT e.municipality_id,e.id,$4::integer+1,$5::text,$6::date,$7::date,$8::date,
  $9::text,$10::text,$11::text,
  encode(digest(jsonb_build_object(
   'source_id',e.id,'version',$4::integer+1,'source_url',$5::text,
   'published_on',$6::date,'valid_from',$7::date,'valid_until',$8::date,
   'source_section',$9::text,'excerpt',$10::text,'context_note',$11::text
  )::text,'sha256'),'hex'),$2::uuid
 FROM eligible e CROSS JOIN newest n
 WHERE n.current_version=$4::integer AND n.current_version BETWEEN 1 AND 999
 ON CONFLICT(source_id,version) DO NOTHING
 RETURNING id,version
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT current_version FROM newest) AS current_version,
 (SELECT id FROM saved) AS id,(SELECT version FROM saved) AS version
`;
