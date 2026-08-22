# Current Experience — Zion OS

Data: 2026-08-21 · Versão: 1 · Commit analisado: `36e1828`
Série: auditoria de produto/UX (skill `zion-product-ui-ux`). Documentos: 01 → 07.

> Este documento descreve **como o sistema funciona hoje**, com citação de arquivo:linha. Não propõe nada. Onde algo não existe, está escrito "NÃO EXISTE HOJE" — a ausência é achado.

## Stack detectada

| Camada | O que é | Evidência |
|---|---|---|
| Framework | Next.js 16.2.10, App Router em `src/app`, React 19.2.4 | `package.json:16-22` |
| Renderização | ~53 de 55 páginas são `"use client"`; só `agentes/novo` e `clientes/novo` são Server Components. Sem Server Actions (`"use server"` = 0). Sem `middleware.ts`/`proxy.ts`. | `src/app/page.tsx:1`; `next.config.ts` (comentário: sem middleware por decisão) |
| Dados | Supabase JS direto do navegador (repositório genérico) + rotas `/api/*` para escrita sensível | `src/lib/services/clientes.ts:10-17`; `src/app/api/**` |
| Auth | Supabase Auth; gate em React (`AuthGate`), guards em API routes, RLS no banco | `src/components/auth/AuthGate.tsx:353-503`; `src/lib/auth/serverAuthorization.ts:87-136` |
| UI | Tailwind v4 + lucide-react; sem shadcn/CVA/clsx. Primitivas próprias em `src/components/ui` | `src/app/globals.css:1`; `src/components/ui/*` |
| Design tokens | Existe um design system tokenizado (`src/design/foundation`, `src/design/semantic`) — **carregado apenas em `/z`** | `src/app/z/page.tsx:13-14`; `src/app/layout.tsx:3` carrega só `globals.css` |
| Estado de servidor | `useLiveQuery` próprio + `RealtimeSync`; sem React Query/SWR | `src/lib/hooks`; `src/components/auth/RealtimeSync.tsx` |
| Estado de cliente | Context API: `ClientPortalProvider` (portal), `MissionProvider` e `ShellProvider` (só `/z`) | `src/components/client-portal/context.tsx:20`; `src/shell/providers/ShellProvider.tsx` |
| i18n | pt-BR com rótulos em inglês misturados ("Dashboard", "Templates", "Decision Intelligence", "Status", "Score", "Powered by") | `src/components/layout/nav.ts:29,33,43`; `src/app/auditoria-massa/page.tsx:63-78` |

## Modelo de domínio atual

```
auth.users ──1:1── perfis (papel: 'equipe' | 'cliente' | 'agencia')
                     ├── cliente_id  → clientes   (quando papel = cliente)
                     └── agencia_id  → agencias   (quando papel = agencia)

agencias (054) ──1:N── clientes.agencia_id (NULL = loja self-service, o padrão)
                          │
                          └── TUDO que é operacional pendura em clientes.id (cliente_id):
                              produtos, produto_variantes, anuncios_gerados, canais_marketplace,
                              auditorias_anuncios, fila_otimizacao*, pendencias, relatorios,
                              copilot_*, consumo_ia, infracoes_marketplace, imagens_produto…

Fora da raiz:  agentes, execucoes_agentes, categoria_templates   (globais, só equipe)
               decisoes, padroes, ofertas, conhecimentos, delegacoes (AIL) → chave `empresa` TEXT sem FK
Dormente:      organizacoes / produto_mestre (migrations 017-021 arquivadas, nunca aplicadas;
               mas `organizacaoId` continua vivo no TypeScript de domínio)
```

Evidência: `database/migrations/054-a-agencia-como-cliente.sql:17,73-78,97-104,110-111,124-129`; `database/migrations/005-portal-cliente.sql:18-24`; `database/_legado/supabase-schema.sql:20-35,85-140`; `database/migrations/022-decision-journal.sql:16-19`; `database/migrations/arquivadas/README.md:3,12-15`; `src/domain/produto-mestre/produto-mestre.ts:55,80,101`.

**Raiz de tenancy: `cliente_id` (a loja).** A `agencia_id` é um agrupador acima da loja, deliberadamente não uma segunda raiz de dados (`054:37-44`: "Uma agência NÃO é uma loja"). Há **três raízes concorrentes**, duas dormentes: `cliente_id` (ativa), `empresa` text no AIL (ativa, desacoplada, sem FK), `organizacao_id` (dormente no banco, viva no TS).

