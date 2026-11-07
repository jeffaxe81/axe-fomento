import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {LIST_CONSORTIA_SQL} from '@/lib/consortium-sql.mjs';
import {CreateConsortiumForm,ConsortiumMembershipAction}
 from '@/components/consortium-forms';
export const dynamic='force-dynamic';
type Member={id:string;tenant:string;state:string;revision:number};
type Group={id:string;owner_municipality_id:string;title:string;purpose:string;
 is_owner:boolean;members:Member[];created_at:string};
export default async function ConsortiaPage(){
 const actor=await requireSession();
 const groups=await queryForMunicipality<Group>(actor.municipality_id,
  LIST_CONSORTIA_SQL,[actor.municipality_id],actor.id);
 const enabled=process.env.ENABLE_CONSORTIUMS==='yes';
 return <>
  <div className="section-eyebrow">CONSÓRCIOS · AF-039/040</div>
  <div className="page-heading"><div><h1>Consórcios municipais</h1>
   <p>Participação institucional autorizada com compartilhamento restrito de resumos.</p>
  </div></div>
  <section className="panel">
   <h2>Acesso em duas etapas</h2>
   <p>Uma prefeitura cria um consórcio e convida outra. O município
    destinatário só se torna participante após aceite de seu administrador.
    O aceite não abre acesso à carteira privada: o responsável
    pelo projeto deve autorizar um resumo específico. A revogação
    da participação ou do resumo corta o acesso inclusive por link direto.</p>
  </section>
  <section className="panel">
   <h2>Seus consórcios e convites ({groups.length})</h2>
   {!groups.length&&<p>Nenhum consórcio ou convite visível neste município.</p>}
   <div className="review-events">
    {groups.map(g=><article className="review-event" key={g.id} data-consortium={g.id}>
     <span className="chip">{g.is_owner?'Município fundador':'Município convidado'}</span>
     <h3><Link href={'/consorcios/'+g.id}>{g.title}</Link></h3>
     <p>{g.purpose}</p>
     {g.members.filter(m=>m.tenant===actor.municipality_id).map(m=>
      <div key={m.id} data-membership={m.id}>
       <p>Adesão do seu município: <strong>{m.state}</strong></p>
       {actor.role==='admin'&&enabled&&m.state==='invited'&&
       <div className="radar-actions">
        <ConsortiumMembershipAction membershipId={m.id}
         revision={m.revision} action="accept" label="Aceitar convite"/>
        <ConsortiumMembershipAction membershipId={m.id}
         revision={m.revision} action="decline" label="Recusar convite"/>
       </div>}
       {actor.role==='admin'&&enabled&&m.state==='active'&&
        <ConsortiumMembershipAction membershipId={m.id}
         revision={m.revision} action="revoke" label="Sair do consórcio"/>}
      </div>)}
    </article>)}
   </div>
  </section>
  <section className="panel">
   <h2>Cadastrar consórcio da prefeitura</h2>
   {actor.role==='admin'&&enabled?<CreateConsortiumForm/>:
    <p className="muted">Ação reservada ao administrador e dependente de homologação.</p>}
  </section>
 </>;
}