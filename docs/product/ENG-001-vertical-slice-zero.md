# ENG-001 — Vertical Slice Zero

> A primeira implementação constitucional: a **menor** fatia que atravessa
> todos os estratos (Shell → Contexto → Missão → Runtime → Capability → AIL →
> Memory → Eventos → Resultado) num único fluxo. Não entrega funcionalidades —
> **valida a arquitetura**. Fontes: toda a Constituição + o repo real.

## Decisão de engenharia nº 0 — internal boundaries, não monorepo (ainda)

O repo é **um app Next.js único** (`src/`), com a **AIL viva** em
`src/modules/adaptive-intelligence/` e a operação da Chinelaria **em produção**.
As Leis 8 (não duplicar a AIL) e 9 (usável por cliente real) tornam a migração
para monorepo o caminho de maior risco para a slice zero.

> **Decisão:** as camadas do monorepo especificado viram **fronteiras de módulo
> impostas dentro do app atual** (`src/design/`, `src/shell/`, `src/mission/`,
> `src/runtime/`, `src/contracts/`, `src/capabilities/`, e o adapter sobre a AIL
> existente). O split físico em `packages/*` fica **registrado como refatoração
> opcional** pós-validação — mesma fronteira lógica, custo/risco menor agora.

Mapa camada → local real:

| Camada especificada | Local na slice zero | Já existe? |
|---|---|---|
| `foundation` | `src/design/foundation/` (gerado de system/004) | ⬜ gerar |
| `semantic` | `src/design/semantic/` (gerado de system/005) | ⬜ gerar |
| `ui` | `src/design/ui/` (primitivos) | ⬜ novo (fino) |
| `shell` | `src/shell/` (substitui `components/layout/AppShell`) | ⬜ novo |
| `mission` | `src/mission/` (CMP-001) | ⬜ novo |
| `runtime` | `src/runtime/` (registry, dispatcher, bus, adapters) | ⬜ novo (fino) |
| `contracts` | `src/contracts/` (interfaces CAP-000) | ⬜ novo (tipos) |
| `adapters/ail` | `src/runtime/adapters/ail.ts` → **envolve** `src/modules/adaptive-intelligence/*` | ✅ **reusa** |
| `capabilities/catalog` | `src/capabilities/catalog/` → **orquestra** `src/lib/services/produtos.ts` + `pendencias.ts` | ✅ **reusa serviços** |

## Estrutura física (responsabilidade única por módulo)

```
src/
  design/
    foundation/   ← tokens gerados de system/004 (CSS vars · Tailwind · TS · JSON)
    semantic/     ← aliases gerados de system/005 (referem só foundation)
    ui/           ← primitivos (Box·Stack·Text·Button…) — consomem só semantic
  shell/          ← Frame · Stage · MissionLayer · Notification · Feedback (SHELL-001/002)
  mission/        ← a Mission (CMP-001) + DecisionBody polimórfico
  contracts/      ← interfaces CAP-000 (Capability, Event, Mission, Contract)
  runtime/        ← CapabilityRegistry · MissionDispatcher · EventBus · MemoryAdapter · AgreementAdapter
    adapters/ail.ts ← ponte para src/modules/adaptive-intelligence (NUNCA reimplementa — Lei 8)
  capabilities/
    catalog/      ← a única Capability desta slice (orquestra produtos.ts/pendencias.ts)
  modules/adaptive-intelligence/  ← INTOCADO (o motor)
  lib/services/                   ← INTOCADO (produtos, pendencias, delegation…)
```

## Parte 1 · Foundation (geração automática)

Um script (`scripts/build-tokens.ts`) lê o catálogo de **system/004** (as ~90
grandezas: spacing base 4, type 16×1.2ⁿ, motion, layer, radius…) e **gera** —
zero definição manual: `foundation.css` (CSS custom properties),
`tailwind-foundation.js` (preset), `foundation.ts` (const tipadas),
`foundation.tokens.json` (W3C DTCG). Fonte da verdade = DTCG; os quatro são
derivados. *Validação:* editar um valor em system/004 e reexecutar → os quatro
mudam juntos; nenhum valor hardcoded em componente.

## Parte 2 · Semantic (aliases)

`src/design/semantic/` gera de **system/005** os papéis (`surface.default`,
`content.primary`, `attention.pending`, `voice.presence`…) — cada um
**referindo** um foundation, resolvido por Theme (Contexto). **Regra imposta por
lint:** nenhum componente importa `foundation/*` diretamente — só `semantic/*`
(DS-100 P8; validável por regra ESLint `no-restricted-imports`).

## Parte 3 · UI (primitivos, zero negócio)

| Primitivo | Responsabilidade única |
|---|---|
| **Box** | uma região (padding/margin/radius via semantic) |
| **Stack** | empilhamento vertical com gap semantic |
| **Inline** | alinhamento horizontal com gap |
| **Surface** | uma superfície temática (surface.*) com elevation (layer) |
| **Text** | tipografia (type.* + content.*) — a voz impressa |
| **Icon** | um signo mínimo (iconography) |
| **Divider** | separação (stroke + semantic) |
| **Button** | uma ação (interaction.*) — um toque |
| **Input** | uma entrada de um fato |
| **Spinner** | *ausência deliberada de spinner anônimo* — só "preparando" textual; existe como último recurso, banido do fluxo normal (SYS-001 P4) |
| **Badge** | um rótulo de estado em palavra (nunca contador) |
| **Toast** | *não usado no fluxo* — a Zion fala por Conversa, não toast; existe só para erro-de-sistema irrecuperável |

