import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {operationalOutcomes} from '@/lib/funding-pipeline.mjs';
export const runtime='nodejs';
type Case={id:string;project_id:string;project_title:string;source:string};
type Event={case_id:string;revision:number;event_kind:string;evidence_url:string|null;value_cents:string|null};
function cell(s:unknown){
 let str=String(s??'').replace(/[\r\n]+/g,' ');
 if(/^[=+@-]/.test(str))str="'"+str;
 return '"'+str.replaceAll('"','""')+'"';
}
export async function GET(request:Request){
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 const [cases,events]=await Promise.all([
  queryForMunicipality<Case>(actor.municipality_id,
   'SELECT c.id,c.project_id,p.title AS project_title,o.source FROM funding_cases c '+
   'JOIN projects p ON p.id=c.project_id AND p.municipality_id=c.municipality_id '+
   'JOIN funding_observations o ON o.id=c.observation_id AND o.municipality_id=c.municipality_id '+
   'WHERE c.municipality_id=$1 ORDER BY c.created_at DESC LIMIT 500',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Event>(actor.municipality_id,
   'SELECT case_id,revision,event_kind,evidence_url,value_cents::text AS value_cents '+
   'FROM funding_case_events WHERE municipality_id=$1 ORDER BY created_at DESC LIMIT 5000',
   [actor.municipality_id],actor.id)
 ]);
 const summary=operationalOutcomes(cases,events);
 if(new URL(request.url).searchParams.get('format')==='csv'){
  const labels=['Projeto','Fonte','Etapa declarada','Aprovação declarada (centavos)',
   'Desembolso declarado (centavos)','Aviso'];
  const names=new Map(cases.map(c=>[c.id,c.project_title]));
  const lines=[labels.map(cell).join(';'),
   ...summary.cases.map((c:{caseId:string;source:string;stage:string;
    awardDeclaredCents:string;paidDeclaredCents:string})=>
    [names.get(c.caseId),c.source,c.stage,c.awardDeclaredCents,c.paidDeclaredCents,
     'Valores não conciliados com financiador'].map(cell).join(';'))];
  const content='\uFEFF'+lines.join('\r\n');
  return new NextResponse(content,{headers:{
   'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="axe-fomento-captacao-declarada.csv"',
   'cache-control':'private, no-store'
  }});
 }
 return NextResponse.json(summary,{headers:{'cache-control':'no-store'}});
}
