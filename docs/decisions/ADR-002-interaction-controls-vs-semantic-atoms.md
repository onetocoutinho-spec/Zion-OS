# ADR-002 — Separar Interaction Controls de Semantic Atoms no Component Catalog

> **Status:** `Accepted`
> **Data:** 2026-07-14 · **Responsável:** Arquitetura Zion (decisão humana, ratificada durante a Sprint 2 da Zion Design Library)
> **Metodologia:** [decisions/000 — Decision Record Methodology](./000-decision-record-methodology.md)

---

## Contexto

A **Fundação Arquitetural** da Zion foi concluída antes de qualquer implementação: Architecture, Product, Blueprints, System, Company, Brand, Meta e Decisions. Sobre ela iniciou-se a construção da **Zion Design Library** no Figma — Sprint 1 (Foundations & Variables) e Sprint 2 (Atoms).

Os documentos foram escritos **de cima para baixo**, partindo do *significado*: o que é uma Missão, o que é Health, o que é Precisão, o que é Origem. Essa ordem produziu uma arquitetura de rara coerência semântica — e uma consequência não percebida.

Ao concluir os **7 Átomos oficiais** ([Catalog §5](../product/blueprints/004-component-catalog.md)) e preparar as Molecules, a construção parou.

---

## Problema

**O `MissionCard` — a molécula central do cockpit — não podia ser construído: sua ação "Agir" não tinha componente.**

A auditoria arquitetural que se seguiu revelou algo maior que um componente faltando:

- A palavra **"Button" aparecia zero vezes** em todo o corpo documental da Zion.
- `IconButton`, `GhostButton`, `LinkButton`, `SplitButton`, `TextArea`: **zero ocorrências**.
- As poucas menções eram **prosa** (*"botão de agir"*), **nome de evento** (`cost.missing_input`) ou **SQL** (`select`).
- **Nenhum controle de interação existia oficialmente** — nem no Catalog, nem em Product, nem nos Blueprints.

A questão específica a resolver: **onde vivem os componentes que capturam a intenção humana, dado que a taxonomia do Component Catalog não previa nenhum lugar para eles?**

### Por que a categoria "Atoms" deixou de representar a realidade

A taxonomia definia: *"**Átomos** — peças mínimas, **sem lógica de domínio**"*. A afirmação **era falsa**. Cinco dos sete Átomos declaram **"Origem dos dados"** apontando para uma Capability:

| Átomo | Origem dos dados declarada |
|---|---|
| `OriginBadge` | metadado de proveniência — [013a](../architecture/013a-architecture-review-epic2.md) |
| `PrecisionBadge` | precisão — [013](../architecture/013-cost-engine.md)/[014](../architecture/014-operational-maturity-engine.md) |
| `HealthMeter` | [014](../architecture/014-operational-maturity-engine.md) Operational Maturity |
| `PriorityBadge` | prioridade calculada — [015](../architecture/015-operation-center.md)/[014](../architecture/014-operational-maturity-engine.md) |
| `StatusChip` | o estado do objeto |
| `EmptyState` · `LoadingSkeleton` | **—** *(os únicos realmente neutros)* |

A categoria descrevia "ausência de domínio" enquanto abrigava componentes **inteiramente feitos de domínio**. Esse erro de definição é a causa-raiz de ninguém ter notado a lacuna: **o lugar dos controles não estava vazio — estava mal descrito.** A taxonomia dizia que já existia uma categoria "sem domínio", então parecia que os controles caberiam ali. Não cabiam: aquela categoria nunca foi isso.

### Onde a lacuna realmente estava

Entre os **Design Tokens** e os **Semantic Atoms**. A camada de tokens **já sabia** que controles existiam:

- `radius.sm` — descrito como *"inputs, botões pequenos · **controles**"*
- `type.label` — *"rótulos, **botões**, badges"*
- collection `Interaction` (`primary`, `danger`, `focus`), `State` (`hover`, `pressed`, `focus`, `disabled`)
- `a11y.focus.ring`, `a11y.target.min` (44×44)

O [system/004](../product/system/004-design-tokens.md) **provisionou um andar que o Catálogo nunca construiu**.

---

## Alternativas consideradas

