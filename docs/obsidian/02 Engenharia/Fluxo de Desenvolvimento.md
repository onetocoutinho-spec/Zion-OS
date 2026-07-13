---
tipo: nota
area: engenharia
---

# 🔄 Fluxo de Desenvolvimento

> Do plano ao deploy. Encadeia [[007-execution-roadmap|Roadmap]] → [[PRs]] → [[Fluxo de Code Review]] → [[Definition of Done]].

## Cadeia de decomposição (de 007)

```
Fase → Capability → Épico → User Story → Tarefa técnica → PR
```

Nenhuma funcionalidade inicia sem que **todas as suas dependências** estejam com [[Definition of Done|DoD]] cumprida (ver a Matriz de Dependências em [[Roadmap]]).

## Ciclo de um PR

1. **Selecionar** o próximo PR liberável em [[PRs]] (dependências prontas).
2. **Branch** por PR; migração com `down` quando toca banco ([[Migrations]]).
3. **Implementar** atrás de feature-flag; escrever testes da peça.
4. **CI local**: `npm run lint` · `npx tsc --noEmit` · build · `node --test`.
5. **Abrir PR** ([[Template PR]]) → [[Fluxo de Code Review]].
6. **Merge** verde → deploy (Vercel). Runtime novo permanece atrás da flag até o Critério de Liberação.
7. **Liberar a fase** só quando todas as capabilities cumprem o Critério de Liberação ([[Definition of Done]]).

## Feature-flag & rollback

Todo runtime novo nasce desligável. Rollback = desligar a flag + `down migration`; o legado continua operando (ex.: a fila `fila_otimizacao_produto` do Zion OS segue viva enquanto o [[Marketplace Engine]] não assume).

## Convenções do repositório (Zion OS)

- Build local no Windows: `$env:Path = "C:\Program Files\nodejs;" + $env:Path; npm run build`.
- Commit só quando o responsável autorizar ("comite"/"sim"/"tudo de uma vez").
- Autor de commit deve casar com a conta GitHub ligada à Vercel (senão deploy bloqueado).

---
◀ [[Engenharia]] · [[Home]]
