# 05 — Métricas disponíveis (dashboard da agência)

Fonte: `src/app/page.tsx` (`DashboardPage`), com dados **reais** do store/Supabase via `useLiveQuery`. **Nenhuma métrica fictícia** foi criada nesta tarefa.

## Já exibidas hoje (dados reais)
| Card | Origem |
|------|--------|
| Clientes ativos | `clientes` com `status = "Ativo"` |
| Clientes em onboarding | `clientes` com `status = "Onboarding"` |
| Produtos em cadastro | `produtos` com `statusCadastro` em cadastro/não iniciado |
| Anúncios em otimização | `anuncios` ainda não concluídos/publicados |
| Tarefas atrasadas | `tarefas` não concluídas com prazo vencido |
| Relatórios pendentes | `relatorios` pendentes/em elaboração |
| Faturamento previsto | soma de `financeiro.valorMensal` (mensalidades da agência) |
| Clientes em risco | `clientes` com `status="Em risco"` ou `risco="Alto"` |
| Próximas ações prioritárias | `tarefas` por prioridade/prazo |
| Tarefas recentes | `tarefas` (últimas) |
| **Clientes que precisam de atenção** | `clientes` com `risco != "Baixo"` ou em risco → link p/ `/clientes/[id]` |
| Resumo da semana | tarefas concluídas, anúncios no ar, pendências de onboarding, tarefas atrasadas |

> A seção "Clientes que precisam de atenção" (pedida na Parte 4) **já existe** e lista os clientes em risco com a próxima ação.

## Pedidas na Parte 4 — mapeamento honesto
| Métrica pedida | Situação |
|----------------|----------|
| Clientes ativos | ✅ exibida |
| Produtos cadastrados | ✅ dado disponível (`produtos`); hoje o card mostra o subconjunto "em cadastro" |
| Anúncios ativos | ✅ "anúncios no ar" (resumo) |
| Anúncios aguardando aprovação | ⚠️ **dado existe** (`anuncios_gerados.status='aguardando_aprovacao'`) mas **não está neste dashboard** (usa `anuncios`, não `anuncios_gerados`) |
| Publicações com erro | ⚠️ **Dado ainda não integrado** ao dashboard (não há card de erro de publicação) |
| Otimizações pendentes | ⚠️ **dado existe** (`fila_otimizacao_produto.status='pendente'`) mas não está no dashboard |
| Faturamento dos clientes | ⚠️ o card mostra **faturamento da agência** (mensalidades). Faturamento **dos clientes** (vendas ML) é por cliente (`/vendas`), não consolidado aqui |
| Tarefas abertas | ✅ exibida (próximas ações / atrasadas) |
| Onboardings em andamento | ✅ "clientes em onboarding" |
| Pendências de suporte | ⚠️ **dado existe** (`pendencias`) mas não há card dedicado |
| Reuniões próximas | ⚠️ **dado existe** (`reunioes`) mas não há card dedicado |

## Decisão desta tarefa
Para respeitar "reaproveite o máximo possível", "não invente métricas" e "não redesenhe", **mantive o dashboard atual** (que já é real e funcional) e **não adicionei cards** para os itens marcados ⚠️. Eles têm dados disponíveis e podem virar cards numa evolução ([07](./07-PENDENCIAS-FUTURAS.md)) — sem inventar nada. Nada fictício foi incluído.
