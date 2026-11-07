/** AF-031. Controlled intent expansion, not embeddings or an LLM. */
const STOP=new Set(['a','as','o','os','um','uma','uns','umas','de','da','do','das','dos','na','no','nas','nos','em','para','por','com','sem','e','ou','que','qual','quais','quero','queremos','preciso','precisamos','busco','buscar','projeto','projetos','programa','programas','recurso','recursos','apoio','financiamento','fomento','meu','minha','municipio','municipal','cidade','melhorar','ampliar','construir','reforma','tem','ter','como']);
const GROUPS=[
 ['saude',['saude','saúde','hospital','hospitais','hospitalar','sus','postos','posto','ubs','unidade','clinica','clínica','medico','médico']],
 ['educacao',['educacao','educação','escola','escolas','ensino','creche','creches','professor','professores','alfabetizacao','alfabetização']],
 ['saneamento',['saneamento','agua','água','esgoto','drenagem','tratamento','residuos','resíduos']],
 ['mobilidade',['mobilidade','transporte','onibus','ônibus','transito','trânsito','rodovia','estrada']],
 ['habitacao',['habitacao','habitação','moradia','moradias','casas','residencial']],
 ['agricultura',['agricultura','rural','agricola','agrícola','agro','irrigacao','irrigação','produtor']],
 ['cultura',['cultura','cultural','patrimonio','patrimônio','museu','biblioteca']],
 ['esporte',['esporte','esportiva','esportivo','quadra','ginasio','ginásio']],
 ['assistencia',['assistencia','assistência','social','cras','vulnerabilidade','acolhimento']],
 ['tecnologia',['tecnologia','digital','inovacao','inovação','conectividade','internet']],
];
const GROUP_LOOKUP=new Map();
for(const [category,values] of GROUPS)for(const value of values)
 GROUP_LOOKUP.set(fold(value),{category,terms:values});

export function fold(value){
 return String(value).normalize('NFD').replace(/[\u0300-\u036f]/gu,'').toLocaleLowerCase('pt-BR');
}
export function semanticIntent(raw){
 if(typeof raw!=='string'||raw.length>120||/[\u0000-\u001f\u007f]/u.test(raw))return null;
 const input=raw.trim().normalize('NFC');
 if(input.length<3)return null;
 const words=input.match(/[\p{L}\p{N}]+/gu)||[];
 const unique=[];const seen=new Set();
 for(const word of words){
  const normalized=fold(word);
  if(normalized.length<2||STOP.has(normalized)||seen.has(normalized))continue;
  seen.add(normalized);
  unique.push(word.toLocaleLowerCase('pt-BR'));
  if(unique.length>=8)break;
 }
 if(!unique.length)return null;
 const terms=new Map();
 const categories=new Set();
 function add(term,weight){
  const key=term.toLocaleLowerCase('pt-BR');
  if(!terms.has(key)&&terms.size>=40)return;
  terms.set(key,Math.max(terms.get(key)||0,weight));
 }
 for(const word of unique){
  add(word,4);
  if(fold(word)!==word)add(fold(word),3);
  const g=GROUP_LOOKUP.get(fold(word));
  if(g){
   categories.add(g.category);
   for(const synonym of g.terms){if(terms.size>=40)break;add(synonym,1);}
  }
 }
 return {
  input,terms:[...terms].map(([term,weight])=>({term,weight})),
  categories:[...categories],mode:'controlled-intents-pt-v1',
 };
}
export function semanticSelection(params={}){
 const val=x=>Array.isArray(x)?x[0]:x;
 const raw=val(params.intencao);
 const intent=semanticIntent(typeof raw==='string'?raw:'');
 const mode=val(params.tipo)==='programas'?'programas':'oportunidades';
 const rawPage=val(params.pagina);
 const page=typeof rawPage==='string'&&/^[1-9]\d{0,2}$/.test(rawPage)?
  Math.min(100,Number(rawPage)):1;
 return {intent,mode,page};
}
export function semanticHref(intent,mode,page=1){
 const p=new URLSearchParams();
 p.set('intencao',intent.input);
 if(mode==='programas')p.set('tipo','programas');
 if(page>1)p.set('pagina',String(page));
 return '/oportunidades/semantica?'+p.toString();
}
