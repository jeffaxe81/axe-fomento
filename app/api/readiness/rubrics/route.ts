import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validateRubric} from '@/lib/readiness-rubric.mjs';
export const runtime='nodejs';
const schema=z.object({
 rubricKey:z.string().regex(/^[a-z][a-z0-9_-]{3,39}$/),
 expectedVersion:z.number().int().min(0).max(99),
 criteria:z.array(z.object({
  id:z.string(),label:z.string(),weight:z.number().int()
 }).strict()).min(1).max(30),
 changeNote:z.string().trim().min(10).max(500)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_READINESS_EVALUATOR!=='yes')
  return NextResponse.json({error:'Avaliador aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão obrigatória'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Reservado ao administrador'},{status:403});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Rubrica inválida'},{status:400});
 const d=parsed.data;
 let criteria:ReturnType<typeof validateRubric>;
 try{criteria=validateRubric(d.criteria);}catch{
  return NextResponse.json({error:'Critérios ou soma de pesos inválidos'},{status:422});
 }
 const [row]=await queryForMunicipality<{id:string;version:number}>(actor.municipality_id,`
 WITH previous AS MATERIALIZED(
  SELECT COALESCE(max(version),0)::integer AS version
  FROM readiness_rubric_versions WHERE municipality_id=$1::uuid AND rubric_key=$3::text
 ), saved AS(
  INSERT INTO readiness_rubric_versions(municipality_id,rubric_key,version,
   criteria,change_note,sha256,created_by)
  SELECT $1::uuid,$3::text,previous.version+1,$4::jsonb,$5::text,
   encode(digest($4::jsonb::text,'sha256'),'hex'),$2::uuid
  FROM previous WHERE previous.version=$6::integer
  ON CONFLICT(municipality_id,rubric_key,version) DO NOTHING
  RETURNING id,version
 )
 SELECT id,version FROM saved`,[
  actor.municipality_id,actor.id,d.rubricKey,JSON.stringify(criteria),
  d.changeNote,d.expectedVersion
 ],actor.id);
 if(!row)return NextResponse.json({error:'Revisão concorrente; atualize a lista de rubricas'},{status:409});
 return NextResponse.json(row,{status:201,headers:{'cache-control':'no-store'}});
}
