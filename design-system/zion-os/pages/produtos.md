# /produtos — overrides sobre MASTER.md

Auditoria `ui-ux-pro-max` em 2026-08-23 (régua: tabelas, feedback, vazio/carga, toque, headings, cor, massa).

## Corrigido em 2026-08-23
- Erro de "Auditar base" era pintado de sucesso (verde + ✓). Agora `erroAuditoria` separado, `role="alert"`, âmbar, com caminho de recuperação.
- Sucesso com `role="status"`.
- Skeleton (`EsqueletoDeTabela`) enquanto `useLiveQuery` carrega — antes ficava em branco.
- Nome do produto em `TdMain` (sem `whitespace-nowrap`) → sem rolagem horizontal por nome longo.
- Toggle do grupo: `aria-expanded`, `type="button"`, alvo ≥44px em toque.

## Pendente (Medium/Low)
- Filtros `status`/`prioridade` em `useState`; só a loja vai para a URL. Regra "Update URL on state/view changes".
- 11 colunas e **sem coluna de ação** (a ação é só o link no nome). Avaliar reduzir colunas ou coluna "Abrir".
- Sem multi-select/ação em massa por produto (a ação em lote é por grupo inteiro). Primitivas `marcaMestre`/`TdSelecao` já existem em `Table.tsx`.
