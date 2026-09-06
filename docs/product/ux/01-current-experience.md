# Current Experience — verificação de estado no HEAD atual

Data: 2026-09-06 · Commit analisado: `c04ca51` (branch `claude/zion-ux-discovery-mapping-eonqcr` = `origin/master`) · Método: skill `zion-product-ui-ux`, **somente fases 1 (DISCOVER), 2 (UNDERSTAND) e 3 (MAP)**. Sessão somente-leitura — nenhum arquivo de produto foi alterado.

Este documento **não substitui** `docs/product/ux/01-CURRENT-EXPERIENCE.md` (auditoria completa de 2026-08-21, commit `36e1828`). Ele é uma **reverificação** contra o estado atual do repositório, porque houve commits relevantes depois daquela auditoria (`f78c329`, `a7d77a3`, `d81c2f9`, `c848586`, `f5bcac2`, entre outros) que mudaram partes do modelo. Onde a auditoria antiga estava certa, este documento confirma com citação fresca. Onde ficou desatualizada, este documento diz explicitamente.

**Arquitetura-alvo:** não existe hoje um arquivo `docs/product/ux/zion-os-arquitetura-informacao.md` no repositório (verificado por busca — não encontrado). Os documentos mais próximos de "arquitetura alvo" são a própria série `docs/product/ux/03-RECOMMENDED-EXPERIENCE.md` e `04-INFORMATION-ARCHITECTURE.md` (2026-08-21), e a constituição de produto em `docs/zion-os/constitution/`. Este relatório mede a distância do código de hoje em relação a essas referências, não valida nem implementa nenhuma delas.

---

## 0. Stack detectada

- Framework: **Next.js 16.2.10, App Router** (`package.json`; rotas sob `src/app`, todas `page.tsx` — nenhum `page.ts`, nenhum Pages Router).
- UI: **React 19.2.4**, Tailwind 4 via `@theme inline` em `src/app/globals.css` (não há `tailwind.config.*` no repo — confirmado por ausência do arquivo). Não há `components.json` (shadcn/ui não usado); componentes de UI são próprios, em `src/components/ui/`.
- Dados/Auth: **Supabase** (`@supabase/supabase-js`), sem ORM adicional. Migrations SQL versionadas manualmente em `database/migrations/` (85+ arquivos numerados).
- Estado: React Context (`LojaAtualProvider`) + hooks; sem Redux/Zustand/React Query detectados nos arquivos revisados.
- i18n: produto 100% em português, inclusive nomes de tabela, rota e variável (`clientes`, `agencias`, `perfis`, `esteira`).
- IA: `@anthropic-ai/sdk` como dependência direta — há um "Copilot" (`AssistenteDaAgencia`, `PainelDoAssistente`) integrado nas telas, e uma área separada de IA analítica (`/ail/*`, `/agentes`) só para a equipe Zion.

---

## 1. Como o sistema entende uma agência?

Tabela `public.agencias`, criada em `database/migrations/054-a-agencia-como-cliente.sql:88-96`:
```sql
create table if not exists public.agencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
```
Deliberadamente mínima — comentário na própria migração (`054-a-agencia-como-cliente.sql:38-44`) explica que agência não é uma loja: "não tem produto, não tem canal do Mercado Livre, não tem preço mínimo", por isso não reaproveita a tabela `clientes`.

Criar uma agência **não é self-service**: não há política de INSERT em `agencias` para nenhum papel além de `equipe_total` (`054-a-agencia-como-cliente.sql:100-101`, `for all using (public.eh_equipe())`). A própria migração é explícita (`054-a-agencia-como-cliente.sql:66-70`): "Este arquivo NÃO cria nenhuma agência [...] Ligar a primeira é um insert deliberado, revisado à parte." A UI para isso é `src/app/agencias/nova/page.tsx` (só equipe, `nav.ts:138`, `SO_EQUIPE`).

