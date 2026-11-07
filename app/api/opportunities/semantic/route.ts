import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';
import {searchSemanticCatalog} from '@/lib/semantic-catalog';
import {semanticSelection} from '@/lib/semantic-intent.mjs';
export const runtime='nodejs';

export async function GET(request:Request){
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(process.env.ENABLE_SEMANTIC_CATALOG!=='yes')
  return NextResponse.json({error:'Busca por intenção não homologada'},{status:503});
 const url=new URL(request.url);
 const params={intencao:url.searchParams.get('intencao')??'',
  tipo:url.searchParams.get('tipo')??'oportunidades',
  pagina:url.searchParams.get('pagina')??'1'};
 const {intent,mode,page}=semanticSelection(params);
 if(!intent)return NextResponse.json({error:'Informe uma intenção válida (até 120 caracteres)'},{status:400});
 const result=await searchSemanticCatalog(user.municipality_id,intent,mode,page,user.id);
 return NextResponse.json({
  query:intent.input,method:intent.mode,concepts:intent.categories,
  kind:result.kind,page,hasNext:result.hasNext,items:result.items,
  provenance:mode==='programas'?'revisão municipal, último registro de consulta da fonte':
   'cadastro do catálogo; consulta à fonte não comprovada'
 },{headers:{'cache-control':'no-store'}});
}
