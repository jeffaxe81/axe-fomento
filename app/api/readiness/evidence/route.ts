import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
export const runtime='nodejs';
const schema=z.object({
 caseId:z.string().uuid(),versionId:z.string().uuid(),
 note:z.string().trim().min(10).max(500)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_READINESS_EVALUATOR!=='yes')
  return NextResponse.json({error:'Avaliador aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão obrigatória'},{status:401});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Evidência inválida'},{status:400});
 const d=p.data;
 const [record]=await queryForMunicipality<{id:string}>(actor.municipality_id,`
  INSERT INTO readiness_case_evidence(municipality_id,case_id,project_id,
   version_id,note,added_by)
  SELECT c.municipality_id,c.id,c.project_id,v.id,$5::text,$2::uuid
  FROM readiness_cases c
  JOIN users u ON u.id=$2::uuid AND u.municipality_id=c.municipality_id AND u.active
  JOIN project_document_versions v ON v.id=$4::uuid
   AND v.municipality_id=c.municipality_id AND v.project_id=c.project_id
  WHERE c.id=$3::uuid AND c.municipality_id=$1::uuid AND c.kind='documented'
   AND (u.role='admin' OR c.created_by=u.id)
  ON CONFLICT(case_id,version_id) DO NOTHING RETURNING id`,[
  actor.municipality_id,actor.id,d.caseId,d.versionId,d.note
 ],actor.id);
 if(!record)return NextResponse.json({error:'Evidência indisponível ou já vinculada'},{status:409});
 return NextResponse.json({id:record.id},{status:201,headers:{'cache-control':'no-store'}});
}
