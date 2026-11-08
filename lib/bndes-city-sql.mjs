// AF-035: immutable official reference registry + tenant-private manual checks.
export const BNDES_CITY_LIST_SQL=`
SELECT s.code,s.title,s.area,s.summary,s.source_url,
 to_char(s.reference_observed_on,'YYYY-MM-DD') AS reference_observed_on,
 current_check.revision,current_check.source_state,current_check.availability_state,
 to_char(current_check.checked_on,'YYYY-MM-DD') AS checked_on,
 current_check.note,current_check.recorded_at
FROM bndes_city_solutions s
LEFT JOIN LATERAL (
 SELECT e.revision,e.source_state,e.availability_state,e.checked_on,
  e.note,e.recorded_at
 FROM municipal_bndes_review_events e
 WHERE e.municipality_id=$1::uuid AND e.solution_code=s.code
 ORDER BY e.revision DESC LIMIT 1
) current_check ON true
WHERE ($2::text='' OR strpos(
 lower((s.title||' '||s.summary||' '||s.code) COLLATE pg_catalog.pg_c_utf8),
 lower($2 COLLATE pg_catalog.pg_c_utf8))>0)
 AND ($3::text='' OR s.area=$3::text)
 AND ($4::text='' OR current_check.source_state=$4::text)
 AND ($5::text='' OR current_check.availability_state=$5::text)
 AND ($6::text='' OR ($6::text='sim' AND current_check.revision IS NOT NULL)
  OR ($6::text='nao' AND current_check.revision IS NULL))
ORDER BY s.title,s.code LIMIT $7::integer OFFSET $8::integer
`;

export const BNDES_CITY_STATS_SQL=`
SELECT count(*)::integer AS total,
 count(latest.revision)::integer AS municipally_checked,
 count(*) FILTER (WHERE latest.revision IS NULL)::integer AS without_check,
 count(*) FILTER (WHERE latest.source_state='atualizacao_pendente'
  OR latest.source_state='pagina_indisponivel')::integer AS requires_followup
FROM bndes_city_solutions s
LEFT JOIN LATERAL (
 SELECT revision,source_state
 FROM municipal_bndes_review_events
 WHERE municipality_id=$1::uuid AND solution_code=s.code
 ORDER BY revision DESC LIMIT 1
) latest ON true
`;

export const BNDES_CITY_HISTORY_SQL=`
SELECT e.id,e.revision,e.source_state,e.availability_state,
 to_char(e.checked_on,'YYYY-MM-DD') AS checked_on,e.note,
 e.source_url_snapshot,e.snapshot_sha256,e.recorded_at,
 u.full_name AS reviewer_name
FROM municipal_bndes_review_events e
JOIN users u ON u.id=e.reviewer_id AND u.municipality_id=e.municipality_id
WHERE e.municipality_id=$1::uuid AND e.solution_code=$2::text
ORDER BY e.revision DESC LIMIT 100
`;

// Atomic batch of up to 20 reviews; same transaction-scoped advisory lock
// serializes all CI-tested API writers for a given municipality. If any
// revision is stale, the entire batch inserts ZERO events.
export const BNDES_CITY_BATCH_SQL=`
WITH mutex AS MATERIALIZED(
 SELECT pg_advisory_xact_lock(hashtext('axe_bndes_cities:'||$1::text)) AS held
), actor AS MATERIALIZED(
 SELECT u.id FROM users u CROSS JOIN mutex
 WHERE u.id=$2::uuid AND u.municipality_id=$1::uuid
  AND u.active AND u.role='admin'
), payload AS MATERIALIZED(
 SELECT code,expected_revision,source_state,availability_state,
  checked_on,note,acknowledged_limits
 FROM jsonb_to_recordset($3::jsonb) AS x(
  code text,expected_revision integer,source_state text,
  availability_state text,checked_on date,note text,acknowledged_limits boolean)
), eligible AS MATERIALIZED(
 SELECT p.*,s.source_url,
  coalesce((
   SELECT max(e.revision) FROM municipal_bndes_review_events e
   WHERE e.municipality_id=$1::uuid AND e.solution_code=p.code
  ),0)::integer AS current_revision
 FROM payload p
 JOIN bndes_city_solutions s ON s.code=p.code
 CROSS JOIN actor a
), readiness AS MATERIALIZED(
 SELECT count(*)::integer AS matched,
 coalesce(bool_and(current_revision=expected_revision
  AND current_revision BETWEEN 0 AND 999),false) AS versions_current
 FROM eligible
), inserted AS(
 INSERT INTO municipal_bndes_review_events(
  municipality_id,solution_code,revision,
  source_state,availability_state,checked_on,note,source_url_snapshot,
  acknowledged_limits,snapshot_sha256,reviewer_id)
 SELECT $1::uuid,e.code,e.current_revision+1,
  e.source_state,e.availability_state,e.checked_on,e.note,
  e.source_url,e.acknowledged_limits,
  encode(digest(jsonb_build_object(
   'code',e.code,'revision',e.current_revision+1,
   'source_state',e.source_state,'availability_state',e.availability_state,
   'checked_on',e.checked_on,'note',e.note,'source_url',e.source_url
  )::text,'sha256'),'hex'),$2::uuid
 FROM eligible e CROSS JOIN readiness r
 WHERE r.matched=(SELECT count(*) FROM payload)
  AND r.versions_current
 RETURNING solution_code,revision
)
SELECT EXISTS(SELECT 1 FROM actor) AS eligible,
 (SELECT count(*)::integer FROM payload) AS requested,
 (SELECT matched FROM readiness) AS recognized,
 (SELECT versions_current FROM readiness) AS current_versions,
 (SELECT count(*)::integer FROM inserted) AS saved
`;
