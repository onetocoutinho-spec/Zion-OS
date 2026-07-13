---
tipo: conceito
area: marketplace
aliases: [Canal, canais_marketplace]
---

# Conta Marketplace

> A **conta/loja conectada** de um Cliente em um [[Marketplace|Marketplace]] (via OAuth). Guarda o vínculo (`refresh_token`) **server-side** — nunca no navegador.

**Fonte da verdade (design):** [[000-business-domain|000]] (entidade Conta Marketplace) · segurança em [[RLS]]

## Regras

- 1 ou mais por (Cliente, Marketplace); pertence a 1 Cliente; tem N [[Listing|Listings]].
- Credencial segura server-side (Fase 1 de segurança R3: rotas recebem `clienteId`, nunca o token). Ver [[RLS]].
- No Zion OS: tabela `canais_marketplace` (migração 011). "Conectado" = `ativo`.

Ver também: [[Mercado Livre]] · [[Listing]] · [[Marketplace]]

---
◀ [[Marketplace]] · [[Glossário]]
