import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {fetchOfficialContract,OFFICIAL_CONTRACTS} from '@/lib/transferegov-contract.mjs';
export const runtime='nodejs';
const schema=z.object({source:z.enum(['parcerias','discricionarias'])}).strict();
type Audit={id:string;source:string;schema_url:string;result:string;schema_digest:string|null;
 openapi_version:string|null;route_count:number|null;candidate_routes:string[];
 message:string;checked_at:string};
export async function GET(){
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Sessão requerida'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 const checks=await queryForMunicipality<Audit>(user.municipality_id,
  'SELECT id,source,schema_url,result,schema_digest,openapi_version,'+
  'route_count,candidate_routes,message,checked_at FROM source_contract_checks '+
  'WHERE municipality_id=$1 ORDER BY checked_at DESC,id DESC LIMIT 40',
  [user.municipality_id],user.id);
 return NextResponse.json({checks,enabled:process.env.ENABLE_OFFICIAL_CONTRACT_CHECK==='yes',
  scope:'documentacao_da_api_nao_certifica_edital_aberto'},
  {headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Sessão requerida'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 if(process.env.ENABLE_OFFICIAL_CONTRACT_CHECK!=='yes')
  return NextResponse.json({error:'Verificação externa de contratos desabilitada'},{status:503});
 let body:unknown;try{body=await request.json()}
 catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Módulo inválido'},{status:400});
 const source=parsed.data.source;
 let info;
 let failure=false;
 try{info=await fetchOfficialContract(source);}
 catch{failure=true;}
 const result=info?.result??'unavailable';
 const note=failure?'Consulta indisponível, contrato não verificado e nenhum dado publicado':
  info?.qualification??'Formato de contrato incompatível, revisar documentação';
 const [row]=await queryForMunicipality<{id:string}>(user.municipality_id,
  'INSERT INTO source_contract_checks(municipality_id,source,schema_url,result,'+
  'schema_digest,openapi_version,route_count,candidate_routes,message,created_by) '+
  'VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING id',
  [user.municipality_id,source,OFFICIAL_CONTRACTS[source].url,result,
   result==='documented'?info?.sha256??null:null,
   info?.version??null,info?.documentedRoutes??null,
   JSON.stringify(info?.candidateRoutes??[]),note,user.id],user.id);
 return NextResponse.json({id:row.id,source,result,documentedRoutes:info?.documentedRoutes??null,
  candidateRoutes:info?.candidateRoutes??[],automaticallyPublishable:false,
  message:note},{status:failure?502:200,headers:{'cache-control':'no-store'}});
}
