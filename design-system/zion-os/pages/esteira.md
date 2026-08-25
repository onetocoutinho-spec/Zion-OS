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
- ~~Aprovações: 9 colunas, ação atrás da rolagem (não medido)~~ → MEDIDO em 2026-08-24 com uma linha de conteúdo real (o modo demo não tem dados): 1081px num container de 964 a 1280px de janela. Resolvido juntando Nota, A10 e Pend. em UMA coluna "Trava" (regra pura e testada em `loteDeAprovacao.ts`): caiu para 1010px, e a 1440 cabe exato (1134 em 1134). Os 46px que ainda sobram a 1280 ficam cobertos pelo `acaoFixa` — a ação nunca é o que a rolagem come.
- ~~Faltavam ~46px para caber a 1280~~ → `Criado` passou a mostrar só a data (a hora vai no `title`), caiu de 152px para 102 e a tabela fecha exata: **964px em 964** a 1280, e cabe a 1440. A 961px ainda sobra 59px, com a ação fixada.