**Consequência de UX:** o vocabulário do produto — confirmado pelo commit `a7d77a3` que reescreveu o README — não trata "agência" como sinônimo da própria Zion. É um segundo formato de conta, ao lado de "loja". Isso é uma mudança de framing real desde a auditoria de agosto, que ainda descrevia a Zion operando como agência única.

---

## 2. Como o sistema entende um lojista?

Um lojista é um `perfil` com `papel = 'cliente'` e `cliente_id` apontando para uma linha em `clientes` (`database/migrations/005-portal-cliente.sql:18-24`, colunas ampliadas por `016-fix-multitenancy-security.sql:31-32` e `054-a-agencia-como-cliente.sql:110-111`). A constraint `perfis_forma_do_papel` (`054-a-agencia-como-cliente.sql:124-129`) garante que todo perfil com `papel='cliente'` tem exatamente um `cliente_id` e nenhum `agencia_id`.

O lojista tem uma experiência de produto própria: o Portal (`src/app/cliente/*`, casca `ClientPortalShell.tsx`), cuja loja **nunca muda** — vem sempre do próprio perfil (`ClientPortalShell.tsx:186-215`, `CascaDoLojista`), nunca do contexto global.

---

## 3. Como o sistema representa uma loja — entidade de primeira classe, ou campo/filtro?

**Entidade de primeira classe.** A loja é a tabela `public.clientes` (nome herdado do produto original — ver achado de nomenclatura na pergunta 9), definida na base do schema (`database/staging/sql-editor/01-base-schema.sql:42-57`) e estendida por dezenas de migrations (`limite_esteira_mes`, `margem_minima`, `agencia_id`, etc.). Cada loja tem produtos, anúncios, canais de marketplace, pendências e relatórios próprios, todos referenciando `cliente_id`.

`agencia_id` foi adicionada em `054-a-agencia-como-cliente.sql:100-104`:
```sql
alter table public.clientes
  add column if not exists agencia_id uuid references public.agencias(id) on delete set null;
```
Nullable — comentário na própria coluna: "NULL = loja self-service, sem agência (o padrão)."

---

## 4. Como usuários se relacionam com agência e loja (1:1, N:N, membership)?

**Não há tabela de membership N:N.** O vínculo é uma coluna direta em `perfis`, que é 1:1 com `auth.users` (`perfis.id references auth.users(id) on delete cascade`, `005-portal-cliente.sql:18-24`).

Modelo real: **um perfil = um papel = um vínculo fixo**, garantido pela constraint `perfis_forma_do_papel` (`054-a-agencia-como-cliente.sql:124-129`):
```sql
alter table public.perfis add constraint perfis_forma_do_papel check (
  (papel = 'cliente' and cliente_id is not null and agencia_id is null) or
  (papel = 'agencia' and agencia_id is not null and cliente_id is null) or
  (papel = 'equipe'  and agencia_id is null)
);
```
Um usuário não pode ser "cliente" na loja A e "agência" na loja B, nem operar duas agências. O "N" fica do lado da agência: uma agência alcança **N lojas** via `clientes.agencia_id` (FK direta, 1 loja pertence a no máximo 1 agência), não via tabela de junção.

Não existe tabela `acessos`/`permissoes`/`memberships`/`loja_usuario` (busca em `database/migrations` por esses nomes não retornou nada).

---

## 5. Como funcionam permissões (role global, role por tenant, RLS, middleware, só UI)?

Quatro camadas, nesta ordem de força real:

