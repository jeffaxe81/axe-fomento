# Exportação de evidências de homologação da V1 (incremento de 08/11/2026)

A rota autenticada `GET /api/pilot/acceptance-report` disponibiliza um arquivo
`axe-fomento-v1-evidencias.json` apenas ao **administrador municipal**. A tela
`/evolucao` oferece link de exportação, sem alteração de dados. O relatório
agrega **somente o município autenticado** e expõe: resultado do último contrato
OpenAPI consultado para cada módulo, observações de oportunidade e revisão
municipal independente, resultados mais recentes dos oito portões OP-01..08
e revisão por um segundo administrador.

O arquivo devolve `report` e seu `sha256`. O digest é SHA-256 do JSON do
campo `report` na mesma ordem em que foi exportado, comprovando que a cópia
não foi modificada após geração. Para conferir com Node.js:

```javascript
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const {report,sha256}=JSON.parse(readFileSync('axe-fomento-v1-evidencias.json','utf8'));
const actual=createHash('sha256').update(JSON.stringify(report)).digest('hex');
if(actual!==sha256)throw Error('Relatório adulterado');
console.log('Checksum válido. Isso não valida o conteúdo declarado.');
```

Nenhum campo de texto livre, senha ou token é incluído na exportação. O
relatório **não faz consulta externa**, não valida a existência de recurso,
não executa envio de proposta nem altera o GO do produto. Mesmo todos os oito
portões declarados e revisados internamente mantêm `productionDecision=NO-GO`
e `deploymentAuthorized=false` até o aceite institucional, de competência do
responsável municipal e do operador da infraestrutura.

Limitações: relatório considera as 100 referências de oportunidades
mais recentes por código e fonte, no máximo 400 pareceres para essas
referências, e até 200 revisões dos oito portões; o relatório deve ser usado
junto à documentação integral quando houver histórico acima desses limites.
O hash assegura integridade da cópia, **não** autenticidade institucional nem
validade jurídica do conteúdo.

O procedimento para concluir a V1 continua em
`docs/V1_HOMOLOGACAO_EDITAIS_20261108.md`. O painel segue **V1=6/8 (75%)**
até a evidência de edital/eligibilidade em fonte oficial real (V1-07) e o
piloto com aceite formal no ambiente do município (V1-08).

## Pré-verificação do pacote de campo (V1-08)
O novo relatório inclui `operationalPilot.documentaryPreflight`: para cada portão OP-01 a OP-08
indica evidência ausente, ensaio não aprovado, URL inválida, SHA-256 não informado,
ensaio ou revisão com mais de **30 dias**, revisão anterior ao próprio teste,
revisor igual ao autor e divergência entre ambientes. O calendário usa a data
civil de Brasília. A tela `/evolucao` exibe as mesmas pendências.

O conjunto somente fica `readyForInstitutionalAudit=true` quando todos os oito
portões possuem registros recentes, coerentes, checksum e revisão de outro
administrador. **Esse valor significa que a documentação está pronta para
análise, não que os testes de campo foram verificados pela AXE ou que houve
aceite institucional.** Em todos os casos permanecem `fieldVerifiedGates=0`,
`deploymentAuthorized=false` e `productionDecision=NO-GO` até conferência
externa. Uma nova execução negativa substitui a positiva mais antiga na visão
do portão, preservando o histórico.
