# Runbook — Aplicação da Migração 016 em Produção (PR-002)

> Operação crítica de banco. Segue a **regra dos 3 artefatos** do programa:
> **Plano** (PR-002, aprovado) · **Snapshot anterior** · **Relatório posterior**.
> Nada de memória — tudo documentado em `docs/engineering/executions/`.
> Código do app: **nenhuma alteração** (já em produção e validado em staging —
> `docs/implementation-phase-1-security/10-VALIDACAO-ISOLAMENTO-CONCLUIDA.md`).

## Fase 0 — Snapshot Operacional (OBRIGATÓRIA antes de qualquer escrita)

1. SQL Editor (produção) → rodar `database/checks/diagnostico-migracoes-producao.sql`
   (somente leitura; 1 grade de resultado).
2. Colar o resultado integral em
   `docs/engineering/executions/<AAAA-MM-DD>-pr002-security-snapshot.md`.
3. **Gate de decisão:** se `usuarios_SEM_perfil > 0` → Fase 1 é obrigatória.
   Se alguma migração 015/017 constar `PENDENTE` → parar e decidir antes de seguir
   (a 016 pressupõe a 015; a 017 pressupõe a 016).

## Fase 1 — Backfill de perfis (se o snapshot exigir)

1. Diagnóstico detalhado: `database/checks/check-users-without-profile.sql`.
2. Cadastro: `database/checks/fix-missing-profiles-template.sql`
   (equipe: `papel='equipe'`; clientes: `papel='cliente'` + `cliente_id`).
3. Reconferir: reexecutar o diagnóstico → `usuarios_SEM_perfil = 0`.

## Fase 2 — Aplicar a 016 (inteira)

1. Rodar `database/migrations/016-fix-multitenancy-security.sql` **completa**
   (idempotente — reexecutar o §1 já aplicado é inócuo).
2. Rodar a **verificação embutida** (§VERIFICAÇÃO no fim do arquivo):
   as duas funções com definição nova + coluna `ativo` presente.

## Fase 3 — Validação funcional (logado, produção)

- Equipe: login → painel completo acessível.
- Cliente (conta real): login → só os próprios dados; `/cliente/*` funcional.
- Negativo: usuário sem perfil (se existir de teste) → "Acesso não liberado".
- Checklist completo: `docs/security-validation-checklist.md`.

## Durante a execução — registrar SEMPRE

Horário de início/término · tempo total · divergências encontradas · decisões
tomadas na hora. Vai direto para o relatório.

## Fase 4 — Relatório posterior

Criar `docs/engineering/executions/<AAAA-MM-DD>-pr002-security-report.md` com:
diagnóstico inicial · ações executadas · validações realizadas · evidências ·
problemas encontrados · rollback necessário? (sim/não) · resultado final.

## Rollback (a qualquer momento, instantâneo, não-destrutivo)

Seção **REVERTER** embutida na própria 016 (dois `create or replace` restauram o
comportamento anterior). `perfis.ativo` pode permanecer. Registrar no relatório.