| # | Alternativa | Prós | Contras | Veredito |
|:--:|---|---|---|:--:|
| **A1** | **Adicionar `Button`, `Input` etc. à categoria Átomos** | Rápido; nenhuma mudança de taxonomia; destravaria a Sprint imediatamente. | Contamina a categoria com peças **sem domínio**, tornando a definição de Átomos ainda mais falsa. Perde-se a distinção entre "identidade da Zion" e "mecânica universal". Abre precedente para `ApproveButton`/`HealthSwitch`. | ❌ **Rejeitada** |
| **A2** | **Criar a categoria `Interaction Controls`** | Torna explícita a fronteira que já governa a arquitetura; corrige a definição de Átomos; cria teste objetivo de classificação; isola o que é universal do que é identidade. | Exige evoluir o Catálogo (congelado); adiciona uma categoria à taxonomia. | ✅ **Escolhida** |
| **A3** | **Deixar os controles fora do Catálogo** (delegar a um Design System externo/biblioteca de terceiros) | Zero trabalho de especificação; controles são commodity. | O Catálogo deixaria de ser a Fonte da Verdade dos contratos. Os controles **carregam Leis** (L14 consequência conhecida, L05 nunca inventar, L07 humano decide) — terceirizá-los terceirizaria o cumprimento das Leis. Nenhuma biblioteca externa conhece a A10 nem "DISABLED sempre com motivo". | ❌ **Rejeitada** |
| **A4** | **Cada Molécula constrói seus próprios controles internamente** | Nenhuma categoria nova; cada card resolve sua ação. | Duplicação garantida (Anti-Lei [§10](../product/blueprints/004-component-catalog.md)); viola [L12](../product/system/002-product-laws.md) (*"nenhuma tela contradiz outra"*) e [L20](../product/system/002-product-laws.md) (*"nenhuma feature cria nova linguagem"*). O botão do `MissionCard` divergiria do botão do `ApprovalCard`. | ❌ **Rejeitada** |
| **A5** | **Improvisar o `Button` na Sprint e seguir** | Destrava a construção no mesmo dia; nenhuma discussão. | Resolve o sintoma e apaga a causa. A lacuna deixaria de ser visível e nunca mais seria investigada. Viola a regra absoluta *"nunca inventar componentes"*. | ❌ **Rejeitada** |

---

## Decisão

**Criar no Component Catalog a categoria oficial `Interaction Controls`, no nível mais primitivo da taxonomia, separando definitivamente os componentes que capturam intenção humana daqueles que apresentam significado do domínio Zion — e corrigir a definição de Átomos para refletir a realidade.**

Componentes admitidos: `Button` (variantes `primary`/`secondary`/`ghost`/`link`), `IconButton`, `Input`, `TextArea`, `Select`, `Checkbox`, `Switch`.
Rejeitados com registro permanente: `SplitButton`, `Radio`, `Toggle` (este, reservado como variante futura de `Switch`).

---

## Justificativa

### Por que uma nova categoria, e não um remendo

A Constituição da Zion se apoia numa única linha: **a plataforma apresenta a verdade; o humano decide** ([L06](../product/system/002-product-laws.md) *apresentação nunca calcula* · [L07](../product/system/002-product-laws.md) *a IA recomenda, o humano decide* · [L16](../product/system/002-product-laws.md) *o humano permanece no controle*).

Essa linha governava tudo e **não tinha nenhuma expressão estrutural**. Os Semantic Atoms são a **voz da plataforma** — dizem o que é verdade ("este custo veio do ERP", "esta margem é estimativa"). Os Interaction Controls são as **mãos do humano** — são onde a decisão fisicamente acontece.

A categoria não foi inventada: ela **já existia na cabeça de quem escreveu as Leis**. A árvore de componentes é que nunca soube expressá-la. Criá-la foi torná-la visível — não adicioná-la.

### Por que adicionar Buttons aos Atoms foi rejeitado (A1)

