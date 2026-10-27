# AXE Fomento — Critérios de aceite: radar e projetos

## Radar de oportunidades

- Mostrar título, órgão, fonte, prazo, valor e situação quando esses dados estiverem disponíveis.
- Marcar oportunidades fictícias de forma inequívoca; nunca apresentá-las como editais vigentes.
- Permitir pesquisa por título/órgão e filtro por área, com resultado vazio explicativo.
- Distinguir prazos ausentes de prazos expirados e informar a data de referência da avaliação.
- Não afirmar elegibilidade definitiva: pontuação é preliminar e critérios devem ser explicáveis.
- Não inserir dados de editais reais sem fonte verificável e data de consulta.

## Gestão de projetos

- Criar projeto apenas no município autenticado, ignorando identificadores de município fornecidos pelo cliente.
- Exigir permissão adequada para cada operação; registrar autoria e data das alterações.
- Não permitir que usuário de um município visualize ou modifique projetos de outro.
- Manter transições de status coerentes, sem marcar projeto aprovado sem comprovação externa.
- Proteger títulos e campos livres contra injeção SQL e HTML executável.

## Testes de aceite

1. Radar sem resultados e com oportunidades fictícias.
2. Busca com termos especiais e filtro de área.
3. Prazo inexistente, futuro e expirado.
4. Criação de projeto por usuário autenticado e rejeição anônima.
5. Isolamento A/B com tentativa de falsificação do município.
6. Controle de papéis e trilha de auditoria.
7. Navegação em telas pequenas e acessibilidade básica.

## Status

Especificação registrada; não equivale a implementação ou homologação funcional. A implantação permanece acompanhada pela issue #13.
