# AXE Fomento — verificação de segurança (ambiente de teste)

## Escopo desta rodada

Testes de regressão em aplicativo e banco *descartáveis*, usando contas e prefeituras fictícias:

- Rejeitar chamadas de escrita de outra origem (proteção contra CSRF baseada em Origin/Fetch Metadata).
- Bloquear acesso a telas e API privadas sem sessão.
- Não revelar se usuário desconhecido existe no login.
- Impedir que duas prefeituras enxerguem projetos uma da outra.
- Garantir que um cliente não consiga selecionar outro município para gravar projetos.
- Negar alteração do perfil municipal a analistas sem privilégio.
- Proibir incorporação da aplicação em sites externos.
- Verificar que o aplicativo e a imagem Docker compilam.

Os testes HTTP estão em `tests/integration/`. A automação de CI instala o PostgreSQL isolado, aplica a migração, sobe o aplicativo e executa os testes.

## Limitações — NÃO É HOMOLOGAÇÃO OU PENTEST COMPLETO

- **RLS não implantado:** a aplicação ainda usa credencial do banco com permissões amplas. Isolamento no aplicativo foi testado, mas isso não substitui regras no banco com conta limitada.
- Não há controle robusto e distribuído de tentativas de login; falta rate limiting.
- Falta auditoria de alterações, revisão de dependências e verificação de HTTPS em ambiente real.
- Não foram executados testes ativos contra servidores de produção.
- A função `rejectUntrustedWrite` considera `Origin` e `Sec-Fetch-Site`; clientes sem tais cabeçalhos não são bloqueados. Isso não substitui autorização, cookies com atributos seguros e defesa em profundidade.

## Implantação

Definir `APP_ORIGIN` como a URL pública de confiança, incluindo HTTPS em produção (ex.: `https://fomento.exemplo.gov.br`). Rotas que alteram dados retornam 503 em produção sem essa variável.

**Sem liberação pública antes de homologar os bloqueadores acima.**
