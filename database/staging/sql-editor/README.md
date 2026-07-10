# `database/staging/sql-editor/` — Bootstrap para o SQL Editor do Supabase

Arquivos SQL **consolidados** para executar manualmente no **SQL Editor** do Supabase (não precisa de `psql` nem da Supabase CLI). Cada arquivo pode ser colado e executado inteiro.

> São consolidações **fiéis** dos arquivos reais do repositório (verificado: cada linha das fontes aparece verbatim). **Não** contêm `\ir`, seed de demonstração, `001b`, clientes fictícios, usuários, tokens nem dados de produção. A lógica das migrações é preservada; só foram removidos comandos incompatíveis com o SQL Editor (não havia `\ir` nas fontes — só no antigo `01-bootstrap-schema.sql`, que **não** é usado aqui).

## ⚠️ Guardrails
- **Visual (todos os arquivos):** banner no topo — "RODE SOMENTE no zion-os-staging".
- **Técnico (02–08 + template):** um bloco `raise exception` aborta se o banco **não** tiver o marcador `public.environment_metadata` = `'staging'`. Esse marcador é criado pelo **01-base-schema.sql**. Logo, 02–08 **não** rodam num banco que não passou pelo 01 (ex.: produção).
- **Limitação honesta:** o **01** cria o marcador, então ele mesmo não pode se autoproteger por marcador — nele o guard é **visual**. Confirme o nome do projeto no topo do painel antes de rodar o 01. (A versão com guard técnico mais forte, via `psql`, está em `database/staging/`.)

## Ordem de execução (exata)

```
1.  Confirmar VISUALMENTE que o projeto aberto é zion-os-staging (topo do painel)
2.  Executar  01-base-schema.sql
3.  Executar  02-base-rls-realtime.sql
4.  Executar  03-migrations-001-005.sql
5.  Executar  04-migrations-006-010.sql
6.  Executar  05-migrations-011-015.sql
7.  Criar usuários de teste no Supabase Auth (ver "Primeiro usuário" abaixo)
8.  Criar os registros em `perfis` (create-first-team-profile-template.sql + seed de teste)
9.  Executar  06-pre-security-diagnostic.sql
10. Confirmar que TODOS os membros da equipe têm perfil (bloco 1 = 0 linhas)
11. Executar  07-security-migration-016.sql
12. Executar  08-post-migration-validation.sql
```

## Detalhe por arquivo

### `01-base-schema.sql`
- **Fonte:** `_legado/supabase-schema.sql` (+ cria o marcador `environment_metadata='staging'`).
- **Cria:** tabelas base (clientes, produtos, anuncios, agentes, tarefas, relatorios, financeiro, onboardings, onboarding_items, pendencias, reunioes, execucoes_agentes) e a função `set_updated_at()`.
- **Esperado:** "Success". Tabelas base passam a existir.
- **Como saber que deu certo:** `select count(*) from public.clientes;` responde 0 (existe, vazia).
- **Erro?** Se disser que algum objeto já existe, o banco não estava vazio — confirme que é o staging novo.
- **Reexecutável?** Sim (usa `if not exists` / `create or replace`).
- **Depende de:** banco vazio (projeto novo).

### `02-base-rls-realtime.sql`
- **Fonte:** `_legado/supabase-rls.sql` + `_legado/supabase-realtime.sql`.
- **Cria/altera:** RLS base (v1.x) nas tabelas base + publication `supabase_realtime`.
- **Esperado:** "Success".
- **Como saber:** as tabelas base ficam com RLS habilitado.
- **Erro?** Requer o marcador (rode o 01 antes). "policy já existe" → reexecução, pode ignorar.
- **Reexecutável?** Sim (idempotente).
- **Depende de:** 01.

### `03-migrations-001-005.sql`
- **Fontes:** migrações `001, 002, 003, 004, 005`.
- **Cria/altera:** produto_variantes/atributos/templates/anuncio_variantes/precificacao/imagens; auditorias; `anuncios_gerados`; **`perfis`, `eh_equipe()`, `cliente_do_usuario()`, RPCs `portal_*`** e a conversão de RLS por papel.
- **Esperado:** "Success". Ao final, a tabela `perfis` existe.
- **Como saber:** `select to_regclass('public.perfis'), to_regprocedure('public.eh_equipe()');` não-nulos.
- **Erro?** Precisa de 01+02. Rode-os antes.
- **Reexecutável?** Sim.
- **Depende de:** 01, 02.