## As dez perguntas

**1. Como o sistema entende uma agência?**
Duas acepções concorrentes. (a) A **agência-cliente**: tabela `agencias` (`054:73-78`), papel `agencia` em `perfis.papel`, lojas via `clientes.agencia_id`; funções `agencia_do_usuario()` / `lojas_da_agencia()` (`054:140-166`); policy `agencia_escopo` aplicada por laço a toda tabela com `cliente_id` (`054:212-240`), com exclusões deliberadas: `perfis`, `financeiro` (055a), `tarefas`/`reunioes` (055b), `canais_marketplace` (059). (b) A **Zion-como-agência**: "O 'tenant' é a própria agência Zion" (`src/lib/services/usuarios.ts:9-10`); o painel `/` chama-se "Painel da Agência" (`src/lib/auth/roteamentoPapel.ts:3-4`). **No TypeScript a agência não existe como entidade** — não há `interface Agencia`; só `agenciaId: string | null` em `PerfilServidor` (`serverAuthorization.ts:43-44`) e o literal `"agencia"` (`roteamentoPapel.ts:10`). **Não existe caminho no código para criar usuário ou agência `agencia`**: `PAPEIS_PERMITIDOS = ["equipe","cliente"]` (`usuarios.ts:12`, validação `:58-61`); nasce por `insert` manual no banco.

**2. Como entende um lojista?**
`perfis.papel = 'cliente'` + `perfis.cliente_id` (`005:20-21`). Experiência própria em `/cliente/*` com casca `ClientPortalShell` (`src/app/cliente/layout.tsx:3-5`). Nasce por convite da equipe (`POST /api/usuarios`, guard `exigirEquipe`, `route.ts:66`) ou self-service (`POST /api/loja/provisionar` cria loja + perfil juntos, `provisionar/route.ts:111-117`). Um lojista = uma loja; não há suporte a lojista com duas lojas.

**3. Como representa uma loja?**
Tabela `clientes` (`_legado/supabase-schema.sql:20-35`): `empresa` (nome), `status`, `risco`, `plano`, `marketplaces` jsonb, `agencia_id` nullable, `limite_esteira_mes`, `margem_minima`, custos do lojista. Tipo TS `Cliente` (`src/lib/types.ts:25`) / `ClienteRow` (`database.types.ts:7`). **Não existe tabela `lojas` nem tipo `Loja`**; "loja" é vocabulário de comentário e de função SQL (`lojas_da_agencia()` retorna `clientes.id`). Consequência de UX: a mesma entidade chama-se "Cliente" no painel (`nav.ts:30`), "Portal do Cliente" na casca do lojista (`ClientPortalShell.tsx:57`), "sua loja" no texto (`src/app/cliente/page.tsx:252,337`), "Empresa" na coluna (`clientes/page.tsx:18`) e "conta" nas infrações (`cliente/produtos/page.tsx:875`).

**4. Como usuários se relacionam com agência e loja?**
**1 : 0..1, sem tabela de junção.** `perfis.id` é PK e FK de `auth.users` (`005:19`); `cliente_id` e `agencia_id` são colunas escalares; a constraint `perfis_forma_do_papel` torna as três formas mutuamente exclusivas (`054:124-129`). Um usuário de agência alcança N lojas apenas via `lojas_da_agencia()` (função, não membership). Uma loja pertence a no máximo uma agência (`054:97-101`). **NÃO EXISTE HOJE**: operador de agência com subconjunto de lojas; usuário em duas agências; lojista com duas lojas.

