# /esteira, /esteira/aprovacoes, /esteira/lote — overrides sobre MASTER.md

Auditoria `ui-ux-pro-max` em 2026-08-23.

## Corrigido em 2026-08-23
### /esteira
- `aprovar()` sem try/catch → agora loading ("Aprovando…"), erro com `role="alert"` e retry.
- Erro da esteira com `role="alert"`, aviso com `role="status"`.
- Alternador rápido/aprofundado: `aria-pressed`, alvo ≥44px em toque. `summary` idem.

### /esteira/aprovacoes
- Aprovar/Rejeitar sem feedback → `executar()` com sucesso/erro anunciado; `busy` por ID (spinner só na linha em andamento).
- Badge da nota dizia "bom/ruim" só pela cor → agora com texto (boa/atenção/ruim).
- Skeleton durante a carga; KPIs com `aria-busy` enquanto `data` é null.
- `msgPub` com `role="status"/"alert"`. "Ver no ML" e `summary` com alvo ≥44px.

### /esteira/lote
- `criarExecucaoLote` fora do try → botão ficava preso em "Rodando lote…". Agora try/catch/finally; falha no registro vira aviso separado (o lote já rodou).
- "0 anúncios na fila" durante a carga → "Montando a fila…" + botão desabilitado com spinner; `aria-live`.
- `select` de quantidade com `focus-visible:ring` e alvo ≥44px.

## Pendente (Medium/Low)
- ~~Filtros fora da URL~~ → `useFiltroNaUrl` (`?status=`; `?prioridade=&quantidade=`) em 2026-08-23.
- ~~Aprovações sem multi-select~~ → caixa mestre + `TdSelecao` + barra "Aprovar N / Rejeitar N" com a mesma trava da linha (`loteDeAprovacao.ts`, testado) em 2026-08-23.
- Aprovações: 9 colunas; coluna de ação é a última — em desktop estreito pode ficar atrás da rolagem do contêiner (não medido).
