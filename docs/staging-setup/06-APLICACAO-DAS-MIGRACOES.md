# 06 — Aplicação do Schema e das Migrações

## Conclusão principal (leia antes)
As migrações `001–016` **NÃO** rodam sozinhas num banco vazio. Elas fazem `ALTER TABLE` em `produtos`/`anuncios`/`clientes` e usam a função `set_updated_at()` — tudo criado na **base legada** (`database/_legado/`). Portanto:

> **Ordem:** base legada (`_legado/supabase-schema.sql` + `supabase-rls.sql` + `supabase-realtime.sql`, **sem** `seed.sql`) → migrações `001` … `015` → (criar usuários/perfis) → `016`.

**Extensões:** nenhuma `create extension` é necessária. `gen_random_uuid()` é do core do Postgres (13+); os schemas `auth` e `storage` são providos pelo Supabase.

## Inventário e dependências

| Passo | Arquivo | Cria/Altera | Depende de |
|-------|---------|-------------|------------|
| base | `_legado/supabase-schema.sql` | tabelas base (clientes, produtos, anuncios, agentes, tarefas, relatorios, financeiro, onboardings, onboarding_items, pendencias, reunioes, execucoes_agentes) + `set_updated_at()` | Postgres core |
| base | `_legado/supabase-rls.sql` | RLS base v1.x | schema base |
| base | `_legado/supabase-realtime.sql` | publication `supabase_realtime` | schema base |
| — | `_legado/seed.sql` | **SEED DEMO (7 clientes fictícios)** — **NÃO RODAR** | — |
| 001 | `001-modelagem-produtos-marketplace.sql` | variantes, atributos, templates, anuncio_variantes, precificacao, imagens; altera produtos/anuncios; publication | base (produtos, anuncios, clientes, set_updated_at) |
| 001b | `001b-seed-modelagem.sql` | **amostra** (produtos/variantes/agentes/templates) — **opcional**, evite no teste de isolamento | 001 + base |
| 002 | `002-auditoria-em-massa.sql` | importacoes, auditorias, problemas, fila_otimizacao, execucoes_lote | base + set_updated_at |
| 003 | `003-modelo-marketplace-real.sql` | altera produtos (cod_erp, preço mínimo, margem) | base (produtos) |
| 004 | `004-anuncios-gerados.sql` | `anuncios_gerados` + policy | base (clientes) + set_updated_at |
| 005 | `005-portal-cliente.sql` | `perfis`, `eh_equipe()`, `cliente_do_usuario()`, converte RLS, RPCs `portal_*` | `auth.users`, base, 001, 002, 004 |
| 006 | `006-self-service-cliente.sql` | RLS escopada + `quota_esteira()` + `clientes.limite_esteira_mes` | 005, produtos, produto_variantes, anuncios_gerados |
| 007 | `007-self-service-fase2.sql` | RLS de escrita p/ cliente | 005, 006, importacoes/auditorias |
| 008 | `008-portal-cliente-leituras.sql` | policies de leitura do portal | 005 |
| 009 | `009-marketplace-ml.sql` | `canais_marketplace` + colunas em anuncios_gerados | 005 (eh_equipe), clientes, 004 |
| 010 | `010-imagens-storage.sql` | bucket `produtos-imagens` + policies | schema `storage` (Supabase) |
| 011 | `011-canal-cliente-conecta.sql` | policy `cliente_escopo` em canais | 009 + `cliente_do_usuario()` (005) |
| 012 | `012-fila-otimizacao-produto.sql` | `fila_otimizacao_produto` | 004, 005, clientes, produtos |
| 013 | `013-tabela-medidas-produto.sql` | altera produtos (tabela_medidas) | base (produtos) |
| 014 | `014-tabelas-medidas-cliente.sql` | `tabelas_medidas` + policy | 005, clientes |
| 015 | `015-kit-componentes.sql` | altera produtos (componentes) | base (produtos) |
| **016** | `016-fix-multitenancy-security.sql` | `perfis.ativo` + `eh_equipe`/`cliente_do_usuario` deny-by-default | **005 (perfis) + perfis de equipe já cadastrados** |

**Observações de dependência importantes:**
- Migrações que dependem de **tabelas legadas**: 001, 002, 003, 004, 013, 015 (alteram/referenciam produtos/anuncios/clientes).
- Migrações que **não podem rodar isoladas**: 005 (precisa das tabelas de 001/002/004), 006/007/008/011 (precisam de 005), 012 (precisa de 004/005).
- Migrações que **assumem dados existentes / são específicas de produção**: `_legado/seed.sql` e `001b` (dados de amostra) — **pule**. A `016` assume que os **perfis de equipe já existem** (senão trava o acesso).
- Nenhuma migração exige extensão adicional.

## Como aplicar — **Opção recomendada: SQL Editor (manual, ordenado)**
No SQL Editor do Supabase de **staging**, abra e execute **um a um, nesta ordem** (copie o conteúdo de cada arquivo):
1. `database/_legado/supabase-schema.sql`
2. `database/_legado/supabase-rls.sql`
3. `database/_legado/supabase-realtime.sql`
4. `database/migrations/001` → `002` → `003` → `004` → `005` → `006` → `007` → `008` → `009` → `010` → `011` → `012` → `013` → `014` → `015`
5. (Pare aqui. **016** e os dados de teste vêm depois — ver [08-VALIDACAO-ETAPA-1.md](./08-VALIDACAO-ETAPA-1.md).)

Antes: rode `database/staging/00-preflight.sql` para confirmar o banco. Para criar o marcador de guardrail (`environment_metadata='staging'`), rode o topo de `database/staging/01-bootstrap-schema.sql` (o bloco `create table … insert … 'staging'`) — ou o script inteiro se usar psql.

## Como aplicar — **Opção alternativa: psql (tudo de uma vez)**
Da raiz do repositório:
```bash
psql "<STAGING_DB_CONNECTION_STRING>" -f database/staging/01-bootstrap-schema.sql
# (cria environment_metadata=staging, roda base legada + 001–015 via \ir)
```
Depois dos usuários/perfis de teste:
```bash
psql "<STAGING_DB_CONNECTION_STRING>" -f database/staging/02-apply-security-016.sql
```

## Sobre a Supabase CLI (`db push`) — **não plug-and-play aqui**
A CLI espera as migrações em `supabase/migrations/<timestamp>_nome.sql` e um `supabase/config.toml`. Este projeto usa `database/migrations/NNN-*.sql` **+ uma base legada** — formato **incompatível** com `db push` sem retrabalho. Para usar a CLI seria necessário:
- `npx supabase init` (cria `supabase/config.toml`);
- **copiar/renomear** as migrações para `supabase/migrations/` no padrão de timestamp — **e** incluir a base legada como a primeira migração;
- só então `npx supabase link --project-ref <STAGING_PROJECT_REF>` e `npx supabase db push`.

Como isso **muda a organização das migrações** (não desejável nesta etapa), a CLI **não é recomendada** agora. Fluxo sugerido caso você opte por ela mesmo assim (não executar contra produção; **nunca** inclua o project ref real em arquivos versionados):
```bash
npm install --save-dev supabase        # ou use via npx sem instalar
npx supabase init
npx supabase login
npx supabase link --project-ref <STAGING_PROJECT_REF>
npx supabase db push
```
> **Não instale a Supabase CLI nesta tarefa** — isto é só a documentação do fluxo. Prefira o **SQL Editor** (ordenado) ou o **psql** com os scripts de `database/staging/`.
