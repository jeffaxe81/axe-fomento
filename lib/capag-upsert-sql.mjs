// Registro e histórico são inseridos atomicamente. Idempotência não gera nova versão.
export const UPSERT_CAPAG_SQL = `
WITH changed AS (
 INSERT INTO municipal_capag AS existing
  (municipality_id,classification,base_year,reference_date,official_url,source_label,recorded_by)
 VALUES ($1::uuid,$2::text,$3::integer,$4::date,$5::text,$6::text,$7::uuid)
 ON CONFLICT(municipality_id) DO UPDATE
 SET classification=EXCLUDED.classification,base_year=EXCLUDED.base_year,
     reference_date=EXCLUDED.reference_date,official_url=EXCLUDED.official_url,
     source_label=EXCLUDED.source_label,recorded_by=EXCLUDED.recorded_by,
     recorded_at=clock_timestamp(),version=existing.version+1
 WHERE (existing.classification,existing.base_year,existing.reference_date,
        existing.official_url,existing.source_label)
   IS DISTINCT FROM (EXCLUDED.classification,EXCLUDED.base_year,
       EXCLUDED.reference_date,EXCLUDED.official_url,EXCLUDED.source_label)
 RETURNING municipality_id,version,classification,base_year,reference_date,
           official_url,source_label,recorded_by,recorded_at
), history AS (
 INSERT INTO municipal_capag_history
  (municipality_id,version,classification,base_year,reference_date,
   official_url,source_label,recorded_by,recorded_at)
 SELECT municipality_id,version,classification,base_year,reference_date,
        official_url,source_label,recorded_by,recorded_at FROM changed
 RETURNING version
)
SELECT EXISTS(SELECT 1 FROM history) AS changed,
  COALESCE((SELECT version FROM changed),
   (SELECT version FROM municipal_capag WHERE municipality_id=$1::uuid)) AS version
`;
