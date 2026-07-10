# 03 — Layout da Agência

## Casca
`src/components/layout/AppShell.tsx` — sidebar da equipe (`NAV_ITEMS`), header com busca global, e-mail do usuário e "Sair". Para `/cliente/*` retorna só o conteúdo (o cliente tem casca própria) — agora via `estaNoPortalCliente` (não pega `/clientes`).

## Navegação da agência (já existente, todas rotas REAIS)
`src/components/layout/nav.ts` — 19 itens, todos com rota existente em `src/app/*`:

| Item | Rota | Cobre a área pedida |
|------|------|---------------------|
| Dashboard | `/` | **Visão Geral** |
| Clientes | `/clientes` | Clientes |
| Onboarding | `/onboarding` | Onboarding |
| Produtos | `/produtos` | Produtos |
| Templates | `/templates` | (apoio a Produtos) |
| Anúncios | `/anuncios` | Anúncios |
| Esteira de Anúncio | `/esteira` | **Esteira de IA** |
| Otimizar em Massa | `/otimizar-lote` | (apoio à Esteira) |
| Aprovações | `/esteira/aprovacoes` | Aprovações |
| Auditoria em Massa | `/auditoria-massa` | (apoio a Anúncios) |
| Fila de Otimização | `/fila-otimizacao` | (apoio à Esteira) |
| Agentes IA | `/agentes` | Agentes e automações |
| Tarefas | `/tarefas` | Tarefas / **Suporte** operacional |
| Reuniões | `/reunioes` | Reuniões |
| Pendências | `/pendencias` | Pendências e alertas |
| Vendas | `/vendas` | Vendas |
| Relatórios | `/relatorios` | Relatórios / **Performance** |
| Financeiro | `/financeiro` | Financeiro / **Contratos** (mensalidades) |
| Configurações | `/configuracoes` | Configurações / **Integrações** |

> A navegação da agência **já existia e é abrangente** — não foi redesenhada. Nenhuma tela falsa foi criada.

## Áreas pedidas que ainda NÃO têm rota dedicada
`Suporte`, `Contratos`, `Performance` e `Integrações` **não** têm rota própria hoje. Hoje elas são cobertas operacionalmente por rotas existentes (Tarefas/Pendências, Financeiro, Relatórios/Vendas, Configurações). Criar módulos dedicados é evolução futura ([07](./07-PENDENCIAS-FUTURAS.md)) — **não** foram inventadas telas para elas nesta tarefa.

## Página inicial
`/` = `src/app/page.tsx` (`DashboardPage`), já é uma visão da operação com **dados reais** (ver [05](./05-METRICAS-DISPONIVEIS.md)). Reaproveitada como está — o problema relatado era o redirecionamento, não o conteúdo do dashboard.
