// Deployment checks are advisory safeguards; passing them is NOT production approval.
// Pure validation. Never include secret values in messages or reports.
export const FEATURE_FLAGS=Object.freeze([
 'ENABLE_OFFICIAL_SOURCE_SYNC','ENABLE_DOCUMENT_UPLOADS','ENABLE_EXTERNAL_PROTOCOL_RECORDS',
 'ENABLE_DILIGENCE_RECORDS','ENABLE_FINANCIAL_TRACKING','ENABLE_PROJECT_BUDGET',
 'ENABLE_NORMATIVE_REGISTRY','ENABLE_MODALITY_MAP','ENABLE_EDICT_ASSISTED_EXTRACTION',
 'ENABLE_SEMANTIC_CATALOG','ENABLE_PROPOSAL_DRAFTS','ENABLE_PROPOSAL_CONTENT_REVIEWS',
 'ENABLE_FINANCIER_DIRECTORY','ENABLE_BNDES_CITY_CATALOG','ENABLE_COFIEX_CATALOG',
 'ENABLE_INTERNATIONAL_COOPERATION','ENABLE_CONSORTIUMS','ENABLE_CONSORTIUM_SHARING',
 'ENABLE_READINESS_EVALUATOR','ENABLE_FUNDING_PIPELINE'
]);
export const KEY_NAMES=Object.freeze(['POSTGRES_PASSWORD','POSTGRES_APP_PASSWORD',
 'SESSION_SECRET','MFA_ENCRYPTION_KEY','BACKUP_ENCRYPTION_KEY','ATTACHMENT_ENCRYPTION_KEY']);
const placeholders=/^(?:SUBSTITUA_|GERAR_|COLOQUE_|troque_|YOUR_|CHANGE_|EXAMPLE_|ci_only_)/i;
const isPlaceholder=x=>typeof x!=='string'||!x.trim()||placeholders.test(x.trim());
export function validOrigin(value) {
 try {
  const url=new URL(value);
  return url.protocol==='https:'&&url.username===''&&url.password===''&&
   url.pathname==='/'&&url.search===''&&url.hash===''&&
   !/^(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[?::1\]?|.*\.local)$/i.test(url.hostname);
 } catch {return false;}
}
const base64Key=s=>{
 if(typeof s!=='string'||!s||isPlaceholder(s)||!/^[A-Za-z0-9+/]{42,43}={0,2}$/.test(s))return false;
 try{return Buffer.from(s,'base64').length===32;}catch{return false;}
};
export function assessEnvironment(env){
 const problems=[];
 for(const key of KEY_NAMES)if(isPlaceholder(env[key]))problems.push(key+': ausente ou valor de exemplo');
 // Compose interpolates these credentials into PostgreSQL URLs without URL encoding.
 // Use random hex or base64url only; avoid @:#/?%&=+, or the connection string can break.
 const safePassword=/^[A-Za-z0-9._~-]{24,}$/;
 for(const key of ['POSTGRES_PASSWORD','POSTGRES_APP_PASSWORD'])
  if(!isPlaceholder(env[key])&&!safePassword.test(env[key]))
   problems.push(key+': use pelo menos 24 caracteres URL-safe (ex.: hexadecimal aleatório)');
 if(!isPlaceholder(env.POSTGRES_PASSWORD)&&env.POSTGRES_PASSWORD===env.POSTGRES_APP_PASSWORD)
  problems.push('Senhas de administração e aplicação não podem ser iguais');
 if(!isPlaceholder(env.SESSION_SECRET)&&env.SESSION_SECRET.length<32)
  problems.push('SESSION_SECRET: mínimo de 32 caracteres');
 if(!isPlaceholder(env.SESSION_SECRET)&&
  [env.POSTGRES_PASSWORD,env.POSTGRES_APP_PASSWORD].includes(env.SESSION_SECRET))
  problems.push('SESSION_SECRET deve ser diferente das senhas do banco');
 for(const name of ['MFA_ENCRYPTION_KEY','BACKUP_ENCRYPTION_KEY','ATTACHMENT_ENCRYPTION_KEY'])
  if(!base64Key(env[name]))problems.push(name+': exige chave aleatória de 32 bytes em base64');
 const keys=['MFA_ENCRYPTION_KEY','BACKUP_ENCRYPTION_KEY','ATTACHMENT_ENCRYPTION_KEY']
  .map(k=>env[k]).filter(v=>typeof v==='string'&&!isPlaceholder(v));
 if(new Set(keys).size!==keys.length)problems.push('Chaves MFA, backup e anexos devem ser distintas');
 if(!validOrigin(env.APP_ORIGIN))problems.push('APP_ORIGIN: domínio público HTTPS, sem caminho e sem credenciais');
 if(!['true','false',undefined].includes(env.TRUST_PROXY_IP))
  problems.push('TRUST_PROXY_IP: use true/false e confie apenas no proxy de borda');
 for(const flag of FEATURE_FLAGS) {
  if(env[flag]!==undefined&&!['yes','no'].includes(env[flag]))
   problems.push(flag+': use apenas yes ou no');
 }
 return {ok:problems.length===0,problems};
}
export function assessStaticDeployment(compose,nginx,dockerfile){
 const problems=[];
 const web=compose.split(/\n  web:\s*\n/)[1]?.split(/\nvolumes:\s*\n/)[0]??'';
 if(!web)problems.push('docker-compose.yml: serviço web ausente');
 for(const flag of FEATURE_FLAGS)
  if(!web.includes(flag+': ${'+flag+':-no}'))
   problems.push('Compose: falta encaminhamento seguro (default no) para '+flag);
 if(/^\s*DATABASE_ADMIN_URL:/m.test(web)||/^\s*POSTGRES_PASSWORD:/m.test(web))
  problems.push('Compose: web não pode receber credenciais administrativas');
 if(!web.includes('127.0.0.1:3000:3000'))
  problems.push('Compose: porta web precisa estar limitada a loopback');
 if(!web.includes('no-new-privileges:true')||!web.includes('cap_drop:'))
  problems.push('Compose: faltam restrições de privilégio para web');
 if(!web.includes('healthcheck:'))
  problems.push('Compose: healthcheck da aplicação ausente');
 if(!nginx.includes('ssl_protocols TLSv1.2 TLSv1.3;'))
  problems.push('Nginx: somente TLS 1.2 e 1.3 devem ser habilitados');
 const size=/client_max_body_size\s+(\d+)m;/.exec(nginx);
 if(!size||Number(size[1])<3)
  problems.push('Nginx: uploads de 2 MiB requerem limite de corpo >=3m');
 if(!/\bUSER node\b/.test(dockerfile))problems.push('Imagem web: deve rodar sem root');
 return {ok:problems.length===0,problems};
}
