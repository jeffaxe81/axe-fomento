import Link from 'next/link';
import {ProductProgress} from '@/components/product-progress';
import {PRODUCT_VERSIONS} from '@/lib/product-roadmap.mjs';
export default function ProductEvolution(){
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
