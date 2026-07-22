# Engenharia — Zion OS

Guia operacional mínimo. A documentação reflete o software — nunca o contrário.

## Comandos oficiais

```bash
npm test           # suíte completa (node:test via tsx) — 294+ testes
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (AINDA NÃO é gate — 9 erros conhecidos, backlog E1.1.4)
npm run dev        # dev server (next)
npm run build      # build de produção
```

## CI

`.github/workflows/ci.yml` roda em todo push no `master` e todo pull request:
`npm ci` → `typecheck` → `test`, em **Node 22 LTS** (alinhamento com produção; a versão
local de dev não é referência arquitetural). Lint entrará no gate após E1.1.4.

## Documentos-base do programa

- [PROJECT_AUDIT.md](PROJECT_AUDIT.md) — auditoria completa (snapshot 2026-07-22)
- [ENGINEERING_BACKLOG.md](ENGINEERING_BACKLOG.md) — EPIC → Feature → Task → Checklist

## Diretrizes permanentes do programa

**Regra de remoção** — antes de propor remover qualquer código/módulo/diretório/abstração,
responder: (1) existe código usando? (2) existe documentação justificando? (3) existe intenção
arquitetural futura? (4) suporta alguma Capability planejada? (5) aproxima ou afasta a visão da
plataforma? **Só remover se todas forem negativas.** Preferimos carregar uma pequena reserva
arquitetural a eliminar uma boa ideia por excesso de limpeza.

**Refatoração orientada pela visão (Track B)** — uma refatoração não deve apenas melhorar o
código; deve **preservar ou ampliar** as possibilidades futuras da plataforma.

**Módulos reservados** — `src/modules/operation-center` é reserva arquitetural deliberada
(Signal/Decision/Mission/Action/Result; ver `docs/zion-os/modules/`): manter, não implementar
até o momento certo, não remover.