**5. Como funcionam permissões?**
Role **global**, string livre em `perfis.papel text` sem enum/CHECK próprio (`005:21`); três valores (`equipe | cliente | agencia`) fechados no TS por `lerPapel` fail-closed (`roteamentoPapel.ts:43-47`). Aplicação em camadas:
- **Banco (RLS)** — camada real. `equipe_total` deny-by-default em 29 tabelas (`041:134-137`), `cliente_escopo` por `cliente_do_usuario()` (`006:35-38`), `agencia_escopo` por `lojas_da_agencia()` (`054:233-238`). Fragilidade documentada: o laço da 054 rodou uma vez; tabela nova nasce sem `agencia_escopo` (`verificacoes/alcance-da-agencia.sql:28-32`).
- **API routes** — `exigirAutenticado` (10 rotas), `exigirEquipe` (só `/api/usuarios`), `exigirCliente` (só `/api/loja/renomear`), `exigirAcessoAoCliente` (14 rotas `/api/ml/*`); `avaliarAcesso` exige `agenciaOperaOCliente === true` para agência (`serverAuthorization.ts:126-130`). **Não existe `exigirAgencia`**. Fail-open declarado em modo demo sem env (`:216-219`).
- **Rota (client-side)** — `decidirRota` + `router.replace` num `useEffect` (`AuthGate.tsx:512-528`); o próprio arquivo diz "Isto NÃO substitui a segurança" (`roteamentoPapel.ts:7-8`).
- **Menu (front)** — `navDoPapel` é allowlist de 10 rotas para agência (`nav.ts:91-108`). **Só o front esconde** `/`, `/agentes`, `/ail/*`, `/templates`, `/configuracoes`, `/usuarios/novo` da agência: `decidirRota` devolve `ok` para qualquer rota fora de `/cliente/*` (`roteamentoPapel.ts:112-127`); o que segura é o RLS esvaziando os dados (`nav.ts:88-89`). → Sinalizado como risco de segurança para a skill `zion-saas-security-audit` (não é escopo desta auditoria).

**6. Como o usuário troca de loja?**
**NÃO EXISTE HOJE** para agência/equipe. Não há `currentClient`, store global, cookie ou searchParam compartilhado. Cada tela tem seu `useState` com defaults divergentes: `""` ("Todos") em `/esteira:51`; auto-seleciona o **primeiro cliente** em `/otimizar-lote:25-28` e `/vendas:34-43`; `"Todos"` por **nome de empresa** em `/produtos:36`, `/auditoria-massa:84`, `/esteira/lote:106`, `/fila-otimizacao:50`, `/pendencias:41`, `/relatorios:27`; obrigatório em `/auditoria-massa/importar:44`. Chave inconsistente: 4 telas guardam `id`, 6 guardam `empresa` (nome); formulários passam `?cliente=<empresa>` (`clientes/[id]/page.tsx:47`), só `/cliente/conectar-ml` passa `?cliente=<id>` (`clientes/page.tsx:102`). **F5 perde a seleção**; em `/vendas` e `/otimizar-lote` F5 **troca silenciosamente para a primeira loja da lista**. Para o lojista o contexto vem do perfil (`ClientPortalShell.tsx:137-141`) e sobrevive a F5 — mas ele nunca escolhe, ele *é* a loja.

**7. Como a agência visualiza várias lojas?**
Pelas **mesmas telas da equipe** com menu filtrado (`navDoPapel`, `nav.ts:105-108`): `/clientes` (lista, `clientes/page.tsx:63-118`) e listas globais com filtro local. **NÃO EXISTE HOJE**: visão de portfólio (a home `/` está fora do menu da agência, `nav.ts:91-102`), comparação entre lojas, indicador de "loja em risco" com definição, "operar a loja X" (impersonação/view-as — documentado como não implementado em `docs/agency-panel-separation/07-PENDENCIAS-FUTURAS.md:5-10`; as RPCs `portal_*` usam `cliente_do_usuario()` sem parâmetro, `perfil.ts:121-134`). A única porta da agência para dentro do portal é `/cliente/conectar-ml?cliente=<id>` (`roteamentoPapel.ts:114-127`; `ClientPortalShell.tsx:212-231`), e mesmo ali **não aparece o nome da loja sendo conectada**, só o do operador (`:223`).

**8. Como o lojista visualiza a própria loja?**
Portal `/cliente/*`, 17 telas em 5 áreas organizadas por pergunta (`src/modules/portal/domain/navegacao.ts:49-110`: Hoje · Catálogo · Anúncios · Pulso · Zion), já alinhado a UX-010. Home `/cliente` com bloco principal "O que importa agora" (3 lacunas mais bloqueantes com link de resolução, `src/components/client-portal/OQueImportaAgora.tsx:17-51`), 7 `StatCard` não clicáveis (`cliente/page.tsx:274-315`), três estados tratados (`:234,240,271`). Assistente de IA em toda tela do portal, com contexto de `?produto=` (`ClientPortalShell.tsx:302-306`; `PainelDoAssistente.tsx:45-47`). Marketplace no header é **inferido** (mais frequente nos produtos; fallback "Mercado Livre", `ClientPortalShell.tsx:143-150`), não escolhido.

