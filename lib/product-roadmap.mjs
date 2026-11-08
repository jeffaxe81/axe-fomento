// AXE Fomento: milestone evidence is code presence, NOT commercial readiness.
export const CODED_SCOPE=Object.freeze({implemented:65,total:65});
export const OPERATIONAL_GATES=Object.freeze({
 approved:0,total:8,source:'https://github.com/jeffaxe81/axe-fomento/issues/13'
});
export const PRODUCT_VERSIONS=Object.freeze([
 {id:'V1',title:'Radar de oportunidades verificáveis',start:'2026-11-07',target:'2026-11-19',
  milestones:[
   {id:'V1-01',name:'Sessões, perfis municipais e isolamento de dados',done:true,evidence:'CI de autenticação e RLS'},
   {id:'V1-02',name:'Busca, filtros e aderência inicial ao município',done:true,evidence:'Radar e testes de busca/score'},
   {id:'V1-03',name:'Favoritos, agenda e prazos de oportunidades',done:true,evidence:'Componentes e testes integrados do radar'},
   {id:'V1-04',name:'Coleta controlada, trilha de versões e revisão humana das fontes',done:true,evidence:'Ingestão e curadoria de programas públicos'},
   {id:'V1-05',name:'Radar separado de observações conferidas, com vencimento e fonte',done:true,evidence:'Página /oportunidades/conferidas, com revisão declarada'},
   {id:'V1-06',name:'Evidência obrigatória de edital individual, órgão emissor e data de publicação',done:true,evidence:'Snapshot com referência documental, validação de origem, histórico e testes'},
   {id:'V1-07',name:'API oficial, edital vigente e elegibilidade verificados com dados reais',done:false,evidence:'Contratos OpenAPI e parecer documental de segundo gestor codificados; pendem fonte real, elegibilidade de município e aceite'},
   {id:'V1-08',name:'Piloto municipal e oito portões operacionais aprovados',done:false,evidence:'Registro auditável e revisão por segundo administrador codificados; pendem implantação-alvo, oito ensaios reais e autorização formal'}
  ]},
 {id:'V2',title:'Inteligência jurídica e preparação com IA',start:'2026-12-20',target:'2027-02-28',
  milestones:[
   {id:'V2-01',name:'Documentos privados, checklist e versões auditáveis',done:true,evidence:'Anexos versionados e RLS'},
   {id:'V2-02',name:'Simulador financeiro indicativo',done:true,evidence:'API e testes determinísticos de simulação'},
   {id:'V2-03',name:'Leitura de editais e perguntas por IA com recuperação de fontes',done:false,evidence:'Pendente de RAG e avaliação de precisão'},
   {id:'V2-04',name:'Fundamentação jurídica por artigo e vigência',done:false,evidence:'Pendente de validação jurídica externa'},
   {id:'V2-05',name:'Rascunho assistido por IA com documento exigido por programa',done:false,evidence:'Pendente de modelo e prova de qualidade'},
   {id:'V2-06',name:'Aceite de usuários em casos municipais reais',done:false,evidence:'Pendente de piloto V2'}
  ]},
 {id:'V3',title:'Rede nacional e internacional de fomento',start:'2027-03-01',target:'2027-04-30',
  milestones:[
   {id:'V3-01',name:'Diretório de financiadores e catálogo de cooperação',done:true,evidence:'Cadastro e referências BNDES/COFIEX/cooperação'},
   {id:'V3-02',name:'Conectores ou curadoria de CAIXA, fundos e bancos multilaterais',done:false,evidence:'Pendente de fontes e contratos válidos'},
   {id:'V3-03',name:'Protocolos sincronizados somente via API autorizada',done:false,evidence:'Hoje há apenas registro interno assistido'},
   {id:'V3-04',name:'Acompanhamento de desembolso com confirmação externa',done:false,evidence:'Hoje valores dependem de declaração e documentos'},
   {id:'V3-05',name:'Piloto de rede e parceiros com governança aprovada',done:false,evidence:'Pendente de participantes, acordos e aceite'}
  ]},
 {id:'V4',title:'Avaliador inteligente e calibrado',start:'2027-05-01',target:'2027-05-31',
  milestones:[
   {id:'V4-01',name:'Rubrica versionada e pontuação conservadora',done:true,evidence:'Motor próprio e testes'},
   {id:'V4-02',name:'Relatório PDF e evidências de avaliação',done:true,evidence:'Histórico de pareceres e versão de documentos'},
   {id:'V4-03',name:'Calibração com projetos e decisões anteriores reais',done:false,evidence:'Pendente de dataset consentido e rotulado'},
   {id:'V4-04',name:'Revisão independente de vieses, segurança e explicabilidade',done:false,evidence:'Pendente de auditoria e validação'},
   {id:'V4-05',name:'Aceite de gestores municipais no fluxo completo',done:false,evidence:'Pendente de piloto V4'}
  ]}
]);
export const VERSION_SUMMARY=(version)=>{
 const completed=version.milestones.filter(m=>m.done).length;
 return {id:version.id,title:version.title,start:version.start,target:version.target,
 completed,total:version.milestones.length,percent:Math.round(completed/version.milestones.length*100)};
};
export const PRODUCT_SUMMARY=()=>{
 const completed=PRODUCT_VERSIONS.reduce((n,v)=>n+VERSION_SUMMARY(v).completed,0);
 const total=PRODUCT_VERSIONS.reduce((n,v)=>n+VERSION_SUMMARY(v).total,0);
 return {completed,total,percent:Math.round(completed/total*100)};
};
