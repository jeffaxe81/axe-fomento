# Cronograma V1–V4 e pendências — AXE Fomento (base 07/11/2026)

## Métrica reproduzível
O painel `/evolucao` usa `lib/product-roadmap.mjs` como fonte versionada. Cada marco
vale 1 somente quando há funcionalidade ou evidência técnica no Git. **Isso não autoriza produção.**
A V1 contempla 8 marcos (5 codificados), a V2 6 (2 codificados), a V3 5 (1 codificado),
a V4 5 (2 codificados): 10/24 (42% arredondados).
O backlog de funcionalidades AF-001..065 já foi implementado; o produto ainda tem dependências
reais e **OP-01..08 = 0/8 comprovados**.

## Prazos propostos, condicionais à disponibilidade de fonte e equipe
| Versão | Janela planejada | Entregável e aceite | Principal risco | Contorno |
| --- | --- | --- | --- | --- |
| V1 | 07/11–19/12/2026 | Fonte pública real validada, revisão de edital, radar sem falsos abertos e piloto municipal | API oficial indisponível, respostas diferentes, edital sem dados de vigência | Fila/staging, curadoria humana, badge desatualizado, nunca afirmar vigência |
| V2 | 20/12/2026–28/02/2027 | Respostas de IA com trechos e normas de origem, dossiê e aprovação humana | Alucinação, mudança normativa, dados sensíveis | RAG apenas em corpus autorizado e versionado, recusa sem referência, revisão jurídica |
| V3 | 01/03–30/04/2027 | Ampliação de financiadores, protocolos só via API autorizada, comprovação de decisões | Ausência de APIs privadas ou permissão formal | Handoff assistido, registro auditado de número e documento, acordos progressivos |
| V4 | 01/05–31/05/2027 | Avaliador calibrado com exemplos reais, auditável e com parecer humano | Viés e base pequena, nota interpretada como concessão | Rubrica explicável, teste cego, limitações e impedimentos destacados |

## V1 — próximas entregas (não confundir código com homologação)
1. Painel `/evolucao` e barras do dashboard; progresso com critério explícito e acessibilidade.
2. Radar `/oportunidades/conferidas`: separar observações municipais das oportunidades fictícias;
   revisão humana não se confunde com certidão de edital aberto.
3. Obter amostra, OpenAPI, paginação e regras de uso de Transferegov; corrigir parser quando preciso.
4. Ligação entre edital específico e data/termos verificáveis, mantendo evidência e histórico por versão.
5. Testar com uma prefeitura piloto em ambiente HTTPS de homologação, sem acesso ao ambiente público
   até OP-01 a OP-08.

## Portões obrigatórios antes de cada GO
- V1: ao menos uma oportunidade real com edição/versão verificáveis, prazos corretos e
  município elegível *preliminarmente*; testes de fonte positiva/negativa.
- V2: respostas que citam documentos e se abstêm quando faltar evidência; aceite jurídico.
- V3: cada sincronização externa deve ser autorizada, registrada, auditada e conciliável.
- V4: aderência da rubrica testada em conjunto de casos rotulados com validação humana.
- Produção geral: 8/8 OP e aprovação formal de responsável externo; CI isolado não basta.

## Riscos transversais
Mudança de API: cache identificado e recuperação sem inventar dados.
LGPD: armazenamento mínimo e isolamento RLS, expurgo e treinamento de usuário.
Falha do banco: backup criptografado, ensaio de restauração em infraestrutura-alvo.
Ausência de acesso API: trilha manual assistida com fonte primária e data, sem falsificar resultado.