**9. Onde a UX mistura conceitos de agência e loja?**
- O painel `/` serve **três** públicos (Zion-equipe, agência-cliente e, por design, nenhum lojista) com uma lista de 17 ferramentas; a agência recebe 10 delas escondendo o resto (`nav.ts:28-46,91-108`) — exatamente "mesmo dashboard + menus escondidos conforme a role".
- A sidebar da agência mostra "Zion OS / Zion Company" (`AppShell.tsx:29-30`) — a marca da Zion, não o nome da agência nem da loja.
- "Clientes" na agência = lojas; "Portal do Cliente" no lojista = ele mesmo; VOC-001 define Cliente = quem contrata a Zion e Comprador = quem compra (`docs/product/VOC-001-canonical-vocabulary.md:98-99`), mas a UI não segue.
- "Pendências" com dois significados (pendências internas × infrações do ML), reconhecido no código (`cliente/page.tsx:73-80`), mas a palavra na tela é uma só.
- `/esteira/aprovacoes` não tem seletor de loja: a lista vem misturada entre lojas (relatório de rotas, fluxo de 8 passos).
- Enquanto `meuPerfil()` não resolve, a agência vê o **menu completo da Zion** por um instante a cada carga (`AppShell.tsx:82-88,122`).

**10. Onde a navegação gera confusão?**
- Menu plano de 17 itens (equipe) / 10 (agência) sem agrupamento, ordem por ferramenta, não por pergunta (`nav.ts:28-46`) — o anti-padrão que `docs/product/UX-010:188` chama de "menu infinito"; o portal já saiu dele, o painel não.
- Quatro itens são a mesma família "otimização" espalhada: Esteira de Anúncio, Otimizar em Massa, Fila de Otimização, Aprovações (`nav.ts:34-38`), mais `/esteira/lote` só alcançável por link interno (`esteira/page.tsx:185`).
- "Novo Usuário" é item de menu sem lista `/usuarios` (`nav.ts:31`).
- `/busca` só existe pelo campo do header, que é `hidden sm:flex` — **no celular não há porta** (`AppShell.tsx:139,185`).
- Três navegações coexistem: `NAV_ITEMS`, `AREAS` do portal, e `NAV` hard-coded de `/z` com os mesmos cinco rótulos (`src/app/z/page.tsx:50-56`).
- `/z` (Vertical Slice Zero: Shell + Mission + Runtime + design tokens próprios) é uma **segunda arquitetura de aplicação** sem nenhum `href` no repositório, alcançável só digitando a URL (`AppShell.tsx:98-101`).
- No portal, `/cliente/conectar-ml` (onboarding crítico) só aparece depois de abrir a área "Zion" (`ClientPortalShell.tsx:94`).

## Inventário

### Rotas (resumo; tabela completa com "pergunta que responde" em anexo A)

| Grupo | Rotas | Perfil | Contexto de loja na URL? | No menu? |
|---|---|---|---|---|
| Painel — portfólio/listas | `/`, `/clientes`, `/produtos`, `/pendencias`, `/vendas`, `/relatorios` | E (+A exceto `/`) | Não (filtro local) | Sim |
| Painel — otimização | `/esteira`, `/esteira/lote`, `/esteira/aprovacoes`, `/otimizar-lote`, `/auditoria-massa`, `/auditoria-massa/importar`, `/fila-otimizacao` | E+A | Não (select local) | Sim, menos `/esteira/lote` e `/importar` |
| Painel — Zion interno | `/usuarios/novo`, `/templates`, `/agentes/*`, `/ail/*`, `/configuracoes` | E (A só escondida) | `/agentes/[id]?cliente=` | Sim |
| Painel — detalhe/forms | `/clientes/[id]`, `/clientes/[id]/editar`, `/clientes/novo`, `/produtos/[id]`, `/produtos/novo?cliente=<empresa>`, `/produtos/importar`, `/pendencias/nova`, `/relatorios/novo`, `/relatorios/[id]/editar`, `/auditoria-massa/[id]` | E+A | `[id]` = objeto; `?cliente=` = nome | Não (links) |
| Painel — escondidas | `/busca` (só header desktop), `/z` (sem link) | E+A / E | — | Não |
| Portal | `/cliente` + 16 subrotas | C | Nunca (perfil) — exceto `/cliente/conectar-ml?cliente=<id>` | Sim (5 áreas) |
| Públicas | `/definir-senha`, `/not-found` | P | — | — |

### Navegação atual

