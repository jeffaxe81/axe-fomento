import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
export const dynamic='force-dynamic';
type Share={id:string;consortium_id:string;public_title:string;
 shared_summary:string;enabled:boolean;revision:number};
export default async function SharedSummary({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [share]=await queryForMunicipality<Share>(actor.municipality_id,
  'SELECT id,consortium_id,public_title,shared_summary,enabled,revision '+
  'FROM consortium_project_shares WHERE id=$1::uuid',[id],actor.id);
 if(!share)notFound();
 return <>
  <div className="section-eyebrow">RESUMO CONSORCIADO · AF-040</div>
  <div className="page-heading"><div><h1>{share.public_title}</h1>
   <p>Acesso restrito à autorização do município responsável.</p>
  </div><Link href={'/consorcios/'+share.consortium_id}
   className="btn btn-outline">Voltar ao consórcio</Link></div>
  <section className="panel" data-shared-summary={share.id}>
   <h2>Resumo selecionado pelo gestor</h2>
   <p>{share.shared_summary}</p>
   <p className="help">Versão da autorização: {share.revision}.
    Não inclui documentos, credenciais, estatísticas, orçamento,
    cadastro de cidadãos nem outros dados da carteira privada.</p>
   {!share.enabled&&<p className="note">Esta autorização foi revogada
    e não é mais exibida para municípios participantes.</p>}
  </section>
 </>;
}