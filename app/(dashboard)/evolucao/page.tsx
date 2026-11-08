import Link from 'next/link';
import {ProductProgress} from '@/components/product-progress';
import {PilotEvidenceForm} from '@/components/pilot-evidence-form';
import {PilotGateReviewForm} from '@/components/pilot-gate-review-form';
import {PILOT_GATES,pilotEvidenceSummary} from '@/lib/pilot-gates.mjs';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {PRODUCT_VERSIONS} from '@/lib/product-roadmap.mjs';
type Evidence={id:string;gate_id:string;result_claimed:string;environment_label:string;
 evidence_url:string;performed_on:string;notes:string;created_by:string;created_at:string};
type Review={evidence_id:string;reviewed_by:string;decision:string;acceptance_url:string|null;created_at:string};
export default async function ProductEvolution(){
 const user=await requireSession();
 const evidence=await queryForMunicipality<Evidence>(user.municipality_id,
  'SELECT id,gate_id,result_claimed,environment_label,evidence_url,'+
  'performed_on::text AS performed_on,notes,created_by,created_at FROM pilot_gate_evidence '+
  'WHERE municipality_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',
  [user.municipality_id],user.id);
 const reviews=await queryForMunicipality<Review>(user.municipality_id,
  'SELECT evidence_id,reviewed_by,decision,acceptance_url,created_at '+
  'FROM pilot_gate_reviews WHERE municipality_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',
  [user.municipality_id],user.id);
 const summary=pilotEvidenceSummary(evidence,reviews);
 const reviewByEvidence=new Map<string,Review>();
 for(const r of reviews){if(!reviewByEvidence.has(r.evidence_id))reviewByEvidence.set(r.evidence_id,r);}
 const latest=new Map<string,Evidence>();
 for(const e of evidence){if(!latest.has(e.gate_id))latest.set(e.gate_id,e);}

 return <>
  <div className="section-eyebrow">GOVERNANÇA DE PRODUTO · PLANO 2026–2027</div>
  <div className="page-heading"><div><h1>Evolução V1 a V4</h1>
   <p>Progresso baseado em marcos explícitos, sem confundir desenvolvimento com financiamentos captados.</p></div>
   <Link className="btn btn-outline" href="/oportunidades/conferidas">Radar de fontes conferidas</Link>
  </div>
  <section className="panel"><ProductProgress/></section>
  <section className="panel">
   <h2>Datas propostas e critérios de aceite</h2>
   <div className="table-scroll" role="region" aria-label="Cronograma V1 a V4" tabIndex={0}>
    <table><thead><tr><th>Etapa</th><th>Início</th><th>Meta</th><th>Entrega verificável</th></tr></thead>
    <tbody>{PRODUCT_VERSIONS.map(v=><tr key={v.id}>
     <td>{v.id} — {v.title}</td>
     <td>{v.start.split('-').reverse().join('/')}</td><td>{v.target.split('-').reverse().join('/')}</td>
     <td>{v.milestones.filter(m=>!m.done).map(m=>m.id).join(', ')||'Todos os marcos codificados'}</td>
    </tr>)}</tbody></table>
   </div>
   <p className="note">Datas são metas de planejamento a partir de 07/11/2026, não compromissos de órgãos externos.
   O marco é contado como codificado apenas quando existe evidência no repositório. A homologação real é separada.</p>
  </section>
  <section className="panel">
   <h2>Homologação operacional — oito portões</h2>
   <p><strong>Decisão: NO-GO.</strong> {summary.recordedGateCount}/{summary.required} portões
    possuem alguma evidência municipal registrada. {summary.declaredPass} têm resultado
    declarado como positivo, mas <strong>{summary.independentlyApproved}/8 têm revisão interna por segundo administrador</strong>.
    Um relatório de CI ou uma declaração não habilita produção.</p>
   <div className="review-events">{PILOT_GATES.map(g=>{
    const record=latest.get(g.id);
    return <article key={g.id} className="review-event">
     <h3>{g.id} — {g.title}</h3>
     <p>{g.required}</p>
     <p>Situação: {record?'Evidência declarada ('+record.result_claimed+')':'Aguardando evidência'}</p>
     {record&&<p>Teste declarado em {record.performed_on} · Ambiente {record.environment_label}.
      {' '}<a href={record.evidence_url} rel="noopener noreferrer" target="_blank">Consultar registro informado</a></p>}
     <p className="help">Revisão por segundo administrador: {record&&reviewByEvidence.get(record.id)?
      reviewByEvidence.get(record.id)?.decision:'pendente'}.
      Autorização final de produção: pendente.</p>
    </article>;
   })}</div>
   {user.role==='admin'&&<><h3>Registrar resultado do piloto</h3>
    <PilotEvidenceForm enabled={process.env.ENABLE_PILOT_EVIDENCE==='yes'}/>
    <h3>Revisão por administrador diferente</h3>
    <PilotGateReviewForm
     evidence={[...latest.values()].filter(x=>x.created_by!==user.id)}
     enabled={process.env.ENABLE_PILOT_REVIEW==='yes'}/></>}
  </section>
  <section className="panel">
   <h2>Principais riscos e contornos</h2>
   <ul>
    <li><strong>API fora do ar ou contrato alterado:</strong> importação em staging, parser conservador e última cópia marcada como desatualizada.</li>
    <li><strong>Programa sem edital aberto:</strong> nunca classificar registro de programa como oportunidade vigente automaticamente.</li>
    <li><strong>Dados fiscais incompletos:</strong> sinalizar elegibilidade indeterminada e exigir conferência por responsável municipal.</li>
    <li><strong>Integração com financiador sem autorização:</strong> encaminhamento assistido e comprovante inserido pelo usuário.</li>
    <li><strong>IA com respostas não sustentadas:</strong> exigir origem documental, revisão humana e bloquear conclusões sem evidência.</li>
    <li><strong>Implantação ou LGPD pendente:</strong> manter produção NO-GO até comprovação de OP-01 a OP-08.</li>
   </ul>
  </section>
 </>;
}
