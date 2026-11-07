import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {renderReadinessPdf} from '@/lib/readiness-pdf.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Assessment={
 id:string;project_id:string;version:number;stage:string;project_title:string;
 author_name:string;created_at:string;note:string;snapshot_sha256:string;
 result_snapshot:{score:number;maximumPossibleScore:number;evaluatedWeight:number;
  breakdown:Array<{id:string;label:string;weight:number;score:number|null;evidence:string|null}>};
 evidence_snapshot:Array<{kind:string;title:string;snapshot_sha256:string;document_version_id:string|null;budget_item_id:string|null}>;
 blockers:Array<{id:string;title:string;ruleUrl:string;evidence:string;confirmed:boolean}>;
 actions:Array<{key:string;title:string;priority:string;reason:string}>;
};
type Review={decision:string;note:string;reviewer_name:string;reviewed_at:string;revision:number};
type Assignment={action_key:string;assigned_to:string|null;responsible_name:string|null;revision:number;note:string};
export async function GET(_request:Request,{params}:{params:Promise<{evaluationId:string}>}){
 if(process.env.ENABLE_READINESS_EVALUATOR!=='yes')
  return NextResponse.json({error:'Relatório ainda não homologado'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão obrigatória'},{status:401});
 const {evaluationId}=await params;
 if(!z.string().uuid().safeParse(evaluationId).success)
  return NextResponse.json({error:'Identificador inválido'},{status:404});
 const [a]=await queryForMunicipality<Assessment>(actor.municipality_id,`
 SELECT a.id,a.project_id,a.version,a.stage,a.created_at,a.note,a.snapshot_sha256,
  a.result_snapshot,a.evidence_snapshot,a.blockers,a.actions,
  p.title AS project_title,u.full_name AS author_name
 FROM project_readiness_assessments a
 JOIN projects p ON p.id=a.project_id AND p.municipality_id=a.municipality_id
 JOIN users u ON u.id=a.created_by AND u.municipality_id=a.municipality_id
 WHERE a.municipality_id=$1::uuid AND a.id=$2::uuid`,
 [actor.municipality_id,evaluationId],actor.id);
 if(!a)return NextResponse.json({error:'Avaliação indisponível'},{status:404});
 const [reviews,assignments]=await Promise.all([
  queryForMunicipality<Review>(actor.municipality_id,`
   SELECT e.decision,e.note,e.reviewed_at,e.revision,u.full_name AS reviewer_name
   FROM readiness_review_events e JOIN users u ON u.id=e.reviewer_id
    AND u.municipality_id=e.municipality_id
   WHERE e.municipality_id=$1 AND e.assessment_id=$2
   ORDER BY e.revision LIMIT 100`,[actor.municipality_id,evaluationId],actor.id),
  queryForMunicipality<Assignment>(actor.municipality_id,`
   SELECT e.action_key,e.assigned_to,u.full_name AS responsible_name,e.revision,e.note
   FROM readiness_action_assignment_events e LEFT JOIN users u ON u.id=e.assigned_to
    AND u.municipality_id=e.municipality_id
   WHERE e.municipality_id=$1 AND e.assessment_id=$2
   ORDER BY e.action_key,e.revision DESC LIMIT 200`,[actor.municipality_id,evaluationId],actor.id)
 ]);
 const assigned=new Map<string,Assignment>();
 for(const e of assignments)if(!assigned.has(e.action_key))assigned.set(e.action_key,e);
 const date=(v:string)=>new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const sections=[
  {title:'Identificacao e versao',lines:[
   'Projeto: '+a.project_title,
   'Municipio vinculado: '+actor.municipality_id,
   'Versao da avaliacao: '+a.version+' | Estagio: '+a.stage,
   'Autor: '+a.author_name+' | Registrado em: '+date(a.created_at),
   'Hash SHA-256 do snapshot: '+a.snapshot_sha256,
   'Observacoes: '+a.note
  ]},
  {title:'Pontuacao preliminar',lines:[
   'Nota conservadora: '+a.result_snapshot.score+' de 100',
   'Cobertura dos pesos avaliados: '+a.result_snapshot.evaluatedWeight+'%',
   'Limite teorico com evidencias ainda ausentes: '+a.result_snapshot.maximumPossibleScore,
   'Pontuacao nao supera ou ignora os impedimentos eliminatorios abaixo.'
  ]},
  {title:'Criterios, pesos e evidencias',lines:a.result_snapshot.breakdown.map(c=>
   c.label+' ('+c.weight+'%): '+(c.score===null?'pendente':c.score+'/100')+
   ' | Evidencia declarada: '+(c.evidence||'ausente'))},
  {title:'Versoes tecnicas e financeiras vinculadas',
   lines:a.evidence_snapshot.length?a.evidence_snapshot.map(e=>
    e.kind+': '+e.title+' | SHA-256 '+e.snapshot_sha256+
    ' | Identificador da fonte '+(e.document_version_id||e.budget_item_id)):
    ['Nenhuma evidencia versionada vinculada ao snapshot.']},
  {title:'Impedimentos (independentes da nota)',lines:a.blockers.length?a.blockers.map(b=>
   (b.confirmed?'CONFIRMADO PELA EQUIPE: ':'A VERIFICAR: ')+b.title+
   ' | Regra/URL informada: '+b.ruleUrl+' | Evidencia: '+b.evidence):
   ['Nenhum impedimento foi declarado. Isso NAO certifica ausencia de impedimentos legais.']},
  {title:'Plano de correcao priorizado',lines:a.actions.length?a.actions.map(x=>{
   const responsible=assigned.get(x.key);
   return '['+x.priority+'] '+x.title+' | Justificativa: '+x.reason+
    ' | Responsavel declarado: '+(responsible?.responsible_name||'nao atribuido');
  }):['Sem lacunas descritas na avaliacao informada.']},
  {title:'Revisao humana e reavaliacoes',lines:reviews.length?reviews.map(r=>
   'Revisao '+r.revision+': '+r.decision+' | '+r.reviewer_name+' | '+date(r.reviewed_at)+
   ' | Justificativa: '+r.note):['Sem revisao independente registrada.']},
  {title:'Ressalvas',lines:[
   'Relatorio interno de pre-viabilidade: nao equivale a parecer juridico, financeiro ou a aprovacao publica.',
   'Evidencias sao registros inseridos pela equipe municipal; fontes oficiais devem ser reconferidas.',
   'Situacao de editais, regras e elegibilidade nao sao validadas automaticamente por este relatorio.',
   'Nota simulada, quando existir, nao altera a nota oficialmente registrada nesta versao.'
  ]}
 ];
 try{
  const pdf=await renderReadinessPdf({title:'Pre-avaliacao: '+a.project_title,sections});
  return new NextResponse(new Uint8Array(pdf).buffer as ArrayBuffer,{
   headers:{
    'content-type':'application/pdf',
    'content-disposition':'attachment; filename="axe-fomento-avaliacao-'+a.id+'.pdf"',
    'cache-control':'private, no-store, max-age=0',
    'x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'; sandbox"
   }
  });
 }catch{
  return NextResponse.json({error:'Não foi possível gerar o PDF desta avaliação'},{status:500});
 }
}