1. **RLS no Postgres** — funções `security definer`: `eh_equipe()` (`016-fix-multitenancy-security.sql:47-55`, `coalesce(..., false)` — fail-closed), `cliente_do_usuario()` (`016:62-68`), `agencia_do_usuario()`/`lojas_da_agencia()` (`054-a-agencia-como-cliente.sql:140-166`). Política padrão `equipe_total` aplicada por loop em ~25 tabelas (`005-portal-cliente.sql:44-63`); política `agencia_escopo` aplicada por loop a toda tabela com `cliente_id` (`054:212-240`), depois **removida explicitamente** das tabelas mais sensíveis: financeiro (`055a`), tarefas/reuniões (`055b`) e credenciais de marketplace (`059:69`).
2. **Autorização server-side nas API routes** — `src/lib/auth/serverAuthorization.ts`: `avaliarAcesso()` (função pura, linhas 87-136) decide `{ok:true}`/`{ok:false,status,motivo}`; `autorizar()` (linhas 225-239) carrega o perfil real do banco e, se for agência, roda `agenciaOperaALoja()` (linhas 200-214) antes de decidir; `exigirAcessoAoCliente()` (linhas 272-277) é o wrapper usado por dezenas de rotas (`/api/ml/*`, `/api/usuarios`, `/api/imagens/*`, `/api/assistente/*`).
3. **Middleware — não existe hoje.** Busca por `middleware.ts`/`.js` na raiz e em `src/` não encontrou nada. Next roda sem Edge Middleware.
4. **Guard client-side (só UX)** — `rotaPermitida()` (`src/components/layout/nav.ts:180-186`) + `decidirRota()` (`src/lib/auth/roteamentoPapel.ts:106-134`), consumidos por `AuthGate`/`RoteadorPapel` (`src/components/auth/AuthGate.tsx:595-612`). O próprio código documenta que isso **não é segurança** (`roteamentoPapel.ts:7-8`: "Isto NÃO substitui a segurança [...] Aqui é só a experiência de UI").

Roles: **união de strings TS**, não enum nativo do Postgres — `PapelPerfil = "equipe" | "cliente" | "agencia"` (`src/lib/auth/roteamentoPapel.ts:12,15`), validada por `lerPapel()` (fail-closed) e refletida pela constraint de banco da pergunta 4. É a **mesma enum** para agência e loja — não há tipo `RoleDeAgencia` separado de `RoleDeLoja`; o que diferencia o escopo é qual FK (`cliente_id` vs `agencia_id`) está preenchida.

Roles são efetivamente **por tenant no sentido de escopo** (agência alcança N lojas; lojista alcança 1), mas **globais no sentido de que um usuário tem um único papel fixo no sistema inteiro** — não há tabela de acessos que permita papéis diferentes por loja.

Achado histórico relevante: `database/migrations/041-fecha-o-rls-que-a-005-nao-fechou.sql:40-56` documenta um **vazamento real e já corrigido**: a migração 005 deveria trocar a política permissiva em 24 tabelas mas nunca completou; 29 tabelas ficaram com `using (true)` combinado por OR com `cliente_escopo`, neutralizando o filtro. Medido em 2026-07-29: um cliente real via 74 produtos (73 dele + 1 de outro) e conseguia **escrever** em produtos, decisões (AIL) e agentes de outro tenant. Corrigido pela própria 041. Ver `02-problems.md` para a leitura de risco estrutural que isso implica hoje.

---

## 6. Como o usuário troca de loja (URL, estado global, cookie, sessão, nada)?

Existe um mecanismo único e ativo: `src/lib/contexto/LojaAtualProvider.tsx` + `src/lib/contexto/lojaAtual.ts`. Precedência real (`lojaAtual.ts:66-88`, `resolverLojaAtual`):
1. segmento de URL `/lojas/<id>` (reconhecido pela regra, mas a rota física `/lojas/*` hoje é só um alvo de redirect — ver seção MAP);
2. query `?loja=` (ou `?cliente=` legado) — lida via `useSearchParams` num filho isolado em `<Suspense>` (`LojaAtualProvider.tsx:108-118`, exigência do Next 16);
3. cookie `zion.loja` (`lojaAtual.ts:49,90-108`, SameSite=Lax, 30 dias), lido/escrito via `useSyncExternalStore`;
4. perfil (`papel==="cliente"` → sempre a própria loja, `lojaAtual.ts:67-70`);
5. nada selecionado → modo portfólio (`lojaAtual.ts:87`).

