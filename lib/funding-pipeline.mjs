// AXE Funding Engine — municipal decision support. None of the outputs constitutes
// a lender's decision, official fiscal eligibility, proof of submission or award.
import {createHash} from 'node:crypto';
export const SOURCES=Object.freeze({
 transferegov:Object.freeze({host:'api-publica.transferegov.gestao.gov.br',label:'Transferegov'}),
 bndes:Object.freeze({host:'cidades.bndes.gov.br',label:'BNDES Cidades'}),
 tesouro_capag:Object.freeze({host:'www.tesourotransparente.gov.br',label:'Tesouro / CAPAG'})
});
export const EVENT_TYPES=Object.freeze([
 'eligibility','line_comparison','financial_simulation','documentation_check',
 'dossier','submission_handoff','protocol_update','diligence_alert',
 'award_verification','disbursement_verification','decision_review'
]);
const maximum=100_000_000_000_000; // cents, no unsafe currency JSON
export const MODALITIES=Object.freeze(['transferencia','convenio','credito','cooperacao','outro']);
export const parseMoneyCents=(x)=>{
 if(typeof x!=='string'||!/^\d{1,12}\.\d{2}$/.test(x))return null;
 const [a,b]=x.split('.');const n=BigInt(a)*100n+BigInt(b);
 return n<=BigInt(maximum)?n.toString():null;
};
export function validOfficialUrl(value,source){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search.length>500)return false;
  const host=u.hostname.toLowerCase();
  if(source==='transferegov')return host===SOURCES.transferegov.host;
  if(source==='bndes')return host===SOURCES.bndes.host||host==='www.bndes.gov.br';
  if(source==='tesouro_capag')return host==='www.tesourotransparente.gov.br'||host==='tesourotransparente.gov.br';
  if(source==='other_official')return host==='gov.br'||host.endsWith('.gov.br');
  return false;
 }catch{return false;}
}
export function fingerprint(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function validDate(x){
 if(typeof x!=='string'||!/^\d{4}-\d\d-\d\d$/.test(x))return false;
 const date=new Date(x+'T00:00:00.000Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===x;
}
export function classifyObservation(row,today=new Date().toISOString().slice(0,10)){
 if(row.observation_kind!=='oportunidade_conferida'||row.reference_status!=='conferida_por_operador')
  return 'referencia_sem_oferta_confirmada';
 if(!validDate(row.checked_on))return 'consulta_nao_comprovada';
 if(!validDate(today))return 'data_invalida';
 const age=(Date.parse(today+'T00:00:00Z')-Date.parse(row.checked_on+'T00:00:00Z'))/86_400_000;
 if(age<0||age>30)return 'verificacao_desatualizada';
 if(row.closes_on&&validDate(row.closes_on)&&row.closes_on<today)return 'prazo_encerrado';
 if(row.opens_on&&validDate(row.opens_on)&&row.opens_on>today)return 'inicio_futuro';
 if(!row.closes_on)return 'sem_prazo_comprovado';
 return 'potencialmente_aberta_verificar_fonte';
}
export function officialSourcePolicy(source){
 if(source==='transferegov')return 'Dados de programas não significam edital aberto ou linha disponível';
 if(source==='bndes')return 'Página BNDES não comprova taxa, prazo, contratação ou aprovação';
 if(source==='tesouro_capag')return 'CAPAG publicada é indicativa e não equivale à avaliação definitiva do Tesouro';
 return 'Conferir fonte pública, requisitos e autorização de uso antes de aplicar';
}
export function compareOffers(rows,today){
 return rows.slice(0,3).map(r=>({
  id:r.id,title:r.title,modality:r.modality,
  status:classifyObservation(r,today),
  checkedOn:r.checked_on??null,closesOn:r.closes_on??null,
  annualRateBps:r.terms?.annualRateBps??null,termMonths:r.terms?.termMonths??null,
  guarantee:r.terms?.requiresGuarantee??null,
  sourceUrl:r.source_url,
  notice:'Condições declaradas em observação, não simulam uma proposta vinculante'
 }));
}
export function initialEligibility(offer,municipality,requirements=[]){
 const signals=[];
 if(offer.modality==='credito'){
  signals.push({code:'credito',state:'pendente',why:'Verificar limites de endividamento, autorizações e condições do financiador'});
  signals.push({code:'capag',state:municipality?.capag?'revisao_humana':'ausente',
   why:'CAPAG informada não garante aval do Tesouro ou aptidão para contratar'});
 }
 if(offer.terms?.minimumPopulation!=null){
  const min=Number(offer.terms.minimumPopulation),pop=Number(municipality?.population);
  signals.push({code:'populacao',state:Number.isFinite(pop)&&pop>0
   ?(pop>=min?'indicio_compatibilidade':'possivel_impedimento'):'pendente',
   why:'População e regras precisam ser confirmadas na fonte vigente'});
 }
 for(const rule of requirements){
  signals.push({code:'documento',state:rule.status??'pendente',
   why:'Evidência documental declarada: '+String(rule.title??'Requisito').slice(0,100)});
 }
 return {decision:'analise_humana_obrigatoria',signals};
}
export function simulateFinancing({principalCents,annualRateBps,months,graceMonths=0}){
 const p=Number(principalCents),bps=Number(annualRateBps);
 if(!Number.isSafeInteger(p)||p<=0||p>maximum||!Number.isInteger(bps)||bps<0||bps>10000
  ||!Number.isInteger(months)||months<1||months>600||
  !Number.isInteger(graceMonths)||graceMonths<0||graceMonths>120)
  throw Error('Parâmetros financeiros inválidos');
 // Illustrative nominal monthly rate, capitalized grace; excludes fees, indexers and taxes.
 const rate=bps/120000;
 const financed=p*Math.pow(1+rate,graceMonths);
 const payment=rate===0?financed/months:financed*rate/(1-Math.pow(1+rate,-months));
 if(!Number.isFinite(payment))throw Error('Simulação indisponível');
 const installmentCents=Math.round(payment);
 return {installmentCents:String(installmentCents),totalCents:String(installmentCents*months),
  graceMonths,months,annualRateBps:bps,
  assumption:'Projeção hipotética pela Tabela Price, taxa nominal constante, carência capitalizada; sem encargos, tributos, indexadores ou oferta oficial'};
}
export function checkDossier(items){
 const result=items.map(item=>({title:item.title,status:item.status,
  ready:item.status==='apresentado'&&Boolean(item.versionId)}));
 return {items:result,ready:result.length>0&&result.every(x=>x.ready),
  pending:result.filter(x=>!x.ready).map(x=>x.title),
  notice:'Dossiê interno; não comprova aceite ou recepção em portal externo'};
}
export function handoffFor(offer,steps=[]){
 return {portalUrl:validOfficialUrl(offer.source_url,offer.source)?offer.source_url:null,
  steps:['Conferir edital/linha original e vigência','Revisar requisitos e aprovações internas',
   'Reunir anexos oficiais exigidos',...steps,'Protocolar apenas por usuário habilitado no sistema externo',
   'Registrar número e comprovante de submissão no AXE'],
  mode:'assistido_sem_envio_automatico'};
}
export function alertsFor(offers,days,today=new Date().toISOString().slice(0,10),municipality=null){
 if(![7,30,90].includes(days)||!validDate(today))throw Error('Janela inválida');
 const horizon=new Date(Date.parse(today+'T00:00:00Z')+days*86_400_000).toISOString().slice(0,10);
 return offers.filter(o=>classifyObservation(o,today)==='potencialmente_aberta_verificar_fonte'
  &&o.closes_on>=today&&o.closes_on<=horizon
  &&municipalityOfferCompatibility(o,municipality).status!=='possivel_impedimento')
  .map(o=>({id:o.id,title:o.title,deadline:o.closes_on,
   compatibility:municipalityOfferCompatibility(o,municipality).status,
   warning:'Confirme a vigência e os requisitos na fonte oficial antes de agir'}));
}
export function operationalOutcomes(cases,events){
 const byCase=new Map(cases.map(c=>[c.id,{caseId:c.id,projectId:c.project_id,
  source:c.source,awardDeclaredCents:'0',paidDeclaredCents:'0',stage:'preparacao'}]));
 const grouped=new Map();
 for(const e of events){
  if(!byCase.has(e.case_id))continue;
  const group=grouped.get(e.case_id)??[];
  group.push(e);grouped.set(e.case_id,group);
 }
 for(const [caseId,group] of grouped){
  const row=byCase.get(caseId);
  group.sort((a,b)=>a.revision-b.revision);
  for(const e of group){
   if(e.event_kind==='submission_handoff')row.stage='encaminhamento_assistido';
   if(e.event_kind==='protocol_update')row.stage='protocolo_declarado';
   if(e.event_kind==='award_verification'&&e.evidence_url&&e.value_cents)
    {row.awardDeclaredCents=e.value_cents;row.stage='aprovacao_declarada_com_evidencia';}
   if(e.event_kind==='disbursement_verification'&&e.evidence_url&&e.value_cents)
    {row.paidDeclaredCents=e.value_cents;row.stage='desembolso_declarado_com_evidencia';}
  }
 }
 let award=0n,paid=0n,awarded=0;
 for(const row of byCase.values()){
  const a=BigInt(row.awardDeclaredCents),p=BigInt(row.paidDeclaredCents);
  award+=a;paid+=p;if(a>0n)awarded++;
 }
 return {projects:byCase.size,awarded,declaredAwardCents:award.toString(),
  declaredPaidCents:paid.toString(),cases:[...byCase.values()],
  caveat:'Valores declarados e acompanhados de referência documental, sem conciliação bancária ou confirmação automática pela instituição financiadora'};
}


export function offerDocumentGaps(offer,documents){
 const required=Array.isArray(offer?.terms?.documentation)?offer.terms.documentation:[];
 const normalize=x=>String(x).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const seen=new Set();
 const checks=required.filter(label=>typeof label==='string'&&label.trim().length>0).map(label=>{
  const key=normalize(label);
  if(seen.has(key))return null;seen.add(key);
  const matching=documents.find(d=>normalize(d.title)===key);
  return {requirement:label,status:matching?.status??'nao_localizado',
   ready:Boolean(matching?.status==='apresentado'&&matching?.versionId),
   evidenceVersionId:matching?.versionId??null};
 }).filter(Boolean);
 return {requiredCount:checks.length,ready:checks.length>0&&checks.every(c=>c.ready),
  gaps:checks.filter(c=>!c.ready),
  notice:'Comparação com documentos informados pelo município; conferir lista no edital original'};
}
export function fundingEligibilityForCase(offer,municipality,documents=[]){
 const initial=initialEligibility(offer,municipality);
 const documentary=offerDocumentGaps(offer,documents);
 const signals=[...initial.signals];
 if(offer.terms?.requiresGuarantee===true)
  signals.push({code:'garantia',state:'pendente',why:'Verificar necessidade e condições oficiais da garantia'});
 if(!documentary.requiredCount)
  signals.push({code:'documentos_exigidos',state:'pendente',
   why:'Lista documental por linha não informada; consultar regras do financiador'});
 else if(documentary.gaps.length)
  signals.push({code:'documentos_exigidos',state:'pendente',
   why:documentary.gaps.length+' documento(s) ainda sem comprovação na linha'});
 return {decision:'analise_humana_obrigatoria',signals,documentary};
}


export function municipalityOfferCompatibility(offer,municipality){
 const population=Number(municipality?.population);
 const min=offer?.terms?.minimumPopulation;
 const max=offer?.terms?.maximumPopulation;
 if(min!=null&&Number.isFinite(population)&&population>0&&population<Number(min))
  return {status:'possivel_impedimento',reason:'População abaixo do mínimo declarado'};
 if(max!=null&&Number.isFinite(population)&&population>0&&population>Number(max))
  return {status:'possivel_impedimento',reason:'População acima do máximo declarado'};
 const areas=Array.isArray(offer?.terms?.thematicAreas)?offer.terms.thematicAreas:[];
 const priorities=Array.isArray(municipality?.priority_areas)?municipality.priority_areas:[];
 if(areas.length&&priorities.length){
  const normalize=s=>String(s).trim().toLocaleLowerCase('pt-BR');
  if(!areas.some(a=>priorities.some(p=>normalize(a)===normalize(p))))
   return {status:'outra_area',reason:'Linha fora das prioridades informadas pela prefeitura'};
 }
 return {status:'analisar_condicoes',reason:'Compatibilidade preliminar; verificar regras oficiais'};
}
