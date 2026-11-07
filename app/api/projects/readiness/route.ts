import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {getSession,type UserSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validateRubric,scoreReadiness} from '@/lib/readiness-rubric.mjs';
import {validateBlockers,planForGaps,simulateReadiness} from '@/lib/readiness-workflow.mjs';
export const runtime='nodejs';
const uuid=z.string().uuid();
const text=(a:number,b:number)=>z.string().trim().min(a).max(b);
const common=z.object({action:z.string()});
type Actor=UserSession;
async function owner(actor:Actor,projectId:string){
 const [p]=await queryForMunicipality<{id:string;owner_user_id:string|null}>(
  actor.municipality_id,'SELECT id,owner_user_id FROM projects WHERE municipality_id=$1 AND id=$2',
  [actor.municipality_id,projectId],actor.id);
 return !!p&&(actor.role==='admin'||p.owner_user_id===actor.id);
}
function fail(message:string,status=400){return NextResponse.json({error:message},{status});}
function success(data:unknown,status=201){return NextResponse.json(data,{status,headers:{'cache-control':'no-store'}});}
function hash(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
async function input(request:Request){try{return await request.json() as unknown;}catch{return null;}}
const ideaSchema=z.object({action:z.literal('idea'),projectId:uuid,expectedVersion:z.number().int().min(0).max(999),
 problem:text(20,2000),audience:text(10,1000),objective:text(20,2000)}).strict();
const rubricSchema=z.object({action:z.literal('rubric'),expectedVersion:z.number().int().min(0).max(999),
 criteria:z.array(z.object({id:text(1,50),label:text(3,160),weight:z.number().int().min(1).max(100)}).strict()).min(2).max(30),
 note:text(10,500)}).strict();
const evidenceSchema=z.object({action:z.literal('evidence'),projectId:uuid,
 kind:z.enum(['document','budget']),sourceId:uuid,note:text(10,1000)}).strict();
const criterionSchema=z.object({id:text(1,50),score:z.number().int().min(0).max(100).nullable(),evidence:z.string().max(2000).nullable()}).strict();
const blockerSchema=z.object({id:text(1,50),title:text(10,180),
 ruleUrl:z.string().max(500),evidence:text(20,1000),confirmed:z.boolean()}).strict();
const evaluateSchema=z.object({
 action:z.literal('evaluate'),projectId:uuid,stage:z.enum(['idea','documented']),
 ideaId:uuid.nullable(),rubricId:uuid,previousId:uuid.nullable(),
 expectedVersion:z.number().int().min(0).max(999),
 assessments:z.array(criterionSchema).max(30),
 blockers:z.array(blockerSchema).max(20),note:text(10,1000)
}).strict();
const assignmentSchema=z.object({action:z.literal('assign'),assessmentId:uuid,actionKey:text(1,50),
 expectedRevision:z.number().int().min(0).max(999),assignedTo:uuid.nullable(),note:text(10,500)}).strict();
const reviewSchema=z.object({action:z.literal('review'),assessmentId:uuid,expectedRevision:z.number().int().min(0).max(999),
 decision:z.enum(['reviewed','needs_changes']),note:text(15,1000)}).strict();
const simulationSchema=z.object({action:z.literal('simulate'),assessmentId:uuid,changes:z.array(z.object({
 id:text(1,50),score:z.number().int().min(0).max(100),evidence:text(5,2000)
}).strict()).max(30)}).strict();

export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_READINESS_EVALUATOR!=='yes')return fail('Avaliador ainda não homologado',503);
 const actor=await getSession();if(!actor)return fail('Sessão obrigatória',401);
 const raw=await input(request);
 const action=common.safeParse(raw);if(!action.success)return fail('Ação inválida');
 try{
 switch(action.data.action){
 case 'idea':{
  const p=ideaSchema.safeParse(raw);if(!p.success)return fail('Dados de ideia inválidos');
  const d=p.data;if(!await owner(actor,d.projectId))return fail('Projeto indisponível',404);
  const [r]=await queryForMunicipality<{id:string|null;version:number|null}>(actor.municipality_id,`
   WITH previous AS(SELECT coalesce(max(version),0)::integer AS n FROM project_readiness_ideas
    WHERE municipality_id=$1::uuid AND project_id=$2::uuid),
   ins AS(INSERT INTO project_readiness_ideas(municipality_id,project_id,version,
    problem,audience,objective,created_by)
    SELECT $1::uuid,$2::uuid,previous.n+1,$3,$4,$5,$6::uuid FROM previous
    WHERE previous.n=$7::integer AND previous.n<1000
    ON CONFLICT(project_id,version) DO NOTHING RETURNING id,version)
   SELECT (SELECT id FROM ins) AS id,(SELECT version FROM ins) AS version`,
   [actor.municipality_id,d.projectId,d.problem,d.audience,d.objective,actor.id,d.expectedVersion],actor.id);
  return r?.id?success(r):fail('Versão de ideia desatualizada',409);
 }
 case 'rubric':{
  if(actor.role!=='admin')return fail('Somente administrador municipal',403);
  const p=rubricSchema.safeParse(raw);if(!p.success)return fail('Rubrica inválida');
  const d=p.data;let criteria;
  try{criteria=validateRubric(d.criteria);}catch{return fail('Pesos devem somar 100; critérios únicos e válidos');}
  const [r]=await queryForMunicipality<{id:string|null;version:number|null}>(actor.municipality_id,`
   WITH previous AS(SELECT coalesce(max(version),0)::integer AS n FROM municipal_readiness_rubrics
    WHERE municipality_id=$1::uuid),
   ins AS(INSERT INTO municipal_readiness_rubrics(municipality_id,version,criteria,note,created_by)
    SELECT $1::uuid,previous.n+1,$2::jsonb,$3,$4::uuid FROM previous
    WHERE previous.n=$5::integer AND previous.n<1000
    ON CONFLICT(municipality_id,version) DO NOTHING RETURNING id,version)
   SELECT (SELECT id FROM ins) AS id,(SELECT version FROM ins) AS version`,
   [actor.municipality_id,JSON.stringify(criteria),d.note,actor.id,d.expectedVersion],actor.id);
  return r?.id?success(r):fail('Versão da rubrica desatualizada',409);
 }
 case 'evidence':{
  const p=evidenceSchema.safeParse(raw);if(!p.success)return fail('Evidência inválida');
  const d=p.data;if(!await owner(actor,d.projectId))return fail('Projeto indisponível',404);
  let source:{id:string;title:string;sha256:string}|undefined;
  if(d.kind==='document'){
   [source]=await queryForMunicipality<{id:string;title:string;sha256:string}>(actor.municipality_id,
    'SELECT v.id,i.title || \' (versão \' || v.version || \')\' AS title,v.sha256 FROM project_document_versions v JOIN project_document_items i ON i.id=v.item_id AND i.municipality_id=v.municipality_id WHERE v.municipality_id=$1 AND v.project_id=$2 AND v.id=$3',
    [actor.municipality_id,d.projectId,d.sourceId],actor.id);
  }else{
   const [row]=await queryForMunicipality<{id:string;title:string;line_total_cents:string}>(actor.municipality_id,
    'SELECT id,title,line_total_cents::text FROM project_budget_items WHERE municipality_id=$1 AND project_id=$2 AND id=$3',
    [actor.municipality_id,d.projectId,d.sourceId],actor.id);
   if(row)source={id:row.id,title:row.title,sha256:hash(row)};
  }
  if(!source)return fail('Versão documental ou item financeiro indisponível',404);
  const [r]=await queryForMunicipality<{id:string}|undefined>(actor.municipality_id,
   'INSERT INTO project_readiness_evidence(municipality_id,project_id,kind,document_version_id,budget_item_id,snapshot_sha256,title,note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id',
   [actor.municipality_id,d.projectId,d.kind,d.kind==='document'?source.id:null,d.kind==='budget'?source.id:null,source.sha256,source.title,d.note,actor.id],actor.id);
  return r?.id?success({id:r.id}):fail('Evidência já vinculada',409);
 }
 case 'evaluate':{
  const p=evaluateSchema.safeParse(raw);if(!p.success)return fail('Avaliação inválida');
  const d=p.data;if(!await owner(actor,d.projectId))return fail('Projeto indisponível',404);
  const [rubric]=await queryForMunicipality<{criteria:unknown}>(actor.municipality_id,
   'SELECT criteria FROM municipal_readiness_rubrics WHERE municipality_id=$1 AND id=$2',
   [actor.municipality_id,d.rubricId],actor.id);
  if(!rubric)return fail('Rubrica indisponível',404);
  if(d.stage==='idea'&&!d.ideaId)return fail('Registre uma ideia para o estágio inicial',422);
  if(d.ideaId){
   const [idea]=await queryForMunicipality<{id:string}>(actor.municipality_id,
    'SELECT id FROM project_readiness_ideas WHERE municipality_id=$1 AND project_id=$2 AND id=$3',
    [actor.municipality_id,d.projectId,d.ideaId],actor.id);
   if(!idea)return fail('Versão da ideia indisponível',404);
  }
  const evidence=await queryForMunicipality<{id:string;kind:string;document_version_id:string|null;budget_item_id:string|null;snapshot_sha256:string;title:string}>(actor.municipality_id,
   'SELECT id,kind,document_version_id,budget_item_id,snapshot_sha256,title FROM project_readiness_evidence WHERE municipality_id=$1 AND project_id=$2 ORDER BY kind,id LIMIT 100',
   [actor.municipality_id,d.projectId],actor.id);
  if(d.stage==='documented'&&(!evidence.some(e=>e.kind==='document')||!evidence.some(e=>e.kind==='budget')))
   return fail('Projeto documentado exige ao menos uma versão documental e um item financeiro vinculados',422);
  let score,blockers;
  try{score=scoreReadiness(rubric.criteria,d.assessments);blockers=validateBlockers(d.blockers);}
  catch{return fail('Nota, evidência ou impedimentos inválidos',422);}
  const actions=planForGaps(score,blockers);
  const snapshot={rubricId:d.rubricId,ideaId:d.ideaId,stage:d.stage,criteria:d.assessments,
   evidence,score,blockers,actions,note:d.note,version:d.expectedVersion+1};
  const [r]=await queryForMunicipality<{id:string|null;version:number|null}>(actor.municipality_id,`
   WITH previous AS(
    SELECT id,version FROM project_readiness_assessments
    WHERE municipality_id=$1::uuid AND project_id=$2::uuid ORDER BY version DESC LIMIT 1
   ), ins AS(
    INSERT INTO project_readiness_assessments(
     municipality_id,project_id,version,stage,idea_id,rubric_id,previous_assessment_id,
     criteria_input,evidence_snapshot,result_snapshot,blockers,actions,snapshot_sha256,note,created_by)
    SELECT $1::uuid,$2::uuid,$3::integer+1,$4,$5::uuid,$6::uuid,$7::uuid,
     $8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15::uuid
    WHERE coalesce((SELECT version FROM previous),0)=$3::integer
     AND (SELECT id FROM previous) IS NOT DISTINCT FROM $7::uuid
    ON CONFLICT(project_id,version) DO NOTHING RETURNING id,version
   )
   SELECT (SELECT id FROM ins) AS id,(SELECT version FROM ins) AS version`,
   [actor.municipality_id,d.projectId,d.expectedVersion,d.stage,d.ideaId,d.rubricId,d.previousId,
    JSON.stringify(d.assessments),JSON.stringify(evidence),JSON.stringify(score),
    JSON.stringify(blockers),JSON.stringify(actions),hash(snapshot),d.note,actor.id],actor.id);
  return r?.id?success({id:r.id,version:r.version,score:score.score,coverage:score.evaluatedWeight,
   blockersConfirmed:blockers.filter(b=>b.confirmed).length}):fail('Avaliação concorrente ou versão desatualizada',409);
 }
 case 'assign':{
  const p=assignmentSchema.safeParse(raw);if(!p.success)return fail('Atribuição inválida');
  const d=p.data;
  const [assessment]=await queryForMunicipality<{project_id:string}>(actor.municipality_id,
   'SELECT project_id FROM project_readiness_assessments WHERE municipality_id=$1 AND id=$2',
   [actor.municipality_id,d.assessmentId],actor.id);
  if(!assessment||!await owner(actor,assessment.project_id))return fail('Avaliação indisponível',404);
  const [r]=await queryForMunicipality<{id:string|null;revision:number|null}>(actor.municipality_id,`
   WITH target AS(
    SELECT id,project_id,municipality_id FROM project_readiness_assessments
    WHERE id=$2::uuid AND municipality_id=$1::uuid
     AND actions @> jsonb_build_array(jsonb_build_object('key',$3::text))
   ), previous AS(
    SELECT coalesce(max(revision),0)::integer n FROM readiness_action_assignment_events
    WHERE assessment_id=$2::uuid AND action_key=$3::text
   ), ins AS(
    INSERT INTO readiness_action_assignment_events(municipality_id,project_id,assessment_id,
     action_key,revision,assigned_to,note,actor_id)
    SELECT $1::uuid,t.project_id,t.id,$3::text,p.n+1,$4::uuid,$5,$6::uuid
    FROM target t CROSS JOIN previous p
    WHERE p.n=$7::integer AND p.n<1000
     AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM users u WHERE u.id=$4::uuid
       AND u.municipality_id=$1::uuid AND u.active))
    ON CONFLICT(assessment_id,action_key,revision) DO NOTHING RETURNING id,revision
   ) SELECT (SELECT id FROM ins) id,(SELECT revision FROM ins) revision`,
   [actor.municipality_id,d.assessmentId,d.actionKey,d.assignedTo,d.note,actor.id,d.expectedRevision],actor.id);
  return r?.id?success(r):fail('Ação inválida, responsável inativo ou revisão desatualizada',409);
 }
 case 'review':{
  if(actor.role!=='admin')return fail('Revisão exclusiva de administrador municipal',403);
  const p=reviewSchema.safeParse(raw);if(!p.success)return fail('Revisão inválida');
  const d=p.data;
  const [r]=await queryForMunicipality<{id:string|null;revision:number|null}>(actor.municipality_id,`
   WITH target AS(
    SELECT id,project_id FROM project_readiness_assessments
    WHERE id=$2::uuid AND municipality_id=$1::uuid AND created_by<>$6::uuid
   ), previous AS(
    SELECT coalesce(max(revision),0)::integer n FROM readiness_review_events WHERE assessment_id=$2::uuid
   ), ins AS(
    INSERT INTO readiness_review_events(municipality_id,project_id,assessment_id,revision,decision,note,reviewer_id)
    SELECT $1::uuid,t.project_id,t.id,p.n+1,$3,$4,$6::uuid FROM target t CROSS JOIN previous p
    WHERE p.n=$5::integer AND p.n<1000
    ON CONFLICT(assessment_id,revision) DO NOTHING RETURNING id,revision
   ) SELECT (SELECT id FROM ins) id,(SELECT revision FROM ins) revision`,
   [actor.municipality_id,d.assessmentId,d.decision,d.note,d.expectedRevision,actor.id],actor.id);
  return r?.id?success(r):fail('Avaliação indisponível, conflito ou revisor igual ao autor',409);
 }
 case 'simulate':{
  const p=simulationSchema.safeParse(raw);if(!p.success)return fail('Simulação inválida');
  const d=p.data;
  const [a]=await queryForMunicipality<{project_id:string;criteria_input:Array<{id:string;score:number|null;evidence:string|null}>;criteria:unknown}>(actor.municipality_id,
   'SELECT a.project_id,a.criteria_input,r.criteria FROM project_readiness_assessments a JOIN municipal_readiness_rubrics r ON r.id=a.rubric_id AND r.municipality_id=a.municipality_id WHERE a.municipality_id=$1 AND a.id=$2',
   [actor.municipality_id,d.assessmentId],actor.id);
  if(!a)return fail('Avaliação indisponível',404);
  let result;try{result=simulateReadiness(a.criteria,a.criteria_input,d.changes);}catch{return fail('Premissas de simulação inválidas',422);}
  return success(result,200);
 }
 default:return fail('Ação desconhecida');
 }
 }catch(e){
  // Avoid disclosing SQL errors or cross-tenant foreign-key details in API responses.
  console.error('Falha interna do avaliador',e instanceof Error?e.message:'unknown');
  return fail('Operação não concluída; verifique os dados ou tente novamente',500);
 }
}