`definirLoja()` grava o cookie **e** escreve `?loja=` na URL via `router.replace` sem entrar no histórico (`LojaAtualProvider.tsx:17-19`), para que F5 e link colado cheguem ao mesmo lugar — resolvendo exatamente o defeito que a auditoria de agosto relatou ("F5 trocava silenciosamente para a primeira loja da lista", citado em `lojaAtual.ts:5-10` como motivação).

O switcher visível é `src/components/layout/SeletorDeLoja.tsx`: atalho global Ctrl/Cmd+K (linhas 66-77), navegação por teclado (124-135), recentes em `localStorage` (26-41), indicador de saúde por loja (24, 83-91), opção "Todas as lojas" (106,116-121,217-222). Renderizado na sidebar do `AppShell` (equipe/agência, `AppShell.tsx:65-69`) e na sidebar do portal quando alguém está "operando" (`ClientPortalShell.tsx:70-75`, condicional a `operando`, nunca visível para o lojista).

**Isto é implementação real em produção**, não uma proposta — confirmado pela árvore de arquivos, pelos usos em `AppShell.tsx`/`ClientPortalShell.tsx`/`page.tsx` (home) e pela ausência de diff entre a branch analisada e `origin/master`.

---

## 7. Existe visão de portfólio ou só uma loja por vez?

Existem os dois modos, e a maioria das telas operacionais respeita ambos:

- **Portfólio**: home `/` (`src/app/page.tsx`), com regra pura `resumoDoPortfolio()` (`src/lib/contexto/portfolio.ts:64-146`) cruzando lojas × anúncios × produtos × pendências, ordenando por saúde (linhas 83-108) e listando "atenção" com ação exata (110-133). Renderiza StatCards clicáveis, bloco "Precisa de atenção" e tabela comparativa de todas as lojas com coluna de ação "Operar" (`page.tsx:105-194`).
- **Loja única**: qualquer tela dentro de `/cliente/*` (portal) — sempre uma loja.
- Telas de topo (`/produtos`, `/pendencias`, `/relatorios`) tratam corretamente os dois modos: sem loja escolhida, agrupam por cliente; com loja escolhida, filtram (`src/app/produtos/page.tsx:128-146`).
- **Exceção inconsistente**: `/vendas` (`src/app/vendas/page.tsx:36-37,96-98`) e `/esteira` (`src/app/esteira/page.tsx:55,93`) assumem uma loja só (`const clienteId = lojaId ?? ""`) e mostram apenas um `EmptyState` pedindo para escolher a loja quando o contexto é "Todas as lojas" — não agregam portfólio como as demais telas do mesmo grupo de menu. Ver `02-problems.md`.

---

## 8. Como um lojista visualiza a própria loja?

Portal em `src/app/cliente/*`, casca `ClientPortalShell.tsx` (`CascaDoLojista`, linhas 186-215) — a loja vem do perfil e nunca troca. Home operacional `src/app/cliente/page.tsx` (`ClienteHome`): abre com `<OQueImportaAgora>` (o que falta para a loja estar pronta), depois `<TarefasDaLoja>`, depois 4 `StatCard` (anúncios no ar, anúncios que a esteira não fechou, produtos sem otimização, pendências abertas). O mesmo Copilot (`PainelDoAssistente`) aparece embutido, sempre visível, porque a loja nunca muda.

Quando é a **equipe/agência** que entra nessa mesma casca ("operar a loja"), a página é a mesma (`CascaOperando`, `ClientPortalShell.tsx:218-302`), mas a loja vem do `LojaAtualProvider` em vez do perfil, e aparece uma faixa permanente "Operando {nome}" com botão "Todas as lojas" (`ClientPortalShell.tsx:384-392`) — "o lojista nunca a vê" (comentário na própria linha 383).

---

## 9. Onde a UX atual mistura conceitos de agência e loja?