Porque teria transformado um erro de definição em erro de arquitetura. A categoria Átomos já mentia ao dizer "sem domínio"; enfiar ali componentes **genuinamente** sem domínio criaria uma categoria com **duas naturezas irreconciliáveis** e nenhum critério para distingui-las. Sem critério, o próximo `ApproveButton` entraria sem resistência — e o Catálogo viraria o pântano onde domínio e mecânica se misturam, exatamente o "arquipélago" que a Zion existe para eliminar ([L19](../product/system/002-product-laws.md)).

### Por que Controls pertencem à plataforma e Semantic Atoms ao domínio Zion

| Eixo | Interaction Controls | Semantic Atoms |
|---|---|---|
| **Origem dos dados** | `—` (nenhuma) | uma **Capability** |
| **Direção do fluxo** | **capturam** intenção (input) | **apresentam** verdade (output) |
| **Fora da Zion** | fazem todo sentido — um botão é um botão em qualquer produto | não fazem sentido algum — o que é um `PrecisionBadge` em outra empresa? |
| **Se removidos** | a Zion fica inutilizável, **mas continua sendo a Zion** | a Zion **deixa de ser a Zion** |
| **Governados por** | Design System + Tokens | Catalog + a Capability dona |
| **Substituíveis** | sim, em tese | **jamais** |

O critério é objetivo, não estético: **quem declara Origem dos dados é semântico; quem não declara e captura intenção é controle.** Esse teste virou obrigatório ([Catalog §3.2](../product/blueprints/004-component-catalog.md)).

---

## Consequências

### Positivas

- **A Constituição virou estrutura.** O primeiro nível da taxonomia agora é a linha *apresentar × decidir*. Um novo membro entende a filosofia da Zion **olhando a árvore de componentes**.
- **Critério objetivo contra inflação.** O teste de classificação tem um terceiro ramo — *"o componente provavelmente não deve existir"* — materializando *"criar é sempre a última opção"* ([meta/000 §8](../meta/000-architecture-methodology.md)).
- **A definição de Átomos passou a ser verdadeira.**
- **Rejeições viraram patrimônio.** `SplitButton`, `Radio` e `Toggle` ficam registrados com motivação — a Zion não re-debate o que já analisou.
- **Sprint 3 destravada** sem improviso.

### Trade-offs assumidos

- **O Catálogo, congelado desde a Sprint 1.1, foi descongelado.** Aceito: a evolução é aditiva e versionada (v1.0 → v1.1).
- **Uma correção não-aditiva** (a definição de Átomos) foi necessária. Aceito: a definição anterior era factualmente falsa.
- **A taxonomia ganhou uma quinta categoria** — mais superfície conceitual para aprender. Aceito: a alternativa era uma categoria mentirosa.
- **Dívida de forma:** a seção dos contratos é a **§14**, embora a hierarquia coloque Interaction Controls em primeiro. Renumerar quebraria referências em [system/001](../product/system/001-ui-composition-system.md) e no [system/004](../product/system/004-design-tokens.md) — **estabilizado**. A hierarquia vive na §3; a ordem física do arquivo não é a hierarquia. Se o Catálogo for reorganizado no futuro, §14 deve subir para §5.

---

## Impactos

| Afetado | Impacto |
|---|---|
| **Component Catalog** ([blueprints/004](../product/blueprints/004-component-catalog.md)) | **Único documento alterado.** v1.0 → v1.1: nova categoria (§3), definições oficiais (§3.1), teste de classificação (§3.2), 7 contratos (§14), rejeitados (§14.8), decisão arquitetural (§15). |
| **Architecture · Product · Product Laws · Brand · Design Tokens · Design System · UI Composition · Blueprints** | **Nenhum.** Nenhuma responsabilidade mudou; nenhum contrato existente foi alterado; nenhum Atom aprovado mudou. |
| **Zion Design Library (Figma)** | Sprint 2.5 passa a existir: os 7 controles serão construídos **depois** desta decisão, nunca antes. |
| **Molecules (Sprint 3)** | Destravadas: `MissionCard` ("Agir") e `CoachCard` (Ver/Dispensar/Por quê) têm contrato de ação. |
| **Evolução futura do Design System** | Ver abaixo. |

### Impacto na evolução futura do Design System

