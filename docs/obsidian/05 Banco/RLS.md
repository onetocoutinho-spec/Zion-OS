---
tipo: nota
area: banco
aliases: [Row Level Security, Multiempresa, Multitenancy]
---

# RLS

> **Row Level Security** — isolamento multiempresa **deny-by-default** por `organizacao_id` (agência) e `cliente_id` (empresa-cliente). Segurança real no banco, não no navegador.

**Fonte da verdade (design):** [[000-business-domain|000]] (tenancy) · [[010-database-compliance|010 · Database Compliance]] · implementação em [[implementation-phase-1-security/README|Segurança Fase 1]]

## Regras

- Todo dado operacional é escopado por tenant; ninguém acessa dado de outro tenant.
- Privilégio **nunca** é decidido pelo browser — sempre server-side (JWT via Bearer).
- Novas tabelas nascem com RLS deny-by-default ([[Definition of Done]]).

## Fase 1 de segurança (branch `fix/multitenancy-security`, não mergeada)

- (R1) `eh_equipe()`/`cliente_do_usuario()` passam a **negar por padrão** + `perfis.ativo` → migração **016**.
- (R3) `refresh_token` do ML sai do navegador (rotas recebem `clienteId`, nunca o token).
- (R6) `serverAuthorization.ts` valida JWT nas rotas ML + esteira/imagens.

> [!warning] Ordem de aplicação da 016
> `check-users-without-profile.sql` → backfill de perfis de toda a equipe → aplicar a 016. Ver [[Migrations]].

Ver também: [[Schema]] · [[Engineering Rules]] · [[Conta Marketplace]]

---
◀ [[Banco]] · [[Glossário]]
