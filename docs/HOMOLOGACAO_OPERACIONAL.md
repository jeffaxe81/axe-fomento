# AXE Fomento — Homologação operacional

**Decisão atual: GO CONDICIONAL / NÃO AUTORIZADO PARA PRODUÇÃO.**

A execução CI 40032003259 concluiu com sucesso, mas validações em ambiente descartável não substituem ensaio operacional na infraestrutura de destino.

## Evidências já disponíveis

- CI aprovado: testes unitários, tipagem, migrações e integridade de checksums.
- Testes HTTP, isolamento municipal e privilégios da role `fomento_app` aprovados.
- Imagens Docker construídas; backup criptografado e restauração em banco descartável aprovados.

## Portões para GO operacional

| ID | Critério | Evidência exigida | Situação |
| --- | --- | --- | --- |
| OP-01 | Implantação no servidor-alvo | Compose, logs, health e versões registrados | PENDENTE |
| OP-02 | HTTPS e proxy | TLS válido, headers seguros e IP de origem confiável | PENDENTE |
| OP-03 | Credenciais e isolamento | Sem segredo admin no web; teste A/B no ambiente-alvo | PENDENTE |
| OP-04 | Fluxo funcional | Login, MFA, perfil, radar, projetos, logout, senha | PENDENTE |
| OP-05 | Backup e recuperação | RPO/RTO definidos; restauração isolada a partir do backup do alvo | PENDENTE |
| OP-06 | Operação | Logs, monitoramento, alertas, disco e procedimentos de rollback | PENDENTE |
| OP-07 | Resiliência | Reinício, indisponibilidade do banco e testes de carga | PENDENTE |
| OP-08 | Privacidade e aceite | LGPD, perfis, retenção, responsável e aceite documentado | PENDENTE |

## Procedimento de verificação (não destrutivo)

1. Confirmar o commit implantado, variáveis obrigatórias e saúde dos contêineres. Nunca imprimir segredos em relatórios.
2. Verificar HTTPS, certificado, proxy reverso e resposta de `/api/health`.
3. Validar autenticação, MFA, sessão, permissões e separação de dois municípios fictícios.
4. Confirmar a rotina de backup e executar recuperação **somente em banco isolado**, com autorização operacional.
5. Simular falhas e medir RTO/RPO sem interromper produção.
6. Executar aceite de usuário e registrar responsável, data, ambiente, evidências e resultado de cada item.

## Regra de decisão

**GO** somente com OP-01 a OP-08 aprovados e evidências anexadas. Qualquer falha crítica: **NO-GO**. O sucesso do CI não constitui autorização de implantação pública.

## Registro de aprovação

- Ambiente e URL: pendente
- Responsável técnico: pendente
- Responsável pelo aceite: pendente
- Data: pendente
- Decisão final: **NO-GO até conclusão dos portões**
