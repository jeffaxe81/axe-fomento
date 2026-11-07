export const INSERT_DOCUMENT_VERSION_SQL = `
WITH advanced AS (
 UPDATE project_document_items
 SET current_version=current_version+1,updated_by=$10::uuid,updated_at=clock_timestamp()
 WHERE municipality_id=$1::uuid AND project_id=$2::uuid AND id=$3::uuid
   AND current_version<20
 RETURNING id,municipality_id,project_id,current_version
), recorded AS (
 INSERT INTO project_document_versions
 (municipality_id,project_id,item_id,version,file_name,media_type,
  content_length,sha256,ciphertext,nonce,auth_tag,note,uploaded_by)
 SELECT municipality_id,project_id,id,current_version,$4::text,$5::text,
   $6::integer,$7::text,$8::bytea,$9::bytea,$11::bytea,$12::text,$10::uuid
 FROM advanced
 RETURNING id,version
)
SELECT id,version FROM recorded
`;