- **`/vendas` e `/esteira`** (seção 7) tratam o contexto de agência como se fosse sempre uma loja — comportamento herdado de quando essas telas só existiam para lojista, não atualizado quando passaram a ser acessíveis a quem opera portfólio.
- **Nomenclatura histórica**: a tabela e a rota `clientes`/`cliente` significam "loja", não "cliente da Zion" — o próprio código está ciente do risco e avisa explicitamente contra confusão: `roteamentoPapel.ts:69-70` ("⚠️ Usa a barra final para NÃO confundir com a rota da equipe `/clientes`") e `AppShell.tsx:220-221` repetem o aviso. A auditoria de agosto (`docs/product/ux/README.md:26`) já havia identificado isso como a emenda "Loja ≠ Cliente" pendente na interface. Continua sem resolução física de nome — apenas comentário de código alertando desenvolvedores, o usuário final não vê o nome da tabela mas vê os rótulos de rota/menu, que hoje ainda usam "Clientes" para a carteira de lojas.
- **Ausência de página "minha agência"**: não existe rota singular `/agencia` — os dados agregados da própria agência ficam fatiados entre a home de portfólio (`/`) e um card dentro de `/configuracoes` (tela compartilhada com a equipe, `configuracoes/page.tsx:29-30,34`). Não é mistura de conceitos dentro de uma tela, é uma lacuna de agrupamento.

---

## 10. Onde a navegação gera confusão?

- **`/otimizar-lote`** existe como rota de primeiro nível mas **não aparece** em `GRUPOS` (`src/components/layout/nav.ts:60-143`) — não está no menu, só é alcançável por link direto ou redirect legado. Coexiste com três rotas de nome muito próximo e propósito sobreposto: `/fila-otimizacao` (equipe), `/esteira/lote` e `/auditoria-massa/*`. Quatro rotas sobre "processar em lote/fila" com nomenclatura quase idêntica é sinal de alerta clássico da própria skill.
- **`/z`** é um shell experimental ("Vertical Slice Zero", `src/app/z/page.tsx:1-143`, importando de `src/shell/`, `src/mission/`, `src/design/foundation/`) — deliberadamente fora do menu (`SO_EQUIPE_FORA_DO_MENU`, `nav.ts:169`), mas continua no repositório, acessível por URL direta para a equipe, com testes próprios. Não é código morto, mas também não é produto — é uma segunda arquitetura paralela que nunca foi promovida.
- **Redirects em direção contrária ao alvo documentado**: `next.config.ts:132-147` redireciona `/lojas → /clientes`, `/anuncios → /esteira`, `/auditoria → /auditoria-massa`, `/loja/* → /cliente/*` — ou seja, os nomes "bonitos" que a auditoria de agosto definiu como endereços canônicos (`docs/product/ux/04-INFORMATION-ARCHITECTURE.md`) hoje são a ORIGEM do redirect, não o destino. O próprio arquivo documenta que a inversão é temporária, bloqueada pelo `redirect_uri` fixo do OAuth do Mercado Livre em `/cliente/conectar-ml` (`next.config.ts:127-131`).
- **`/cliente` (singular) vs `/clientes` (plural)**: funcionalmente não são duplicadas (uma é o portal de uma loja, outra é a carteira administrativa), mas a proximidade do nome já exigiu dois avisos em comentário de código para não confundir desenvolvedores — risco de confundir usuários também não pode ser descartado sem teste de uso real.

---

## MAP — o que existe hoje

### Entidades (tabela · existe como tipo TS? · sinônimo de)

