// AF-041: cohorts by protocol date, outcome is current project status.
export function normalizeConversionRange(from,to){
 const valid=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  !Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 if(!valid(from)||!valid(to)||from>to||from<'2000-01-01'||to>'2100-12-31')return null;
 return {from,to};
}
export function percentOf(numerator,denominator){
 const n=Number(numerator),d=Number(denominator);
 return Number.isFinite(n)&&Number.isFinite(d)&&n>=0&&d>0
 ?(100*n/d).toFixed(1).replace('.',',')+'%':'—';
}
export const CONVERSION_COHORTS_SQL=`
WITH latest AS (
 SELECT e.project_id,e.portal_host,e.portal_name,
  COALESCE(d.modality,'nao_informada') AS modality,
  p.status,e.submitted_on,e.recorded_at,e.id,
  row_number() OVER (
   PARTITION BY e.project_id,e.portal_host,COALESCE(d.modality,'nao_informada')
   ORDER BY e.submitted_on DESC,e.recorded_at DESC,e.id DESC
  ) AS position
 FROM project_external_protocols e
 JOIN projects p ON p.id=e.project_id AND p.municipality_id=e.municipality_id
 LEFT JOIN project_document_checklists d ON d.project_id=p.id
  AND d.municipality_id=p.municipality_id
 WHERE e.municipality_id=$1::uuid AND e.submitted_on BETWEEN $2::date AND $3::date
), cohorts AS (
 SELECT portal_host,modality,portal_name,status FROM latest WHERE position=1
)
SELECT portal_host,modality,max(portal_name) AS portal_name,
 count(*)::integer AS protocolados,
 count(*) FILTER (WHERE status='aprovado')::integer AS aprovados,
 count(*) FILTER (WHERE status='recusado')::integer AS recusados,
 count(*) FILTER (WHERE status NOT IN ('aprovado','recusado'))::integer AS demais
FROM cohorts GROUP BY portal_host,modality
ORDER BY protocolados DESC,portal_host,modality LIMIT 500`;
