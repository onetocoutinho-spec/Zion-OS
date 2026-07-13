---
tipo: nota
area: engenharia
---

# ✅ Definition of Done

> Critério de "pronto". A **DoD por fase** está detalhada em cada fase do [[007-execution-roadmap|Execution Roadmap]]. Esta página resume o critério transversal. Ver [[Fluxo de Code Review]] e [[Definition of Done]] aplicada em [[Template PR]].

## DoD de um PR

- [ ] CI verde: `npm run lint` + `npx tsc --noEmit` + build + testes (`node --test`).
- [ ] Mudança de runtime atrás de **feature-flag**.
- [ ] Migração com **`down`** testada (quando toca banco). Ver [[Migrations]].
- [ ] Nenhum segredo em código/log/evento.
- [ ] Uma responsabilidade única (não mistura capabilities).
- [ ] Testes próprios do PR (unit/integração conforme a peça).

## DoD de uma Capability (Critério de Liberação para produção — de 007)

1. DoD da capability 100% cumprida.
2. Dependências (matriz) todas liberadas em produção — nenhuma em flag.
3. Testes: unit + integração verdes; E2E da jornada verde; carga/performance na meta (Fases 2/3/4/5/6).
4. **Fronteira de Fonte da Verdade (000)** respeitada — não escreve dado de que não é dona.
5. Idempotência e resiliência: dead-letter replayável; nada se perde silenciosamente.
6. Segurança: nenhum segredo em browser/log/evento; [[RLS]] deny-by-default nas novas tabelas.
7. Auditoria/[[Versionamento]]: toda alteração gera evento + histórico; AuditLog cobre a capability.
8. Aprovação (quando publica): trava [[IA|A10]]/Board ativa.
9. Observabilidade: logs estruturados + métricas (lag, erro, dead-letter) com alerta.
10. Rollback ensaiado: feature-flag validado; `down migration` testada; plano no PR.
11. Revisão de arquitetura assinada (conformidade com 000–006).

> [!info] Gate de saída por fase
> A fase é "em produção" só quando **todas** as suas capabilities cumprem o Critério de Liberação. Só então a fase dependente pode liberar.

Documento-fonte: [[007-execution-roadmap]] (seção "Critério de Liberação").

---
◀ [[Engenharia]] · [[Home]]
