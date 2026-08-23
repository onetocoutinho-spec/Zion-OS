# / (Visão geral da agência) — overrides sobre MASTER.md

Auditoria `ui-ux-pro-max` em 2026-08-23: passa em feedback (`role="alert"` + retry), vazio com ação, skeleton, cor+forma em `EstadoDaLoja`, tabela sem rolagem na página.

## Corrigido em 2026-08-23
- `<p>` aninhado em `TdMain` (aviso de hidratação) → `TdMain sub=`.
- (transversal) `AppShell`: trilha deixa de ser `<h1>` → um h1 por tela, o do `PageHeader`.
- (transversal) `globals.css`: `cursor: pointer` em button/summary/select/label, `not-allowed` em desabilitado — o preflight do Tailwind 4 não traz.
