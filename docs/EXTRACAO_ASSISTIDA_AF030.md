# AXE Fomento — AF-030 · Extração assistida de requisitos de editais

## O que esta versão entrega

Um fluxo determinístico para destacar e registrar possíveis exigências
encontradas em **texto copiado ou transcrito manualmente** de editais,
vinculando-as a uma versão de PDF armazenada pelo próprio município.
É um primeiro estágio de extração assistida por regras textuais, **não
um leitor automático de PDF, OCR ou integração a modelo de IA**.
A análise de cada requisito continua sendo responsabilidade humana.

## Utilização

1. No projeto, a equipe configura o checklist AF-017 e anexa uma versão
   de PDF de edital via mecanismo criptografado do AF-018.
2. Abre **Extração assistida de edital**, disponível para administrador
   ou titular do projeto se a feature estiver homologada e habilitada.
3. Seleciona a **versão exata** do PDF anexado ao mesmo projeto.
4. Copia ou transcreve um texto do edital (de 20 a 16.000 caracteres).
   Para indicar uma página, adiciona uma linha isolada `PÁGINA 4`,
   seguida do trecho daquela página na linha seguinte. Cada linha
   candidata deve manter a redação literal da fonte.
5. O extrator identifica até 25 frases com termos como `deverá`,
   `obrigatório`, `apresentar` e `comprovar`; mostra prévia no
   navegador. Linhas sem verbos pertinentes não geram sugestão.
6. Ao confirmar o lote com justificativa, o sistema guarda a versão
   vinculada do PDF, SHA-256 do texto fornecido e os trechos; **não
   armazena o texto integral colado**.
7. O revisor abre cada sugestão, confere manualmente o PDF/edital
   original e registra `pendente`, `aprovada` ou `rejeitada` com
   justificativa. Trecho ausente bloqueia `aprovada` mesmo se o
   cliente alterar manualmente o JSON enviado à API.
8. Cada revisão preserva autor, data e revisão incremental. Duas
   revisões simultâneas com o mesmo `expectedRevision` não substituem
   a decisão uma da outra; uma falha com HTTP 409.
9. O histórico por sugestão permite verificar a versão do PDF e a
   impressão SHA-256 declarada ao registrar o lote.

## Seguranças e limitações

- A versão de PDF deve pertencer ao **mesmo projeto e município**.
  Vínculos FK compostos e `FORCE RLS` impedem acessar registros
  de outra prefeitura. Titular do projeto ou administrador ativo
  podem gerar e revisar lotes. Não há acesso a credenciais admin
  de PostgreSQL no servidor.
- O código valida origem HTTP (CSRF), sessão, papéis e
  campos JSON estritos e impõe limites no cliente e servidor.
- Lotes, sugestões e eventos são append-only para a role web,
  apenas com privilégios `SELECT,INSERT`.
- Os trechos fornecidos não são verificados automaticamente contra
  os bytes criptografados do PDF. O hash do texto atesta apenas que
  a declaração registrada não mudou; não demonstra autenticidade
  do documento ou integridade de transcrição.
- A sugestão aprovada **não se converte automaticamente em requisito
  objetivo AF-013**, diligência, parecer jurídico ou condição oficial.
- Falhas e ambiguidades são esperadas na heurística, incluindo
  **falsos positivos e falsos negativos**. Nenhum documento é enviado
  a serviços externos nesta funcionalidade.
- Máximo de 25 sugestões por lote, 50 lotes recentes visíveis na
  listagem, 100 documentos de origem selecionáveis e 1.000 revisões
  mais recentes visíveis por sugestão. Registros mais antigos
  continuam armazenados.

## Operação e homologação

- Migração sequencial `023_edict_suggestions.sql`.
- Variável `ENABLE_EDICT_ASSISTED_EXTRACTION=no` é padrão de produção,
  enquanto o CI descartável usa `yes`.
- Requer `ENABLE_DOCUMENT_UPLOADS=yes` e segurança de armazenamento
  de anexos AF-018 homologada para uso operacional.
- CI valida a nova suíte em PostgreSQL/HTTP, RLS/concorrência,
  migrações repetidas, permissões, imagens Docker, restauração de
  backup e a bateria determinística de 10.000 cenários.
- **Não liberar produção** até aceite da issue #13 e análise dos
  controles documentais/jurídicos.
