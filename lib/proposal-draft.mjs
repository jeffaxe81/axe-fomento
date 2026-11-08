import {formatBRLCents} from './financial-money.mjs';

export const SECTION_LABELS=[
 ['summary','Apresentação e contexto'],
 ['justification','Justificativa e público beneficiário'],
 ['objectives','Objetivos e resultados esperados'],
 ['execution','Plano de execução e cronograma'],
 ['budget','Orçamento e premissas'],
 ['requirements','Requisitos e conferência documental']
];
export const SECTION_IDS=SECTION_LABELS.map(([key])=>key);
export const MISSING_LABELS={
 opportunity:'Vincular ou conferir a oportunidade e fonte',
 beneficiaries:'Identificar público beneficiário e demanda local',
 targets:'Definir metas mensuráveis e indicadores',
 stages:'Detalhar etapas e cronograma',
 budget:'Lançar itens e conferir o orçamento',
 requirements:'Conferir exigências do edital para o projeto',
 edict:'Revisar evidências e sugestões do edital'
};
const placeholder='[PREENCHER E VALIDAR PELA EQUIPE MUNICIPAL]';
const slice=(value,max=240)=>String(value??'').trim().slice(0,max);
const line=(s,max=200)=>slice(s,max).replace(/[\r\n]+/gu,' ');
function bounded(text){return text.trim().slice(0,4000);}
export function validateProposalSections(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const keys=Object.keys(input);
 if(keys.length!==SECTION_IDS.length||keys.some(k=>!SECTION_IDS.includes(k)))return null;
 const sections={};
 for(const key of SECTION_IDS){
  const value=input[key];
  if(typeof value!=='string'||value.trim().length<10||
   value.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))return null;
  sections[key]=value.trim();
 }
 return sections;
}

/**
 * Snapshot is declared from the municipality DB, not a verified government source.
 * Missing source values remain visible across every future manual revision.
 */
export function buildProposalDraft(data){
 if(!data||typeof data!=='object'||!data.project||!data.municipality)return null;
 const project=data.project,city=data.municipality,
  stages=Array.isArray(data.stages)?data.stages.slice(0,20):[],
  requirements=Array.isArray(data.requirements)?data.requirements.slice(0,20):[],
  evidence=Array.isArray(data.edictEvidence)?data.edictEvidence.slice(0,12):[];
 const itemCount=Number(data.budgetItems||0);
 const totalCents=String(data.budgetTotalCents??'0');
 if(!/^\d{1,15}$/.test(totalCents)||!Number.isSafeInteger(itemCount)||itemCount<0)return null;
 const missing=[];
 const opportunity=data.opportunity??null;
 if(!opportunity)missing.push('opportunity');
 missing.push('beneficiaries','targets');
 if(stages.length===0)missing.push('stages');
 if(itemCount===0)missing.push('budget');
 if(requirements.length===0)missing.push('requirements');
 if(evidence.length===0)missing.push('edict');
 const locality=line(city.name)+' / '+line(city.uf,2);
 const sections={
  summary:bounded(
   'Projeto: '+line(project.title)+'\nMunicípio: '+locality+
   '\nOportunidade vinculada: '+(opportunity?line(opportunity.title):placeholder)+
   '\nÓrgão informado: '+(opportunity?line(opportunity.provider):placeholder)+
   '\nSituação interna: '+line(project.status)+
   '\nEste documento é um rascunho sujeito a conferência e aprovação humana.'),
  justification:bounded(
   'Contexto municipal declarado: '+locality+
   '\nProblema público a solucionar: '+placeholder+
   '\nPúblico beneficiário e diagnóstico local: '+placeholder+
   '\nDados e referências que comprovam a necessidade: '+placeholder),
  objectives:bounded(
   'Objetivo geral: '+placeholder+
   '\nMetas, indicadores e resultados mensuráveis: '+placeholder+
   '\nResponsáveis e meios de verificação: '+placeholder),
  execution:bounded(stages.length?
   'Etapas cadastradas no planejamento (estimativas municipais):\n'+
    stages.map(s=>'- Etapa '+line(s.number,5)+': '+line(s.title)+
     ' | '+line(s.startsOn,10)+' até '+line(s.endsOn,10)+
     ' | premissas: '+line(s.assumptions,160)).join('\n')+
   '\nMetodologia, contratações e responsáveis: '+placeholder:
   'Plano de execução e cronograma: '+placeholder),
  budget:bounded(
   'Total dos itens cadastrados: '+formatBRLCents(totalCents)+
   '\nItens lançados: '+itemCount+
   '\nOrigem: orçamento físico-financeiro interno declarado pela equipe.\n'+
   (itemCount===0?'Detalhamento orçamentário: '+placeholder:'Os custos devem ser validados por pesquisa e processo adequados.')+
   '\nFonte de recursos e contrapartida confirmadas: '+placeholder),
  requirements:bounded(
   'Matriz de requisitos declarados para a oportunidade:\n'+
   (requirements.length?
    requirements.map(r=>'- '+line(r.requirement)+' [Situação: '+line(r.status,30)+
     '; fonte/versão: '+line(r.sourceVersion,100)+'; item '+line(r.sourceSection,100)+']').join('\n'):
    'Requisitos ainda não registrados: '+placeholder)+
   '\nSugestões de edital com aprovação APENAS interna (AF-030):\n'+
   (evidence.length?
    evidence.map(e=>'- '+line(e.requirement)+
     ' [Página declarada: '+(e.page??'não informada')+
     '; trecho: '+line(e.excerpt,160)+']').join('\n'):
    'Sugestões documentalmente revisadas: '+placeholder)+
   '\nAferição jurídica, autenticação das fontes e elegibilidade: '+placeholder),
 };
 return {sections,missingFields:missing,sourceSnapshot:{
  project:{id:project.id,title:line(project.title),status:line(project.status)},
  municipality:{name:line(city.name),uf:line(city.uf,2)},
  opportunity:opportunity?{id:opportunity.id,title:line(opportunity.title),
   provider:line(opportunity.provider),sourceUrl:slice(opportunity.sourceUrl,600)}:null,
  budget:{items:itemCount,totalCents,stages},
  requirements,evidence,method:'template_from_local_data'
 }};
}
