// SQL compartilhado pela aplicação e suíte de integração.
export const START_DOCUMENT_CHECKLIST_SQL = \`
WITH eligible AS (
 SELECT p.id AS project_id,p.municipality_id
 FROM projects p WHERE p.id=$2::uuid AND p.municipality_id=$1::uuid
), available AS (
 SELECT 1 FROM municipal_document_templates
 WHERE municipality_id=$1::uuid AND modality=$3::text LIMIT 1
), created AS (
 INSERT INTO project_document_checklists(project_id,municipality_id,modality,created_by)
 SELECT project_id,municipality_id,$3::text,$4::uuid
 FROM eligible CROSS JOIN available WHERE true
 ON CONFLICT(project_id) DO NOTHING
 RETURNING project_id,municipality_id,modality
), seeded AS (
 INSERT INTO project_document_items
  (municipality_id,project_id,modality,template_id,title,guidance,updated_by)
 SELECT c.municipality_id,c.project_id,c.modality,t.id,t.title,t.guidance,$4::uuid
 FROM created c JOIN municipal_document_templates t
 ON t.municipality_id=c.municipality_id AND t.modality=c.modality
 RETURNING id
)
SELECT EXISTS(SELECT 1 FROM eligible) AS project_exists,
 EXISTS(SELECT 1 FROM available) AS templates_available,
 EXISTS(SELECT 1 FROM created) AS created,
 (SELECT modality FROM project_document_checklists
    WHERE project_id=$2::uuid AND municipality_id=$1::uuid) AS modality,
 (SELECT count(*)::int FROM seeded) AS seeded_count
\`;

export const UPDATE_DOCUMENT_ITEM_SQL = \`
WITH applicable AS (
 SELECT id FROM project_document_items
 WHERE municipality_id=$1::uuid AND project_id=$2::uuid AND id=$3::uuid
), changed AS (
 UPDATE project_document_items
 SET status=$4::text,evidence_note=$5::text,updated_by=$6::uuid,
 updated_at=clock_timestamp()
 WHERE municipality_id=$1::uuid AND project_id=$2::uuid AND id=$3::uuid
 AND (status,evidence_note) IS DISTINCT FROM ($4::text,$5::text)
 RETURNING municipality_id,project_id,id,status,evidence_note,updated_by
), events AS (
 INSERT INTO project_document_events
 (municipality_id,project_id,item_id,status,evidence_note,actor_id)
 SELECT municipality_id,project_id,id,status,evidence_note,updated_by FROM changed
 RETURNING id
)
SELECT EXISTS(SELECT 1 FROM applicable) AS applicable,
 EXISTS(SELECT 1 FROM events) AS changed
\`;
