---
tipo: nota
area: engenharia
---

# 📏 Engineering Rules

> Regras de engenharia da Zion Platform. Derivadas de [[007-execution-roadmap|007]], [[008-architecture-compliance|008]] e [[000-business-domain|000]]. Página de navegação — a autoridade normativa está nos documentos-fonte.

## Regras de PR (de 007)

1. **Verde no CI obrigatório:** lint + typecheck + build + testes. Ver [[Definition of Done]].
2. **Runtime atrás de feature-flag:** toda mudança que toca runtime é reversível por flag.
3. **Migrações sempre com `down`.** Ver [[Migrations]].
4. **Nenhum segredo em código/log/evento.** Credenciais só server-side. Ver [[RLS]].
5. **Um PR = uma responsabilidade.** Um PR nunca mistura duas capabilities.

## Fronteira de Fonte da Verdade (regra suprema — 000)

- **Zion** é dona de conteúdo, [[SKU Origem|SKU]], preço de venda, identidade e estado do anúncio.
- **ERP ([[Magazord]])** é dono de estoque, custo, fiscal e nota — a Zion **espelha** (read-only), nunca inventa.
- **Marketplace** é dono do estado real do anúncio e dos pedidos.
- Uma capability **não escreve dado do qual não é dona** (verificado por teste e revisão).

## Regras de plataforma

- Toda integração implementa o [[Connector SDK]]; todo marketplace implementa o [[Marketplace Adapter]].
- Toda alteração relevante gera **Evento** ([[004-event-bus|Event Bus]]) + **Histórico** ([[Versionamento]]).
- Operações são **idempotentes**; falhas vão a dead-letter e são replayáveis.
- Multiempresa por **RLS deny-by-default** (por `organizacao_id`/`cliente_id`).
- Nada publica sem aprovação (trava [[IA|A10]] / Board).
- IA **nunca inventa dado** — falta de dado vira "⚠️ informação necessária".

## Convenções de ambiente (Zion OS atual)

- `NEXT_PUBLIC_*` são build-time (exigem Redeploy na Vercel). Segredos server-only: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ML_CLIENT_SECRET`.
- Autor de commit deve casar com conta GitHub ligada à Vercel (senão o deploy é bloqueado).

Documentos-fonte: [[008-architecture-compliance]] · [[010-database-compliance]] · [[007-execution-roadmap]]

---
◀ [[Engenharia]] · [[Home]]
