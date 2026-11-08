import { NextResponse } from 'next/server';
import { getSession, verifiedCookie } from '@/lib/auth';
import { query } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
export const runtime='nodejs';
async function identity(){
  const [user,ids]=await Promise.all([getSession(),verifiedCookie()]);
  return user&&ids&&ids.userId===user.id ? {user,ids}:null;
}
export async function GET(){
  const session=await identity();
  if(!session)return NextResponse.json({error:'Não autorizado'},{status:401});
  const rows=await query<{id:string;created_at:string;expires_at:string;is_current:boolean}>(
    'SELECT * FROM public.auth_list_sessions($1::uuid,$2::uuid)',
    [session.user.id,session.ids.sessionId]);
  return NextResponse.json({sessions:rows},{headers:{'Cache-Control':'no-store'}});
}
export async function DELETE(request:Request){
  const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
  const session=await identity();
  if(!session)return NextResponse.json({error:'Não autorizado'},{status:401});
  const [result]=await query<{count:number}>(
    'SELECT public.auth_revoke_other_sessions($1::uuid,$2::uuid) AS count',
    [session.user.id,session.ids.sessionId]);
  return NextResponse.json({revoked:result?.count??0},{headers:{'Cache-Control':'no-store'}});
}
