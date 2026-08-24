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
- ~~A tabela não cabia~~ → resolvido em 2026-08-23 cortando as 5 colunas de status (Cadastro, SEO, Descrição, Imagens, Preço OK) para UMA, "O que falta" (regra pura e testada em `modules/catalog/domain/etapasDoCadastro.ts`). Medido: 12 colunas pediam 1201px; agora 8 colunas cabem exatas — 974px em 974 a 1280px de janela, 911 em 911 a 961px. Entre 640 e 900px ainda sobra (776 em 670 a 720px), e é aí que o `acaoFixa` continua trabalhando.
- Sem multi-select/ação em massa por produto (a ação em lote é por grupo inteiro). Primitivas `marcaMestre`/`TdSelecao` já existem em `Table.tsx`.