| Termo | Tabela? | Tipo TS? | Observação |
|---|---|---|---|
| agencia | `agencias` (`054...sql:88-96`) | `PapelPerfil` inclui `"agencia"` como valor de papel, não como tipo de entidade próprio | mínima: id/nome/ativo/criado_em |
| cliente (loja) | `clientes` (`01-base-schema.sql:42-57`) | não há tipo `Loja` isolado revisado nos agentes; a tabela é referida por `clienteId: string` nas funções | é a "loja" do produto — nome legado |
| perfil | `perfis` (`005-portal-cliente.sql:18-24`) | `ContextoAutorizado.perfil` (`serverAuthorization.ts`) | 1:1 com `auth.users`; carrega `papel`, `cliente_id`, `agencia_id` |
| papel/role | coluna `text` em `perfis` | `PapelPerfil = "equipe"\|"cliente"\|"agencia"` (`roteamentoPapel.ts:12`) | união de strings, não enum nativo |
| membership | não existe hoje | não existe hoje | vínculo é coluna direta em `perfis`, não tabela de junção |
| marketplace | coluna `text` em `produtos`, `anuncios`, `canais_marketplace` (`009-marketplace-ml.sql:15`) | não existe hoje como tipo de entidade própria | filtro/dimensão, não nível de navegação |
| tokens OAuth | `canais_marketplace.refresh_token_cifrado` (`061...sql:54-56`), acesso só via funções `security definer` | não aplicável | detalhado na seção "5 perguntas extras" |

### Contextos (React)

- `LojaAtualProvider` (`src/lib/contexto/LojaAtualProvider.tsx`) — contexto global de loja, montado em `AppShell.tsx:269` e `ClientPortalShell.tsx:176-181`.
- Fora desses shells (`/z`, `/definir-senha`), o hook devolve um contexto `INERTE` (`LojaAtualProvider.tsx:69-75`).

### Cascas (shells)

- `AppShell.tsx` — equipe/agência ("operadores").
- `ClientPortalShell.tsx` — portal da loja, bifurcado em `CascaDoLojista` e `CascaOperando`, convergindo em `CascaDoPortal`.
- `src/shell/Frame/Frame.tsx` — experimental, só usado por `/z`.

### Roles / grupos de navegação

`src/components/layout/nav.ts`: `OPERADORES = ["equipe","agencia"]` (linha 57), `SO_EQUIPE = ["equipe"]` (linha 58), `SO_EQUIPE_FORA_DO_MENU = ["/z"]` (linha 169). `GRUPOS` (linhas 60-143) associa cada grupo de menu a uma `pergunta` de usuário e a uma lista de `papeis`.

### Rotas de primeiro nível, papel de acesso e pergunta respondida

| Rota | Acessa | Pergunta que responde | Candidata a fusão/remoção? |
|---|---|---|---|
| `/` | equipe, agência | "Qual loja precisa de mim agora, e como está cada uma?" | não |
| `/acessos` | equipe, agência | "Quem entra na minha agência/lojas, e em quê?" | não |
| `/agencias` | só equipe | "Quais agências existem e quantas lojas cada uma opera?" | não |
| `/agentes` | só equipe | "Quais agentes de IA existem e como estão implantados?" | não |
| `/ail/inteligencia`, `/ail/padroes` | só equipe | "O que a Zion decidiu/já sabe?" | não |
| `/auditoria-massa` | equipe, agência | "Quais anúncios têm defeito em massa?" | avaliar junto com `/otimizar-lote`, `/fila-otimizacao`, `/esteira/lote` |
| `/busca` | equipe, agência | "Onde está X no sistema?" | não |
| `/cliente/*` | lojista, ou equipe/agência "operando" | "O que importa agora nesta loja?" | não |
| `/clientes` | equipe, agência | "Quais lojas eu opero, e a situação de cada uma?" | não — mas nome colide com `/cliente` |
| `/configuracoes` | equipe, agência | "Quais são os dados/integrações da minha agência/equipe?" | parcialmente — deveria hospedar "meus dados de agência" com mais destaque (ver pergunta 9) |
| `/definir-senha` | pública | "Como eu ativo meu convite?" | não |
| `/esteira` | equipe, agência | "O que falta para publicar os anúncios em andamento?" | não (mas corrigir modo portfólio, ver seção 7) |
| `/fila-otimizacao` | só equipe | "Qual anúncio a equipe deve otimizar primeiro?" | avaliar consolidação com o grupo acima |
| `/otimizar-lote` | equipe, agência (por link, fora do menu) | "Como enfileiro a otimização completa de uma loja de uma vez?" | **sim** — órfã do menu, nome sobreposto ao grupo de auditoria em massa |
| `/pendencias` | equipe, agência | "O que está pendente, por loja?" | não |
| `/produtos` | equipe, agência | "Quais produtos existem, em que estágio?" | não |
| `/relatorios` | equipe, agência | "Quais relatórios foram entregues às lojas?" | não |
| `/templates` | só equipe | "Qual é o molde obrigatório de cada nicho?" | não |
| `/usuarios` | só equipe | "Quem tem acesso, e a quê?" | não |
| `/vendas` | equipe, agência | "Quanto cada cliente faturou/lucrou no ML?" | não (mas corrigir modo portfólio, ver seção 7) |
| `/z` | só equipe, fora do menu | nenhuma pergunta de produto — protótipo de arquitetura | **sim** — avaliar se continua valendo manter no repositório de produção |

