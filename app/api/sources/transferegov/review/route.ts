import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({
  id:z.string().uuid(),
  version:z.number().int().min(1),
  decision:z.enum(['approved','rejected']),
  justification:z.string().trim().min(10).max(1000),
}).strict();
export async function POST(request:Request) {
  const blocked=rejectUntrustedWrite(request);
  if(blocked) return blocked;
  const user=await getSession();
  if(!user) return NextResponse.json({error:'Acesso não autorizado'},{status:401});
  if(user.role!=='admin') return NextResponse.json({error:'Permissão insuficiente'},{status:403});
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Revisão inválida'},{status:400});
  const d=parsed.data;
  const rows=await queryForMunicipality<{id:string}>(user.municipality_id,
    `WITH reviewed AS (
      UPDATE source_programs SET review_state=$5,reviewer_id=$2,reviewed_at=clock_timestamp()
      WHERE id=$3 AND municipality_id=$1 AND version=$4
      RETURNING id,municipality_id,version
    ), audit AS (
      INSERT INTO source_program_reviews(municipality_id,program_id,version,reviewer_id,decision,justification)
      SELECT municipality_id,id,version,$2,$5,$6 FROM reviewed RETURNING id
    )
    SELECT id FROM audit`,
    [user.municipality_id,user.id,d.id,d.version,d.decision,d.justification],user.id);
  if(!rows.length)
    return NextResponse.json({error:'Registro inexistente, de outra prefeitura ou versão desatualizada'},{status:409});
  return NextResponse.json({ok:true});
}
