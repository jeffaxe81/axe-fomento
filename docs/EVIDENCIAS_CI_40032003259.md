# Evidências de CI — AXE Fomento

## Execução

- Workflow run: 40032003259
- Commit avaliado: 6776bffcddacd507a71ada75abb5c711fadcc248
- Resultado consultado: completed / success
- Endereço: https://github.com/jeffaxe81/axe-fomento/actions/runs/40032003259

## Verificações aprovadas

- Testes unitários e checagem de tipos.
- Migrações, repetibilidade e integridade de checksums.
- Provisionamento da role restrita.
- Build da aplicação e inicialização HTTP.
- Testes de integração, segurança HTTP e isolamento municipal.
- Teste de privilégios PostgreSQL da role da aplicação.
- Build da imagem Docker web e da imagem operacional.
- Backup criptografado e restauração em banco descartável.
- Auditoria de dependências no nível crítico.

## Limites da evidência

CI aprovado não equivale a homologação com usuários nem a autorização de produção. Ainda validar configuração real de infraestrutura, restauração no ambiente-alvo, monitoramento, fluxos funcionais completos, testes de carga e revisão LGPD. Manter PR aberto até aceite explícito.

## Indicador

O percentual formal da Fase 1 permanece 2/8 (25%) até reconciliação dos critérios de aceite. Não confundir percentual do pipeline com percentual funcional.
