# 03 — Migração RLS (R1)

## Arquivo
`database/migrations/016-fix-multitenancy-security.sql` — **aditiva, idempotente, reversível.** Não apaga dados, não renomeia tabelas.

## O que faz
1. `alter table public.perfis add column if not exists ativo boolean not null default true;` — perfis existentes continuam ativos (não quebra ninguém).
2. `eh_equipe()` → `create or replace` com **`coalesce(..., false)`** e exige `papel='equipe' AND ativo`. Sem perfil = **sem acesso** (antes: equipe).
3. `cliente_do_usuario()` → exige `papel='cliente' AND ativo`. Perfil inativo → `NULL` → nenhuma linha casa (`cliente_id = NULL` nunca é verdadeiro).
4. Re-liga o RLS (`enable row level security`) nas tabelas sensíveis (idempotente). **Nenhuma política é reescrita** — todas já referenciam as duas funções (migrações 005/006/007/009/011/012/014), então herdam o novo comportamento automaticamente.

## Por que é seguro para as políticas existentes
- Políticas de equipe: `using (eh_equipe())` → agora `false` para quem não é equipe ativa → nega.
- Políticas de cliente: `using (cliente_id = cliente_do_usuario())` → se a função retorna `NULL`, a comparação é `NULL` (não `true`) → nega. Sem vazamento por `NULL`.

## Ordem de aplicação (OBRIGATÓRIA)
> A equipe atual pode não ter perfil (o comportamento antigo dispensava). Aplicar fora de ordem tranca a equipe.

1. **Diagnóstico** — rode `database/checks/check-users-without-profile.sql` (só leitura). Veja o bloco 1 (auth sem perfil) e o 5 (equipe).
2. **Backfill** — com `database/checks/fix-missing-profiles-template.sql`, cadastre **todos** os perfis: equipe (`papel='equipe'`) e clientes (`papel='cliente'` + `cliente_id`). Não adivinhe quem é quem.
3. **Reconferência** — rode de novo o bloco 1 do check: deve retornar **0 linhas**.
4. **Aplicar 016** — em **staging** primeiro; depois produção. (A coluna `ativo` só existe após a 016; se cadastrar perfis antes, omita `ativo` nos inserts — o default é ativo.)

## Verificação pós-aplicação (no SQL Editor)
```sql
select pg_get_functiondef('public.eh_equipe()'::regprocedure);          -- deve mostrar coalesce(..., false)
select pg_get_functiondef('public.cliente_do_usuario()'::regprocedure); -- deve exigir ativo
select column_name from information_schema.columns
  where table_schema='public' and table_name='perfis' and column_name='ativo';
```

## Reversão
O próprio arquivo traz o bloco "REVERTER" comentado: recria as duas funções com `coalesce(..., true)` / sem `ativo`. A coluna `perfis.ativo` pode permanecer (inofensiva). Ver também [07-ROLLBACK](./07-ROLLBACK.md).

## ⚠️ Não aplicado
Esta migração **não foi executada** em nenhum banco (nem staging nem produção). É um arquivo pronto para a equipe rodar de forma controlada.