```
EQUIPE (17, plano)                AGÊNCIA (10, mesma lista filtrada)      LOJISTA (5 áreas / 17 telas)
Dashboard                         —                                       Hoje  "O que importa agora?"
Clientes                          Clientes                                  Visão geral · Assistente · Pendências
Novo Usuário                      —                                       Catálogo  "O que sabemos dos produtos?"
Produtos                          Produtos                                  Produtos · Fotos · Peso e caixa · Medidas · Precificação
Templates                         —                                       Anúncios  "Como dizemos e prometemos?"
Esteira de Anúncio                Esteira de Anúncio                        Criar anúncio · Meus anúncios · Auditoria · Ferramentas avulsas
Otimizar em Massa                 Otimizar em Massa                       Pulso  "Como está a loja?"
Aprovações                        Aprovações                                Vendas · Relatórios
Auditoria em Massa                Auditoria em Massa                      Zion  "O que combinamos?"
Fila de Otimização                Fila de Otimização                        Configurações · Conexão com o ML · Ajuda
Agentes IA                        —
Pendências                        Pendências
Vendas                            Vendas
Memória (AIL)                     —
Decision Intelligence             —
Relatórios                        Relatórios
Configurações                     —
```

Fontes: `src/components/layout/nav.ts:28-108`; `src/modules/portal/domain/navegacao.ts:49-110`.

### Componentes

| Família | Variações encontradas | Usos | Duplicação? |
|---|---|---|---|
| Card / tile numérico | `Card` (`ui/Card.tsx:8`), `StatCard` (`ui/StatCard.tsx:23`), tiles inline (`src/app/page.tsx:122-137`), `ActionTile` (`client-portal/ui.tsx:56`) | 35 / 12 / 1 / — | Parcial: mesma caixa `bg-[#0e0e16]` reimplementada 4× |
| Badge / Pill | `Badge` (`ui/Badge.tsx:20`), `Pill` (`client-portal/ui.tsx:45`) | 31 / 16 | **Sim, quase literal**: mesmo mapa `Tone → classes` copiado (`Badge.tsx:2-11` × `ui.tsx:10-19`) |
| Table | `Table` (`ui/Table.tsx:97`) + 10 arquivos com `<table>` cru | 15 / 10 | Sim: as cruas perdem tabela→cartão no celular (`globals.css:123-197`) e `carregando` |
| Modal / Dialog | `ModalPublicar` local (`esteira/aprovacoes/page.tsx:381`), `PainelDoAssistente:101`, `Mission.tsx:99`, + 8 `fixed inset-0` ad hoc | — | **Sim, sem primitiva**; só `Mission` declara `aria-modal` |
| Button | `Button`/`LinkButton` 4 variantes (`ui/Button.tsx:3`) + 107 `<button>` crus | 56 arquivos / 158 usos | ~40% dos botões ignoram a primitiva (perdem `min-h-11` em toque) |
| EmptyState | `EmptyState` (`ui/EmptyState.tsx:12`), `VazioAmigavel` (`client-portal/ui.tsx:125`), `EmptyRow` (`Table.tsx:283`), inline (`cliente/medidas:318`, `cliente/produtos:997`) | 21 / — / — / 2 | Sim, quatro formas |
| Skeleton | `EsqueletoDeTexto/Bloco/Tabela`, `Superficie` (`ui/Skeleton.tsx`) + 32 `animate-spin` inline | 8 páginas | Subutilizada |
| Form | `Field/Input/TextArea/Select/FormGrid` (`ui/form.tsx`), `FilterSelect` + 44 `<input>`, 23 `<select>`, 5 `<textarea>` crus; classe de input copiada em 4 arquivos | 17 / 13 | Sim, alta |
| Sidebar | `AppShell.tsx:13-67`, `ClientPortalShell.tsx:44+`, `shell/Navigation` | — | Três; as duas primeiras com markup idêntico (`bg-[#0b0b12]`, logo gradient) |

### Roles e permissões

| Role | Definida em | Aplicada em | Escopo |
|---|---|---|---|
| `equipe` | `perfis.papel` (string, `005:21`); `PapelPerfil` (`roteamentoPapel.ts:10`) | RLS `equipe_total` (29 tabelas); `exigirEquipe` (1 rota); menu completo | Global — tudo |
| `agencia` | idem + `perfis.agencia_id` (`054:110`) | RLS `agencia_escopo` (25 tabelas, 6 excluídas); `avaliarAcesso` com `clienteAlvo`; menu allowlist de 10 | Global — lojas com `agencia_id` igual; **sem guard de rota** |
| `cliente` | idem + `perfis.cliente_id` (`005:20`) | RLS `cliente_escopo`; `exigirCliente` (1 rota); `decidirRota` → `/cliente` | Global — uma loja |

