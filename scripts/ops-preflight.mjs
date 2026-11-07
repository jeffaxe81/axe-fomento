// Local operator CLI: static checks (CI), environment checks and read-only HTTPS probe.
// Does NOT deploy, mutate data, validate real user flows or authorize GO.
import {readFile} from 'node:fs/promises';
import {assessEnvironment,assessStaticDeployment,validOrigin} from '../lib/ops-readiness.mjs';
const mode=process.argv[2]??'static';
function emit(label,result){
 console.log(label+': '+(result.ok?'PASS':'BLOCKED'));
 for(const issue of result.problems)console.log(' - '+issue);
 if(!result.ok)process.exitCode=1;
}
if(mode==='static'){
 const [compose,nginx,dockerfile]=await Promise.all([
  readFile(new URL('../docker-compose.yml',import.meta.url),'utf8'),
  readFile(new URL('../deploy/nginx-fomento.conf.example',import.meta.url),'utf8'),
  readFile(new URL('../Dockerfile',import.meta.url),'utf8')
 ]);
 emit('Guardrails estáticos do deployment',
  assessStaticDeployment(compose,nginx,dockerfile));
 console.log('OP-01..08 ainda exigem evidências reais; esta verificação não concede GO.');
}else if(mode==='env'){
 emit('Segredos e configuração do ambiente',assessEnvironment(process.env));
 console.log('Nenhum valor de segredo foi impresso. Um PASS não habilita produção.');
}else if(mode==='remote'){
 const origin=process.env.APP_ORIGIN;
 if(!validOrigin(origin))emit('APP_ORIGIN', {ok:false,problems:[
  'Informe APP_ORIGIN com HTTPS público antes de executar teste remoto']});
 else{
  try{
   const url=new URL('/api/health',origin);
   const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000)});
   const problems=[];
   if(r.status!==200)problems.push('GET /api/health não retornou HTTP 200');
   if(r.headers.get('x-content-type-options')!=='nosniff')
    problems.push('Cabeçalho X-Content-Type-Options inválido');
   if(r.headers.get('x-frame-options')!=='DENY')
    problems.push('Cabeçalho X-Frame-Options inválido');
   if(!r.headers.get('strict-transport-security'))
    problems.push('Cabeçalho HSTS ausente');
   let data;try{data=await r.json();}catch{data=null;}
   if(data?.status!=='ok')problems.push('Health JSON não indica status ok');
   emit('Sonda HTTPS somente leitura', {ok:problems.length===0,problems});
  }catch{
   emit('Sonda HTTPS somente leitura',{ok:false,problems:[
    'Servidor não acessível, TLS inválido ou limite de tempo excedido']});
  }
 }
 console.log('Sonda HTTPS não testa MFA, RLS, backup, resiliência ou aceite; OP-01..08 pendentes.');
}else{
 console.error('Modo desconhecido. Use: static | env | remote');
 process.exitCode=2;
}
