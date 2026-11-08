// As duas gravações abaixo são atômicas: estado atual e evento de auditoria.
// A junção projeto/regra exige mesmo município E mesma oportunidade.
export const ASSESS_REQUIREMENT_SQL = `
WITH applicable AS (
 SELECT p.id AS project_id,p.municipality_id,p.opportunity_id,r.id AS requirement_id
 FROM projects p
 JOIN opportunity_requirements r
   ON r.municipality_id=p.municipality_id AND r.opportunity_id=p.opportunity_id
 WHERE p.municipality_id=$1::uuid AND p.id=$2::uuid AND r.id=$3::uuid
), recorded AS (
 INSERT INTO project_requirement_assessments
  (municipality_id,project_id,opportunity_id,requirement_id,status,evidence_note,assessed_by)
 SELECT municipality_id,project_id,opportunity_id,requirement_id,$4::text,$5::text,$6::uuid
 FROM applicable WHERE true
 ON CONFLICT(project_id,requirement_id) DO UPDATE SET
   status=EXCLUDED.status,evidence_note=EXCLUDED.evidence_note,
   assessed_by=EXCLUDED.assessed_by,assessed_at=clock_timestamp()
 WHERE project_requirement_assessments.status IS DISTINCT FROM EXCLUDED.status
    OR project_requirement_assessments.evidence_note IS DISTINCT FROM EXCLUDED.evidence_note
 RETURNING municipality_id,project_id,opportunity_id,requirement_id,status,evidence_note,assessed_by
), event AS (
 INSERT INTO project_requirement_events
  (municipality_id,project_id,opportunity_id,requirement_id,status,evidence_note,actor_id)
 SELECT municipality_id,project_id,opportunity_id,requirement_id,status,evidence_note,assessed_by
 FROM recorded RETURNING id
)
SELECT EXISTS(SELECT 1 FROM applicable) AS applicable,
       EXISTS(SELECT 1 FROM event) AS changed
`;
