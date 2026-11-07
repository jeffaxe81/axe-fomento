import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {CONVERSION_COHORTS_SQL,normalizeConversionRange,percentOf} from '@/lib/conversion-cohorts.mjs';
export const dynamic='force-dynamic';
type Group={portal_host:string;portal_name:string;modality:string;protocolados:number;aprovados:number;recusados:number;demais:number};
type Query={de?:string;ate?:string};
export default async function ConversionReport({searchParams}:{searchParams:Promise<Query>}){
 const actor=await requireSession(),search=await searchParams;
 const year=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,4);
 const from=search.de??year+'-01-01',to=search.ate??year+'-12-31';
 const range=normalizeConversionRange(from,to);
 const rows=range?await queryForMunicipality<Group>(actor.municipality_id,
  CONVERSION_COHORTS_SQL,[actor.municipality_id,range.from,range.to],actor.id):[];
 const total=rows.reduce((n,r)=>n+r.protocolados,0);
 const approved=rows.reduce((n,r)=>n+r.aprovados,0);
 const declined=rows.reduce((n,r)=>n+r.recusados,0);
 return <>
  <div className="section-eyebrow">AF-041 · INDICADORES MUNICIPAIS</div>
  <div className="page-heading"><div><h1>Conversão por fonte e modalidade</h1>
   <p>Coortes por data declarada do protocolo externo; resultado atual do projeto.</p></div>
   <Link className="btn btn-outline" href="/">Voltar ao painel</Link></div>
  <section className="panel"><h2>Período dos protocolos</h2>
   <form method="get" className="external-protocol-form">
    <label>De <input type="date" name="de" defaultValue={from} required/></label>
    <label>Até <input type="date" name="ate" defaultValue={to} required/></label>
    <button type="submit" className="btn btn-primary">Consultar coorte</button>
   </form>
   {!range&&<p role="alert" className="error">Intervalo inválido; use datas entre 2000 e 2100 em ordem crescente.</p>}
   <p className="note">Denominador: projetos únicos por fonte (domínio do portal) e modalidade com ao menos um protocolo no período. Reapresentações na mesma fonte e modalidade contam uma vez. Aprovação/recusa é a situação <strong>atual</strong> da carteira, não o desfecho histórico na data de corte. Nenhum resultado é conferido automaticamente com o portal.</p>
  </section>
  <section className="panel"><h2>Resultado por grupo</h2>
   <p><strong>{total}</strong> vínculos projeto/fonte/modalidade protocolados · <strong>{approved}</strong> aprovados ({percentOf(approved,total)}) · <strong>{declined}</strong> recusados ({percentOf(declined,total)}).</p>
   {rows.length===0?<p className="muted">Nenhum protocolo declarado neste período.</p>:
   <div className="table-scroll"><table><thead><tr><th>Fonte / domínio</th><th>Modalidade</th><th>Protocolados</th><th>Aprovados</th><th>Recusados</th><th>Demais</th><th>Conversão</th></tr></thead>
    <tbody>{rows.map(r=><tr key={r.portal_host+':'+r.modality}>
     <td>{r.portal_name} · {r.portal_host}</td><td>{r.modality==='nao_informada'?'Não informada':r.modality}</td>
     <td>{r.protocolados}</td><td>{r.aprovados}</td><td>{r.recusados}</td><td>{r.demais}</td><td>{percentOf(r.aprovados,r.protocolados)}</td>
    </tr>)}</tbody></table></div>}
   {rows.length===500&&<p className="note">Exibidos no máximo 500 grupos; refine o período.</p>}
  </section>
 </>;
}
