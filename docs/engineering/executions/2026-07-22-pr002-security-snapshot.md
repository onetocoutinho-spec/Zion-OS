# Snapshot Operacional — PR-002 · Segurança Multi-tenant (016)

> Artefato "Snapshot anterior" (regra dos 3 artefatos). Coletado ANTES de qualquer
> alteração, via `database/checks/diagnostico-migracoes-producao.sql` (somente leitura).

- **Ambiente:** Supabase produção (Postgres 17.6, db `postgres`)
- **Timestamp da coleta:** 2026-07-22 18:53:18 UTC
- **Operador:** mantenedor (SQL Editor) · condução: programa PR-002

## Resultado do diagnóstico

| Seção | Item | Valor |
|---|---|---|
| 1-eh_equipe | deny_by_default_aplicado | **NÃO** — definição PERMISSIVA da 005 ativa (`coalesce(..., true)`: "sem perfil = equipe") |
| 2-perfis | auth_users_total | 3 |
| 2-perfis | perfis_total | 2 (1 equipe + 1 cliente) |
| 2-perfis | perfis_inativos | 0 |
| 2-perfis | **usuarios_SEM_perfil** | **1 — `onetocoutinho@gmail.com`** (hoje com acesso TOTAL implícito pela regra permissiva) |
| 3-entidades | clientes | 1 |
| 3-entidades | organizacoes | tabela ausente |
| 4-migracoes | 015 · 016§1 · 022 · 023 | APLICADAS |
| 4-migracoes | **016 §2-4 (deny-by-default)** | **PENDENTE** ← objetivo desta operação |
| 4-migracoes | **017, 018, 019, 020, 021** | **PENDENTES** (achado novo — ver leitura abaixo) |

<details><summary>Definição completa de eh_equipe() capturada</summary>

```sql
CREATE OR REPLACE FUNCTION public.eh_equipe()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.papel = 'equipe' from public.perfis p where p.id = auth.uid()),
    true  -- sem perfil = equipe (não quebra os usuários atuais)
  );
$function$
```
</details>

## Leitura do gate de decisão

- **Backfill necessário: SIM** — 1 órfão (`onetocoutinho@gmail.com`). Papel a confirmar
  com o mantenedor antes do insert (regra de ouro do template).
- **016 pode prosseguir: SIM** — a 015 está aplicada (pré-requisito da 016 ✓); a 017
  depende da 016 (não o contrário), então sua ausência **não bloqueia**.
- **Achado novo (fora do escopo desta operação, registrado):** migrações **017–021
  nunca foram aplicadas** em produção. 020/021 (`produto_mestre*`) pertencem à fundação
  DDD morta → aplicá-las hoje seria inútil; decisão pertence à colheita (backlog E5.1).
  017 (`organizacoes`) e 018/019 → reconciliar quando as features correspondentes forem
  ativadas. Nenhum código em produção quebra por essas ausências (sem erros 42P01 em
  operação normal observados). Alimenta E1.2 (tracking de migrações).
- Divergências vs. plano: nenhuma além do achado 017–021 (o plano previa incerteza
  exatamente aqui — por isso o diagnóstico veio primeiro).
