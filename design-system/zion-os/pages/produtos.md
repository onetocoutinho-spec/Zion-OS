# /produtos — overrides sobre MASTER.md

Auditoria `ui-ux-pro-max` em 2026-08-23 (régua: tabelas, feedback, vazio/carga, toque, headings, cor, massa).

## Corrigido em 2026-08-23
- Erro de "Auditar base" era pintado de sucesso (verde + ✓). Agora `erroAuditoria` separado, `role="alert"`, âmbar, com caminho de recuperação.
- Sucesso com `role="status"`.
- Skeleton (`EsqueletoDeTabela`) enquanto `useLiveQuery` carrega — antes ficava em branco.
- Nome do produto em `TdMain` (sem `whitespace-nowrap`) → sem rolagem horizontal por nome longo.
- Toggle do grupo: `aria-expanded`, `type="button"`, alvo ≥44px em toque.

## Pendente (Medium/Low)
- ~~Filtros fora da URL~~ → `useFiltroNaUrl` (`?cadastro=&prioridade=`) em 2026-08-23.
- ~~Sem coluna de ação~~ → coluna "Abrir" em 2026-08-23, **grudada à direita** (`<Table acaoFixa>`).
- **Aberto (decisão de produto):** a tabela não cabe. Medido a 1440px: 12 colunas pedem 1201px num container de 1134 — e já não cabia antes (11 colunas = 1127px num container de 911 a 961px de janela). O `acaoFixa` garante que a AÇÃO nunca some, mas as colunas do meio continuam rolando. Caber de verdade pede cortar ~3 colunas; quais é decisão sua. Candidatas pelo critério que o repo já usou (constante ou derivada): `Prioridade` é derivada de nota/pendências, e `Cadastro`/`SEO`/`Descrição`/`Imagens`/`Preço OK` são cinco badges de status que poderiam virar uma coluna "o que falta".
- Sem multi-select/ação em massa por produto (a ação em lote é por grupo inteiro). Primitivas `marcaMestre`/`TdSelecao` já existem em `Table.tsx`.