Nenhuma rota foi apagada, movida ou proposta para remoção nesta sessão — apenas sinalizada.

### Componentes principais (inventário)

- **Card**: só duas famílias — `Card` (`src/components/ui/Card.tsx:8`) e `StatCard` (`src/components/ui/StatCard.tsx:29`). Não há `MetricCard`/`KpiCard` concorrentes.
- **Tabela**: uma família — `Table` (+ `Td`/`TdMain`/`EmptyRow`) em `src/components/ui/Table.tsx`, com transformação responsiva "linha vira cartão" via `.tabela-cartao` (`globals.css:196-303`).
- **Modal/Dialog**: uma primitiva base `Dialog` (`src/components/ui/Dialog.tsx:41`), mas migração incompleta — 4 modais ad-hoc (`fixed inset-0` sem `role="dialog"`/foco preso/Esc) ainda não migrados: `CadastrarProduto.tsx:118`, `PublicarAnuncio.tsx:168`, `cliente/produtos/page.tsx:1338,1388`.
- **Switcher**: `SeletorDeLoja.tsx` — ativo, com Ctrl+K, usa `Dialog`.
- **Indicadores de contexto**: `TrilhaDeContexto` (`AppShell.tsx:153-183`, breadcrumb no header) e a faixa "Operando" (`ClientPortalShell.tsx:384-392`).
- **IA contextual**: `AssistenteDaAgencia`/`PainelDoAssistente` embutido nas telas do `AppShell` (só aparece com loja escolhida) e no portal; `ExecutarComAgente` como gatilho inline que abre a rota isolada `/agentes/[id]`.
- **Design tokens**: dois sistemas não integrados — produção usa um núcleo pequeno de tokens em `globals.css` (`--surface-*`) sobre Tailwind majoritariamente hardcoded; `src/design/foundation/*` é um sistema tokenizado completo, mas isolado para `/z`, com comentário explícito proibindo seu uso em produção.

---

## Cinco perguntas extras que decidem a arquitetura

**1. Todo cadastro cria uma agência por baixo dos panos? Existe caminho para loja independente?**
Não. Dois caminhos de criação de loja, ambos gravando em `clientes`:
- Autocadastro independente — `POST /api/loja/provisionar` (`src/app/api/loja/provisionar/route.ts:94-105`) cria a loja sem `agencia_id` no INSERT (fica `NULL`, o padrão). Comentário no cabeçalho chama isso de "a porta de entrada do SaaS".
- Loja de agência — `POST /api/agencia/loja` (`src/app/api/agencia/loja/route.ts:83-96`), só para quem já tem `papel==="agencia"`, grava `agencia_id` vindo do perfil do chamador (nunca do corpo da requisição).
Criar uma **agência** em si exige ação da equipe Zion (seção 1) — mas criar uma **loja sem agência** é o caminho padrão e self-service.

