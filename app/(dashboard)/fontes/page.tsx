import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { SourceSyncButton } from '@/components/source-sync-button';
import { SourceContractCheck } from '@/components/source-contract-check';

export const dynamic='force-dynamic';
type ProgramRow={id:string;external_id:string;title:string;provider:string;review_state:string;version:number;last_seen_at:string};
type ContractCheck={id:string;source:string;result:string;schema_url:string;route_count:number|null;openapi_version:string|null;checked_at:string;message:string};
type RunRow={id:string;status:string;found_count:number;changed_count:number;started_at:string;finished_at:string|null;error_summary:string|null};
function formatDate(value:string|null) {
  return value ? new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : 'Não informado';
}
const labels:Record<string,string>={pending:'Pendente de revisão',approved:'Revisado',rejected:'Rejeitado'};
export default async function OfficialSources() {
  const user=await requireSession();
  if(user.role!=='admin')return <section className="panel"><h1>Fontes públicas</h1>
    <p>O acompanhamento de fontes oficiais requer um administrador municipal.</p></section>;
  const [records,runs,contracts]=await Promise.all([
    queryForMunicipality<ProgramRow>(user.municipality_id,
      'SELECT id,external_id,title,provider,review_state,version,last_seen_at FROM source_programs '+
      'WHERE municipality_id=$1 ORDER BY last_seen_at DESC,id DESC LIMIT 100',
      [user.municipality_id],user.id),
    queryForMunicipality<RunRow>(user.municipality_id,
      'SELECT id,status,found_count,changed_count,started_at,finished_at,error_summary '+
      'FROM source_ingestion_runs WHERE municipality_id=$1 ORDER BY started_at DESC,id DESC LIMIT 10',
      [user.municipality_id],user.id),
    queryForMunicipality<ContractCheck>(user.municipality_id,
      'SELECT id,source,result,schema_url,route_count,openapi_version,checked_at,message '+
      'FROM source_contract_checks WHERE municipality_id=$1 ORDER BY checked_at DESC LIMIT 12',
      [user.municipality_id],user.id),
  ]);
  return <>
    <div className="section-eyebrow">CURADORIA DE DADOS PÚBLICOS</div>
    <div className="page-heading">
      <div><h1>Fontes oficiais</h1><p>Conferência de registros da API Transferegov — Gestão de Parcerias.</p></div>
      <Link href="/oportunidades" className="btn btn-outline">Voltar ao radar</Link>
    </div>
    <section className="panel">
      <h2>Importação controlada</h2>
      <p>Os registros abaixo representam <strong>programas</strong>, não editais abertos.
        Nenhuma coleta os publica automaticamente no radar.</p>
      <p className="help">Referência: <a className="source-link" href="https://api-publica.transferegov.gestao.gov.br/parcerias/docs"
        target="_blank" rel="noopener noreferrer">Documentação oficial da API</a>.
        O esquema e as condições de reutilização devem ser revisados antes de habilitar a coleta.</p>
      <SourceSyncButton enabled={process.env.ENABLE_OFFICIAL_SOURCE_SYNC==='yes'}/>
    </section>
    <section className="panel">
      <h2>V1 · Verificação do contrato técnico das APIs</h2>
      <p>O portal oficial também disponibiliza o módulo Discricionárias e Legais.
       A checagem coleta apenas o <strong>contrato OpenAPI</strong>, sem consultar dados de cidadãos
       e sem transformar programas em editais abertos.</p>
      <SourceContractCheck enabled={process.env.ENABLE_OFFICIAL_CONTRACT_CHECK==='yes'}/>
      {contracts.length?<div className="table-scroll" role="region" tabIndex={0}
       aria-label="Histórico de contratos oficiais">
       <table><thead><tr><th>Módulo</th><th>Consulta</th><th>Rotas GET</th><th>Situação</th></tr></thead>
       <tbody>{contracts.map(c=><tr key={c.id}><td>{c.source}</td>
        <td>{formatDate(c.checked_at)}</td><td>{c.route_count??'Não apurado'}</td>
        <td>{c.result==='documented'?'Documentação encontrada':'Contrato indisponível ou incompatível'}</td></tr>)}</tbody></table>
       </div>:<p className="muted">Nenhuma verificação de contrato realizada neste município.</p>}
      <p className="help">Mesmo com documentação encontrada, permanecem pendentes:
       validar o esquema dos campos, consultar dados reais com autorização e testar o
       edital individual com data e elegibilidade. Nenhum aceite é gerado automaticamente.</p>
    </section>
    <section className="panel source-table">
      <h2>Programas coletados</h2>
      <div className="results-summary">{records.length} registros exibidos (até 100 mais recentes).</div>
      {records.length? <div className="table-scroll" tabIndex={0} role="region" aria-label="Programas em revisão">
        <table><thead><tr><th scope="col">Código na fonte</th><th scope="col">Programa</th>
          <th scope="col">Órgão</th><th scope="col">Estado</th><th scope="col">Versão</th><th scope="col">Última consulta</th></tr></thead>
        <tbody>{records.map((record)=><tr key={record.id}>
          <td><Link className="source-link" href={'/fontes/'+record.id}>{record.external_id}</Link></td>
          <td>{record.title}</td><td>{record.provider}</td><td>{labels[record.review_state]??'Não informado'}</td>
          <td>{record.version}</td><td>{formatDate(record.last_seen_at)}</td>
        </tr>)}</tbody></table>
      </div>:<p className="muted">Ainda não há dados coletados neste município.</p>}
    </section>
    <section className="panel source-table">
      <h2>Execuções de coleta</h2>
      {runs.length?<div className="table-scroll" tabIndex={0} role="region" aria-label="Histórico de coletas">
        <table><thead><tr><th scope="col">Início</th><th scope="col">Situação</th>
        <th scope="col">Identificados</th><th scope="col">Versões novas</th><th scope="col">Observação</th></tr></thead>
        <tbody>{runs.map(run=><tr key={run.id}><td>{formatDate(run.started_at)}</td><td>{run.status}</td>
          <td>{run.found_count}</td><td>{run.changed_count}</td><td>{run.error_summary??'—'}</td></tr>)}</tbody></table>
      </div>:<p className="muted">Nenhuma execução registrada.</p>}
    </section>
  </>;
}
