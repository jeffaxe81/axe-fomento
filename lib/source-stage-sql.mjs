/** SQL de staging único, consumido pela aplicação e pelos testes de integração. */
export const STAGE_PROGRAM_SQL = `WITH rec AS (
      INSERT INTO source_programs(municipality_id,source_key,external_id,title,provider,source_url,checksum)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(municipality_id,source_key,external_id) DO UPDATE SET
        title=EXCLUDED.title,provider=EXCLUDED.provider,source_url=EXCLUDED.source_url,
        checksum=EXCLUDED.checksum,last_seen_at=clock_timestamp(),
        version=source_programs.version+CASE WHEN source_programs.checksum<>EXCLUDED.checksum THEN 1 ELSE 0 END,
        review_state=CASE WHEN source_programs.checksum<>EXCLUDED.checksum THEN 'pending' ELSE source_programs.review_state END,
        reviewed_at=CASE WHEN source_programs.checksum<>EXCLUDED.checksum THEN NULL ELSE source_programs.reviewed_at END,
        reviewer_id=CASE WHEN source_programs.checksum<>EXCLUDED.checksum THEN NULL ELSE source_programs.reviewer_id END
      RETURNING id,municipality_id,version,checksum,title,provider,source_url,external_id
    ), snapshot AS (
      INSERT INTO source_program_versions(program_id,municipality_id,version,checksum,snapshot)
      SELECT id,municipality_id,version,checksum,
        jsonb_build_object('external_id',external_id,'title',title,'provider',provider,'source_url',source_url)
      FROM rec ON CONFLICT DO NOTHING RETURNING program_id
    )
    SELECT rec.version, EXISTS(SELECT 1 FROM snapshot) AS new_version FROM rec`;
