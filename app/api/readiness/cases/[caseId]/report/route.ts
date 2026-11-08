import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {buildReadinessPdf} from '@/lib/readiness-pdf.mjs';
export const runtime='nodejs';
type Case={id:string;kind:string;title:string;problem:string;target_audience:string;
 objective:string;author_name:string;project_title:string|null};
type Assessment={id:string;revision:number;previous_id:string|null;author_name:string;
 score:string;maximum_possible_score:string;evaluated_weight:number;
 rubric_version:number;rubric_snapshot:object[];scores_snapshot:object[];
 blockers_snapshot:object[];action_plan_snapshot:object[];evidence_snapshot:object[];
 snapshot_sha256:string;revision_note:string;created_at:string};
type Review={revision:number;decision:string;note:string;reviewer_name:string;reviewed_at:string};
type Assignment={action_code:string;responsible_name:string};
export async function GET(request:Request,{params}:{params:Promise<{caseId:string}>}){
 if(process.env.ENABLE_READINESS_EVALUATOR!=='yes')
  return NextResponse.json({error:'Relatório ainda não homologado'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão obrigatória'},{status:401});
 const {caseId}=await params;
 const filter=new URL(request.url).searchParams.get('assessmentId');
 if(!z.string().uuid().safeParse(caseId).success||
  (filter!==null&&!z.string().uuid().safeParse(filter).success))
  return NextResponse.json({error:'Identificador inválido'},{status:400});
 const [caseInfo]=await queryForMunicipality<Case>(actor.municipality_id,`
  SELECT c.id,c.kind,c.title,c.problem,c.target_audience,c.objective,
   creator.full_name AS author_name,p.title AS project_title
  FROM readiness_cases c JOIN users creator
   ON creator.id=c.created_by AND creator.municipality_id=c.municipality_id
  LEFT JOIN projects p ON p.id=c.project_id AND p.municipality_id=c.municipality_id
  WHERE c.municipality_id=$1::uuid AND c.id=$2::uuid`,
  [actor.municipality_id,caseId],actor.id);
 if(!caseInfo)return NextResponse.json({error:'Avaliação não encontrada'},{status:404});
 const [assessment]=await queryForMunicipality<Assessment>(actor.municipality_id,`
  SELECT a.*,u.full_name AS author_name FROM readiness_assessments a
  JOIN users u ON u.id=a.created_by AND u.municipality_id=a.municipality_id
  WHERE a.municipality_id=$1::uuid AND a.case_id=$2::uuid
   AND ($3::uuid IS NULL OR a.id=$3::uuid)
  ORDER BY a.revision DESC LIMIT 1`,
  [actor.municipality_id,caseId,filter],actor.id);
 if(!assessment)return NextResponse.json({error:'Versão indisponível'},{status:404});
 const [reviews,assignments]=await Promise.all([
  queryForMunicipality<Review>(actor.municipality_id,`
   SELECT r.revision,r.decision,r.note,u.full_name AS reviewer_name,r.reviewed_at
   FROM readiness_review_events r JOIN users u ON u.id=r.reviewer_id
    AND u.municipality_id=r.municipality_id
   WHERE r.municipality_id=$1::uuid AND r.case_id=$2::uuid
    AND r.assessment_id=$3::uuid ORDER BY r.revision ASC LIMIT 100`,
   [actor.municipality_id,caseId,assessment.id],actor.id),
  queryForMunicipality<Assignment>(actor.municipality_id,`
   SELECT DISTINCT ON (s.action_code) s.action_code,u.full_name AS responsible_name
   FROM readiness_action_assignments s JOIN users u ON u.id=s.responsible_user_id
    AND u.municipality_id=s.municipality_id
   WHERE s.municipality_id=$1::uuid AND s.case_id=$2::uuid
    AND s.assessment_id=$3::uuid
   ORDER BY s.action_code,s.revision DESC`,[actor.municipality_id,caseId,assessment.id],actor.id)
 ]);
 const bytes=await buildReadinessPdf({caseInfo,assessment,reviews,assignments});
 return new NextResponse(new Uint8Array(bytes),{status:200,headers:{
  'content-type':'application/pdf',
  'content-length':String(bytes.length),
  'content-disposition':'attachment; filename="axe-fomento-previabilidade-v'+assessment.revision+'.pdf"',
  'cache-control':'no-store, private',
  'x-content-type-options':'nosniff',
  'content-security-policy':"default-src 'none'; sandbox"
 }});
}
