# AF-034 — seis frentes técnicas coordenadas

As frentes especializadas são áreas de trabalho integradas
em um mesmo fluxo de implementação, não seis agentes
externos ou serviços de produção iniciados em paralelo.

| Frente | Componente | Critério |
|---|---|---|
| 1. Arquitetura e dados | sql/027_financier_directory.sql | Modelo municipal, modalidade/área e versões imutáveis |
| 2. Curadoria e proveniência | lib/financier-directory.mjs | URL pública, data humana, status sem alegação de recursos |
| 3. Backend | lib/financier-directory-sql.mjs | Escrita transacional, conflito, autorização, filtros sem truncar catálogo |
| 4. Segurança | APIs REST, RLS, role restrita | Sessão, CSRF, tenant e privilégio mínimo |
| 5. Interface | /financiadores e /financiadores/[id] | Filtros, páginas, histórico e avisos explícitos |
| 6. Testes e CI | testes AF-034, 27 migrações, Docker | Integração real com 2 municípios, 10k casos e recuperação de backup |

Só considerar validação técnica quando o CI completo aprovar.
Homologação operacional, merge e deploy continuam separados.
