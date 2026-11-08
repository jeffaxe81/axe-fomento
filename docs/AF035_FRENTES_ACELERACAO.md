# AF-035 — seis frentes de desenvolvimento coordenadas

Foco em alto volume útil: **37 fontes oficiais** prontas para
consulta e **lotes de até 20 avaliações**, com segurança e
proveniência. As frentes são especialidades integradas no
mesmo fluxo de desenvolvimento, não agentes autônomos
externos ou serviços implantados em paralelo.

| Frente | Entrega |
|---|---|
| 1. Referências oficiais | Levantamento de 37 URLs diretas do BNDES Cidades |
| 2. Banco e performance | Migração 028, índices, catálogo global, revisão municipal |
| 3. Segurança e auditoria | FORCE RLS, role mínima, sessão/CSRF, snapshot SHA-256 |
| 4. API de alta vazão | Lote de 1 a 20 eventos, all-or-nothing, conflito de revisão |
| 5. Interface | Consulta, filtros, paginação, detalhe, lote e alerta 90 dias |
| 6. Qualidade e DevOps | Unitários, integração 2 tenants, 24 GETs concorrentes, 10k CI, backup/Docker |

Concluído tecnicamente somente depois de CI integral verde.
`ENABLE_BNDES_CITY_CATALOG=no` permanece em produção e
a homologação operacional (issue #13) não foi concluída.