### `04-migrations-006-010.sql`
- **Fontes:** `006, 007, 008, 009, 010`.
- **Cria/altera:** self-service (RLS escopada + `quota_esteira()` + `clientes.limite_esteira_mes`), leituras do portal, `canais_marketplace`, bucket de imagens (Storage).
- **Esperado:** "Success".
- **Como saber:** `select to_regclass('public.canais_marketplace');` não-nulo.
- **Erro?** Depende de 03 (funções de 005). Rode na ordem.
- **Reexecutável?** Sim.
- **Depende de:** 03.

### `05-migrations-011-015.sql`
- **Fontes:** `011, 012, 013, 014, 015`.
- **Cria/altera:** política do canal do cliente, `fila_otimizacao_produto`, `produtos.tabela_medidas`, `tabelas_medidas`, `produtos.componentes`.
- **Esperado:** "Success".
- **Como saber:** `select to_regclass('public.fila_otimizacao_produto'), to_regclass('public.tabelas_medidas');` não-nulos.
- **Reexecutável?** Sim.
- **Depende de:** 03 (e 04 para 011/`canais_marketplace`).

### `06-pre-security-diagnostic.sql` (SOMENTE LEITURA)
- **Fonte:** `database/checks/check-users-without-profile.sql`.
- **Faz:** lista usuários do Auth sem perfil, perfis de cliente sem `cliente_id`, papéis inválidos, equipe existente, órfãos + resumo numérico. **Não** altera dados.
- **Esperado:** o **bloco 1** (auth sem perfil) deve ficar **vazio** antes de rodar a 016.
- **Como saber:** `auth_sem_perfil = 0` no resumo.
- **Erro?** Se `auth_sem_perfil > 0`, cadastre os perfis faltantes antes da 016.
- **Reexecutável?** Sim (leitura).
- **Depende de:** 03 (tabela `perfis`).

### `07-security-migration-016.sql` (ISOLADA)
- **Fonte:** `database/migrations/016-fix-multitenancy-security.sql` — **sozinha**, nunca junto das anteriores.
- **Faz:** adiciona `perfis.ativo` (default true) e redefine `eh_equipe()`/`cliente_do_usuario()` para **negar por padrão**.
- **Esperado:** "Success".
- **Como saber:** `08-post-migration-validation.sql` mostra `eh_equipe` com `coalesce(..., false)` e `perfis.ativo` existente.
- **Erro?** Rode SÓ depois que a equipe tiver perfil (passo 10). Se algum objeto faltar, rode 03–05 antes.
- **Reexecutável?** Sim (idempotente).
- **Depende de:** 03 (perfis) + perfis de equipe já cadastrados.

### `08-post-migration-validation.sql` (SOMENTE LEITURA)
- **Fonte:** `database/staging/04-validation-queries.sql`.
- **Faz:** confere definições das funções, `perfis.ativo`, RLS ligado, perfis/dados de teste, canais (só contagem). **Não** altera dados.
- **Esperado:** funções com deny-by-default; `perfis.ativo` presente; RLS `on`.
- **Reexecutável?** Sim (leitura).
- **Depende de:** 07.

## Primeiro usuário (Supabase Auth)
Crie manualmente em **Supabase Staging → Authentication → Users → Add user**:
- Use um **e-mail exclusivo de staging** (ex.: um endereço só para testes). Confirme o e-mail manualmente se o projeto exigir (há opção "Auto Confirm User").
- **Copie o User UID (UUID).**
- Cole o UUID em **`create-first-team-profile-template.sql`** (substitua **todas** as ocorrências de `<STAGING_TEAM_USER_UUID>`) e execute. O template **aborta** enquanto o placeholder não for substituído.
- Para os usuários de cliente/inativo de teste, use `database/staging/03-seed-test-data-template.sql` (fluxo completo em `docs/staging-setup/07-DADOS-DE-TESTE.md`).

> **Nunca** insira linhas em `auth.users` por SQL — sempre crie o usuário pelo Auth e use só o UUID aqui. **Nunca** cole e-mail/senha/UUID reais em arquivos versionados.

## O que foi propositalmente excluído
`_legado/seed.sql`, `_legado/supabase-setup-completo.sql`, `001b-seed-modelagem.sql`, dados demonstrativos, clientes fictícios, usuários, tokens e credenciais. A migração **016** fica isolada em `07-…`, nunca junto das anteriores.
