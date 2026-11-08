import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {InviteConsortiumMember,ConsortiumMembershipAction,
 ShareConsortiumProjectForm,RevokeConsortiumShare} from '@/components/consortium-forms';
export const dynamic='force-dynamic';
type Group={id:string;owner_municipality_id:string;title:string;purpose:string};
type Member={id:string;member_municipality_id:string;state:string;revision:number};
type Share={id:string;owner_municipality_id:string;project_id:string;
 public_title:string;shared_summary:string;enabled:boolean;revision:number};
type Choice={id:string;name:string;uf:string};
export default async function ConsortiumDetail({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [group]=await queryForMunicipality<Group>(actor.municipality_id,
  'SELECT id,owner_municipality_id,title,purpose FROM municipal_consortia WHERE id=$1::uuid',
  [id],actor.id);
 if(!group)notFound();
 const isOwner=group.owner_municipality_id===actor.municipality_id;
 const enabled=process.env.ENABLE_CONSORTIUMS==='yes';
 const sharing=enabled&&process.env.ENABLE_CONSORTIUM_SHARING==='yes';
 const [members,shares]=await Promise.all([
  queryForMunicipality<Member>(actor.municipality_id,
   'SELECT id,member_municipality_id,state,revision FROM consortium_memberships '+
   'WHERE consortium_id=$1::uuid ORDER BY updated_at DESC',[id],actor.id),
  queryForMunicipality<Share>(actor.municipality_id,
   'SELECT id,owner_municipality_id,project_id,public_title,shared_summary,enabled,revision '+
   'FROM consortium_project_shares WHERE consortium_id=$1::uuid ORDER BY created_at DESC',
   [id],actor.id)
 ]);
 const directories=isOwner&&actor.role==='admin'&&enabled?
  await queryForMunicipality<Choice>(actor.municipality_id,
   'SELECT * FROM consortium_municipality_directory($1::uuid,$2::uuid)',
   [actor.id,actor.municipality_id],actor.id):[];
 const ownProjects=isOwner&&sharing?
  await queryForMunicipality<{id:string;title:string}>(actor.municipality_id,
   'SELECT id,title FROM projects WHERE municipality_id=$1::uuid '+
   'AND ($2::boolean OR owner_user_id=$3::uuid) ORDER BY created_at DESC LIMIT 100',
   [actor.municipality_id,actor.role==='admin',actor.id],actor.id):[];
 const memberNames=new Map(directories.map(x=>[x.id,x.name+' / '+x.uf]));
 return <>
  <div className="section-eyebrow">COOPERAÇÃO CONSORCIADA · AF-039/040</div>
  <div className="page-heading"><div><h1>{group.title}</h1><p>{group.purpose}</p></div>
   <Link className="btn btn-outline" href="/consorcios">Voltar aos consórcios</Link>
  </div>
  <section className="panel">
   <h2>Participação das prefeituras</h2>
   <p>Sem aceite institucional e autorização específica de resumo, a
    carteira de projetos do município fundador permanece indisponível.</p>
   {!members.length&&<p>Não há convites registrados.</p>}
   {members.map(m=><article key={m.id} className="review-event"
    data-membership={m.id}>
    <p><strong>{memberNames.get(m.member_municipality_id)??'Município convidado'}</strong>
     {' '}· Estado: {m.state} · Revisão {m.revision}</p>
    {actor.role==='admin'&&enabled&&m.state==='invited'&&isOwner&&
     <ConsortiumMembershipAction membershipId={m.id} revision={m.revision}
      action="revoke" label="Revogar convite"/>}
    {actor.role==='admin'&&enabled&&m.state==='active'&&
     <ConsortiumMembershipAction membershipId={m.id} revision={m.revision}
      action="revoke" label="Revogar participação"/>}
    {actor.role==='admin'&&enabled&&m.state==='invited'&&!isOwner&&
     <ConsortiumMembershipAction membershipId={m.id} revision={m.revision}
      action="accept" label="Aceitar participação"/>}
   </article>)}
  </section>
  {isOwner&&<section className="panel"><h2>Convidar outro município</h2>
   {actor.role==='admin'&&enabled?
    <InviteConsortiumMember consortiumId={id} municipalities={directories}/>:
    <p>Apenas administrador municipal pode emitir convites.</p>}
  </section>}
  <section className="panel">
   <h2>Resumos expressamente compartilhados ({shares.length} visíveis)</h2>
   {!shares.length&&<p>Nenhum resumo está acessível ao seu município.</p>}
   {shares.map(s=><article className="review-event" key={s.id}
    data-consortium-share={s.id}>
    <span className="chip">{s.enabled?'Resumo autorizado':'Autorização revogada'}</span>
    <h3><Link href={'/consorcios/compartilhados/'+s.id}>
     {s.public_title}</Link></h3>
    <p>{s.shared_summary}</p>
    {isOwner&&sharing&&s.enabled&&
     <RevokeConsortiumShare shareId={s.id} revision={s.revision}/>}
   </article>)}
  </section>
  {isOwner&&<section className="panel"><h2>Autorizar resumo de projeto</h2>
   {sharing&&ownProjects.length?
    <ShareConsortiumProjectForm consortiumId={id} projects={ownProjects}/>:
    <p>É necessário ter projeto autorizado e a funcionalidade homologada.</p>}
  </section>}
 </>;
}