---
tipo: nota
area: engenharia
---

# 🔍 Fluxo de Code Review

> Como um PR é revisado antes do merge. Complementa [[Definition of Done]] e [[Engineering Rules]].

## Passos

1. **Abertura** — PR pequeno, escopo único, descrição no formato [[Template PR]]. Referencia a Capability/Fase de [[007-execution-roadmap|007]] e os PRs de que depende ([[PRs]]).
2. **CI** — precisa estar verde: lint + typecheck + build + testes. PR vermelho não entra na fila de review.
3. **Revisão de conteúdo** — o revisor verifica:
   - Respeito à **Fronteira de Fonte da Verdade** (000): o PR não escreve dado de que não é dono?
   - **Idempotência** onde aplicável (reenvio = no-op).
   - **Segurança**: nenhum segredo em código/log/evento; [[RLS]] cobre novas tabelas.
   - **Migração** com `down`; feature-flag para runtime.
   - Testes cobrindo a peça.
4. **Conformidade de arquitetura** — para PRs de fundação, checar contra [[008-architecture-compliance|008]] e [[010-database-compliance|010]].
5. **Aprovação e merge** — squash com mensagem clara; autor casando com conta ligada à Vercel.

## O que barra o merge

- CI vermelho.
- Segredo exposto.
- Escrita fora da Fonte da Verdade.
- Migração sem `down`.
- Mudança de runtime sem flag.
- Ausência de testes na peça alterada.

Ver também: [[Fluxo de Desenvolvimento]] · [[Template PR]] · [[Template Bug]]

---
◀ [[Engenharia]] · [[Home]]