Não existe role por tenant, nem distinção papel-na-agência × papel-na-loja, nem `exigirAgencia`, nem criação de `agencia` pela UI.

### Contextos

| Contexto | Fonte de verdade | Persistência | Telas que consomem |
|---|---|---|---|
| Loja do lojista | `perfis.cliente_id` → `ClientPortalProvider` (`context.tsx:22-30`) | Banco (sobrevive a F5) | Todas de `/cliente/*` via `useClientPortal()` |
| Marketplace do lojista | Inferido dos produtos (`ClientPortalShell.tsx:143-150`) | Nenhuma | Header do portal |
| Loja da agência/equipe | **NÃO EXISTE** — 10 `useState` locais | Nenhuma (F5 zera; 2 telas auto-selecionam a primeira loja) | `/esteira`, `/esteira/lote`, `/otimizar-lote`, `/vendas`, `/produtos`, `/auditoria-massa`, `/auditoria-massa/importar`, `/fila-otimizacao`, `/pendencias`, `/relatorios` |
| Agência do usuário | `perfis.agencia_id` → `PerfilServidor.agenciaId` | Banco | Só `avaliarAcesso` e `navDoPapel`; **nenhuma tela mostra o nome da agência** |
| Produto aberto (assistente) | `?produto=` na URL (`PainelDoAssistente.tsx:45-47`) | URL | Painel do assistente |

## Fluxos atuais

**Agência — auditar, priorizar e otimizar a Loja B (fluxo real do código):**

| Passo | Tela | Ação | Estado do contexto |
|---|---|---|---|
| 1 | `/auditoria-massa/importar` | escolhe Loja B no select obrigatório (`:121`) | local |
| 2 | `/auditoria-massa` | filtro volta a "Todos"; escolhe Loja B (`:264`) | perdido, re-escolhe |
| 3 | `/fila-otimizacao` | "Todos" → Loja B (`:105`) | re-escolhe |
| 4 | `/esteira/lote` | "Todos" → Loja B (`:258`) | re-escolhe |
| 5 | `/otimizar-lote` | **já veio na Loja A** (primeira da lista); troca (`:28,130`) | errado por padrão |
| 6 | `/esteira/aprovacoes` | sem seletor; lista misturada | sem contexto |
| 7 | `/vendas` | **já veio na Loja A**; troca (`:41,80`) | errado por padrão |
| 8 | `/produtos` | "Todos" → Loja B (`:102`) | re-escolhe |

**≈ 7 seleções da mesma loja para um trabalho só; zero persistem; em 2 passos o default é outra loja.** Indicador permanente de "operando Loja B": nenhum (`AppShell.tsx:163-214` mostra título do menu, busca, e-mail, avatar, Sair).

**Agência — conectar o ML de uma loja:** `/clientes` → link "Conectar ML" (`clientes/page.tsx:102`) → `/cliente/conectar-ml?cliente=<id>` com header "← Voltar para as lojas" (`ClientPortalShell.tsx:212-231`) → OAuth → ticket (`/api/ml/conectar`, `exigirAcessoAoCliente`). 3 cliques; funciona; mas a tela não diz *qual* loja está sendo conectada.

**Lojista — do "o que importa agora" à ação:** login → `/cliente` (redirect client-side, `AuthGate.tsx:518`) → `OQueImportaAgora` lista 3 lacunas com link → tela-alvo (`/cliente/peso?produto=`, `/cliente/imagens?produto=`…) → assistente disponível com o produto em contexto. 2 cliques do insight à tela do problema. Bom.

**Lojista — onboarding self-service:** cadastro Supabase → `sem_perfil` → `TelaMontarLoja` (`AuthGate.tsx:216-220`) → `POST /api/loja/provisionar` → `/cliente` → área "Zion" → "Conexão com o Mercado Livre" (2 cliques escondidos) → importar anúncios. A conexão do ML, que é o primeiro valor, não é o primeiro passo visível.

**Agência — onboarding:** **NÃO EXISTE HOJE.** Criar agência e vincular lojas é `insert` manual no banco (`054:62-64`; nenhuma rota escreve `agencia_id`).

