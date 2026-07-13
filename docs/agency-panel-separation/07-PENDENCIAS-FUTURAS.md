# 07 — Pendências Futuras

Fora do escopo desta tarefa (que foi só redirecionamento + separação de layout + navegação por papel + home da agência + proteção de rota). Nada aqui foi implementado.

## 1. Modo "Visualizar como cliente" (impersonação do portal)
Hoje a equipe é **redirecionada para fora** de `/cliente` (correto, pois não há modo de visualização). Para a equipe **pré-visualizar o portal como uma empresa X**, seria preciso:
- um contexto "view-as" com `clienteId` explícito (sem mudar o papel real);
- variantes das consultas/RPCs do portal que aceitem `clienteId` da equipe (hoje os RPCs `portal_*` usam `cliente_do_usuario()`, que para equipe é nulo → o portal viria vazio);
- banner claro "Visualizando como: Empresa X · [Sair da visualização]".
Enquanto isso não existe, a agência gerencia cada cliente pelas rotas da equipe (`/clientes`, `/clientes/[id]`, `/produtos`, `/anuncios`, `/vendas` — a equipe vê tudo via RLS).

## 2. Módulos dedicados: Suporte, Contratos, Performance, Integrações
Não têm rota própria hoje. Cobertos operacionalmente por Tarefas/Pendências (suporte), Financeiro (contratos/mensalidades), Relatórios/Vendas (performance) e Configurações (integrações). Criar telas dedicadas é evolução — **não** criar telas falsas até haver dados/fluxo reais.

## 3. Enriquecer o dashboard (sem inventar dados)
Cards que têm **dados disponíveis** mas ainda não estão no dashboard ([05](./05-METRICAS-DISPONIVEIS.md)):
- Anúncios aguardando aprovação (`anuncios_gerados.status='aguardando_aprovacao'`).
- Otimizações pendentes (`fila_otimizacao_produto.status='pendente'`).
- Pendências de suporte (`pendencias`).
- Reuniões próximas (`reunioes`).
- Publicações com erro — **precisa** de um campo/estado de erro de publicação (hoje não integrado).
- Faturamento **dos clientes** (vendas ML) consolidado — hoje é por cliente em `/vendas`.

## 4. Seleção global de cliente (filtro)
Um seletor de cliente no header da agência (aplicando um filtro global às rotas `/produtos`, `/anuncios`, `/vendas`) melhoraria o fluxo "selecionar um cliente e ver os dados dele". Hoje isso é feito por rota (`/clientes/[id]`) e pelas listas globais. Não implementado nesta tarefa.

## 5. Testes de componente (E2E/RTL)
Os testes atuais cobrem a **lógica pura** (`decidirRota`). Testes de componente do `AuthGate`/`RoteadorPapel` (React Testing Library + jsdom) e E2E do fluxo de login exigiriam um framework de testes ainda não instalado — proposto para quando houver setup de testes.
