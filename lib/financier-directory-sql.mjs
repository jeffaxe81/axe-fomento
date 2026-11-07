// AF-034: each write must verify ACTIVE municipal admin inside the same
// statement. Historical institution references never claim open funding.
export const CREATE_FINANCIER_SQL=`
WITH actor AS MATERIALIZED(
 SELECT id,municipality_id FROM users
 WHERE id=$2::uuid AND municipality_id=$1::uuid
  AND active AND role='admin'
), created AS(
 INSERT INTO municipal_financiers(
  municipality_id,reference_code,name,institution_type,
  financing_modalities,thematic_areas,created_by)
 SELECT municipality_id,$3::text,$4::text,$5::text,
  $6::text[],$7::text[],id FROM actor
 ON CONFLICT(municipality_id,reference_code) DO NOTHING
 RETURNING id,municipality_id
), recorded AS(
 INSERT INTO municipal_financier_versions(
  municipality_id,financier_id,version,reference_url,reference_title,
  reference_section,check_status,checked_on,evidence_note,
  snapshot_sha256,recorded_by)
 SELECT municipality_id,id,1,$8::text,$9::text,$10::text,$11::text,
  $12::date,$13::text,
  encode(digest(jsonb_build_object(
   'financier_id',id,'version',1,
   'reference_url',$8::text,'reference_title',$9::text,
   'reference_section',$10::text,'check_status',$11::text,
   'checked_on',$12::date,'evidence_note',$13::text
  )::text,'sha256'),'hex'),$2::uuid FROM created
 RETURNING id
)
SELECT EXISTS(SELECT 1 FROM actor) AS eligible,
 (SELECT id FROM created) AS id,
 EXISTS(SELECT 1 FROM recorded) AS created
`;

export const ADD_FINANCIER_VERSION_SQL=`
WITH eligible AS MATERIALIZED(
 SELECT f.id,f.municipality_id FROM municipal_financiers f
 JOIN users u ON u.id=$2::uuid AND u.municipality_id=f.municipality_id
  AND u.active AND u.role='admin'
 WHERE f.municipality_id=$1::uuid AND f.id=$3::uuid
), latest AS MATERIALIZED(
 SELECT COALESCE(max(v.version),0)::integer AS current_version
 FROM municipal_financier_versions v
 JOIN eligible f ON f.id=v.financier_id AND f.municipality_id=v.municipality_id
), saved AS (
 INSERT INTO municipal_financier_versions(
  municipality_id,financier_id,version,reference_url,reference_title,
  reference_section,check_status,checked_on,evidence_note,
  snapshot_sha256,recorded_by)
 SELECT f.municipality_id,f.id,$4::integer+1,$5::text,$6::text,
  $7::text,$8::text,$9::date,$10::text,
  encode(digest(jsonb_build_object(
   'financier_id',f.id,'version',$4::integer+1,
   'reference_url',$5::text,'reference_title',$6::text,
   'reference_section',$7::text,'check_status',$8::text,
   'checked_on',$9::date,'evidence_note',$10::text
  )::text,'sha256'),'hex'),$2::uuid
 FROM eligible f CROSS JOIN latest
 WHERE latest.current_version=$4::integer
  AND latest.current_version BETWEEN 1 AND 999
 ON CONFLICT(financier_id,version) DO NOTHING
 RETURNING id,version
)
SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
 (SELECT current_version FROM latest) AS current_version,
 (SELECT id FROM saved) AS id,(SELECT version FROM saved) AS version
`;

export const LIST_FINANCIERS_SQL=`
SELECT f.id,f.reference_code,f.name,f.institution_type,f.financing_modalities,
 f.thematic_areas,f.created_at,
 latest.version,latest.reference_url,latest.reference_title,
 latest.reference_section,latest.check_status,
 to_char(latest.checked_on,'YYYY-MM-DD') AS checked_on,
 latest.recorded_at
FROM municipal_financiers f
JOIN LATERAL (
 SELECT v.version,v.reference_url,v.reference_title,
  v.reference_section,v.check_status,v.checked_on,v.recorded_at
 FROM municipal_financier_versions v
 WHERE v.financier_id=f.id AND v.municipality_id=f.municipality_id
 ORDER BY v.version DESC LIMIT 1
) latest ON true
WHERE f.municipality_id=$1::uuid
 AND ($2::text='' OR strpos(lower(
  (f.name || ' ' || f.reference_code) COLLATE pg_catalog.pg_c_utf8),
  lower($2 COLLATE pg_catalog.pg_c_utf8))>0)
 AND ($3::text='' OR $3::text=ANY(f.thematic_areas))
 AND ($4::text='' OR $4::text=ANY(f.financing_modalities))
ORDER BY f.name,f.id LIMIT $5::integer OFFSET $6::integer
`;

export const FINANCIER_HISTORY_SQL=`
SELECT v.id,v.version,v.reference_url,v.reference_title,
 v.reference_section,v.check_status,
 to_char(v.checked_on,'YYYY-MM-DD') AS checked_on,
 v.evidence_note,v.snapshot_sha256,v.recorded_at,u.full_name AS author_name
FROM municipal_financier_versions v
JOIN users u ON u.id=v.recorded_by AND u.municipality_id=v.municipality_id
WHERE v.municipality_id=$1::uuid AND v.financier_id=$2::uuid
ORDER BY v.version DESC LIMIT 100
`;