Nenhum conhece domínio (Lei 2). Nenhum importa foundation.

## Parte 4 · Shell (sem negócio)

`src/shell/`: **Navigation** (a moldura: 5 áreas + Lente), **Stage** (hospeda um
Contexto; preserva rolagem), **MissionLayer** (a sobreposição; ≤1 Missão),
**NotificationLayer** (existe estruturalmente mas **vazio no fluxo** — sem sino;
a voz é a Conversa), **FeedbackLayer** (estados por palavra/posição, Parte 12 do
UX-010). Substitui `components/layout/AppShell.tsx`. Zero lógica de negócio —
só arbitra eventos (contexto desce, evento sobe — SHELL-002).

## Parte 5 · Runtime

| Módulo | Responsabilidade |
|---|---|
| **CapabilityRegistry** | registra Capabilities pelo Contract; resolve por id; publica `CapabilityRegistered` |
| **MissionDispatcher** | recebe a Mission de uma Capability → entrega ao Shell; recebe a Decision → devolve à Capability (Resuming) |
| **EventBus** | pub/sub **in-process** (mínimo) — ver Lacuna 1 |
| **MemoryAdapter** | encaminha "registrar/consultar" à AIL (Journal) — não implementa Memory |
| **AgreementAdapter** | **somente leitura** (Parte 10): consulta delegação vigente do slot via `delegation-runtime` existente |

## Parte 6 · Adapter da AIL (desacoplar sem reimplementar)

`src/runtime/adapters/ail.ts` expõe um Contract fino e **encaminha** para o
motor existente — Lei 8 absoluta:

```
registrarDecisao(captura)  → capturarDecisao()        [decision-journal.ts]
consultarMemoria(slot)     → carregarConhecimento()   [knowledge-maturation.ts]
consultarDelegacao(slot)   → carregarDelegacao()      [delegation-runtime.ts]
sugerir(contexto)          → gerarSugestao()          [suggestion-engine.ts]
```

A Capability conhece **só este Contract**, nunca o interior da AIL. Trocar o
motor não toca a Capability; tocar a Capability não toca o motor. *Desacoplar =
o adapter é a única fronteira; a AIL permanece intocada e testada (447 testes).*

## Parte 7 · A Capability Catalog (a única)

`src/capabilities/catalog/` — orquestra, não reimplementa:

```
1 Trigger    ← evento "contexto Catálogo aberto" (ou produto sem fato)
2 Detecta    ← lê produtos (produtos.ts); acha uma Lacuna (fato ausente que trava um propósito — L3/L5)
3 Cria Mission ← "qual o código de barras deste chinelo?" (AskBody) → publica MissionCreated
4 [Waiting]  ← suspende, preserva contexto (L9)
5 Decision   ← a resposta volta pelo Dispatcher → publica DecisionRecorded
6 Continua   ← chama atualizarProduto(id, {campo}) [produtos.ts EXISTENTE]
7 AIL        ← atualizarProduto já dispara capturarDecisao → Journal   ← Memory ATUALIZADA DE GRAÇA (L7)
8 Eventos    ← publica MemoryUpdated, CapabilityCompleted
9 Resultado  ← o produto agora completo; o Shell re-renderiza (useLiveQuery)
```

**A beleza da slice:** o passo 7 (Lei 7, "toda decisão atualiza Memory") é
**gratuito** — `atualizarProduto` já chama `capturarDecisao` desde o PR-004. A
Capability é ~um orquestrador fino sobre serviço + AIL existentes.

## Parte 8 · Eventos (payloads)

Todos imutáveis, com `{ id, tipo, capabilityId, empresa, correlacao, timestamp }`
+ específicos:

- `CapabilityStarted` — `{ trigger }`
- `MissionCreated` — `{ missionId, slot(contexto·campo), tipoDecisão: "Ask", preparo }`
- `MissionAnswered` — `{ missionId, resultado }`
- `DecisionRecorded` — `{ decisionId, valorAnterior, valorNovo, autor }` *(espelha a Decision do Journal)*
- `MemoryUpdated` — `{ decisionId, slot }`
- `CapabilityCompleted` — `{ indicadores }` (Parte 17 do CAP-000)

## Parte 9 · Memory — só integração

Nenhuma implementação nova. `MemoryUpdated` reflete o que `capturarDecisao` já
persistiu no Journal. Consulta via `carregarConhecimento` (existente).

## Parte 10 · Agreements — só leitura

O `AgreementAdapter` consulta se há delegação vigente para o slot antes de criar
a Mission: **se houver Combinado vigente, a Capability age sozinha** (não cria
Mission — Lei 8 do UX-010: Agreement prevalece); **senão, cria a Mission.**
Nenhuma criação/edição de Agreement nesta slice.