---

## Anexo A — Rotas com a pergunta que cada tela responde

| Rota | Pergunta | Evidência |
|---|---|---|
| `/` | "Como está a operação inteira da Zion hoje?" (6 StatCards + 4 tiles; "Produtos em cadastro" duas vezes; sem delta, sem CTA, sem loading/erro) | `src/app/page.tsx:89-142` |
| `/clientes` | "Quais lojas tenho e quais ainda não conectaram o ML?" | `clientes/page.tsx:96-105` |
| `/clientes/[id]` | "Visão 360° desta loja" (única rota da agência com id de loja na URL) | `clientes/[id]/page.tsx:31-76` |
| `/produtos` | "Base de produtos de todas as lojas e estágio de cadastro" | `produtos/page.tsx:93` |
| `/esteira` | "Rodar diagnóstico→SEO→construção→revisão num produto" | `esteira/page.tsx:181` |
| `/esteira/lote` | "Rodar a esteira em N anúncios priorizados" | `esteira/lote/page.tsx:250` |
| `/esteira/aprovacoes` | "O que a esteira produziu está apto a publicar?" | `esteira/aprovacoes/page.tsx:213` |
| `/otimizar-lote` | "Enfileirar a esteira completa de uma loja no servidor" | `otimizar-lote/page.tsx:124` |
| `/auditoria-massa` | "De 1.000 anúncios, onde a otimização rende mais?" | `auditoria-massa/page.tsx:202` |
| `/fila-otimizacao` | "Em que ordem atacar os anúncios críticos?" | `fila-otimizacao/page.tsx:90` |
| `/pendencias` | "O que está travado esperando a loja?" | `pendencias/page.tsx:59` |
| `/vendas` | "Quanto esta loja faturou/lucrou no ML (7/30/90d)?" | `vendas/page.tsx:77` |
| `/relatorios` | "Que relatórios de período existem por loja?" | `relatorios/page.tsx:40` |
| `/templates` | "O que é obrigatório por categoria de marketplace?" | `templates/page.tsx:32` |
| `/agentes`, `/agentes/[id]` | "Quais agentes existem / executar um agente" | `agentes/page.tsx:29`; `agentes/[id]/page.tsx:70` |
| `/ail/padroes`, `/ail/inteligencia` | "O que a Zion aprendeu / estado da inteligência" | `ail/padroes/page.tsx:52`; `ail/inteligencia/page.tsx:55` |
| `/usuarios/novo` | "Criar conta + convite" (sem lista `/usuarios`) | `usuarios/novo/page.tsx:79` |
| `/configuracoes` | "Dados da agência Zion, equipe e integrações" | `configuracoes/page.tsx:28` |
| `/busca` | "Onde está X?" (sem porta no celular) | `busca/page.tsx:28`; `AppShell.tsx:185` |
| `/z` | "Vertical Slice Zero" — protótipo isolado | `z/page.tsx:3-11` |
| `/cliente` | "O que importa agora na minha loja?" | `cliente/page.tsx:34,217-228` |
| `/cliente/assistente` | "Conversar sobre a operação" | `cliente/assistente/page.tsx:29` |
| `/cliente/pendencias` | "O que falta nos anúncios e na conta do ML?" | `cliente/pendencias/page.tsx:48` |
| `/cliente/produtos` | "Minha base e o que otimizar em cada item" | `cliente/produtos/page.tsx:756` |
| `/cliente/imagens`, `/peso`, `/medidas`, `/precificacao` | Lacunas de catálogo (foto, peso, medidas, preço) | respectivos `page.tsx` |
| `/cliente/anunciar` | "Do produto ao anúncio no ar, um passo por vez" | `cliente/anunciar/page.tsx:557` |
| `/cliente/anuncios` | "Estado dos meus anúncios na palavra do ML" | `cliente/anuncios/page.tsx:181` |
| `/cliente/auditoria` | "O que corrigir primeiro para vender mais?" | `cliente/auditoria/page.tsx:107` |
| `/cliente/otimizar` | "Ferramentas de IA avulsas" | `cliente/otimizar/page.tsx:280` |
| `/cliente/vendas`, `/relatorios` | "Quanto faturei / o que a Zion fez" | respectivos `page.tsx` |
| `/cliente/configuracoes`, `/conectar-ml`, `/ajuda` | Conta, conexão ML, ajuda | respectivos `page.tsx` |
