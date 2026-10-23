import { NextResponse } from 'next/server';
import { getSession, verifiedCookie } from '@/lib/auth';
import { query } from '@/lib/db';
export const runtime='nodejs';
export async function GET(){
  const user=await getSession(),ids=await verifiedCookie();
  if(!user||!ids||ids.userId!==user.id)
    return NextResponse.json({error:'Não autorizado'},{status:401});
  const [result]=await query<{enabled:boolean}>(
    'SELECT public.auth_mfa_status($1::uuid,$2::uuid) AS enabled',
    [user.id,ids.sessionId]);
  return NextResponse.json({enabled:result?.enabled===true},{headers:{'Cache-Control':'no-store'}});
}
