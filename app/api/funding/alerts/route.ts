import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {radarReferenceDate} from '@/lib/opportunity-deadline.mjs';
import {alertsFor} from '@/lib/funding-pipeline.mjs';
export const runtime='nodejs';
const schema=z.object({modality:z.enum([
 'transferencia','convenio','credito','cooperacao','outro','todas']),
 daysAhead:z.union([z.literal(7),z.literal(30),z.literal(90)]),
 active:z.boolean()}).strict();
export async function GET(){
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 const subscriptions=await queryForMunicipality<{modality:string;days_ahead:number}>(
  actor.municipality_id,
  'SELECT modality,days_ahead FROM funding_alert_subscriptions '+
  'WHERE municipality_id=$1 AND user_id=$2 AND is_active=true',[actor.municipality_id,actor.id],actor.id);
 const observations=await queryForMunicipality<{
  id:string;title:string;closes_on:string|null;opens_on:string|null;
  observation_kind:string;reference_status:string;checked_on:string|null;modality:string;terms:Record<string,unknown>
 }>(actor.municipality_id,
  'SELECT DISTINCT ON (source,external_code) id,title,closes_on::text AS closes_on,opens_on::text AS opens_on,'+
  'observation_kind,reference_status,checked_on::text AS checked_on,modality,terms '+
  'FROM funding_observations WHERE municipality_id=$1 '+
  'ORDER BY source,external_code,created_at DESC,id DESC',[actor.municipality_id],actor.id);
 const [municipality]=await queryForMunicipality<{population:number|null;priority_areas:string[]}>(
  actor.municipality_id,'SELECT population,priority_areas FROM municipalities WHERE id=$1',
  [actor.municipality_id],actor.id);
 const matches=subscriptions.flatMap(s=>alertsFor(observations.filter(
  o=>s.modality==='todas'||o.modality===s.modality),s.days_ahead,
   radarReferenceDate().toISOString().slice(0,10),municipality).map((o:{id:string;title:string;deadline:string})=>({
  ...o,windowDays:s.days_ahead
 })));
 const dedup=new Map(matches.map(m=>[m.id,m]));
 return NextResponse.json({subscriptions,matches:[...dedup.values()],
  delivery:'in_app_on_request',notice:'Não existe envio automático de e-mail ou push'},
 {headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const origin=rejectUntrustedWrite(request);if(origin)return origin;
 if(process.env.ENABLE_FUNDING_PIPELINE!=='yes')return NextResponse.json({error:'Módulo em homologação'},{status:503});
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Assinatura inválida'},{status:400});
 const x=parsed.data;
 const [row]=await queryForMunicipality<{id:string}>(actor.municipality_id,
  'INSERT INTO funding_alert_subscriptions(municipality_id,user_id,modality,days_ahead,is_active) '+
  'VALUES($1,$2,$3,$4,$5) '+
  'ON CONFLICT (municipality_id,user_id,modality,days_ahead) DO UPDATE SET is_active=EXCLUDED.is_active RETURNING id',
  [actor.municipality_id,actor.id,x.modality,x.daysAhead,x.active],actor.id);
 return NextResponse.json({id:row.id,active:x.active},{headers:{'cache-control':'no-store'}});
}
