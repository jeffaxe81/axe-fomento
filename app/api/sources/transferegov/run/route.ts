import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rejectUntrustedWrite } from '@/lib/security';
import { fetchOfficialPrograms, stageProgram, startSourceRun, finishSourceRun } from '@/lib/source-ingestion';

export const runtime = 'nodejs';
export async function POST(request:Request) {
  const blocked=rejectUntrustedWrite(request);
  if(blocked) return blocked;
  const user=await getSession();
  if(!user) return NextResponse.json({error:'Acesso não autorizado'},{status:401});
  if(user.role!=='admin') return NextResponse.json({error:'Permissão insuficiente'},{status:403});
  if(process.env.ENABLE_OFFICIAL_SOURCE_SYNC!=='yes')
    return NextResponse.json({error:'Coleta oficial desabilitada neste ambiente'},{status:503});
  const runId=await startSourceRun(user.municipality_id,user.id);
  let found=0,changed=0;
  try {
    const programs=await fetchOfficialPrograms();
    found=programs.length;
    for (const program of programs) {
      const result=await stageProgram(user.municipality_id,user.id,program);
      if(result.new_version) changed++;
    }
    await finishSourceRun(user.municipality_id,user.id,runId,'success',found,changed);
    return NextResponse.json({runId,found,changed,status:'success'});
  } catch {
    await finishSourceRun(user.municipality_id,user.id,runId,'error',found,changed);
    return NextResponse.json({error:'Coleta indisponível ou resposta incompatível; confira o registro da execução.'},{status:502});
  }
}