1. **A camada substituível ficou marcada.** Os Interaction Controls são a única parte da Zion que **qualquer produto tem**. Se um dia a Zion adotar um Design System externo ou migrar de plataforma, **é a única camada trocável sem perder identidade** — e agora se sabe exatamente qual é.
2. **A admissão de componentes tem porteiro.** Todo controle futuro (`Tooltip`, `Modal`, `Tabs`…) passa pelo teste §3.2 e pela regra *"um controle só entra quando uma tela documentada o exige"*. A biblioteca cresce por necessidade, não por simetria com outros Design Systems.
3. **Domínio não vaza para a mecânica.** `ApproveButton`, `PublishButton`, `HealthSwitch` são proibidos por construção. O domínio vive no hospedeiro; o controle permanece universal.
4. **Os tokens não precisarão de nova camada.** O `system/004` já provisiona `interaction.*`, `state.*`, `a11y.*` — e permanece **estabilizado**.

### Como esta separação protege a identidade da Zion

A identidade da Zion não está nos seus botões — está no `OriginBadge` que diz de onde veio o dado, no `PrecisionBadge` que confessa quando o número é frágil, no `HealthMeter` que mede a operação e nunca as pessoas. **É isso que nenhum concorrente copia.**

Sem a fronteira, essa identidade ficaria diluída no meio de peças genéricas, e cada componente novo teria uma chance de contaminá-la. Com a fronteira, a identidade fica **concentrada, nomeada e defensável**: há um lugar no catálogo onde só entra o que é Zion, e um lugar onde só entra o que é universal. Proteger a identidade é, antes de tudo, **saber onde ela mora**.

> **A arquitetura evoluiu antes da implementação.**
>
> **Improvisar um Button teria resolvido o problema imediato, mas teria eliminado uma fronteira arquitetural importante.**
>
> A lacuna foi descoberta *durante* a construção — e deliberadamente **não foi remendada na construção**. Parou-se a Sprint, auditou-se a taxonomia, evoluiu-se o Catálogo, registrou-se esta decisão. Só então a implementação foi autorizada. O improviso teria funcionado naquele dia e custado a fronteira para sempre — porque uma lacuna preenchida às pressas deixa de ser visível, e o que não se vê não se corrige.

---

## Documentos relacionados

| Documento | Relação |
|---|---|
| [blueprints/004 — Component Catalog](../product/blueprints/004-component-catalog.md) | **O documento que esta decisão sustenta** (v1.1: §3, §3.1, §3.2, §14, §15). |
| [system/002 — Product Laws](../product/system/002-product-laws.md) | Deriva de L06/L07/L16 (apresentar × decidir); amarra L02, L05, L11, L12, L14, L19, L20. |
| [system/004 — Design Tokens](../product/system/004-design-tokens.md) | A lacuna estava **entre** este documento e os Átomos; ele já provisionava `interaction.*`, `state.*`, `a11y.*`. Estabilizado — não alterado. |
| [system/001 — UI Composition](../product/system/001-ui-composition-system.md) | Já proibia *"qualquer card sem ação"* — pressupunha controles. Não alterado. |
| [system/003 — Design System](../product/system/003-design-system.md) | Delega comportamento ao Catálogo. Não alterado. |
| [meta/000 — Architecture Methodology](../meta/000-architecture-methodology.md) | Governa esta decisão; fornece *"criar é sempre a última opção"* (§8). |
| [brand/000 — Brand DNA](../brand/000-brand-dna.md) | "Uma só Zion" e "simplicidade que respeita" sustentam a recusa à inflação. |
| [blueprints/001](../product/blueprints/001-operation-center-blueprint.md) · [002](../product/blueprints/002-product-workspace-blueprint.md) · [003](../product/blueprints/003-client-portal-blueprint.md) | Consumidores dos controles. Nenhum alterado. |
| [decisions/000 — Decision Record Methodology](./000-decision-record-methodology.md) | A metodologia que este ZDR segue. |

---

> **Registro oficial:** Este ZDR preserva o **raciocínio**, não apenas o resultado. Quem ler o Component Catalog daqui a dez anos precisa saber que a categoria `Interaction Controls` não nasceu de gosto nem de simetria com outros Design Systems — **nasceu de uma lacuna real, medida, entre os Tokens e os Átomos**, descoberta quando um card não pôde ser construído.