## Parte 11 · Fluxo completo (cada transição)

```
Usuário abre "Catálogo"
   → Shell monta o Stage com o Contexto Catálogo            [SHELL: contexto desce]
   → emite evento → Runtime aciona a Capability Catalog     [CAP-000 Parte 6: input=evento]
   → Catalog consulta AgreementAdapter (há Combinado?)      [Lei 8 UX-010]
       ├ sim → age sozinha → (pula para Resultado)
       └ não → detecta Lacuna → cria Mission                [Lei 5: decisão via Mission]
   → Dispatcher entrega a Mission ao Shell → MissionLayer sobe (CMP-001)
   → Usuário responde (AskBody, um toque)                   [Lei 3: convida, não sequestra]
   → Decision sobe ao Dispatcher → devolve à Catalog (Resuming)
   → Catalog chama atualizarProduto() [serviço existente]
       → capturarDecisao() → Journal                        [Lei 7: Memory de graça]
   → publica MemoryUpdated, CapabilityCompleted             [Lei 6]
   → Shell re-renderiza o Catálogo (useLiveQuery)           [Resultado automático]
   → a Missão desce, devolve ao ponto exato                 [SHELL §4]
```

## Parte 12 · Critérios técnicos (validação)

- **Isolável:** cada módulo compila com só seus contracts (grep de imports proibidos).
- **Testável:** Capability testada com AIL-adapter mockado (entrada→Missão→Decision→efeito), sem tocar banco.
- **Observável:** todo passo publica Evento; um teste assere a sequência exata de eventos.
- **Desacoplado:** trocar o adapter da AIL por um fake não muda a Capability.

## Parte 13 · Critério de aceite (como validar cada um)

| Critério | Validação |
|---|---|
| Shell operacional | `/` monta Navigation+Stage+MissionLayer; troca de área não recarrega |
| navega por Contextos | as 5 áreas trocam o palco; Lente enquadra |
| Missões interrompem naturalmente | a Mission sobe sobre o Catálogo, devolve ao ponto |
| Capabilities invisíveis | zero string "Catalog"/"Capability" na UI (grep) |
| Runtime coordena | todo fluxo passa pelo Dispatcher/Bus (nenhuma chamada direta capability↔shell) |
| AIL intacta | `git diff src/modules/adaptive-intelligence` = vazio; 447 testes verdes |
| Memory registra | após a Decision, o Journal tem a nova Decision (query) |
| Eventos publicados | teste da sequência de 6 eventos |
| Resultado automático | o produto aparece completo sem refresh manual |
| nenhuma violação | ESLint de fronteiras verde; grep de imports proibidos vazio |

## Parte 14 · Fora do escopo

Dashboard · Marketplace · Pricing · Inventory · Analytics · Settings ·
multiempresa · permissões · notificações externas · qualquer outra Capability.
*(Nota: a AIL, o menu antigo e as telas atuais permanecem coexistindo — a slice
zero é uma rota nova, não uma substituição do app em produção. Ver DoD.)*

## Parte 15 · Definition of Done

Uma usuária real (a Lena) consegue, numa rota nova (ex.: `/z`): entrar →
selecionar o Contexto Catálogo → receber uma Mission ("falta o código de barras
deste chinelo") → responder num toque → a Capability continua → o resultado
aparece (produto completo) → **sem conhecer Capability, Runtime ou arquitetura.**
Se isso acontece com a AIL intocada e os eventos publicados, a primeira
implementação constitucional está validada.

## Lacunas declaradas (registradas, não preenchidas)

1. **Event Bus distribuído** — CAP-000 pressupõe eventos como fatos observáveis;
   a slice usa um **EventBus in-process mínimo** (emitter + log), não um bus
   persistente/distribuído. Suficiente para validar; a versão durável é trabalho
   futuro. *Não construo o bus completo agora.*
2. **Monorepo físico** (`packages/*`) — adiado; a slice usa fronteiras internas.
   Registrado como refatoração opcional pós-validação.
3. **Persistência dos Eventos** — os eventos da slice são in-memory/log; a AIL já
   persiste o que importa (o Journal). Persistir o event stream é futuro.
4. **A rota de convivência** (`/z` vs. substituir o app) — decisão de rollout, não
   de arquitetura: a slice nasce ao lado do app em produção (Lei 9 sem risco).

## Veredito

> **A Vertical Slice Zero está completamente especificada.**

Todas as camadas têm local real, responsabilidade única e fronteira validável;
o fluxo ponta a ponta é concreto e **reusa o motor** (a AIL intocada, `produtos.ts`
existente, `capturarDecisao`/`delegation` já prontos — Lei 8 honrada por
construção); a Memory atualiza de graça (Lei 7); os 6 eventos e o aceite são
testáveis. **As quatro lacunas são declaradas e não-bloqueantes** — todas de
*infraestrutura futura* (bus durável, monorepo, event-persistence, rollout), não
de arquitetura: nenhuma impede a slice de ser construída e usada por um cliente
real. A menor implementação que valida a Constituição inteira está pronta para
ser codificada.
