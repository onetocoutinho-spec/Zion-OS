---
tipo: nota
area: banco
---

# Migrations

> Regras e histórico de migrações. **Toda migração tem `down`** ([[Engineering Rules]]). Compliance em [[010-database-compliance|010]].

## Regra

- Migração aditiva e reversível; `down migration` testada ([[Definition of Done]]).
- Aplicação manual no Supabase é passo do responsável (o fluxo dele valida rodando as migrações).

## Histórico vivo (Zion OS)

| Migração | O que introduz |
|----------|----------------|
| 008–010 | base do produto/canais |
| 011 | `canais_marketplace` |
| 012 | `fila_otimizacao_produto` |
| 013 | `produtos.tabela_medidas` (override) |
| 014 | `tabelas_medidas` (gerenciáveis pelo cliente) |
| 015 | `produtos.componentes` (kit/combo) |
| 016 | **fix multitenancy security** — deny-by-default + `perfis.ativo` (ver [[RLS]]) |

> [!warning] Ordem obrigatória da 016
> Antes de aplicar a `016`: rodar `database/checks/check-users-without-profile.sql` → **backfillar perfis de toda a equipe** → só então aplicar (senão a 016 tranca a equipe, que hoje não tem perfil).

Ver também: [[Schema]] · [[RLS]] · [[Modelo de Dados — Produto Mestre]]

---
◀ [[Banco]] · [[Glossário]]
