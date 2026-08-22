# Problems — Zion OS

Data: 2026-08-21 · Versão: 1 · Commit: `36e1828` · Base: [01-CURRENT-EXPERIENCE](01-CURRENT-EXPERIENCE.md)

Severidade: `P0` bloqueia a tarefa · `P1` custa tempo ou causa erro · `P2` atrito · `P3` polimento. Esforço: S (≤1 dia) · M (2–5 dias) · L (>1 semana). Ordem: impacto ÷ esforço.

## Scorecard

> **Reavaliação em 2026-08-22, após as 8 fatias.** Separação Agency × Store 1→4 (os três P0 resolvidos; o P0 #3 depende da migração 064 para as RPCs do portal). Discoverability 2→4 (menu por pergunta, `/esteira/lote` e `/importar` visíveis, lista de usuários). Clarity 2→3 (glossário aplicado nas colunas e no portal; descrições de página ainda dizem "cliente" em alguns lugares). Hierarchy 2→4. Feedback/estados 3→4 (home com 3 estados, esqueleto da sidebar). Consistência 2→3 (tokens e duas consolidações; modais antigos e tabelas cruas ficaram). Acessibilidade 3→4 (Dialog com foco preso; alvos ≥44px na home). Estimativa nova: **3.6/5**. O scorecard original abaixo fica como linha de base.


```
DIMENSÃO                    NOTA  ACHADOS   P0  P1  P2  P3
Separação Agency × Store    1/5      8       3   4   1   0
Discoverability             2/5      5       0   2   3   0
Clarity (vocabulário)       2/5      4       0   2   2   0
Hierarchy (nav/dashboard)   2/5      4       0   3   1   0
Feedback / estados          3/5      3       0   2   1   0
Error handling              3/5      2       0   1   1   0
Consistência de UI          2/5      6       0   1   4   1
Acessibilidade              3/5      3       0   1   2   0
Performance percebida       3/5      2       0   1   1   0
────────────────────────────────────────────────────────
TOTAL                      2.3/5    37       3  17  16   1
```

A nota do lojista isolado seria ~3.5/5 (portal já reorganizado por pergunta, três estados na home, IA contextual). A nota da agência isolada é ~1.5/5. A média esconde que **o produto tem duas metades em estágios diferentes** — o trabalho é trazer a metade da agência ao nível da metade do lojista, sem regredir esta.

## Top 10 por impacto ÷ esforço

| # | Sev | Área | Problema | Impacto | Esforço |
|---|---|---|---|---|---|
| 1 | P0 | Contexto | Agência não tem contexto de loja: 10 seletores locais, 7 escolhas por trabalho, F5 troca de loja em silêncio — **resolvido na fatia 1 (2026-08-21)** | Agência, toda sessão | M |
| 2 | P0 | Separação | Agência usa o painel da Zion com menu filtrado; zero indicação de "qual agência / qual loja" | Agência, toda sessão | M |
| 3 | P0 | Separação | "Operar a loja X" não existe: agência não alcança as telas do portal da loja (RPCs sem parâmetro) | Agência, diário | L |
| 4 | P1 | Dashboard | Home `/` é grade de 10 números sem delta, sem ação, sem loading/erro; fora do menu da agência | Equipe diário; agência nunca vê | M |
| 5 | P1 | Hierarchy | Menu plano de 17/10 ferramentas; 4 itens da mesma família "otimização" espalhados | Ambos (painel) | S |
| 6 | P1 | Clarity | "Cliente" com 3 significados; "Pendências" com 2; "Portal do Cliente" para o lojista | Ambos | S (glossário) / M (renomes) |
| 7 | P1 | Segurança/UX | Allowlist de menu da agência sem guard de rota (`/agentes`, `/ail/*`, `/configuracoes` abrem por URL) | Agência | S |
| 8 | P1 | Estados | Flash do menu completo da Zion para a agência a cada carga (`perfil=null → "equipe"`) | Agência, toda carga | S |
| 9 | P1 | Discoverability | `/busca` sem porta no celular; `/esteira/lote` só por link interno; `/cliente/conectar-ml` escondida na área "Zion" | Ambos | S |
| 10 | P2 | Design system | `Badge`×`Pill` duplicados literalmente; 4 caixas `bg-[#0e0e16]`; tokens do DS com 0,1% de adoção | Dev velocity | M |

## Achados completos

### Separação Agency × Store

**[P0] Contexto · painel da agência/equipe (10 telas)**
Evidência: `src/app/esteira/page.tsx:51`; `otimizar-lote/page.tsx:25-28`; `vendas/page.tsx:34-43`; `produtos/page.tsx:36`; `auditoria-massa/page.tsx:84`; `auditoria-massa/importar/page.tsx:44`; `esteira/lote/page.tsx:106`; `fila-otimizacao/page.tsx:50`; `pendencias/page.tsx:41`; `relatorios/page.tsx:27`.
Problema: não existe "loja atual". Cada tela tem `useState` próprio; 4 guardam id, 6 guardam nome da empresa; defaults divergem (`""`, `"Todos"`, primeiro da lista, obrigatório). F5 e navegação zeram; em `/vendas` e `/otimizar-lote` o F5 **passa a mostrar outra loja** sem aviso.
Impacto: agência e equipe, em toda sessão; ≈7 seleções da mesma loja num fluxo de 8 telas; risco real de agir na loja errada.
Recomendação: um `ContextoDeLoja` único (URL `?loja=<id>` > cookie > portfólio), hook `useLojaAtual()`, migrar os 10 seletores para ele; chave sempre `id`.
Esforço: M.

**[P0] Separação · `AppShell` + `nav.ts`**
Evidência: `src/components/layout/nav.ts:28-46,91-108`; `AppShell.tsx:29-30,163-214`.
Problema: a agência recebe a experiência da Zion com 7 itens escondidos. Sidebar diz "Zion OS / Zion Company"; header mostra rótulo do menu, busca, e-mail — nunca o nome da agência nem da loja. É literalmente "mesmo dashboard + menus escondidos por role".
Impacto: agência, toda sessão; não responde "quais lojas eu opero / qual precisa de mim".
Recomendação: experiência de agência própria: header com `Agência › Loja`, navegação por pergunta (Portfólio · Lojas · Operação · Inteligência), home de portfólio. A equipe Zion é tratada como "agência de todas as lojas" + seção "Zion" extra.
Esforço: M (nav+header) + L (home).

**[P0] Separação · "operar a loja X"**
Evidência: `docs/agency-panel-separation/07-PENDENCIAS-FUTURAS.md:5-10`; `src/lib/services/perfil.ts:121-134` (`rpc("portal_resumo")` sem argumento); `roteamentoPapel.ts:114-127` (só `/cliente/conectar-ml` aberta à agência).
Problema: a agência não consegue entrar na experiência da loja (pendências do ML, precificação, fotos, assistente com contexto). Gerencia por listas cross-store do painel, que não respondem "o que esta loja precisa agora".
Impacto: agência, diário; a metade mais madura do produto (portal) é invisível para quem opera N lojas.
Recomendação: `ContextoDeLoja` resolvido também do segmento `/lojas/[id]/*` e injetado no `ClientPortalProvider`; RPCs `portal_*` ganham variante com parâmetro `p_cliente_id` validado por `lojas_da_agencia()`/`eh_equipe()` (mudança de função, não de tabela — precisa de aprovação). Banner "Operando: Loja X · ← Todas as lojas".
Esforço: L.

**[P1] Separação · onboarding de agência**
Evidência: `src/lib/services/usuarios.ts:12,58-61`; `054:62-64`; nenhuma rota escreve `agencia_id`.
Problema: NÃO EXISTE. Criar agência, usuário de agência e vincular loja é `insert` manual.
Impacto: agência (bloqueia venda do produto para agências sem intervenção da Zion).
Recomendação: tela da equipe "Nova agência" + "Vincular loja" (escreve `agencias` e `clientes.agencia_id`), `PAPEIS_PERMITIDOS` ganha `agencia` com `agenciaId` obrigatório.
Esforço: M.

**[P1] Separação · conectar ML pela agência**
Evidência: `ClientPortalShell.tsx:212-231` (mostra operador, não a loja).
Problema: na única tela do portal aberta à agência, não aparece o nome da loja que está sendo conectada.
Impacto: agência; risco de conectar a conta ML errada na loja errada.
Recomendação: header "Conectando o Mercado Livre de **Loja X**".
Esforço: S.

**[P1] Separação · aprovações sem loja**
Evidência: `src/app/esteira/aprovacoes/page.tsx` (sem seletor; relatório de rotas §4).
Problema: fila de aprovação misturada entre lojas.
Recomendação: consumir `useLojaAtual()`; coluna "Loja" em modo portfólio.
Esforço: S (após o contexto).

**[P1] Separação · marketplace inferido**
Evidência: `ClientPortalShell.tsx:143-150`.
Problema: o marketplace "ativo" no header do lojista é o mais frequente entre produtos, com fallback fixo — não é uma escolha nem um filtro; loja com ML + TikTok não consegue trocar.
Recomendação: marketplace como **dimensão/filtro** (product-model §7), não como rótulo inferido; mostrar canais conectados.
Esforço: M.

**[P2] Separação · vocabulário de portfólio vazando**
Evidência: `nav.ts:30` ("Clientes"), `ClientPortalShell.tsx:57` ("Portal do Cliente"), `:124` ("Powered by Zion Company").
Problema: o lojista lê "Portal do Cliente" — sente-se dentro do software de outra empresa.
Recomendação: topo do portal = nome da loja; rodapé discreto; nunca "cliente" para ele mesmo.
Esforço: S.

### Navegação e informação

**[P1] Hierarchy · menu plano do painel**
Evidência: `nav.ts:28-46`; `docs/product/UX-010:188` (anti-padrão "menu infinito").
Problema: 17 itens sem grupo, ordenados por ferramenta. "Esteira de Anúncio", "Otimizar em Massa", "Aprovações", "Fila de Otimização" (+ `/esteira/lote` invisível) são uma família só.
Recomendação: 4 grupos por pergunta (ver [04-INFORMATION-ARCHITECTURE](04-INFORMATION-ARCHITECTURE.md)); máximo 2 níveis.
Esforço: S.

**[P1] Discoverability · portas inexistentes**
Evidência: `AppShell.tsx:139,185` (`/busca` só no header `hidden sm:flex`); `esteira/page.tsx:185` (`/esteira/lote`); `ClientPortalShell.tsx:94` + `navegacao.ts` (`/cliente/conectar-ml` sob "Zion"); `nav.ts:31` ("Novo Usuário" sem `/usuarios`).
Recomendação: busca no menu mobile; `/esteira/lote` como aba da esteira; conexão do ML como passo do onboarding e alerta em "Hoje" enquanto não conectar; `/usuarios` lista.
Esforço: S.

**[P1] Segurança/UX · menu escondido sem guard**
Evidência: `nav.ts:88-89,91-102`; `roteamentoPapel.ts:112-127`.
Problema: agência abre `/agentes`, `/ail/*`, `/templates`, `/configuracoes`, `/`, `/z` por URL; vê tela vazia (RLS) e lê como produto quebrado. Além de UX, é superfície que depende só de RLS.
Recomendação: `decidirRota` ganha allowlist de rotas por papel (mesma fonte que o menu) → 403 explicativo. **Encaminhar à skill `zion-saas-security-audit`.**
Esforço: S.

**[P1] Feedback · flash do menu da Zion**
Evidência: `AppShell.tsx:82-88,122` (fallback `"equipe"` enquanto `perfil === null`).
Problema: a agência vê por um instante 17 itens da Zion a cada carga.
Recomendação: esqueleto de sidebar até o perfil resolver (ou menu mínimo, nunca o máximo).
Esforço: S.

**[P2] Discoverability · três navegações**
Evidência: `nav.ts`, `navegacao.ts`, `src/app/z/page.tsx:50-56`.
Problema: `/z` duplica os cinco rótulos do portal num Shell paralelo sem `href`.
Recomendação: decidir explicitamente o destino de `/z` (incubadora documentada ou remoção); não é escopo de UX resolver, mas é escopo registrar.
Esforço: S (decisão).

**[P2] Discoverability · subtelas do portal só quando a área abre**
Evidência: `ClientPortalShell.tsx:94`.
Problema: usuário novo não descobre "Peso e caixa" ou "Conexão com o ML" sem clicar na área certa.
Recomendação: manter colapso, mas mostrar contador/alerta na área quando há lacuna dentro dela (ex.: "Catálogo · 4").
Esforço: S.

**[P2] Discoverability · `/clientes/[id]` sem saída operacional**
Evidência: `clientes/[id]/page.tsx:47,71-76`.
Problema: a ficha da loja só oferece "novo produto", "novo relatório" e executar agente; não leva à esteira, vendas, auditoria *daquela* loja.
Recomendação: a ficha vira a **Store overview** da agência (ver 06) com atalhos que já carregam o contexto.
Esforço: M (absorvido pela fatia 5).

**[P1] Discoverability · link morto em `/produtos/[id]`**
Evidência: `src/app/produtos/[id]/page.tsx:51,90` — botão com `href="/anuncios/novo?cliente=…"`; a rota `/anuncios` não existe mais (removida com a tabela `anuncios`, ver `nav.ts:66-73`).
Problema: o botão da ficha do produto leva a 404.
Recomendação: apontar para `/esteira?loja=<id>` com o produto pré-selecionado (a esteira é o caminho atual do produto ao anúncio) ou remover.
Esforço: S. *(achado durante a fatia 1)*

### Dashboards

**[P1] Dashboard · home `/` da equipe/agência**
Evidência: `src/app/page.tsx:27-30,89-142`.
Problema: 6 StatCards + 4 tiles (10 números; "Produtos em cadastro" repetido em `:91` e `:135`); nenhum delta/período; StatCards não clicáveis; nenhuma ação primária; `?? []` faz loading e erro renderizarem zeros; cabeçalho à mão sem `PageHeader`. Fora do menu da agência.
Impacto: equipe diário; agência sem home nenhuma.
Recomendação: Agency overview: 5 KPIs com comparação, "Precisa de atenção" com ação, tabela de lojas com estado, três estados tratados (copiar o padrão de `cliente/page.tsx:234-271`).
Esforço: L.

**[P1] Dashboard · "loja em risco" sem definição**
Evidência: `src/app/page.tsx:99-117` (`risco !== "Baixo"`); `clientes.risco` é coluna editada à mão.
Problema: risco é campo manual, não derivado; sem tooltip do critério.
Recomendação: derivar (sem ML conectado, anúncios com problema, queda de vendas, quota) e explicar no tooltip; manter o manual como override.
Esforço: M.

**[P2] Dashboard · StatCards do lojista não clicáveis**
Evidência: `cliente/page.tsx:274-315`.
Problema: "Pendências abertas: 12" não leva a `/cliente/pendencias`.
Recomendação: `StatCard` ganha `href` opcional.
Esforço: S.

**[P1] Dashboard · sem comparação temporal em lugar nenhum**
Evidência: `page.tsx`, `cliente/page.tsx` (0 deltas); `vendas/page.tsx` tem períodos 7/30/90 mas sem "vs. anterior".
Recomendação: `StatCard` ganha `delta`/`comparacao`; começar por vendas (dado existe via ML).
Esforço: M.

### Telas operacionais

**[P1] Erro · `/produtos`, `/clientes`, `/esteira`, `/pendencias`, `/relatorios`, `/vendas`, `/auditoria-massa`, `/ail/*`, `/agentes` sem `loading.tsx`/`error.tsx`**
Evidência: só `src/app/error.tsx`, `src/app/cliente/error.tsx`, `src/app/cliente/loading.tsx`, `src/app/not-found.tsx`.
Recomendação: `loading.tsx` + `error.tsx` por grupo de rotas do painel, reutilizando `Esqueleto*`.
Esforço: S.

**[P1] Estados · `/vendas` (lista) sem estado vazio; 15 páginas sem vazio**
Evidência: relatório de componentes §4.
Recomendação: `EmptyState` nas listas; `/vendas` em especial ("sem ML conectado" ≠ "sem vendas").
Esforço: S.

**[P2] Performance · `/` carrega 322 kB para dois inteiros**
Evidência: `src/app/page.tsx:44-55` (comentário do próprio autor).
Recomendação: `count: "exact", head: true` quando a home abrir para a agência (gatilho já documentado).
Esforço: S.

**[P2] Performance · duas telas de loading em sequência no portal**
Evidência: `AuthGate.tsx:483` + `ClientPortalShell.tsx:191-199`.
Recomendação: esqueleto único com a casca já desenhada.
Esforço: S.

### Design system e consistência

**[P2] Consistência · `Badge` × `Pill`**
Evidência: `ui/Badge.tsx:2-11` × `client-portal/ui.tsx:10-19` (mapa idêntico).
Recomendação: `Badge` aceita `ReactNode` + `tone` explícito; `Pill` vira alias e some.
Esforço: S.

**[P2] Consistência · quatro caixas `bg-[#0e0e16]`**
Evidência: `Card.tsx:11`, `StatCard.tsx:38`, `client-portal/ui.tsx:72,137`, `src/app/page.tsx:122-137`.
Recomendação: `Card` com `variant` (`padrão | acao | vazio`); tiles inline da home viram `StatCard`.
Esforço: S.

**[P2] Consistência · sem primitiva de Modal**
Evidência: `esteira/aprovacoes/page.tsx:381`; `PainelDoAssistente.tsx:101`; `Mission.tsx:99-100`; 8 `fixed inset-0` ad hoc.
Recomendação: `Dialog` único (foco preso, `aria-modal`, Esc, scroll lock) — o Store switcher precisa dele.
Esforço: M.

**[P1] Consistência · tokens sem adoção**
Evidência: `foundation.css`/`semantic.css` importados só em `z/page.tsx:13-14`; `foundation.theme.css` nunca importado; 2 usos de `var(--fnd/--sem)` × 1.917 classes de cor Tailwind; 90 hex em `.tsx`; 130 `text-[11px]`.
Problema: dois sistemas visuais paralelos; o de produção não tem token de superfície/estado.
Recomendação: **não** migrar tudo; importar `foundation.theme.css` no `globals.css` e trocar os ~6 hex recorrentes (`#0e0e16`, `#0b0b12`, `#12121c`) por utilidades de token nas primitivas. Adoção incremental, primitiva a primitiva.
Esforço: M.

**[P2] Consistência · `<table>`/`<button>`/`<input>` crus**
Evidência: 10 tabelas cruas; 107 botões crus; 44 inputs crus; classe de input copiada em 4 arquivos (`agentes/[id]/page.tsx:43`, `auditoria-massa/importar/page.tsx:35`, `cliente/anunciar:604`, `cliente/medidas:264-294`).
Recomendação: regra de lint/teste "sem elemento cru fora de `ui/`" + migração oportunista ao tocar cada tela.
Esforço: M (espalhado).

**[P3] Consistência · inglês no rótulo**
Evidência: `nav.ts:29,33,43`; `auditoria-massa/page.tsx:63-78`; `ClientPortalShell.tsx:124`.
Recomendação: glossário (doc 04) e renomear: Dashboard→Visão geral, Templates→Modelos de categoria, Decision Intelligence→Inteligência de decisão, Status→Situação, Score→Nota.
Esforço: S.

### Acessibilidade

**[P1] A11y · modais sem `aria-modal`/foco preso**
Evidência: só `Mission.tsx:100` declara `aria-modal`.
Recomendação: coberta pela primitiva `Dialog`.
Esforço: (M, acima).

**[P2] A11y · 107 botões crus sem alvo ≥44px em toque**
Evidência: `Button.tsx` BASE tem `[@media(pointer:coarse)]:min-h-11`; botões crus não.
Esforço: (M, acima).

**[P2] A11y · 130 `text-[11px]` / 8 `text-[10px]` / 3 `text-[9px]`**
Problema: abaixo de 12px compromete leitura; fora da escala do DS (`--fnd-scale-type-12` é o mínimo).
Recomendação: `text-xs` mínimo; `text-[11px]` só em `tabular-nums` de tabela densa, com justificativa.
Esforço: S.

### Performance percebida

(ver "Telas operacionais": loading duplo, `/` pesada.)

## Riscos abertos — precisam de decisão do usuário

> Estado em 2026-08-22: (1) continua aberto — a migração `064-a-loja-em-operacao.sql` está escrita e **não aplicada**; (2) decidido na prática: a Lente nasceu no `AppShell` como `SeletorDeLoja`, `/z` intocado; (3) aplicado como emenda na UI (Loja ≠ Cliente) — falta registrar em VOC-001; (4) só os redirects canônicos; mover `/cliente/*` segue bloqueado pelo `redirect_uri` do ML; (5) fora do escopo, inalterado; (6) inalterado.

1. **RPCs `portal_*` com parâmetro de loja.** É mudança de função SQL (não de tabela), mas toca segurança (validação por `lojas_da_agencia()`/`eh_equipe()`). Sem isso, "operar a loja X" não sai do papel. Decisão: aprovar a Fase 3 mínima (doc 03 §Caminho de migração).
2. **Destino de `/z` (Shell + Mission + design tokens).** É a arquitetura-alvo da constituição (SHELL-001, UX-010 "Lente"). Esta auditoria propõe **o Store switcher como a primeira materialização da Lente no app de produção**, sem adotar o Shell inteiro. Decisão: concordar que a Lente nasce no `AppShell`, não no `/z`.
3. **Vocabulário "Cliente".** VOC-001 define Cliente = quem contrata a Zion. A proposta usa **Loja** na UI da agência e do lojista, e reserva "Cliente" para a relação comercial Zion↔contratante (telas da equipe). É emenda explícita, não desvio silencioso. Decisão: aceitar a emenda a VOC-001.
4. **Renomear `/cliente/*` → `/loja/*`.** Cosmético para o lojista, mas muda URLs salvas/e-mails. Proposto para a última fatia, com redirects.
5. **Roles por tenant (operador com subconjunto de lojas).** Exige tabela de membership — **fora desta proposta**; registrado como Fase 3 opcional.
6. **`/z` e `src/shell` duplicam os rótulos do portal.** Não mexer até a decisão 2.