**2. Marketplace é dimensão (filtro) ou virou nível de navegação?**
É dimensão. `produtos.marketplace`, `anuncios.marketplace`, `canais_marketplace.marketplace` são colunas `text` (`01-base-schema.sql:120,147`; `009-marketplace-ml.sql:15`). Não existe rota `/marketplace` (busca em `src/app` não encontrou nada), nem item de menu "Marketplace" em `nav.ts`. A navegação é organizada por "Lojas/Operação/Acompanhamento/Zion", com marketplace aparecendo só como atributo dentro dessas telas.

**3. Existe alguma rota ou query que leia dado sem filtro de tenant, ou usando service_role?**
Não foi encontrada, na amostragem feita (~40 usos de `getSupabaseAdmin()` verificados), nenhuma rota que use `service_role` **sem** aplicar filtro de tenant no código, antes ou junto da chamada — o padrão dominante é `exigirAcessoAoCliente`/`exigirAutenticado` antes de qualquer função `service_role`-scoped, com `clienteId` sempre vindo do servidor, nunca do corpo cru da requisição. Exceção por desenho: `src/app/api/otimizar/worker/route.ts` (cron) processa a fila de **todos os tenants** deliberadamente, autorizado por `CRON_SECRET` (`src/lib/auth/autorizacaoDoCron.ts:32-66`, fail-closed em produção), não por tenant — é um processador de fila, não uma leitura pública de dado de tenant específico.
Ressalva importante: essa disciplina **já falhou uma vez**, historicamente — ver o achado da migração 041 na pergunta 5 do UNDERSTAND. O modelo de segurança hoje é estruturalmente correto mas depende de toda rota nova lembrar de aplicar o filtro; não há um mecanismo automático (linter, tipo, wrapper obrigatório) que impeça uma nova rota de esquecer. Ver `02-problems.md`.

**4. Onde ficam os tokens de OAuth de marketplace, e o que impede uma loja de ler os da outra?**
`canais_marketplace.refresh_token_cifrado` (`bytea`, cifrado com `pgp_sym_encrypt`, chave em `vault.secrets` — `database/migrations/061-a-credencial-do-ml-cifrada-em-repouso.sql:34-56`). A coluna de texto puro original foi **removida** (`062-o-texto-puro-da-credencial-vai-embora.sql:23`). Acesso só via 4 funções `security definer` (`ml_credencial_ler/gravar/rotacionar/limpar`) com `EXECUTE` restrito a `service_role`. O que impede uma loja de ler a de outra: (a) RLS `agencia_escopo` foi **removida** dessa tabela (`059-a-credencial-do-ml-sai-do-alcance-do-navegador.sql:69`); (b) `REVOKE ALL ... FROM authenticated` seguido de `GRANT` só nas colunas não sensíveis (`059:75-82`) — nenhuma sessão de navegador, de nenhum papel, alcança a coluna do token; só `service_role` no servidor, sempre depois de `exigirAcessoAoCliente`. Um índice único parcial (`085-uma-conta-do-ml-pertence-a-uma-loja.sql:78-80`) impede duas lojas ativas apontarem para a mesma conta ML.

**5. Existe conceito de "quando esse dado foi coletado" em alguma tabela?**
Sim. `anuncios_gerados.criado_em_ml` e `atualizado_em_ml` (`database/migrations/074-o-que-o-ml-diz-e-o-zion-descartava.sql:53-59`) — timestamps que vêm do Mercado Livish (`date_created`/`last_updated` do lado do ML), nullable sem default, distintos de `created_at`/`updated_at` (quando o **Zion** gravou a linha, via trigger `set_updated_at()`). Comentário na migração: "null = o ML não disse, ou ninguém perguntou ainda [...] é a mesma regra que já vale para `status_marketplace`: vazio ≠ negado ≠ desconhecido."

---

## Nota metodológica

Toda a descoberta acima foi feita por quatro agentes de leitura em paralelo (schema/entidades, rotas/navegação, auth/permissões, componentes/UX), cada um instruído a citar arquivo:linha e escrever "não existe hoje" na ausência de evidência. Não foi lido nenhum arquivo `.env`/`.env.*`. Nenhum arquivo de produto foi criado, editado ou apagado.
