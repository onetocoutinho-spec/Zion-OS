---
tipo: template
alvo: pull-request
---

# PR-NNN — <título curto>

> Um PR = uma responsabilidade. Preencha e remova estas instruções. Ver [[Fluxo de Code Review]] · [[Definition of Done]] · [[Engineering Rules]].

- **Fase / Capability:** <ex.: Fase 2 · CAP-ML-ADP> ([[007-execution-roadmap|007]])
- **Depende de:** [[PRs|PR-XXX]], [[PRs|PR-YYY]]
- **Entrega:** <o valor de negócio deste PR>
- **Feature-flag:** <nome da flag> (obrigatória se toca runtime)

## Contexto

<Por que este PR existe; link para o doc de arquitetura afetado.>

## Mudanças

- <arquivo/módulo> — <o quê>

## Migração (se houver)

- [ ] Aditiva e reversível · **`down` testada** ([[Migrations]])
- [ ] [[RLS]] deny-by-default nas novas tabelas

## Testes

- [ ] Unitários da peça
- [ ] Integração (contrato entre peças)
- [ ] Idempotência (reenvio = no-op), quando aplicável

## Checklist (Definition of Done)

- [ ] CI verde (lint + tsc + build + testes)
- [ ] Nenhum segredo em código/log/evento
- [ ] Fronteira de Fonte da Verdade (000) respeitada
- [ ] Rollback documentado (flag + `down`)

---
◀ [[Templates]] · [[Home]]
