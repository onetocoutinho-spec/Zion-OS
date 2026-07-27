# System/004 — Tokens da Zion

```
─────────────────────────────────────────────
Status:                  v2.0 — reescrito sob a Ontologia
Autoridade conceitual:   Ontologia (system/000) — precede este documento
Obedece:                 Product Laws (system/002)
Materializa:             Design System (system/003)
Data:                    2026-07-16
Substitui:               004 v1.1 (Design Tokens) integralmente
─────────────────────────────────────────────
```

> Este documento foi **integralmente reescrito** a partir da [Ontologia Normativa da Zion](./000-ontologia-normativa.md). Ele não preserva a estrutura, a terminologia nem a organização da versão anterior. Preserva apenas o **significado normativo que continua exprimível** pelos 31 conceitos da Ontologia.
>
> Toda autoridade conceitual é da Ontologia. Onde a versão anterior divergir dela, prevalece a Ontologia, e o trecho divergente ou foi **reescrito**, ou **eliminado**, ou **registrado como incompatibilidade** ([Parte C](#parte-c--incompatibilidades)).
>
> **Nenhum conceito novo foi criado nesta reescrita.** Declarar uma Matéria (Color, Typography, Shadow, Traço…) **instancia** o conceito Matéria (D4) e não cria conceito — a Norma T9.2 torna o conjunto das Matérias aberto. Onde o 004 anterior dependia de algo que os 31 conceitos não exprimem, isso está na Parte C, jamais contrabandeado como atributo.

---

## Como ler um Token

Um **Token** (T1) atribui um Conteúdo a um Símbolo. Cada Token deste documento recebe, obrigatoriamente, os atributos que a Ontologia exige. Nas tabelas da [Parte B](#parte-b--os-tokens), cada linha é um Token e cada coluna é um desses atributos:

| Atributo | Origem na Ontologia | O que declara |
|---|---|---|
| **Símbolo** | P1 | o nome que distingue unicamente este Token |
| **Matéria** | D4 · T6–T9 | a espécie de **objeto** que o Conteúdo determina — atribuída pelo objeto, **nunca** pelo prefixo do Símbolo (é o cabeçalho de cada seção da Parte B) |
| **Posição** | T2–T5 | derivada **mecanicamente** do Conteúdo: **Foundation** (sem Referência, sem Destinação) · **Semantic** (com Referência, sem Destinação) · **Component** (com Destinação) |
| **Espécie** | Parte 4 | a única espécie do Conteúdo: Valor · Referência · Operação · Restrição · Transformação · Unidade |
| **Escopo** | 6.1–6.3 | **universal** (o Símbolo sobrevive à remoção de toda Declaração da Zion) ou **domínio Zion** (o Símbolo se dissolve sem ela) — qualifica o **Símbolo**, nunca o Valor |
| **Compl.** | 5.5 | **C** = a Resolução encerra em Valor · **I** = Incompleto. Pela Norma 5.5.1, **um Token Incompleto existe** — I não é defeito, é um estado |
| **Destinação** | D3 | o Consumidor único de um Component Token, ou — |
| **Conteúdo** | D1 · P4 | o conteúdo instituído, listado **por Contexto** quando varia (**Dark**, **Light**, **High Contrast** são instâncias de Contexto, P4) |

> **Contexto (P4) substitui "tema".** Os três temas da versão anterior — Dark, Light, High Contrast — são **três instâncias de Contexto**, não uma Matéria nem um Token. Um Semantic resolve o mesmo Símbolo em Conteúdo distinto sob cada Contexto. "Trocar de tema" não é conceito da Ontologia; é fixar qual Contexto vigora (e **isso** é uma incompatibilidade — ver *Eleição de Contexto* na Parte C).

---

## Parte A — As Matérias oficiais

Uma **Matéria** (D4) é a espécie de objeto que um Conteúdo determina. A Norma D4.1 é inquebrável: **duas Matérias jamais possuem o mesmo objeto**. As 18 partes do documento anterior foram classificadas e depois reconciliadas contra esta norma; o conjunto oficial tem **13 Matérias**. Quatro têm objeto **fixado pela Ontologia** (T6–T9) e não são redefiníveis; as outras nove **instanciam D4** (Norma T9.2, conjunto aberto).

| Matéria | Objeto (disjunto de todos os demais) | Origem |
|---|---|---|
| **Color** | a cor — o ponto do espaço cromático que um Conteúdo elege, delimita ou transfere | D4 |
| **Typography** | a forma e o ritmo do texto composto: família, corpo, peso, entrelinha, medida de linha | D4 |
| **Spacing** | a extensão do vão que separa duas entidades e que **nenhuma** ocupa | D4 |
| **Radius** | o arredondamento (curvatura) do vértice do contorno de uma superfície | D4 |
| **Elevation** | o grau de afastamento de uma entidade em relação ao fundo — o **nível** na ordem de profundidade | D4 |
| **Shadow** | a geometria da projeção sobre o fundo — deslocamento e difusão | D4 (T9.2) |
| **Iconography** | a dimensão do glifo de ícone e o seu estilo de renderização (linha vs. preenchimento) | D4 |
| **Traço** | a espessura escalar de um traço/linha/contorno desenhado | D4 (T9.2) |
| **Grid** | a subdivisão responsiva da superfície: os limiares de viewport de recomposição e a cardinalidade de colunas | D4 |
| **Layout** | a **extensão** de uma região da superfície de apresentação | **T6 — fixado** |
| **Motion** | a progressão temporal de uma mudança (duração/curva) | **T7 — fixado** |
| **State** | a condição de um Consumidor e a Operação que ela impõe à expressão de um componente | **T8 — fixado** |
| **A11y** | o limiar de perceptibilidade — contraste, alvo e respiro **mínimos** (Restrição, não Valor) | **T9 — fixado** |

> **Duas Matérias nasceram na reconciliação, ambas por instanciação de D4 (não por criação de conceito):**
> - **Shadow** separa-se de Elevation e de Color: o **nível** (afastamento) é Elevation; a **cor** da projeção é Color; a **geometria** (offset/blur) é Shadow. A "sombra composta" da versão anterior era Estrutura — eliminada pela Parte 4 — e foi **decomposta** em Símbolos atômicos.
> - **Traço** separa-se de Iconography e de A11y: a espessura de um traço desenhado — seja de um ícone (`icon.stroke`), seja de um anel de foco (`a11y.focus.ring.width`) — determina uma **largura** (Valor), não um limiar (Restrição) nem a forma do glifo. Objeto idêntico ⇒ uma só Matéria (D4.1).

> **A atribuição é sempre pelo objeto, nunca pelo prefixo.** Vários Símbolos migraram de Matéria por força disto: `a11y.focus.ring.color` → **Color** (determina uma cor, não um limiar); `a11y.focus.ring.offset` → **Spacing** (é um vão); `grid.gutter`/`grid.margin` → **Spacing** (o vão entre colunas / na borda não é região *ocupada*, logo não é Layout); `state.critical`, `state.disabled.text/icon` → **Color**; `state.hover.motion` → **Motion**; `state.pressed.elevation` → **Elevation**; `elevation.*.surface`, `shadow.*.color` → **Color**.

---

## Parte B — Os Tokens

304 Tokens, agrupados por Matéria e, dentro dela, por Posição. Cada linha traz os oito atributos da Ontologia. Legenda de **Compl.**: **C** = Completo · **I** = Incompleto (existe, Norma 5.5.1).

### Matéria · Color  

**Posição Foundation** — 73

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `alert.100` | Valor | universal | C | — | #F8CFCF |
| `alert.200` | Valor | universal | C | — | #F1A9A9 |
| `alert.300` | Valor | universal | C | — | #EE8A8A |
| `alert.400` | Valor | universal | C | — | #E45D5D |
| `alert.50` | Valor | universal | C | — | #FCECEC |
| `alert.500` | Valor | universal | C | — | #D23B3B |
| `alert.600` | Valor | universal | C | — | #AE2A2A |
| `alert.700` | Valor | universal | C | — | #831F1F |
| `alert.800` | Valor | universal | C | — | #5E1616 |
| `alert.900` | Valor | universal | C | — | #420F0F |
| `alert.950` | Valor | universal | C | — | #2B0A0A |
| `base.0` | Valor | universal | C | — | #FFFFFF |
| `base.100` | Valor | universal | C | — | #ECECF2 |
| `base.200` | Valor | universal | C | — | #D9D9E3 |
| `base.300` | Valor | universal | C | — | #B9B9C7 |
| `base.400` | Valor | universal | C | — | #8E8EA0 |
| `base.50` | Valor | universal | C | — | #F7F7FA |
| `base.500` | Valor | universal | C | — | #6B6B7B |
| `base.600` | Valor | universal | C | — | #4E4E5C |
| `base.700` | Valor | universal | C | — | #35353F |
| `base.800` | Valor | universal | C | — | #20202A |
| `base.850` | Valor | universal | C | — | #16161E |
| `base.900` | Valor | universal | C | — | #0F0F16 |
| `base.950` | Valor | universal | C | — | #08080D |
| `brand.100` | Valor | domínio Zion | C | — | #E4D9FF |
| `brand.200` | Valor | domínio Zion | C | — | #C9B4FF |
| `brand.300` | Valor | domínio Zion | C | — | #AC8CFF |
| `brand.400` | Valor | domínio Zion | C | — | #9366FB |
| `brand.50` | Valor | domínio Zion | C | — | #F3EEFF |
| `brand.500` | Valor | domínio Zion | C | — | #7C4DF0 |
| `brand.600` | Valor | domínio Zion | C | — | #6A3CD8 |
| `brand.700` | Valor | domínio Zion | C | — | #562FB0 |
| `brand.800` | Valor | domínio Zion | C | — | #3F2380 |
| `brand.900` | Valor | domínio Zion | C | — | #2A1857 |
| `brand.950` | Valor | domínio Zion | C | — | #1B0F3A |
| `caution.100` | Valor | universal | C | — | #FAE4B8 |
| `caution.200` | Valor | universal | C | — | #F5D08A |
| `caution.300` | Valor | universal | C | — | #F1C15A |
| `caution.400` | Valor | universal | C | — | #E5A72E |
| `caution.50` | Valor | universal | C | — | #FDF4E3 |
| `caution.500` | Valor | universal | C | — | #CE8A12 |
| `caution.600` | Valor | universal | C | — | #A66D0C |
| `caution.700` | Valor | universal | C | — | #7C5008 |
| `caution.800` | Valor | universal | C | — | #573809 |
| `caution.900` | Valor | universal | C | — | #3B2606 |
| `caution.950` | Valor | universal | C | — | #241705 |
| `color.border.opacity` | Restrição | domínio Zion | I | — | **High Contrast** opacidade ∈ [40%, 80%] |
| `color.critical-content` | Unidade | universal | I | — | Unidade — o Valor admissível é da espécie cor. Nenhum Valor eleito; nenhuma Referência instituída |
| `color.information-content` | Unidade | universal | I | — | Unidade — o Valor admissível é da espécie cor. Nenhum Valor eleito; nenhuma Referência instituída |
| `color.success-content` | Unidade | universal | I | — | Unidade — o Valor admissível é da espécie cor. Nenhum Valor eleito; nenhuma Referência instituída |
| `color.warning-content` | Unidade | universal | I | — | Unidade — o Valor admissível é da espécie cor. Nenhum Valor eleito; nenhuma Referência instituída |
| `info.100` | Valor | universal | C | — | #CADEFB |
| `info.200` | Valor | universal | C | — | #A6C8F7 |
| `info.300` | Valor | universal | C | — | #7FB2F3 |
| `info.400` | Valor | universal | C | — | #4E90EC |
| `info.50` | Valor | universal | C | — | #EAF2FD |
| `info.500` | Valor | universal | C | — | #2B72DA |
| `info.600` | Valor | universal | C | — | #1E58AE |
| `info.700` | Valor | universal | C | — | #164183 |
| `info.800` | Valor | universal | C | — | #0F2E5C |
| `info.900` | Valor | universal | C | — | #0A2143 |
| `info.950` | Valor | universal | C | — | #06152C |
| `positive.100` | Valor | universal | C | — | #C6ECDA |
| `positive.200` | Valor | universal | C | — | #9EDCBE |
| `positive.300` | Valor | universal | C | — | #6FD3A6 |
| `positive.400` | Valor | universal | C | — | #3DBE86 |
| `positive.50` | Valor | universal | C | — | #E8F7F0 |
| `positive.500` | Valor | universal | C | — | #1FA46B |
| `positive.600` | Valor | universal | C | — | #158257 |
| `positive.700` | Valor | universal | C | — | #0F6444 |
| `positive.800` | Valor | universal | C | — | #0A4A33 |
| `positive.900` | Valor | universal | C | — | #073523 |
| `positive.950` | Valor | universal | C | — | #042317 |

**Posição Semantic** — 49

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `a11y.focus.ring.color` | Referência | domínio Zion | C | — | color.border.focus |
| `color.analytics` | Referência | domínio Zion | C | — | Referência ao Símbolo `color.information` |
| `color.border.control` | Transformação | universal | I | — | **Dark** base.0 @ 40%<br>**Light** base.900 @ 56%<br>**High Contrast** base.0 @ 80% |
| `color.border.default` | Transformação | universal | I | — | **Dark** base.0 @ 10%<br>**Light** base.900 @ 10%<br>**High Contrast** base.0 @ 60% |
| `color.border.focus` | Referência | universal | C | — | **Dark** brand.400<br>**Light** brand.500<br>**High Contrast** brand.300 |
| `color.border.strong` | Transformação | universal | I | — | **Dark** base.0 @ 16%<br>**Light** base.900 @ 14%<br>**High Contrast** base.0 @ 80% |
| `color.border.subtle` | Transformação | universal | I | — | **Dark** base.0 @ 6%<br>**Light** base.900 @ 6%<br>**High Contrast** base.0 @ 40% |
| `color.coach` | Referência | domínio Zion | I | — | Referência ao Símbolo `brand` |
| `color.critical` | Referência | universal | C | — | **Dark** Referência ao Símbolo `alert.400` (Resolução → `#E45D5D`)<br>**Light** Referência ao Símbolo `alert.500` (Resolução → `#D23B3B`)<br>**High Contrast** Referência ao Símbolo `alert.300` (Resolução → `#EE8A8A`) |
| `color.critical-surface` | Referência | universal | I | — | **Dark** Referência ao Símbolo `alert.900` (Resolução → `#420F0F`)<br>**Light** Referência ao Símbolo `alert.50` (Resolução → `#FCECEC`)<br>**High Contrast** não declarado |
| `color.health` | Referência | domínio Zion | C | — | **estado healthy — «segurança: está bem»** Referência ao Símbolo `color.success`<br>**estado attention — «segurança em risco»** Referência ao Símbolo `color.warning`<br>**estado critical — «saúde comprometida»** Referência ao Símbolo `color.critical`<br>**estado empty — «ainda medindo» (empresa nova)** Referência ao Símbolo `color.neutral` |
| `color.information` | Referência | universal | C | — | **Dark** Referência ao Símbolo `info.400` (Resolução → `#4E90EC`)<br>**Light** Referência ao Símbolo `info.600` (Resolução → `#1E58AE`)<br>**High Contrast** Referência ao Símbolo `info.300` (Resolução → `#7FB2F3`) |
| `color.information-surface` | Referência | universal | I | — | **Dark** Referência ao Símbolo `info.900` (Resolução → `#0A2143`)<br>**Light** Referência ao Símbolo `info.50` (Resolução → `#EAF2FD`)<br>**High Contrast** não declarado |
| `color.neutral` | Referência | universal | C | — | **Dark** Referência ao Símbolo `base.400` (Resolução → `#8E8EA0`)<br>**Light** Referência ao Símbolo `base.500` (Resolução → `#6B6B7B`)<br>**High Contrast** Referência ao Símbolo `base.300` (Resolução → `#B9B9C7`) |
| `color.origin.ai` | Referência | domínio Zion | I | — | Referencia ao Simbolo `brand` |
| `color.origin.erp` | Referência | domínio Zion | C | — | Referencia ao Simbolo `color.information` |
| `color.origin.estimate` | Referência | domínio Zion | C | — | Referencia ao Simbolo `color.warning` |
| `color.origin.operator` | Referência | domínio Zion | C | — | Referencia ao Simbolo `color.neutral` |
| `color.precision` | Referência | domínio Zion | C | — | **estado high — «confiança: pode confiar»** Referência ao Símbolo `color.information`<br>**estado medium — «confiança parcial»** Referência ao Símbolo `color.warning`<br>**estado low — «baixa confiança (honesta)»** Referência ao Símbolo `color.neutral` |
| `color.priority` | Referência | domínio Zion | C | — | **estado high — «urgência relativa máxima»** Referência ao Símbolo `color.critical`<br>**estado medium — «urgência média»** Referência ao Símbolo `color.warning`<br>**estado low — «urgência baixa»** Referência ao Símbolo `color.information` |
| `color.success` | Referência | universal | C | — | **Dark** Referência ao Símbolo `positive.400` (Resolução → `#3DBE86`)<br>**Light** Referência ao Símbolo `positive.600` (Resolução → `#158257`)<br>**High Contrast** Referência ao Símbolo `positive.300` (Resolução → `#6FD3A6`) |
| `color.success-surface` | Referência | universal | I | — | **Dark** Referência ao Símbolo `positive.900` (Resolução → `#073523`)<br>**Light** Referência ao Símbolo `positive.50` (Resolução → `#E8F7F0`)<br>**High Contrast** não declarado — nenhuma Declaração institui Conteúdo para este Símbolo sob este Contexto |
| `color.surface.canvas` | Referência | universal | C | — | **Dark** base.950<br>**Light** base.50<br>**High Contrast** #000000 |
| `color.surface.default` | Referência | universal | I | — | **Dark** base.900<br>**Light** base.0<br>**High Contrast** #0A0A10 |
| `color.surface.overlay` | Referência | universal | I | — | **Dark** base.800<br>**Light** base.0<br>**High Contrast** base.800 |
| `color.surface.raised` | Referência | universal | I | — | **Dark** base.850<br>**Light** base.0<br>**High Contrast** base.850 |
| `color.surface.sunken` | Referência | universal | I | — | **Dark** base.1000<br>**Light** base.100<br>**High Contrast** #000000 |
| `color.text.disabled` | Referência | universal | C | — | **Dark** base.600<br>**Light** base.300<br>**High Contrast** base.400 |
| `color.text.inverse` | Referência | universal | C | — | **Dark** base.900<br>**Light** base.50<br>**High Contrast** #000000 |
| `color.text.on-accent` | Referência | universal | I | — | **Dark** base.50<br>**Light** base.0<br>**High Contrast** base.900 |
| `color.text.primary` | Referência | universal | I | — | **Dark** base.50<br>**Light** base.900<br>**High Contrast** base.0 |
| `color.text.secondary` | Referência | universal | C | — | **Dark** base.300<br>**Light** base.600<br>**High Contrast** #E6E6EF |
| `color.text.tertiary` | Referência | universal | C | — | **Dark** base.400<br>**Light** base.500<br>**High Contrast** #C9C9D6 |
| `color.timeline` | Referência | domínio Zion | C | — | Referência ao Símbolo `color.neutral` |
| `color.timeline.anchor` | Referência | domínio Zion | I | — | Referência ao Símbolo `info` (rampa, §5.1) |
| `color.warning` | Referência | universal | C | — | **Dark** Referência ao Símbolo `caution.400` (Resolução → `#E5A72E`)<br>**Light** Referência ao Símbolo `caution.600` (Resolução → `#A66D0C`)<br>**High Contrast** Referência ao Símbolo `caution.300` (Resolução → `#F1C15A`) |
| `color.warning-surface` | Referência | universal | I | — | **Dark** Referência ao Símbolo `caution.900` (Resolução → `#3B2606`)<br>**Light** Referência ao Símbolo `caution.50` (Resolução → `#FDF4E3`)<br>**High Contrast** não declarado |
| `elevation.floating.surface` | Referência | domínio Zion | I | — | Referência a `color.surface.overlay` |
| `elevation.flush.surface` | Referência | domínio Zion | C | — | Referência a `color.surface.canvas` |
| `elevation.raised.surface` | Referência | domínio Zion | I | — | Referência a `color.surface.raised` |
| `elevation.surface.border` | Referência | domínio Zion | C | — | Referência a `color.border.subtle` |
| `elevation.surface.surface` | Referência | domínio Zion | C | — | Referência a `color.surface.default` |
| `shadow.color` | Referência | domínio Zion | C | — | **Dark** `#000000` — Valor (sem Referência)<br>**Light** Referência a `base.900`<br>**High Contrast** `#000000` — Valor (sem Referência) |
| `shadow.floating.color` | Transformação | domínio Zion | C | — | **Dark** Transformação: `shadow.color` @ 30%<br>**Light** Transformação: `shadow.color` @ 12%<br>**High Contrast** Transformação: `shadow.color` @ 30% |
| `shadow.overlay.color` | Transformação | domínio Zion | C | — | **Dark** Transformação: `shadow.color` @ 40%<br>**Light** Transformação: `shadow.color` @ 16%<br>**High Contrast** Transformação: `shadow.color` @ 40% |
| `shadow.raised.color` | Transformação | domínio Zion | C | — | **Dark** Transformação: `shadow.color` @ 24%<br>**Light** Transformação: `shadow.color` @ 8%<br>**High Contrast** Transformação: `shadow.color` @ 24% |
| `state.critical` | Referência | universal | C | — | Referência → color.critical |
| `state.disabled.icon` | Referência | universal | C | — | Referência → color.icon.disabled |
| `state.disabled.text` | Referência | universal | C | — | Referência → color.text.disabled |

**Posição Component** — 31

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `analytics-card.delta.color` | Referência | domínio Zion | C | `AnalyticsCard` | Referência → color.text.primary |
| `analytics-card.meaning.color` | Referência | domínio Zion | C | `AnalyticsCard` | Referência → color.analytics |
| `analytics-card.surface` | Referência | domínio Zion | C | `AnalyticsCard` | Referência → color.surface.default |
| `coach-card.gain.color` | Referência | domínio Zion | C | `CoachCard` | Referência → color.text.secondary |
| `coach-card.meaning.color` | Referência | domínio Zion | I | `CoachCard` | Referência → color.coach |
| `coach-card.surface` | Referência | domínio Zion | C | `CoachCard` | Referência → color.surface.overlay |
| `coach-card.text.color` | Referência | domínio Zion | C | `CoachCard` | Referência → color.text.primary |
| `health-card.icon.color` | Referência | domínio Zion | C | `HealthCard` | Referência → color.icon.secondary |
| `health-card.label.color` | Referência | domínio Zion | C | `HealthCard` | Referência → color.text.secondary |
| `health-card.surface` | Referência | domínio Zion | C | `HealthCard` | Referência → color.surface.default |
| `health-meter.meaning.color` | Referência | domínio Zion | C | `HealthMeter` | **Saudável** Referência → color.health.healthy<br>**Atenção** Referência → color.health.attention<br>**Crítico** Referência → color.health.critical<br>**Sem medição** Referência → color.health.empty |
| `mission-card.action.color` | Referência | domínio Zion | I | `MissionCard` | Referência → color.mission |
| `mission-card.priority.color` | Referência | domínio Zion | C | `MissionCard` | **Prioridade Alta** Referência → color.priority.high<br>**Prioridade Média** Referência → color.priority.medium<br>**Prioridade Baixa** Referência → color.priority.low |
| `mission-card.rationale.color` | Referência | domínio Zion | C | `MissionCard` | Referência → color.text.secondary |
| `mission-card.surface` | Referência | domínio Zion | C | `MissionCard` | Referência → color.surface.default<br>**Topo** Referência → color.surface.raised |
| `mission-card.title.color` | Referência | domínio Zion | C | `MissionCard` | Referência → color.text.primary |
| `origin-badge.label.color` | Referência | domínio Zion | C | `OriginBadge` | Referência → color.text.secondary |
| `origin-badge.meaning.color` | Referência | domínio Zion | I | `OriginBadge` | **ERP** Referência → color.origin.erp<br>**IA** Referência → color.origin.ai<br>**Estimado** Referência → color.origin.estimate<br>**Operador** Referência → color.origin.operator<br>**Template** Referência → color.origin.template<br>**Integração** Referência → color.origin.integration<br>**Política** Referência → color.origin.policy |
| `origin-badge.surface` | Referência | domínio Zion | C | `OriginBadge` | Referência → color.surface.raised |
| `precision-badge.label.color` | Referência | domínio Zion | C | `PrecisionBadge` | Referência → color.text.secondary |
| `precision-badge.meaning.color` | Referência | domínio Zion | C | `PrecisionBadge` | **Alta** Referência → color.precision.high<br>**Média** Referência → color.precision.medium<br>**Baixa** Referência → color.precision.low |
| `precision-badge.surface` | Referência | domínio Zion | C | `PrecisionBadge` | Referência → color.surface.raised |
| `priority-badge.label.color` | Referência | domínio Zion | C | `PriorityBadge` | Referência → color.text.primary |
| `priority-badge.meaning.color` | Referência | domínio Zion | C | `PriorityBadge` | **Alta** Referência → color.priority.high<br>**Média** Referência → color.priority.medium<br>**Baixa** Referência → color.priority.low |
| `priority-badge.surface` | Referência | domínio Zion | C | `PriorityBadge` | Referência → color.surface.raised |
| `timeline-card.anchor.color` | Referência | domínio Zion | C | `TimelineCard` | **Âncora** Referência → color.information |
| `timeline-card.narrative.color` | Referência | domínio Zion | C | `TimelineCard` | Referência → color.text.primary |
| `timeline-card.surface` | Referência | domínio Zion | C | `TimelineCard` | Referência → color.surface.default |
| `timeline-card.time.color` | Referência | domínio Zion | C | `TimelineCard` | Referência → color.text.tertiary |
| `workspace-header.surface` | Referência | domínio Zion | C | `WorkspaceHeader` | Referência → color.surface.default |
| `workspace-header.title.color` | Referência | domínio Zion | C | `WorkspaceHeader` | Referência → color.text.primary |


### Matéria · Typography  

**Posição Foundation** — 26

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `scale.type.12` | Valor | universal | C | — | 12 |
| `scale.type.13` | Valor | universal | C | — | 13 |
| `scale.type.14` | Valor | universal | C | — | 14 |
| `scale.type.16` | Valor | universal | C | — | 16 |
| `scale.type.18` | Valor | universal | C | — | 18 |
| `scale.type.22` | Valor | universal | C | — | 22 |
| `scale.type.28` | Valor | universal | C | — | 28 |
| `scale.type.40` | Valor | universal | C | — | 40 |
| `type.body-l.line-height` | Valor | universal | C | — | 1.5 |
| `type.body-m.line-height` | Valor | universal | C | — | 1.5 |
| `type.body-s.line-height` | Valor | universal | C | — | 1.45 |
| `type.caption.line-height` | Valor | universal | C | — | 1.4 |
| `type.display.line-height` | Valor | universal | C | — | 1.1 |
| `type.family.mono` | Restrição | universal | I | — | Restrição: monoespaçada · legível. Nenhuma família concreta é eleita. |
| `type.family.primary` | Restrição | universal | I | — | Restrição: grotesca humanista · alta legibilidade em corpos pequenos · ampla faixa de pesos. Nenhuma família concreta é eleita. |
| `type.label.line-height` | Valor | universal | C | — | 1.2 |
| `type.measure` | Restrição | universal | I | — | Restrição: ~60–75 caracteres por linha no corpo de leitura. |
| `type.mono.line-height` | Valor | universal | C | — | 1.45 |
| `type.numeral` | Valor | universal | C | — | tabular (algarismos de largura fixa, alinhados) |
| `type.title-l.line-height` | Valor | universal | C | — | 1.2 |
| `type.title-m.line-height` | Valor | universal | C | — | 1.25 |
| `type.title-s.line-height` | Valor | universal | C | — | 1.3 |
| `type.weight.max` | Restrição | universal | I | — | Restrição: teto = 600 (semibold). Exclui bold e black (≥ 700). |
| `type.weight.medium` | Valor | universal | C | — | 500 |
| `type.weight.regular` | Valor | universal | C | — | 400 |
| `type.weight.semibold` | Valor | universal | C | — | 600 |

**Posição Semantic** — 20

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `type.body-l.size` | Referência | universal | C | — | → scale.type.16 (resolve em 16) |
| `type.body-l.weight` | Referência | universal | C | — | → type.weight.regular (resolve em 400) |
| `type.body-m.size` | Referência | universal | C | — | → scale.type.14 (resolve em 14) |
| `type.body-m.weight` | Referência | universal | C | — | → type.weight.regular (resolve em 400) |
| `type.body-s.size` | Referência | universal | C | — | → scale.type.13 (resolve em 13) |
| `type.body-s.weight` | Referência | universal | C | — | → type.weight.regular (resolve em 400) |
| `type.caption.size` | Referência | universal | C | — | → scale.type.12 (resolve em 12) |
| `type.caption.weight` | Referência | universal | C | — | → type.weight.regular (resolve em 400) |
| `type.display.size` | Referência | universal | C | — | → scale.type.40 (resolve em 40) |
| `type.display.weight` | Referência | universal | C | — | → type.weight.semibold (resolve em 600) |
| `type.label.size` | Referência | universal | C | — | → scale.type.13 (resolve em 13) |
| `type.label.weight` | Referência | universal | C | — | → type.weight.medium (resolve em 500) |
| `type.mono.size` | Referência | universal | C | — | → scale.type.13 (resolve em 13) |
| `type.mono.weight` | Referência | universal | C | — | → type.weight.regular (resolve em 400) |
| `type.title-l.size` | Referência | universal | C | — | → scale.type.28 (resolve em 28) |
| `type.title-l.weight` | Referência | universal | C | — | → type.weight.semibold (resolve em 600) |
| `type.title-m.size` | Referência | universal | C | — | → scale.type.22 (resolve em 22) |
| `type.title-m.weight` | Referência | universal | C | — | → type.weight.semibold (resolve em 600) |
| `type.title-s.size` | Referência | universal | C | — | → scale.type.18 (resolve em 18) |
| `type.title-s.weight` | Referência | universal | C | — | → type.weight.semibold (resolve em 600) |

**Posição Component** — 12

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `origin-badge.label.line-height` | Referência | domínio Zion | C | `OriginBadge` | Referência → type.label.line-height |
| `origin-badge.label.size` | Referência | domínio Zion | C | `OriginBadge` | Referência → type.label.size |
| `origin-badge.label.weight` | Referência | domínio Zion | C | `OriginBadge` | Referência → type.label.weight |
| `precision-badge.label.line-height` | Referência | domínio Zion | C | `PrecisionBadge` | Referência → type.label.line-height |
| `precision-badge.label.size` | Referência | domínio Zion | C | `PrecisionBadge` | Referência → type.label.size |
| `precision-badge.label.weight` | Referência | domínio Zion | C | `PrecisionBadge` | Referência → type.label.weight |
| `priority-badge.label.line-height` | Referência | domínio Zion | C | `PriorityBadge` | Referência → type.label.line-height |
| `priority-badge.label.size` | Referência | domínio Zion | C | `PriorityBadge` | Referência → type.label.size |
| `priority-badge.label.weight` | Referência | domínio Zion | C | `PriorityBadge` | Referência → type.label.weight |
| `workspace-header.title.line-height` | Referência | domínio Zion | C | `WorkspaceHeader` | Referência → type.title-l.line-height |
| `workspace-header.title.size` | Referência | domínio Zion | C | `WorkspaceHeader` | Referência → type.title-l.size |
| `workspace-header.title.weight` | Referência | domínio Zion | C | `WorkspaceHeader` | Referência → type.title-l.weight |


### Matéria · Spacing  

**Posição Foundation** — 15

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `a11y.focus.ring.offset` | Valor | domínio Zion | C | — | 2 |
| `space.0` | Valor | domínio Zion | C | — | 0 |
| `space.1` | Valor | domínio Zion | C | — | 4 |
| `space.10` | Valor | domínio Zion | C | — | 40 |
| `space.12` | Valor | domínio Zion | C | — | 48 |
| `space.16` | Valor | domínio Zion | C | — | 64 |
| `space.2` | Valor | domínio Zion | C | — | 8 |
| `space.20` | Valor | domínio Zion | C | — | 80 |
| `space.3` | Valor | domínio Zion | C | — | 12 |
| `space.4` | Valor | domínio Zion | C | — | 16 |
| `space.5` | Valor | domínio Zion | C | — | 20 |
| `space.6` | Valor | domínio Zion | C | — | 24 |
| `space.8` | Valor | domínio Zion | C | — | 32 |
| `space.scale` | Restrição | domínio Zion | I | — | Restrição — todo Valor admissível da Matéria Spacing é múltiplo de 4 |
| `space.separation` | Restrição | domínio Zion | I | — | **relacionado — as duas entidades pertencem ao mesmo agrupamento** Restrição — o Valor admissível é o Conteúdo de `space.1`, de `space.2` ou de `space.3`<br>**bloco — as duas entidades separadas são blocos** Restrição — o Valor admissível é o Conteúdo de `space.4`, de `space.5` ou de `space.6`<br>**seção — as duas entidades separadas são seções** Restrição — o Valor admissível é o Conteúdo de `space.8`, de `space.10` ou de `space.12`<br>**distinto — as duas entidades não pertencem ao mesmo agrupamento** Restrição — o Valor admissível é o Conteúdo de `space.6` ou o de qualquer passo superior (`space.8`, `space.10`, `space.12`, `space.16`, `space.20`) |

**Posição Semantic** — 2

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `grid.gutter` | Referência | domínio Zion | C | — | **mobile** space.4<br>**tablet** space.4<br>**desktop** space.6 |
| `grid.margin` | Referência | domínio Zion | C | — | **mobile** space.4<br>**tablet** space.6<br>**desktop** space.12 |

**Posição Component** — 9

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `analytics-card.padding` | Referência | domínio Zion | C | `AnalyticsCard` | Referência → space.4 |
| `coach-card.padding` | Referência | domínio Zion | C | `CoachCard` | Referência → space.4 |
| `health-card.padding` | Referência | domínio Zion | C | `HealthCard` | Referência → space.4 |
| `mission-card.padding` | Referência | domínio Zion | C | `MissionCard` | Referência → space.4 |
| `origin-badge.padding` | Referência | domínio Zion | C | `OriginBadge` | Referência → space.1 |
| `precision-badge.padding` | Referência | domínio Zion | C | `PrecisionBadge` | Referência → space.1 |
| `priority-badge.padding` | Referência | domínio Zion | C | `PriorityBadge` | Referência → space.1 |
| `timeline-card.event.gap` | Referência | domínio Zion | C | `TimelineCard` | Referência → space.3 |
| `workspace-header.padding` | Referência | domínio Zion | C | `WorkspaceHeader` | Referência → space.6 |


### Matéria · Radius  

**Posição Foundation** — 7

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `radius.full` | Valor | domínio Zion | C | — | 9999 |
| `radius.lg` | Valor | domínio Zion | C | — | 12 |
| `radius.md` | Valor | domínio Zion | C | — | 8 |
| `radius.none` | Valor | domínio Zion | C | — | 0 |
| `radius.sm` | Valor | domínio Zion | C | — | 6 |
| `radius.xl` | Valor | domínio Zion | C | — | 16 |
| `radius.xs` | Valor | domínio Zion | C | — | 4 |

**Posição Component** — 7

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `analytics-card.radius` | Referência | domínio Zion | C | `AnalyticsCard` | Referência → radius.md |
| `coach-card.radius` | Referência | domínio Zion | C | `CoachCard` | Referência → radius.lg |
| `health-card.radius` | Referência | domínio Zion | C | `HealthCard` | Referência → radius.md |
| `mission-card.radius` | Referência | domínio Zion | C | `MissionCard` | Referência → radius.md |
| `origin-badge.radius` | Referência | domínio Zion | C | `OriginBadge` | Referência → radius.xs |
| `precision-badge.radius` | Referência | domínio Zion | C | `PrecisionBadge` | Referência → radius.xs |
| `priority-badge.radius` | Referência | domínio Zion | C | `PriorityBadge` | Referência → radius.xs |


### Matéria · Elevation  

**Posição Foundation** — 6

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `elevation.floating.level` | Valor | domínio Zion | C | — | 3 |
| `elevation.flush.level` | Valor | domínio Zion | C | — | 0 |
| `elevation.overlay.level` | Valor | domínio Zion | C | — | 4 |
| `elevation.raised.level` | Valor | domínio Zion | C | — | 2 |
| `elevation.surface.level` | Valor | domínio Zion | C | — | 1 |
| `state.pressed.elevation` | Operação | universal | I | — | recua um grau de elevação a partir da elevação corrente; magnitude 'leve' não determinada |

**Posição Component** — 2

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `coach-card.elevation` | Referência | domínio Zion | I | `CoachCard` | Referência → elevation.floating |
| `workspace-header.elevation` | Referência | domínio Zion | I | `WorkspaceHeader` | Referência → elevation.surface |


### Matéria · Shadow  

**Posição Foundation** — 6

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `shadow.floating.blur` | Valor | domínio Zion | C | — | **Dark** 16<br>**Light** 12<br>**High Contrast** 16 |
| `shadow.floating.offset-y` | Valor | domínio Zion | C | — | **Dark** 6<br>**Light** 4<br>**High Contrast** 6 |
| `shadow.overlay.blur` | Valor | domínio Zion | C | — | **Dark** 32<br>**Light** 24<br>**High Contrast** 32 |
| `shadow.overlay.offset-y` | Valor | domínio Zion | C | — | **Dark** 12<br>**Light** 8<br>**High Contrast** 12 |
| `shadow.raised.blur` | Valor | domínio Zion | C | — | **Dark** 8<br>**Light** 3<br>**High Contrast** 8 |
| `shadow.raised.offset-y` | Valor | domínio Zion | C | — | **Dark** 2<br>**Light** 1<br>**High Contrast** 2 |


### Matéria · Iconography  

**Posição Foundation** — 4

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `icon.size.l` | Valor | domínio Zion | C | — | 24 |
| `icon.size.m` | Valor | domínio Zion | C | — | 20 |
| `icon.size.s` | Valor | domínio Zion | C | — | 16 |
| `icon.style` | Valor | universal | C | — | linha (outline) |


### Matéria · Traço  

**Posição Foundation** — 2

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `a11y.focus.ring.width` | Valor | domínio Zion | C | — | 2 |
| `icon.stroke` | Restrição | universal | I | — | 1.5–2 (faixa; delimita o peso de traço admissível sem eleger um Valor) |


### Matéria · Grid  

**Posição Foundation** — 4

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `grid.bp.mobile` | Valor | domínio Zion | C | — | 640 |
| `grid.bp.notebook` | Valor | domínio Zion | C | — | 1280 |
| `grid.bp.tablet` | Valor | domínio Zion | C | — | 1024 |
| `grid.columns` | Valor | domínio Zion | C | — | **mobile** 4<br>**tablet** 8<br>**desktop** 12 |


### Matéria · Layout  

**Posição Foundation** — 5

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `grid.content.max` | Restrição | domínio Zion | I | — | 1440 |
| `layout.actionpanel.width` | Valor | domínio Zion | C | — | 320 |
| `layout.header.height` | Valor | domínio Zion | C | — | 64 |
| `layout.sidebar.collapsed` | Valor | domínio Zion | C | — | 64 |
| `layout.sidebar.width` | Valor | domínio Zion | C | — | 240 |

**Posição Semantic** — 1

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `layout.main.max` | Referência | domínio Zion | I | — | grid.content.max |

**Posição Component** — 1

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `workspace-header.height` | Referência | domínio Zion | C | `WorkspaceHeader` | Referência → layout.header.height |


### Matéria · Motion  

**Posição Foundation** — 10

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `motion.duration.deliberate` | Valor | universal | C | — | 320 ms |
| `motion.duration.instant` | Valor | universal | C | — | 0 ms |
| `motion.duration.micro` | Valor | universal | C | — | 80 ms |
| `motion.duration.quick` | Valor | universal | C | — | 140 ms |
| `motion.duration.slow` | Valor | universal | C | — | 480 ms |
| `motion.duration.standard` | Valor | universal | C | — | 220 ms |
| `motion.easing.emphasized` | Restrição | universal | I | — | curva suave com leve ênfase — delimita o conjunto das curvas admissíveis sem eleger nenhuma |
| `motion.easing.entrance` | Restrição | universal | I | — | curva que desacelera ao chegar — delimita o conjunto das curvas admissíveis sem eleger nenhuma |
| `motion.easing.exit` | Restrição | universal | I | — | curva que acelera ao sair — delimita o conjunto das curvas admissíveis sem eleger nenhuma |
| `motion.easing.standard` | Restrição | universal | I | — | curva de saída suave — delimita o conjunto das curvas admissíveis sem eleger nenhuma |

**Posição Semantic** — 2

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `motion.duration.context-swap` | Referência | domínio Zion | C | — | motion.duration.instant |
| `state.hover.motion` | Referência | universal | C | — | Referência → motion.duration.micro (80 ms) |

**Posição Component** — 2

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `coach-card.entrance.easing` | Referência | domínio Zion | I | `CoachCard` | Referência → motion.easing.entrance |
| `mission-card.exit.easing` | Referência | domínio Zion | I | `MissionCard` | Referência → motion.easing.emphasized |


### Matéria · State  

**Posição Foundation** — 2

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `state.hover.overlay` | Operação | universal | C | — | sobrepõe +8% da cor de conteúdo (text/icon) sobre a superfície semântica resolvida |
| `state.pressed.overlay` | Operação | universal | C | — | sobrepõe +12% de overlay sobre a superfície semântica resolvida |

**Posição Component** — 2

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `analytics-card.attention` | Transformação | domínio Zion | I | `AnalyticsCard` | Transformação: atenuação («sutil») cujo operando é a Referência → state.critical. A Operação e o seu grau não são declarados |
| `health-card.dimension-critical` | Referência | domínio Zion | I | `HealthCard` | Referência → state.critical |


### Matéria · A11y  

**Posição Foundation** — 4

| Símbolo | Espécie | Escopo | Compl. | Destinação | Conteúdo (por Contexto) |
|---|---|---|:--:|---|---|
| `a11y.contrast.large` | Restrição | universal | I | — | **Dark** ≥ 3:1<br>**Light** ≥ 3:1<br>**High Contrast** ≥ 4.5:1 |
| `a11y.contrast.text` | Restrição | universal | I | — | Dark<br>**Light** ≥ 4.5:1 (AA)<br>**High Contrast** ≥ 7:1 (AAA) |
| `a11y.spacing.min` | Restrição | domínio Zion | I | — | ≥ space.2 (8) |
| `a11y.target.min` | Restrição | universal | I | — | ≥ 44 × 44 (por eixo) |

---

## Parte C — Incompatibilidades

Estas são as **falhas honestas** da reescrita: pontos em que o 004 anterior dependia de algo que os 31 conceitos da Ontologia **não exprimem**. Nenhum foi forçado a um encaixe e nenhum gerou conceito novo — cada um é **nomeado, não criado**. Se a Zion quiser recuperá-los, terá de **expandir a Ontologia** primeiro (é o que o próprio Critério de aceite da Ontologia manda: "se algum conceito adicional for necessário, a Ontologia está incompleta e deve ser expandida antes de encerrar").

Os conceitos ausentes caem em **dez famílias**:

1. **Significado.** O eixo sobre o qual todo o 004 girava. P1 dá ao Símbolo um único predicado — *distinguir* —; um Símbolo designa, não significa. Ausentes: *Significado, Denotação, Acepção do Símbolo, Proveniência/Rastreabilidade* (o vínculo de um Token ao DS 003 que ele "materializa" coexistiria com o seu Conteúdo, violando a Norma 4.0 — uma só espécie por Conteúdo), *Restrição sobre Símbolo* (a regra "nomes nunca descrevem a cor" delimitaria Símbolos, e a Ontologia só delimita Valores).

2. **Papel.** O uso que um Token serve sem se vincular a um Consumidor único (não é Destinação) nem discriminar alternativas exclusivas (não é Contexto). Decompostos os papéis tipográficos, `type.body-s.size`, `type.label.size` e `type.mono.size` tornam-se **indiscerníveis**. Ausentes: *Papel, Suporte* (texto vs. ícone "são materiais diferentes" com Conteúdo idêntico), *Exemplar* ("*ref.: Inter*").

3. **Escala e família.** Uma rampa não é um conjunto de cores: é uma **escala ordenada**, e o passo é um índice. A Norma D4.1 proíbe que `base`…`info` sejam seis Matérias (mesmo objeto: cor); a Ontologia não ordena Símbolos distintos de uma mesma Matéria. Ausentes: *Agrupamento de Tokens de mesma Matéria, Ordenação entre Símbolos, Lei de escala, Notação* (a forma `space.12` determinar 48), *Notação de um Valor* (o hexadecimal como forma canônica), *Agregado/Família* (um Símbolo que designa um conjunto — é por isto que `color.coach`, `color.mission`, `color.organization` e `color.origin.ai`, que "apontam para `brand`" nu, ficam **Incompletos**), *Comparação* (a Missão recebe "mais espaço" que os demais).

4. **Conduta do Consumidor.** P5 põe o Consumidor **fora** do conjunto das Declarações; a única relação declarável com ele é a Destinação (D3), que o alcança, nunca o obriga. Ausentes: *Obrigação do Consumidor* ("cor nunca sozinha"; "DISABLED sempre com motivo visível"), *Coocorrência obrigatória* (a cor só admissível se houver texto+ícone), *Canal de codificação de significado* e *Canal perceptivo* (a ordem "rótulo → ícone → cor"), *Diretiva de comportamento* (LOADING exibe skeleton; PERMISSION_DENIED não revela dado).

5. **Consumidor tipado.** D3 vincula a **exatamente um** Consumidor plano. O 004 precisa de Consumidores em espécies e em contenção. Ausentes: *Espécie de Consumidor* (a peça que consome × a ferramenta que lê), *Classe de Consumidores* (o raio "proporcional ao tamanho da superfície"; a borda de todo controle interativo), *Composição* (um `HealthMeter` **contido** num `HealthCard`), *Referência a propriedade de Consumidor* (`radius.full` = "circular" depende da medida do destinatário).

6. **Contexto além de discriminar.** P4 discrimina alternativas, mas não funda o ato que fixa qual vigora nem o que combina Contextos. Ausentes: *Eleição de Contexto* ("ativação por escolha do usuário"), *Contexto padrão* ("Dark — primário"), *Persistência* e *Transição de Contexto* ("persiste entre sessões"; "trocar de tema nunca perde estado"), *Declaração condicional* (o `on-accent` de um tema **futuro**), *Composição/Exclusão de Contextos* (`space.4` admissível sob "bloco" e inadmissível sob "distinto", simultâneos).

7. **Norma de alcance externo.** Uma Restrição (4.1) só delimita o Conteúdo do Símbolo em que é declarada. O 004 tem regras que alcançam **outros** Símbolos. Ausentes: *Restrição de alcance externo* (a regra `on-accent` que "governa todos os tokens on-accent"), *Conformidade* (a Resolução sujeita ao contraste declarado noutro Símbolo — "≥ 7:1"), *Validação* (o componente que "pula para Foundation é rejeitado em revisão" — a Ontologia tem quem declara, D5, não quem verifica), *Restrição relacional / parametrizada por Referência* (`a11y.spacing.min` = `space.2` é ao mesmo tempo limiar e Referência; origens "distinguíveis entre si"), *Conformidade com documento externo* ("respeita as Product Laws").

8. **Cardinalidade.** "No máximo **1** crítico por tela" delimita **ocorrências**, não Valores — a Restrição (4.1) exclui Valores, não conta ocorrências. Ausentes: *Restrição de composição/cardinalidade*.

9. **Tempo.** A Ontologia é atemporal ("o que não é declarado não existe"); nenhum conceito ordena Declarações por sucessão. Ausentes: *Processo* (o fluxo "necessidade → revisão → versionamento → comunicação"), *Ciclo de vida / vigência* (o deprecado "permanece legível por um ciclo, depois é removido"), *Sucessão de Declarações* (a versão como ordem), *provisoriedade / ratificação* (valores "ratificáveis pela marca").

10. **Orientar, justificar, avaliar.** Ausentes: *Alvo* (o "objetivo AAA" que orienta sem excluir — uma Restrição *excluiria* 6.9:1), *Justificativa / Critério de eleição / propósito* ("reduz carga cognitiva ou reforça identidade" — a Ontologia **proíbe** justificativa em toda definição), *Esforço do Consumidor* ("simples para uso diário"), *Qualificação do conjunto* ("a soma dos tokens produz sobriedade" — todos os qualificadores têm por domínio um Token isolado), *Valor de verdade* ("Registros oficiais **verdadeiros**" — uma Declaração institui, não corresponde a um estado do mundo), *Competência* (o que uma Autoridade **pode** declarar — D5 imputa, não limita).

> **Colisão de grafia registrada:** o 004 usava "universal" para dizer que o Contexto High Contrast "vale para toda a plataforma". "universal" é termo **já ocupado** pelo Escopo (6.2) e não pode ser reusado; o alcance de um Contexto dissolve-se em P4 e o termo não se reaproveita.

O quadro completo, item a item:

| Conceito ausente (nomeado, não criado) | § do 004 | Trecho que o exige |
|---|---|---|
| **«Regra»** | § 10 | «Nunca desloca o alvo do clique: atualização em tempo real "assenta", |
| **«Essencialidade»** | § 10 | «Respeita redução de movimento: `motion.reduced` desliga transições nã |
| **espécie de Conteúdo para relação proporcional aproximada/heurística entre magnitudes** | § 11 | icon.stroke \\| ~1.5–2 (proporcional) |
| **Restrição de composição/cardinalidade** | § 13 | `CRITICAL` … `color.critical` com calma; no máx. **1** por tela |
| **Diretiva de comportamento de Consumidor** | § 13 | `LOADING` … `LoadingSkeleton`, nunca tela branca / `EMPTY` … `EmptySta |
| **Operando de magnitude qualitativa determinada** | § 13 | `PRESSED` … +12% de overlay; **leve recuo de elevação** |
| **Critério normativo que distinga, para uma mesma condição de Consumidor, quando ela é uma instância de Contexto** | § 13 | ## 13 … Vocabulário de estados de componente … Cada estado é uma trans |
| **Canal perceptivo e a precedência entre canais** | § 14 | A ordem de percepção é posição → tamanho → peso → cor. A cor é o últim |
| **Canal de codificação de significado** | § 14 | a11y.meaning.reinforce = rótulo + ícone — significado nunca só por cor |
| **critério de validação/rejeição de codificação perceptiva distinto de Completude** | § 14 | Um valor visual que só se distingue por cor está incompleto e é rejeit |
| **Restrição parametrizada por Referência** | § 14 | a11y.spacing.min = space.2 (8) — separação mínima entre alvos. |
| **Processo** | § 15 | necessidade → impacto → revisão (Design + Produto/Brand) → atualização |
| **Ciclo de vida / vigência temporal e remoção diacrônica de uma Declaração** | § 15 | permanece legível por um ciclo (para migração), depois é removido (§15 |
| **Critério de justificação / propósito** | § 15 | □ Reduz carga cognitiva ou reforça identidade? (§15.4) |
| **Conformidade com autoridade/documento normativo externo** | § 15 | □ Respeita as Product Laws e a acessibilidade? (§15.4) |
| **Matéria cujo objeto seja um vocabulário de domínio** | § 16 | «color.priority.* (low/medium/high — três níveis)» (PriorityBadge) |
| **conceito que relacione um Consumidor ao conjunto das condições que ele admite** | § 16 | Coluna «Estado/Motion» de §16 no seu conjunto (hover/pressed, VISIBLE/ |
| **ordenação entre Símbolos distintos de uma mesma Matéria** | § 5.1 | «Foundation — rampas (12 passos, 50→950)» (5.1), com «Escala, não avul |
| **qualificação de uma Declaração como pendente de ratificação por uma Autoridade** | § 5.1 | «São referência ratificável pela marca ([§15]); a estrutura é definiti |
| **Classe de Consumidores** | § 5.2, § 8 | «Toda borda que comunica interação utiliza border.control. Toda borda |
| **Suporte** | § 5.2 | «texto e ícone **são materiais diferentes**. Texto é lido; ícone é rec |
| **Restrição de alcance externo** | § 5.2 | «Esta é uma **regra estrutural de tokens**, não uma exceção local. Ela |
| **Declaração condicional** | § 5.2 | «**Consequência automática:** se um tema futuro tornar o acento claro, |
| **critério de eleição** | § 5.3 | «idem; nunca ‹grita› (DS §10).» — coluna Regra de `color.critical` |
| **acepção do Símbolo** | § 5.3 | coluna «Significado»: `color.critical` = «erro/urgente»; `color.succes |
| **obrigação de cobertura** | § 5.3 | «+ `-surface` sutil (rampa 900/50)» — Dark e Light determinados, High |
| **substituição plural** | § 5.3 | «e `-content`» (Regra da §5.3) contra «O conceito genérico `content.*` |
| **Significado** | § 5.4, § Seções 1–4 | «Significado (DS 003)» — `color.coach` \\| orientação — a IA aponta \\| |
| **Coocorrência obrigatória** | § 5.4 | «Sempre acompanhado de texto + ícone — a cor nunca carrega o significa |
| **Denotacao** | § 5.5 | coluna «Origem»: `color.origin.erp` = 'do ERP' · `color.origin.integra |
| **Restricao relacional** | § 5.5 | «Chips calmos e distinguiveis» |
| **Precedencia perceptiva entre Materias** | § 5.5 | «cor apenas como reforco» · «A ordem oficial e rotulo → icone → cor» |
| **Competencia** | § 5.5 | «este documento apenas colore as origens que a Arquitetura reconhece — |
| **Agregado** | § 5.5 | `color.origin.ai` \\| Aponta para: `brand` |
| **Precedencia entre Simbolos** | § 5.5 | regra estrutural aplicada: «dois Simbolos com o mesmo Conteudo e mesma |
| **Eleição de Contexto** | § 5.6 | «Ativação: por escolha do usuário ou por preferência do sistema» |
| **Persistência da Eleição de Contexto** | § 5.6 | «…; persiste entre sessões.» |
| **Contexto padrão** | § 5.6 | «Dark (primário)» · «Padrão da plataforma; o cockpit vive aqui.» |
| **Conformidade** | § 5.6 | «Cromáticos vêm da rampa 300» · «bordas explícitas (base.0 @ 40–80%)» |
| **Transição de Contexto** | § 5.6 | «Troca instantânea e sem perda: trocar de tema nunca recarrega a tela, |
| **Alvo** | § 5.6 | «O High Contrast adota AAA como objetivo oficial» |
| **Papel** | § 6 | §6.4 — «cada papel tipográfico decompõe-se em tokens atômicos… A compo |
| **Composição** | § 6, § 16 | §6.5 — «Uma ênfase por bloco: um único elemento tipográfico domina cad |
| **Lei de escala** | § 6 | §6.2 — «Escala (modular, razão 1.20 — “minor third”, densa e calma). B |
| **Restrição relacional** | § 6 | §6.5 — «Contraste de tamanho: dois papéis adjacentes diferem o bastant |
| **Exemplar** | § 6 | §6.1 — «Referência neutra: *(ref.: Inter / equivalente)* · *(ref.: uma |
| **Notação** | § 7 | «Token = `space.N` (N em unidades)» com «unidade base = 4» e «Relação |
| **Composição de Contextos** | § 7 | «blocos = 4–6» (§7.2, «Densidade sob controle») junto de «o que é dist |
| **Comparação** | § 7 | «A Missão de topo e a ação principal recebem mais espaço» (§7.2, «Resp |
| **Referência a propriedade de Consumidor** | § 8 | «`radius.full` \\| 9999 \\| avatar, pílulas, toggles \\| **circular**» |
| **Referência plural** | § 9 | «`elevation.raised` … `surface.raised` + sombra `y2 blur8 @ 24%`» liga |
| **Referência a Matéria** | § 9 | §9.1 · «Sinal primário: superfície mais clara» (Dark) · «Sinal primári |
| **cardinalidade de ocorrências de um Token numa composição** | § 9 | §9 · «no máximo **um** nível de elevação de destaque competindo por ve |
| **objeto individual que um Conteúdo determina** | § 9 | `elevation.floating` → `surface.overlay` e `elevation.overlay` → `surf |
| **Agrupamento de Tokens de mesma Matéria** | § Seções 1–4 | «Escala, não avulso. Cores, espaço, tipo, raio e movimento vivem em es |
| **Restrição sobre Símbolo** | § Seções 1–4 | «Nomes nunca descrevem a cor ("vermelho"), sempre o significado ("crit |
| **Espécie de Consumidor** | § Seções 1–4 | «Os Tokens são independentes de tecnologia — Figma, Higgsfield, Storyb |
| **Justificativa de uma Declaração** | § Seções 1–4 | «A clareza governa o valor. Todo token se justifica por reduzir carga |
| **Obrigação do Consumidor** | § Seções 1–4 | «Cor nunca sozinha. Todo significado codificado em cor é sempre reforç |
| **Validação** | § Seções 1–4 | «Um componente que "pula" para um Foundation viola a hierarquia e é re |
| **Qualificação do conjunto dos Tokens** | § Seções 1–4 | «a soma dos tokens produz sobriedade, não ruído» (§17 «Calmo»); «a ide |
| **Valor de verdade de uma Declaração** | § Seções 1–4 | «Registros oficiais presentes e VERDADEIROS» (§18 item 10); «"color.he |
| **Sucessão de Declarações** | § Seções 1–4 | «Documento ESTABILIZADO… um token nasce, MUDA de significado, ou é dep |
| **Proveniência** | § Seções 1–4 | «Rastreável — cada token aponta o significado (DS 003) que materializa |
| **Esforço do Consumidor** | § Seções 1–4 | «Aplicável — simples o bastante para uso diário; rigoroso o bastante p |
| **Notação de um Valor** | § Seções 1–4 | «Cores em hexadecimal (forma canônica, neutra de tecnologia). Escalas |

---

## Parte D — O que foi eliminado

232 enunciados do 004 anterior deixaram de existir como Token. Não são incompatibilidades (nada falta à Ontologia para lidar com eles): a Ontologia os **dissolve**. Por categoria:

| Categoria | Qtd. | Fundamento |
|---|:--:|---|
| **Redundância** | 66 | Dois Símbolos com o mesmo Conteúdo e a mesma Matéria (Parte 7.5). Ex.: os cinco pares `text.*`/`icon.*` resolvem o mesmo Conteúdo cromático; `content.*` já não existia. |
| **Não-Token** | 53 | Enunciado sem Conteúdo determinado: motivação, finalidade, magnitude qualitativa ("leve", "o bastante"), prosa. Nenhuma das seis espécies da Norma 4.0 o acolhe. |
| **Instância de Contexto** | 24 | "Dark", "Light", "High Contrast", "redução de movimento" — são Contextos (P4), não Tokens. |
| **Decomposto (Estrutura eliminada)** | 14 | Conteúdo com partes nomeadas (sombra composta, papéis tipográficos, `state.disabled.content`) partido em Símbolos atômicos — a Parte 4 eliminou Estrutura. |
| **Família/rampa** | 3 | A rampa como entidade ("`base`", "12 passos 50→950") não designa entidade (P1); existem os passos, não a rampa. |
| **Outros** | 72 | Títulos de seção, notas de ferramenta ("Grid é token, não desenho"), a grafia `.`⇄`/` (um Símbolo é um só — P1 —, a sua grafia não o altera), `base.1000` e `color.chromatic.step` (Símbolos jamais declarados com Valor: designados por Referência ou citados em prosa, nunca instituídos — P3/D1). |

> **Casos-limite decididos.** **`base.1000`** foi eliminado: nenhuma Declaração institui Conteúdo para ele — aparece só como alvo da Referência de `color.surface.sunken` sob Dark. Consequência coerente: a Cadeia de `color.surface.sunken` sob Dark não encerra em Valor, logo aquele Token é **Incompleto** (5.5.1), sem lacuna na Ontologia. **`base.0`** sobrevive porque tem Valor **declarado** (`#FFFFFF`, na glosa de `color.text.primary` sob High Contrast) — a assimetria com `base.1000` é real e é de Declaração, não de arbítrio.

---

## Parte E — Verificação

| Verificação | Resultado |
|---|---|
| **Nenhum conceito novo** | Dois críticos independentes auditaram todos os atributos. `posicao ∈ {Foundation, Semantic, Component}` = T3–T5; `especie ∈` as seis da Parte 4; `escopo ∈` 6.2/6.3; toda Matéria mapeia a T6–T9 ou instancia D4 (T9.2). Nenhum atributo espúrio ("camada", "tipo", "peso", "papel", "significado") entrou — o que não coube virou Parte C. |
| **Toda Matéria disjunta (D4.1)** | Reconciliação global fundiu as ~11 propostas de "Color" numa só, separou Shadow/Elevation/Color na sombra composta, e unificou `icon.stroke` + `a11y.focus.ring.width` sob Traço (objeto idêntico). |
| **Posição mecânica** | Derivada de Referência/Destinação, nunca do prefixo. Corrigido `space.separation` (Restrição ⇒ sem Referência ⇒ Foundation, não Semantic). |
| **Falsa incompatibilidade removida** | `shadow.color` ("Posição indeterminada por Contexto") **não** é incompatibilidade: Posição tem domínio Token (T2.1); basta um Contexto ter Referência para o Token ser Semantic. Reclassificado Semantic, como `color.surface.canvas`. |
| **Atribuição completa** | Os 304 Tokens têm os oito atributos preenchidos (Parte B). |

**Contagem final:** 304 Tokens — Foundation 164 · Semantic 74 · Component 66. Completos 253 · Incompletos 51. universal 154 · domínio Zion 150. 13 Matérias. 232 eliminações. 66 conceitos ausentes registrados.

> **Registro constitutivo.** Este documento é derivado, não fundador: sua autoridade é a [Ontologia](./000-ontologia-normativa.md). Nenhum Token aqui define aparência própria; cada um atribui um Conteúdo a um Símbolo, com Matéria, Posição, Espécie, Escopo, Completude e Destinação declarados. O que a Ontologia não exprime não foi contrabandeado — está na Parte C, à espera de uma expansão da Ontologia que só a Arquitetura pode performar.
