# 07 — Rollback

Tudo é reversível. Duas dimensões: **banco** (migração) e **código** (branch).

## 1. Código (rotas, serviços, tipos, AuthGate)
Toda a alteração de código está na branch `fix/multitenancy-security`, isolada de `master`.

- **Não promover**: se ainda não fez merge, basta não mergear (produção segue em `master`).
- **Reverter após merge**: `git revert <merge_commit>` ou reverter os commits da branch. Nenhum arquivo de terceiro/tabela foi tocado.
- **Reverter arquivo a arquivo**: `git checkout master -- <arquivo>` para os itens de [02-ARQUIVOS-ALTERADOS](./02-ARQUIVOS-ALTERADOS.md).

Pontos de atenção ao reverter só o código (sem reverter o banco):
- Se a migração 016 **já** foi aplicada e você reverte o código: o app volta a tratar "sem perfil" como equipe no **cliente**, mas o **RLS** continua negando (016 ativa). Isso é seguro (nega a mais, não a menos), mas pode confundir. O ideal é reverter os dois juntos.

## 2. Banco (migração 016)
A migração é **aditiva**; reverter = restaurar as funções antigas. O bloco pronto está comentado no fim de `database/migrations/016-fix-multitenancy-security.sql`:

```sql
-- eh_equipe() volta a "sem perfil = equipe"
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.papel = 'equipe' from public.perfis p where p.id = auth.uid()),
    true
  );
$$;
-- cliente_do_usuario() volta a não exigir ativo
create or replace function public.cliente_do_usuario()
returns uuid language sql stable security definer set search_path = public as $$
  select p.cliente_id from public.perfis p
  where p.id = auth.uid() and p.papel = 'cliente';
$$;
-- perfis.ativo pode PERMANECER (inofensiva). Se quiser remover:
--   alter table public.perfis drop column if exists ativo;
```

- A coluna `perfis.ativo` **não precisa** ser removida (default true, ninguém quebra).
- Nenhum dado é perdido no rollback.

## 3. Canal do Mercado Livre / token
- O esquema de `canais_marketplace` **não mudou** (só o caminho de acesso). Reverter o código faz o app voltar a manipular o token no browser — só faça isso se realmente necessário.
- Os `refresh_token` já salvos continuam válidos (o formato no banco é o mesmo).

## 4. tsconfig
- Reverter a linha do `exclude` (`git checkout master -- tsconfig.json`) reinclui os `*.test.ts` no typecheck. Sem impacto funcional.

## Recomendação
Rollback **conjunto** (código + banco) para manter a coerência entre a UI e o RLS. Em staging, teste o rollback antes de precisar dele em produção.
