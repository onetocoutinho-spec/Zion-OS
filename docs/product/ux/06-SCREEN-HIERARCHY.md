# Screen Hierarchy — Zion OS

Data: 2026-08-21 · Versão: 1 · Base: [03](03-RECOMMENDED-EXPERIENCE.md), [04](04-INFORMATION-ARCHITECTURE.md)

## Priorização

| Tela | Experiência | Prioridade | Pergunta que responde | Frequência | Fase |
|---|---|---|---|---|---|
| Store switcher + header de contexto | agency | P0 | "Onde estou? Como entro na loja X?" | toda sessão | 1 |
| `/` Agency overview | agency | P0 | "Qual loja precisa de mim?" | diária | 2 |
| `/lojas/[id]` Store overview (agência) | store | P0 | "O que esta loja precisa agora?" | diária | 2–3 |
| `/lojas` Todas as lojas | agency | P1 | "Quais lojas opero, em que estado?" | diária | 2 |
| `/anuncios` (esteira · lote · aprovações) | agency | P1 | "O que está sendo produzido e o que aprovar?" | diária | 2 |
| `/auditoria` (auditoria · importar · fila) | agency | P1 | "Onde a otimização rende mais?" | semanal | 2 |
| `/vendas` | agency | P1 | "Quanto a loja X vendeu?" | diária | 1 (contexto) |
| `/pendencias`, `/relatorios`, `/produtos` | agency | P2 | listas cross-store | semanal | 1 (contexto) |
| `/cliente` Hoje (lojista) | store | P1 (manter) | "O que importa agora?" | diária | 2 (retoques) |
| Zion › Agências (nova) | zion | P1 | "Como cadastro uma agência e suas lojas?" | rara, bloqueante | 2 |
| Zion › Usuários (lista) | zion | P2 | "Quem tem acesso?" | rara | 2 |
| 403 explicativo | ambas | P1 | "Por que não posso ver isto?" | rara | 1 |

## Por tela

### Store switcher + header de contexto

Pergunta: onde estou e como troco.
Elemento primário: `Agência ▸ Loja ⌄` no topo da sidebar (agência pequena e fraca; loja maior e forte). Em portfólio: `Agência ▸ Todas as lojas`.
Ordem de leitura: 1 agência → 2 loja ativa → 3 busca (ao abrir) → 4 recentes → 5 todas → 6 adicionar.
Ação primária: selecionar loja.
Ações secundárias: "← Todas as lojas"; "+ Adicionar loja" (equipe; agência se permitido).
Estados: carregando (esqueleto do nome, nunca "Zion Company" como placeholder) · 0 lojas (só "+ Adicionar") · erro (mantém última loja conhecida + aviso).
Responsivo: desktop dropdown; mobile bottom sheet tela cheia com busca.
IA: estado de saúde por loja (● ⚠ ▲) com tooltip do motivo.
Lojista: **não renderiza**; topo mostra só o nome da loja.

### `/` Agency overview

Pergunta: como está o portfólio e qual loja precisa de mim.
Elemento primário: bloco "Precisa de atenção" (acima da tabela — urgência antes de panorama).
Ordem de leitura: 1 KPIs (5, com delta) → 2 Precisa de atenção → 3 Tabela de lojas → 4 Atividade recente.
Ação primária: entrar na loja (clique na linha).
Ações secundárias: ação do alerta; filtro de período; [Adicionar loja]; [Rodar auditoria] com loja pré-selecionada.
Estados: loading (esqueleto de KPI + tabela — `EsqueletoDeTabela`) · erro (`role="alert"` + [Tentar de novo], como `cliente/page.tsx:246-270`) · vazio (0 lojas: onboarding) · "nada exige atenção" (estado bom, verde, não vazio).
Responsivo: ≥1280 grid completo; 768–1279 KPIs 2 col + tabela com scroll; <768 KPIs empilhados, "Precisa de atenção" no topo absoluto, tabela vira lista (nome, vendas, Δ, estado) via `.tabela-cartao` já existente.
IA: "Precisa de atenção" é o diagnóstico de portfólio — motivo derivado com número e janela; nível Sugerir.
Equipe vs. agência: mesma tela; equipe vê todas as lojas e um KPI extra (quota de IA agregada).

### `/lojas/[id]` Store overview (agência dentro da loja)

Pergunta: o que esta loja precisa agora.
Elemento primário: "O que importa agora" (reuso de `OQueImportaAgora`).
Ordem de leitura: 1 barra "Operando Loja X · ← Todas as lojas" → 2 breadcrumb → 3 lacunas → 4 KPIs clicáveis → 5 vendas/top produtos.
Ação primária: a da lacuna #1.
Ações secundárias: atalhos "Auditar", "Rodar esteira", "Ver vendas" já com `?loja=`.
Estados: iguais ao `/cliente` atual + 403 sem acesso.
Responsivo: igual ao portal.
IA: `PainelDoAssistente` com `clienteId` do contexto (depende da Fase 3 para as RPCs).

### `/lojas` Todas as lojas

Pergunta: quais lojas opero e em que estado.
Elemento primário: tabela (Loja · Estado · Marketplaces conectados · Vendas 30d · Δ · Anúncios · Última ação).
Ordem: filtros (estado, marketplace, busca) → tabela.
Ação primária: entrar na loja.
Secundárias: [Nova loja]; [Conectar ML] por linha quando desconectado (hoje `clientes/page.tsx:102`).
Estados: três + vazio com onboarding.
Responsivo: lista de cards de linha no mobile.
IA: coluna Estado derivada.

### `/anuncios` (abas: Esteira · Lote · Aprovações)

Pergunta: o que está sendo produzido e o que aprovar.
Elemento primário: a aba ativa; em portfólio, coluna "Loja" e filtro `?loja=`.
Ação primária: Esteira → rodar; Lote → enfileirar; Aprovações → aprovar/publicar.
Estados: loading por aba; vazio ("nenhum anúncio aguardando — nada a fazer" é bom); erro.
IA: diff antes/depois (Preparar) e fila (Executar com aprovação) — já existentes.
Mudança: `/esteira/lote` deixa de ser invisível.

### `/auditoria` (abas: Auditoria · Importar · Fila)

Pergunta: onde a otimização rende mais.
Elemento primário: tabela de auditoria ordenada por impacto.
Ação primária: [Otimizar selecionados] → `/anuncios/lote?loja=`.
Importar exige loja: se `loja = null`, a aba mostra seletor inline (único lugar onde selecionar loja dentro da tela é aceitável, porque a ação é destrutiva por loja).
Estados: sem importação → "Importe os anúncios da loja" com CTA.

### `/cliente` Hoje (lojista) — retoques

Mantém estrutura. Mudanças: topo = nome da loja + chips de marketplaces; `StatCard` com `href`; KPI vendas com comparação; lacuna "Conectar ML" quando não conectado; áreas com contador.

### Zion › Agências

Pergunta: como cadastro uma agência e vinculo lojas.
Elemento primário: lista de agências (nome, nº lojas, usuários, ativo).
Ação primária: [Nova agência]; dentro: [Vincular lojas] (multi-select de lojas sem agência), [Convidar usuário].
Estados: vazio explicativo.
Só equipe.

### 403 explicativo

Pergunta: por que não vejo isto e a quem pedir.
Elemento primário: frase única ("Esta loja não está na sua agência" / "Esta área é da equipe Zion").
Ação primária: [Todas as lojas] ou [Visão geral].
Nunca tela em branco, nunca 404 para recurso existente.
