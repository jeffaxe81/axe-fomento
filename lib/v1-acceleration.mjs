// Plano de antecipação da V1: metas não são evidências de conclusão.
export const V1_ACCELERATION=Object.freeze({
 decidedOn:'2026-11-08',
 previousTarget:'2026-12-19',
 newTarget:'2026-11-19',
 advancedDays:30,
 source:'https://github.com/jeffaxe81/axe-fomento/issues/13',
 operatingDecision:'NO-GO'
});
// Os prazos abaixo são internos. Dependências externas não são controladas pelo software.
export const V1_WORKSTREAMS=Object.freeze([
 {id:'F01',title:'Fontes oficiais',target:'2026-11-10',priority:'Crítica',
  deliverable:'Contrato e trilha de consulta a fontes oficiais, com status de indisponibilidade',
  evidence:'URL, data, resposta, licença/uso e divergências do esquema',
  blocker:'Acesso e contrato efetivo da API oficial',issue:4},
 {id:'F02',title:'Editais reais',target:'2026-11-12',priority:'Crítica',
  deliverable:'Amostra de edital individual vigente, retificação e prazo documentados',
  evidence:'Documento e URL oficiais, publicação, vigência, hash e revisão humana',
  blocker:'Edital público vigente que possa ser verificado',issue:4},
 {id:'F03',title:'Elegibilidade municipal',target:'2026-11-13',priority:'Crítica',
  deliverable:'Caso positivo, negativo e indeterminado com regras municipais conferidas',
  evidence:'Critérios do edital, atributos do município e parecer de segundo gestor',
  blocker:'Dados municipais e critérios oficiais completos',issue:2},
 {id:'F04',title:'Gestão municipal',target:'2026-11-11',priority:'Alta',
  deliverable:'Revisão de perfis, prioridades e permissões no fluxo municipal',
  evidence:'Teste por perfil e isolamento de duas prefeituras',
  blocker:'Contas de homologação autorizadas',issue:7},
 {id:'F05',title:'Projetos e captação',target:'2026-11-13',priority:'Alta',
  deliverable:'Fluxo de proposta, documentos e histórico de encaminhamento revisado',
  evidence:'Roteiro ponta a ponta com registro de versões, sem envio automático',
  blocker:'Regras e exemplos documentais do ente',issue:17},
 {id:'F06',title:'Interface e acessibilidade',target:'2026-11-16',priority:'Alta',
  deliverable:'Fluxo responsivo e erros de formulário revisados em desktop e mobile',
  evidence:'Evidência visual, teclado, leitor de tela e estados vazios',
  blocker:'Dispositivos/usuários para avaliação',issue:23},
 {id:'F07',title:'Segurança e LGPD',target:'2026-11-16',priority:'Crítica',
  deliverable:'Revisão de MFA, RLS, trilhas de auditoria e retenção',
  evidence:'Testes A/B, matriz de perfis e checklist LGPD',
  blocker:'Homologação no servidor-alvo',issue:5},
 {id:'F08',title:'Testes e qualidade',target:'2026-11-17',priority:'Crítica',
  deliverable:'Regressão integrada com CI e cenários positivos e negativos',
  evidence:'SHA validado, CI verde e registro de falhas e correções',
  blocker:'Ambiente de integração estável',issue:23},
 {id:'F09',title:'Infraestrutura de homologação',target:'2026-11-18',priority:'Crítica',
  deliverable:'HTTPS, Docker, PostgreSQL, backup/restore e plano de rollback',
  evidence:'Registros OP-01, OP-02, OP-03, OP-05, OP-06 e OP-07 em ambiente-alvo',
  blocker:'Servidor, domínio, operador e janela de teste',issue:13},
 {id:'F10',title:'Piloto e aceite institucional',target:'2026-11-19',priority:'Crítica',
  deliverable:'Oito portões OP e termo de aceite municipal independente',
  evidence:'Ensaios de campo e aprovação assinada por responsáveis competentes',
  blocker:'Município piloto, testes reais, LGPD e autorização formal',issue:13}
]);
export function summarizeV1Acceleration(versions,operationalGates){
 const version=versions.find(v=>v.id==='V1');
 if(!version)throw Error('V1 não encontrada');
 const coded=version.milestones.filter(m=>m.done).length;
 return Object.freeze({
  coded,required:version.milestones.length,
  percent:Math.round(100*coded/version.milestones.length),
  pendingMilestones:version.milestones.filter(m=>!m.done).map(m=>m.id),
  operationalApproved:operationalGates.approved,
  operationalRequired:operationalGates.total,
  operatingDecision:V1_ACCELERATION.operatingDecision
 });
}
