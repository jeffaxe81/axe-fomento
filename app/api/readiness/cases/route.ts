import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
export const runtime='nodejs';
const schema=z.object({
 kind:z.enum(['idea','documented']),projectId:z.string().uuid().nullable(),
 title:z.string().trim().min(6).max(180),
 problem:z.string().trim().min(20).max(2000),
 targetAudience:z.string().trim().min(10).max(1000),
 objective:z.string().trim().min(20).max(2000)
}).strict().refine(x=>x.kind==='idea'?x.projectId===null:x.projectId!==null);
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
 if(!p.success)return NextResponse.json({error:'Ideia/projeto inválido'},{status:400});
 const d=p.data;
 const [record]=await queryForMunicipality<{id:string}>(actor.municipality_id,`
  INSERT INTO readiness_cases(municipality_id,kind,project_id,title,
   problem,target_audience,objective,created_by)
  SELECT $1::uuid,$3::text,$4::uuid,$5::text,$6::text,$7::text,$8::text,$2::uuid
  FROM users u LEFT JOIN projects pr ON pr.id=$4::uuid
   AND pr.municipality_id=u.municipality_id
  WHERE u.id=$2::uuid AND u.municipality_id=$1::uuid AND u.active
   AND ($3::text='idea' OR (pr.id IS NOT NULL
    AND (u.role='admin' OR pr.owner_user_id=u.id)))
  RETURNING id`,[
  actor.municipality_id,actor.id,d.kind,d.projectId,d.title,
  d.problem,d.targetAudience,d.objective
 ],actor.id);
 if(!record)return NextResponse.json({error:'Projeto indisponível ao responsável'},{status:404});
 return NextResponse.json({id:record.id},{status:201,headers:{'cache-control':'no-store'}});
}
