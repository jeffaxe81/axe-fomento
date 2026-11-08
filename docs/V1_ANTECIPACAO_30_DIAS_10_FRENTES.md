# AXE Fomento — antecipação de 30 dias da V1 em dez frentes

Decisão de planejamento: **08/11/2026**. Meta anterior: **19/12/2026**. Meta antecipada: **19/11/2026** (30 dias corridos antes).

## Estado que NÃO muda ao antecipar a data

- V1: **6/8 marcos técnicos (75%)**. Pendentes V1-07 (fonte oficial, edital real e elegibilidade) e V1-08 (piloto, oito portões OP e aceite institucional).
- Funcionalidades codificadas do backlog: 65/65, o que não certifica fontes oficiais nem uso público.
- Operação: **OP-01 a OP-08 ainda 0/8 comprovados no ambiente-alvo; NO-GO**.
- A antecipação reduz a janela de planejamento; não transforma PR, CI, simulação, PDF ou declarações locais em aceite externo.
- Nenhuma integração de IA nativa é pré-requisito da V1; conectores de IA de terceiros dependem de autorização, rastreabilidade e delimitação de dados.

## Dez frentes e caminho crítico

| Frente | Entrega antecipada | Data-limite interna | Evidência/depêndencia crítica |
| --- | --- | --- | --- |
| F01 Fontes oficiais | Conferir API, OpenAPI, limites e falhas | 10/11 | Contrato real e histórico de resposta, #4 |
| F02 Editais reais | Edital individual aberto, prazo e eventuais retificações | 12/11 | Documento original, URL e revisão por segundo gestor, #4 |
| F03 Elegibilidade | Casos realistas positivo, negativo e indeterminado | 13/11 | Requisitos oficiais e perfil municipal, #2 |
| F04 Gestão municipal | Perfis, cadastro, permissões e isolamento | 11/11 | Teste de dois municípios, #7 |
| F05 Projetos/captação | Dossiê, histórico e encaminhamento assistido | 13/11 | Trilha auditável, sem envio externo não autorizado, #17 |
| F06 UX/acessibilidade | Responsividade, formulários, teclado e erros | 16/11 | Testes em dispositivos e evidências, #23 |
| F07 Segurança/LGPD | MFA, RLS, auditoria e privacidade | 16/11 | Teste cruzado no ambiente-alvo, #5 |
| F08 Qualidade | CI, integração, regressão e testes negativos | 17/11 | SHA e execução verde, #23 |
| F09 Infraestrutura | Container, HTTPS, backup/restore e rollback | 18/11 | Servidor-alvo, responsáveis e ensaios OP, #13 |
| F10 Piloto/aceite | Oito portões + decisão assinada | 19/11 | Município participante, ensaios reais e autoridade institucional, #13 |

## Sequência de execução

1. **08–10/11:** priorizar F01/F02/F03; solicitar fontes, publicação individual, município-piloto e infraestrutura sem bloquear demais frentes.
2. **11–13/11:** executar F04/F05 e concluir roteiros de casos reais; registrar indisponibilidades sem inferir edital vigente.
3. **14–17/11:** F06/F07/F08; regressão de segurança e CI em cada PR, documentos e correções com evidências.
4. **18–19/11:** F09/F10; ensaiar OP-01..08 no servidor-alvo, revisar por segunda pessoa e submeter decisão formal.

## Regras de integração

- Cada frente usa commit, PR e checklist; integrar em `main` **somente com CI 100% aprovada e revisão dos riscos**.
- No ambiente padrão manter desligadas as flags de ingestão/consulta, análise e piloto que dependam de dados reais ou segredos; nunca ativar produção para cumprir prazo.
- Testar autor/revisor diferentes, isolamento entre prefeituras, datas no calendário de Brasília e proibição de publicar edital só por existir programa/contrato OpenAPI.
- Se um portal oficial não responder, registrar indisponibilidade e manter o V1-07 **pendente**. Se faltar infraestrutura/prefeitura piloto, manter V1-08 e OP-01..08 **pendentes**.
- V1 poderá ser chamada de 100% somente após evidências documentais reais de V1-07, ensaios OP-01..08, aceite e autorização institucional; atualização de data é somente uma **meta condicional**.

## Bloqueios que exigem coordenação externa

1. Seleção de município piloto e usuários distintos para cadastro/revisão/aceite.
2. Servidor e domínio HTTPS, acesso de teste, backup e plano de retorno.
3. Publicação de edital oficial atual com regras e prazo auditáveis.
4. Confirmação formal de elegibilidade (não parecer jurídico automático) e aceite municipal.

**Referências técnicas:** `docs/V1_HOMOLOGACAO_EDITAIS_20261108.md`, `docs/HOMOLOGACAO_OPERACIONAL.md`, `docs/V1_EXPORTACAO_EVIDENCIAS.md`; `lib/v1-acceleration.mjs` é a fonte estruturada do cronograma exibido em `/evolucao`.
