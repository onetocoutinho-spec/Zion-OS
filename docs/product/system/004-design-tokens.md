# System/004 — Design Tokens (A Fonte da Verdade Visual)

```
─────────────────────────────────────────────
Status:                  v1.0
Owner:                   Design System / Product / Brand
Documento relacionado:   system/003-design-system.md
Capability:              transversal (materializa 000/001/002/003/004-blueprints)
Prioridade:              Máxima
Última revisão:          2026-07-14
─────────────────────────────────────────────
```

> **Este documento é a transição definitiva entre filosofia e implementação.** Ele é a **Fonte da Verdade oficial de todos os valores visuais** da Zion. Não fala de React, Tailwind, CSS, Figma ou código — define os **valores canônicos, atemporais e independentes de tecnologia** que qualquer implementação deverá respeitar.

> [!important] Registros oficiais
> - **Os Design Tokens são a Fonte da Verdade da identidade visual da Zion.**
> - **Nenhum componente define aparência própria.**
> - **Todo componente consome Design Tokens.**
> - **Os Tokens são independentes de tecnologia** — Figma, Higgsfield, Storybook, React, Tailwind, Flutter, Swift, Android e o que vier depois leem os **mesmos** valores.

> **Autoridade.** Obedece às [Product Laws (002)](./002-product-laws.md) e materializa o [Design System Filosófico (003)](./003-design-system.md): onde o `003` diz *o que comunicar* (Health=segurança, Precisão=confiança…), este `004` diz *com quais valores*. **Organiza** é do [UI Composition (001)](./001-ui-composition-system.md); **comportamento** é do [Component Catalog (004-blueprints)](../blueprints/004-component-catalog.md); **aparência** é daqui.

> **Convenção de nomeação.** Tokens em `dot.case` semântico (ex.: `color.health.healthy`, `space.4`, `motion.duration.standard`). Cores em hexadecimal (forma canônica, neutra de tecnologia). Escalas espaciais em **unidades** (1 unidade = 4). Nomes **nunca** descrevem a cor ("vermelho"), sempre o **significado** ("critical").

> [!important] Convenção oficial e permanente — `.` na documentação ⇄ `/` no Figma
> A documentação escreve **`surface.default`**; o Figma escreve **`surface/default`**. **São exatamente o mesmo token.**
> - O **`.`** representa a **separação lógica** da documentação (a hierarquia do significado).
> - A **`/`** representa o **agrupamento nativo do Figma** (a plataforma **proíbe** `.` em nomes de variável — restrição verificada, não escolha de design).
>
> A tradução é **1:1, determinística e bidirecional**: `a.b.c` ⇄ `a/b/c`. Isso é **transcrição, nunca renomeação** — `surface.default` e `surface/default` **jamais** representam tokens diferentes. Toda ferramenta (Figma, Storybook, React, Flutter, Swift, Android) aplica esta convenção permanentemente ([§15.5](#155-convenção-de-transcrição-documentação--ferramentas)).

---

## 1. Objetivo

Especificar oficialmente os **Design Tokens da Zion** — os valores atômicos da identidade visual — respondendo três perguntas permanentes:

1. **Como a identidade da Zion se materializa visualmente?** Traduzindo os significados do [Design System (003)](./003-design-system.md) e do [Brand DNA (000)](../../brand/000-brand-dna.md) em valores nomeados por propósito.
2. **Como a plataforma mantém consistência visual por muitos anos?** Um valor tem **um** nome e **um** significado; todo componente o consome; ninguém define aparência local.
3. **Como qualquer ferramenta interpreta os mesmos valores?** O token é um contrato neutro de tecnologia: Figma, IA, Storybook, Web e mobile leem a mesma tabela.

> [!important] O que este documento entrega
> A **estrutura**, a **hierarquia**, os **significados** e os **valores canônicos** dos tokens. Não entrega CSS, componentes, nem props — entrega o **dicionário** que todos eles consultam.

---

## 2. Princípios dos Design Tokens

1. **Significado antes de valor.** Um token é um *significado* com um valor anexado, nunca um valor solto. Componentes consomem `color.health.critical`, jamais um hexadecimal cru.
2. **Um significado, um token.** Nenhum valor visual existe duas vezes com nomes diferentes; nenhum nome aponta dois valores. (Espelha "uma palavra, um significado" do Glossário.)
3. **Independência de tecnologia.** O token descreve a intenção; a plataforma traduz. Trocar de framework nunca reescreve os tokens.
4. **Consumo obrigatório.** Aparência só vem de token. Um valor mágico ("só aqui") é um defeito ([§15](#15-governança)).
5. **Escala, não avulso.** Cores, espaço, tipo, raio e movimento vivem em **escalas** matemáticas — previsíveis, não arbitrárias.
6. **A clareza governa o valor.** Todo token se justifica por reduzir carga cognitiva ou reforçar significado ([DS 003 §2](./003-design-system.md)); nenhum existe para decorar.
7. **Acessível por construção.** Contraste, foco e área clicável são tokens de primeira classe, não ajustes finais ([§14](#14-accessibility-tokens)).
8. **Cor nunca sozinha.** Todo significado codificado em cor é **sempre** reforçado por texto + ícone ([L02/L17](./002-product-laws.md)).

---

## 3. Modelo Conceitual

Seis tipos de token, do mais bruto ao mais aplicado:

| Tipo | O que é | Exemplo (nome) | Quem o referencia |
|------|---------|----------------|-------------------|
| **Foundation Token** (primitivo) | Valor bruto numa escala, sem uso decidido. | `base.950`, `brand.500`, `scale.type.400` | **Apenas** Semantic Tokens. |
| **Semantic Token** | Um **significado** apontando para um Foundation. Muda por tema (Dark/Light/High Contrast). | `color.surface.canvas`, `color.health.healthy`, `text.primary` | Component Tokens e composição. |
| **Component Token** | O valor que um componente usa para uma parte sua, apontando para um Semantic. | `mission-card.border`, `coach-card.surface`, `badge.origin.text` | O componente. |
| **Layout Token** | Estrutura espacial da tela: grid, colunas, larguras de região, margens. | `layout.sidebar.width`, `grid.desktop.columns` | Composição de tela ([UICS 001](./001-ui-composition-system.md)). |
| **Motion Token** | Tempo e curva de uma transição, por **significado** de mudança. | `motion.duration.standard`, `motion.easing.exit` | Componentes e transições. |
| **State Token** | A transformação que um **estado** aplica sobre os semânticos. | `state.hover.overlay`, `state.focus.ring`, `state.disabled.content` | Todo componente interativo. |

> [!important] Regra de referência (inquebrável)
> **Componentes referenciam Semantic ou Component Tokens — nunca Foundation.** Só Semantic Tokens tocam Foundation. Isso permite trocar toda a paleta (rebrand, novo tema) mexendo numa camada, sem tocar em nenhum componente.

---

## 4. Hierarquia Oficial

```
FOUNDATION TOKENS        valores brutos, em escala (base, brand, positive, caution, alert, info…)
        │  (só os semânticos leem daqui)
        ▼
SEMANTIC TOKENS          significados, sensíveis a tema (surface, text, icon, health, precision, coach…)
        │  (a única camada que os componentes leem)
        ▼
COMPONENT TOKENS         a peça consome (mission-card.*, coach-card.*, badge.*)
        │
        ▼
SCREEN COMPOSITION       a tela monta com Layout Tokens + componentes ([UICS 001])
```

A regra de leitura é sempre **para cima**: um nível só referencia o nível imediatamente acima. Um componente que "pula" para um Foundation viola a hierarquia e é rejeitado em revisão.

---

## 5. Color System

> **Não definimos cores. Definimos significados.** A cor é a expressão sensorial de um propósito. Nenhum token de cor se chama "vermelho" ou "verde" — chama-se `critical`, `success`, `health.healthy`. Os significados vêm do [Design System 003 §8](./003-design-system.md); aqui recebem valor.

### 5.1 Foundation — rampas (12 passos, `50`→`950`)

Rampas nomeadas por **família de significado**, não por cor. Valores canônicos de referência (dark-first, sóbrios, calmos — consolidam a identidade violeta/quase-preto já existente). **São referência ratificável pela marca ([§15](#15-governança)); a estrutura é definitiva.**

| Passo | `base` (neutro) | `brand` (Zion/Coach) | `positive` (sucesso) | `caution` (atenção) | `alert` (crítico) | `info` (informação) |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 50 | `#F7F7FA` | `#F3EEFF` | `#E8F7F0` | `#FDF4E3` | `#FCECEC` | `#EAF2FD` |
| 100 | `#ECECF2` | `#E4D9FF` | `#C6ECDA` | `#FAE4B8` | `#F8CFCF` | `#CADEFB` |
| 200 | `#D9D9E3` | `#C9B4FF` | `#9EDCBE` | `#F5D08A` | `#F1A9A9` | `#A6C8F7` |
| 300 | `#B9B9C7` | `#AC8CFF` | `#6FD3A6` | `#F1C15A` | `#EE8A8A` | `#7FB2F3` |
| 400 | `#8E8EA0` | `#9366FB` | `#3DBE86` | `#E5A72E` | `#E45D5D` | `#4E90EC` |
| 500 | `#6B6B7B` | `#7C4DF0` | `#1FA46B` | `#CE8A12` | `#D23B3B` | `#2B72DA` |
| 600 | `#4E4E5C` | `#6A3CD8` | `#158257` | `#A66D0C` | `#AE2A2A` | `#1E58AE` |
| 700 | `#35353F` | `#562FB0` | `#0F6444` | `#7C5008` | `#831F1F` | `#164183` |
| 800 | `#20202A` | `#3F2380` | `#0A4A33` | `#573809` | `#5E1616` | `#0F2E5C` |
| 900 | `#0F0F16` | `#2A1857` | `#073523` | `#3B2606` | `#420F0F` | `#0A2143` |
| 950 | `#08080D` | `#1B0F3A` | `#042317` | `#241705` | `#2B0A0A` | `#06152C` |

*(A rampa `base` tem ainda o passo `850` = `#16161E` — usado por `color.surface.raised` no tema escuro. Os passos altos `900`/`950` das rampas cromáticas existem para fundos sutis (`-surface`) em tema escuro.)*

### 5.2 Semantic — superfícies, texto, ícone e borda (sensíveis a tema)

Os **três temas oficiais** ([§5.6](#56-temas-oficiais)) resolvem **o mesmo significado** com valores próprios:

| Semantic Token | Significado | Dark (primário) | Light | High Contrast |
|----------------|-------------|:------:|:-----:|:-------------:|
| `color.surface.canvas` | o fundo do mundo | `base.950` | `base.50` | `#000000` |
| `color.surface.sunken` | recuo (poços, trilhas) | `base.1000` | `base.100` | `#000000` |
| `color.surface.default` | superfície de card | `base.900` | `base.0` | `#0A0A10` |
| `color.surface.raised` | card elevado/ativo | `base.850` | `base.0` + elevação | `base.850` |
| `color.surface.overlay` | drawer/menu/tooltip | `base.800` | `base.0` + elevação | `base.800` |
| `color.text.primary` | texto principal | `base.50` | `base.900` | `base.0` (#FFFFFF) |
| `color.text.secondary` | texto de apoio | `base.300` | `base.600` | `#E6E6EF` |
| `color.text.tertiary` | metadados, hint | `base.400` | `base.500` | `#C9C9D6` |
| `color.text.disabled` | indisponível | `base.600` | `base.300` | `base.400` |
| `color.text.on-accent` | texto sobre cor de marca | `base.50` | `base.0` | **`base.900`** ⚑ |
| `color.text.inverse` | texto sobre superfície invertida | `base.900` | `base.50` | `#000000` |
| `color.icon.primary` | ícone principal | `base.50` | `base.900` | `base.0` |
| `color.icon.secondary` | ícone de apoio | `base.300` | `base.600` | `#E6E6EF` |
| `color.icon.tertiary` | ícone auxiliar | `base.400` | `base.500` | `#C9C9D6` |
| `color.icon.disabled` | indisponível | `base.600` | `base.300` | `base.400` |
| `color.icon.on-accent` | ícone sobre cor de marca | `base.50` | `base.0` | **`base.900`** ⚑ |
| `color.border.subtle` | divisão quase-invisível | `base.0 @ 6%` | `base.900 @ 6%` | `base.0 @ 40%` |
| `color.border.default` | borda de card | `base.0 @ 10%` | `base.900 @ 10%` | `base.0 @ 60%` |
| `color.border.strong` | ênfase/seleção | `base.0 @ 16%` | `base.900 @ 14%` | `base.0 @ 80%` |
| `color.border.focus` | anel de foco | `brand.400` | `brand.500` | `brand.300` |

> [!important] `text.*` e `icon.*` — a separação oficial (substitui `content.*`)
> O conceito genérico `content.*` **deixa de existir**; passam a valer **`text.*`** e **`icon.*`**, com a **mesma escala e o mesmo significado** (primary/secondary/tertiary/disabled/on-accent).
>
> **Motivação arquitetural:** texto e ícone **são materiais diferentes**. Texto é lido; ícone é reconhecido. Eles divergem em *peso óptico* (um ícone de linha a `icon.tertiary` "some" antes de um texto no mesmo valor), em **requisito de contraste** (texto persegue AAA 7:1; ícone/UI, 3:1 — [§14](#14-accessibility-tokens)) e em **evolução** (mudar a legibilidade do texto não deve mexer nos ícones). Um token único forçaria os dois a compartilhar um valor que só é ótimo para um.
>
> **Por que isso ajuda toda plataforma** — sem alterar o significado da documentação: **Figma** (Collections `Text` e `Icon` separadas, aplicáveis a `fill` de texto vs. de vetor), **React**/**Storybook** (`color`× `stroke`/`fill` são propriedades distintas), **Flutter** (`TextStyle.color` × `IconTheme.color`), **Swift** (`foregroundStyle` de `Text` × `Image`), **Android** (`textColor` × `tint`). Todas essas plataformas **já** separam texto de ícone: o token agora fala a língua delas.
>
> **`text.inverse`** existe para texto sobre superfície invertida (o oposto de `primary` no mesmo tema).

> [!important] ⚑ Regra permanente — **todo token `on-accent` utiliza sempre o oposto luminoso do Accent**
> Esta é uma **regra estrutural de tokens**, não uma exceção local. Ela governa **todos** os tokens `on-accent`, hoje e no futuro:
> - **`color.text.on-accent`**
> - **`color.icon.on-accent`**
>
> **Por quê.** Nos temas **Dark** e **Light** o acento é **escuro** (`brand.500`), então o que vai sobre ele é **claro** (`base.50`/`base.0`). No **High Contrast** o acento é **claro por necessidade** (`brand.300`, para contrastar com o canvas preto) — e conteúdo claro sobre acento claro é **ilegível**. Por isso, e exclusivamente no High Contrast, ambos resolvem para **`base.900`**:
>
> | `on-accent` sobre `interaction.primary` | Contraste | Veredito |
> |---|:---:|:---:|
> | Dark — `base.50` sobre `brand.500` | 4.70:1 | ✅ AA |
> | Light — `base.0` sobre `brand.500` | 5.03:1 | ✅ AA |
> | High Contrast — ~~`base.0`~~ sobre `brand.300` | **2.64:1** | ❌ reprovado |
> | High Contrast — **`base.900`** sobre `brand.300` | **7.23:1** | ✅ **AAA** |
>
> **Esta decisão existe para cumprir o requisito de acessibilidade AAA do tema High Contrast** ([§5.6](#56-temas-oficiais), [§14](#14-accessibility-tokens)). Não é preferência estética: sem ela, toda ação primária ficaria ilegível justamente no tema criado para quem mais precisa de legibilidade. **Dark e Light permanecem inalterados.**
>
> **Consequência automática:** se um tema futuro tornar o acento claro, seus `on-accent` **devem** escurecer — sem nova discussão, por aplicação direta desta regra.

### 5.3 Semantic — feedback funcional

| Token | Significado | Dark | Light | High Contrast | Regra |
|-------|-------------|:---:|:---:|:---:|-------|
| `color.success` | deu certo | `positive.400` | `positive.600` | `positive.300` | + `-surface` sutil (rampa 900/50) e `-content`. |
| `color.warning` | atenção, ainda não erro | `caution.400` | `caution.600` | `caution.300` | idem. |
| `color.critical` | erro/urgente | `alert.400` | `alert.500` | `alert.300` | idem; nunca "grita" (DS §10). |
| `color.information` | neutro informativo | `info.400` | `info.600` | `info.300` | idem. |
| `color.neutral` | sem valência | `base.400` | `base.500` | `base.300` | estados neutros/desligados. |

### 5.4 Semantic — domínio Zion (os significados do produto)

Cada um materializa um significado já oficial do [DS 003 §8](./003-design-system.md). **Sempre acompanhado de texto + ícone** — a cor nunca carrega o significado sozinha.

| Token | Significado (DS 003) | Aponta para | Onde aparece |
|-------|----------------------|-------------|--------------|
| `color.health.healthy` | segurança — "está bem" | `success` | `HealthMeter`, `HealthCard` (🟢) |
| `color.health.attention` | segurança em risco | `warning` | `HealthMeter` (🟡) |
| `color.health.critical` | saúde comprometida | `critical` | `HealthMeter` (🔴) |
| `color.health.empty` | ainda medindo | `neutral` | empresa nova |
| `color.precision.high` | confiança — "pode confiar" | `information` | `PrecisionBadge` (confirmado) |
| `color.precision.medium` | confiança parcial | `warning` | `PrecisionBadge` (estimado) |
| `color.precision.low` | baixa confiança (honesta) | `neutral` | `PrecisionBadge` (estimativa) |
| `color.priority.high` | urgência relativa máxima | `critical` | `PriorityBadge` (🔴 Alta) |
| `color.priority.medium` | urgência média | `warning` | `PriorityBadge` (🟠 Média) |
| `color.priority.low` | urgência baixa | `information` | `PriorityBadge` (🟡 Baixa) |
| `color.coach` | orientação — a IA aponta | `brand` | `CoachCard`, IA |
| `color.mission` | ação — "o que fazer agora" | `brand` (ação primária) | `MissionCard`, ação primária |
| `color.analytics` | entendimento — evolução | `information` | `AnalyticsCard` |
| `color.timeline` | memória — o que aconteceu | `neutral` + `info` (âncoras) | `TimelineCard` |
| `color.organization` | identidade do tenant | `brand` | `TenantSwitcher`, marca |

### 5.5 Semantic — origem do dado (proveniência)

Chips calmos e distinguíveis (L04 — todo valor declara sua fonte). Diferenciados por **rótulo + ícone**, cor apenas como reforço:

| Token | Origem ([013a](../../architecture/013a-architecture-review-epic2.md)) | Aponta para |
|-------|-------|-------------|
| `color.origin.erp` | do ERP | `information` |
| `color.origin.ai` | da IA | `brand` |
| `color.origin.estimate` | estimado | `warning` |
| `color.origin.operator` | informado por pessoa | `neutral` |
| `color.origin.template` | de template | `neutral` |
| `color.origin.integration` | de integração | `information` |
| `color.origin.policy` | de política | `neutral` |

> [!important] Cor é o último reforço, nunca o primeiro sinal
> Nenhum estado (Health, Precisão, Prioridade, Origem, Status) é comunicado **só** por cor. A ordem oficial é **rótulo → ícone → cor** ([L02/L17](./002-product-laws.md), [DS 003 §8](./003-design-system.md)). Um usuário sem percepção de cor entende tudo.

> [!important] Vocabulários governados por camadas superiores — este documento **obedece**, não define
> Pela [Hierarquia das Decisões (L 002 §3)](./002-product-laws.md) — *Arquitetura > Produto > Blueprints > System* — três vocabulários **não pertencem** a este documento e são espelhados aqui **sem divergência**:
> - **Health** → `healthy` · `attention` · `critical` (+ `empty`): vocabulário do `HealthMeter` no [Component Catalog §5](../blueprints/004-component-catalog.md). Alterá-lo exige revisar o Catálogo primeiro.
> - **Priority** → `low` · `medium` · `high` (**três níveis, sem um quarto**): vocabulário do `PriorityBadge` no [Component Catalog §5](../blueprints/004-component-catalog.md) e dos badges 🔴🟠🟡 do [Blueprint 001](../blueprints/001-operation-center-blueprint.md).
> - **Origin** → a taxonomia de proveniência é de **Arquitetura** ([013a §Origem da Informação](../../architecture/013a-architecture-review-epic2.md)); este documento **apenas colore** as origens que a Arquitetura reconhece — nunca cria uma nova.

### 5.6 Temas Oficiais

A Zion tem **três temas oficiais**. Um tema **não é uma paleta nova** — é uma **resolução diferente dos mesmos significados** ([§3](#3-modelo-conceitual)). Nenhum componente sabe qual tema está ativo.

| Tema | Objetivo | Quando utilizar |
|------|----------|-----------------|
| **Dark** *(primário)* | A operação diária. Silêncio visual, foco na Missão, calma sob pressão. | Padrão da plataforma; o cockpit vive aqui. |
| **Light** | Ambientes claros, impressão, apresentação, preferência pessoal. | Quando o usuário/ambiente pede; **paridade total** de significado com o Dark. |
| **High Contrast** | **Acessibilidade máxima.** Legibilidade acima de tudo, para baixa visão, luz solar direta, telas de baixa qualidade ou preferência de sistema. | Quando o usuário ativa, ou quando o sistema operacional sinaliza preferência por alto contraste. |

#### Princípios do High Contrast

1. **Mesmo mapa, mesma composição.** O High Contrast **não move, não remove e não adiciona** nada — ele só **amplifica a legibilidade**. A hierarquia ([UICS 001](./001-ui-composition-system.md)) é idêntica.
2. **Contraste é a prioridade máxima**, acima de sobriedade e elegância. É o único tema em que a clareza pode custar refinamento — e deve.
3. **Separação por borda, não por sutileza.** Onde o Dark separa regiões com superfície e sombra, o High Contrast usa **bordas explícitas** (`base.0 @ 40–80%`).
4. **Cromáticos vêm da rampa `300`.** Os passos claros garantem contraste alto sobre preto puro, preservando o **significado** de cada família (`positive`=saudável, `alert`=crítico…).
5. **Nunca inventa significado.** Um token que não existe no Dark **não existe** no High Contrast. O tema muda valores, jamais o vocabulário.
6. **A calma permanece.** Alto contraste **não** é alarme: o crítico continua comunicando "aja aqui", nunca pânico ([DS 003 §10](./003-design-system.md), [Brand](../../brand/000-brand-dna.md)).

#### Acessibilidade — objetivo AAA

| Alvo | Dark / Light | **High Contrast** |
|------|:---:|:---:|
| Texto normal | ≥ 4.5:1 (AA) | **≥ 7:1 (AAA)** |
| Texto grande | ≥ 3:1 | **≥ 4.5:1 (AAA)** |
| Ícone / elemento de UI / borda | ≥ 3:1 | **≥ 4.5:1** |

O High Contrast adota **AAA como objetivo oficial** ([§14](#14-accessibility-tokens)). `text.primary` (#FFFFFF) sobre `surface.canvas` (#000000) atinge **21:1** — o teto absoluto; os demais degraus derivam dele para nunca cair abaixo de 7:1 em texto.

#### Comportamento esperado

- **Ativação:** por escolha do usuário ou por preferência do sistema; **persiste** entre sessões.
- **Troca instantânea e sem perda:** trocar de tema **nunca** recarrega a tela, nunca perde estado, nunca desloca o alvo do clique ([§10](#10-motion-system)).
- **Universal:** vale para **toda** a plataforma — cockpit, workspace e portal. Não existe tela "sem High Contrast".
- **Não é um tema de marca:** a identidade permanece reconhecível (`brand` continua sendo a Zion), apenas mais legível.
- **Cor continua sendo o último reforço:** rótulo → ícone → cor, também aqui.

> [!note] Dark e Light permanecem intocados
> A adição do High Contrast **não altera um único valor** de Dark ou Light. É uma terceira resolução dos mesmos significados.

---

## 6. Typography System

> Tipografia é **ritmo e hierarquia**, não tamanhos. Ela cria a sequência de leitura "o quê → por quê → como → resultado" ([DS 003 §5](./003-design-system.md)).

### 6.1 Família (por papel, não por fonte específica)
| Token | Papel | Critério | Referência neutra |
|-------|-------|----------|-------------------|
| `type.family.primary` | interface e leitura | grotesca humanista, alta legibilidade em corpos pequenos, ampla faixa de pesos | *(ref.: Inter / equivalente)* |
| `type.family.mono` | dados técnicos, IDs, código de canal | monoespaçada legível | *(ref.: uma mono neutra)* |

> A família concreta é ratificação de marca ([§15](#15-governança)); o **papel** e os **critérios** são definitivos.

### 6.2 Escala (modular, razão 1.20 — "minor third", densa e calma)
Base = `16` (corpo). Cada passo é um Foundation `scale.type.*`; os papéis abaixo são os Semantic.

| Token (papel) | Tamanho | Peso | Altura de linha | Uso |
|---------------|:------:|:----:|:---------------:|-----|
| `type.display` | 40 | 600 | 1.1 | marcos, telas de celebração (raro) |
| `type.title.l` | 28 | 600 | 1.2 | título de contexto (WorkspaceHeader) |
| `type.title.m` | 22 | 600 | 1.25 | título de card/seção |
| `type.title.s` | 18 | 600 | 1.3 | subtítulo, título de Missão |
| `type.body.l` | 16 | 400 | 1.5 | leitura principal |
| `type.body.m` | 14 | 400 | 1.5 | corpo padrão da interface |
| `type.body.s` | 13 | 400 | 1.45 | apoio, descrições |
| `type.label` | 13 | 500 | 1.2 | rótulos, botões, badges |
| `type.caption` | 12 | 400 | 1.4 | metadados, hora relativa, hint |
| `type.mono` | 13 | 400 | 1.45 | SKU/EAN/IDs/código de canal |

### 6.3 Pesos (sóbrios — sem gordura)
`type.weight.regular = 400` · `type.weight.medium = 500` · `type.weight.semibold = 600`. **Sem `bold/black`** — ênfase por peso semibold + hierarquia, nunca por peso extremo (Brand: elegância por subtração).

### 6.4 Camada de Tokens — Typography

Estrutura **equivalente às demais Collections** ([§4](#4-hierarquia-oficial)): cada papel tipográfico decompõe-se em tokens atômicos, **theme-independent** (a tipografia não muda por tema).

| Token | Tipo | Valor |
|-------|:----:|:-----:|
| `type.family.primary` · `type.family.mono` | texto | *(papel — ver [§6.1](#61-família-por-papel-não-por-fonte-específica))* |
| `type.display.size` / `.weight` / `.line-height` | número | 40 / 600 / 1.1 |
| `type.title-l.size` / `.weight` / `.line-height` | número | 28 / 600 / 1.2 |
| `type.title-m.size` / `.weight` / `.line-height` | número | 22 / 600 / 1.25 |
| `type.title-s.size` / `.weight` / `.line-height` | número | 18 / 600 / 1.3 |
| `type.body-l.size` / `.weight` / `.line-height` | número | 16 / 400 / 1.5 |
| `type.body-m.size` / `.weight` / `.line-height` | número | 14 / 400 / 1.5 |
| `type.body-s.size` / `.weight` / `.line-height` | número | 13 / 400 / 1.45 |
| `type.label.size` / `.weight` / `.line-height` | número | 13 / 500 / 1.2 |
| `type.caption.size` / `.weight` / `.line-height` | número | 12 / 400 / 1.4 |
| `type.mono.size` / `.weight` / `.line-height` | número | 13 / 400 / 1.45 |
| `type.weight.regular` · `.medium` · `.semibold` | número | 400 · 500 · 600 |

> [!note] Por que decompor em size/weight/line-height
> Um papel tipográfico é uma **composição** de tokens atômicos — é assim que Figma (Text Styles), React, Flutter (`TextStyle`), Swift e Android consomem tipografia. A composição preserva o significado do papel; a decomposição o torna implementável em qualquer plataforma.

### 6.5 Critérios de leitura e ritmo
- **Medida de linha:** corpo entre ~60–75 caracteres; nunca linhas longas demais.
- **Contraste de tamanho:** dois papéis adjacentes diferem o bastante para o olho distinguir sem esforço.
- **Uma ênfase por bloco:** um único elemento tipográfico domina cada agrupamento (DS §5).
- **Números:** tabulares/alinhados onde comparam (Health, deltas), para leitura em coluna.

---

## 7. Spacing System

> Espaço é **respiração e agrupamento** — a ferramenta que transforma dados em leitura fluida ([DS 003 §6](./003-design-system.md)).

### 7.1 Escala oficial (unidade base = 4)
Relação matemática: múltiplos de **4**, densa perto, generosa longe. Token = `space.N` (N em unidades).

| Token | Unidades | Valor | Uso típico |
|-------|:-------:|:-----:|-----------|
| `space.0` | 0 | 0 | colado |
| `space.1` | 1 | 4 | entre ícone e rótulo |
| `space.2` | 2 | 8 | padding interno compacto |
| `space.3` | 3 | 12 | gaps de metadados |
| `space.4` | 4 | 16 | **padding padrão de card** |
| `space.5` | 5 | 20 | separação de sub-blocos |
| `space.6` | 6 | 24 | gap entre cards |
| `space.8` | 8 | 32 | separação de seções |
| `space.10` | 10 | 40 | respiro de região |
| `space.12` | 12 | 48 | margem de conteúdo |
| `space.16` | 16 | 64 | separação maior/vazio calmo |
| `space.20` | 20 | 80 | telas de foco único |

### 7.2 Princípios
- **Densidade sob controle.** Perto = 1–3 unidades; blocos = 4–6; seções = 8–12. Há um **teto** de densidade (DS §7): ultrapassá-lo é defeito, não recurso.
- **Agrupamento por proximidade.** O que é relacionado fica a `space.1`–`space.3`; o que é distinto, a `space.6`+.
- **Respiração ao redor do essencial.** A Missão de topo e a ação principal recebem mais espaço — proeminência por vazio, não por cor.

---

## 8. Radius System

| Token | Valor | Uso | Critério |
|-------|:-----:|-----|----------|
| `radius.none` | 0 | tabelas densas, divisores | quando o ângulo reto ajuda a alinhar |
| `radius.xs` | 4 | badges, chips, `PriorityBadge` | peças mínimas |
| `radius.sm` | 6 | inputs, botões pequenos | controles |
| `radius.md` | 8 | **cards padrão** | a maioria das superfícies |
| `radius.lg` | 12 | painéis, `ActionPanel` | superfícies maiores |
| `radius.xl` | 16 | modais, drawers | contêineres de foco |
| `radius.full` | 9999 | avatar, pílulas, toggles | circular |

Critério geral: **raio proporcional ao tamanho** da superfície — peças pequenas, raio pequeno; superfícies grandes, raio maior. Consistência antes de ousadia (um raio de card em toda a plataforma).

---

## 9. Elevation System

> Elevação é **percepção de distância do fundo** — legibilidade e camadas, nunca espetáculo ([DS 003 §6](./003-design-system.md)). Em tema escuro, elevar = superfície mais clara + borda sutil + sombra suave; em tema claro, sombra é o sinal primário.

| Token | Nível | Significado | Escuro (superfície + sombra) | Uso |
|-------|:----:|-------------|------------------------------|-----|
| `elevation.flush` | 0 | rente ao canvas | `surface.canvas`, sem sombra | fundo, seções |
| `elevation.surface` | 1 | superfície de conteúdo | `surface.default` + borda `subtle` | cards |
| `elevation.raised` | 2 | acima do conteúdo | `surface.raised` + sombra `y2 blur8 @ 24%` | card ativo/hover, `MissionCard` de topo |
| `elevation.floating` | 3 | flutua sobre a tela | `surface.overlay` + sombra `y6 blur16 @ 30%` | `CoachCard`/menus/popover |
| `elevation.overlay` | 4 | camada modal | `surface.overlay` + sombra `y12 blur32 @ 40%` + scrim | drawer, modal |

**Critérios de percepção:** no máximo **um** nível de elevação de destaque competindo por vez; elevação comunica "isto está ativo/acima", nunca é enfeite; overlays sempre com scrim que preserva o contexto atrás ([UICS 001 §4](./001-ui-composition-system.md) — Drawer preserva o contexto).

### 9.1 O sinal de elevação muda por tema

O **nível** é o mesmo nos três temas; o **sinal** que o comunica muda, porque a física da percepção muda:

| Tema | Sinal primário | Sinal de apoio | Por quê |
|------|----------------|----------------|---------|
| **Dark** | **superfície mais clara** (900→850→800) | sombra suave + borda sutil | sobre quase-preto, sombra quase não existe; luz é o que separa. |
| **Light** | **sombra** | borda sutil; superfície permanece branca | sobre branco, não há "mais claro" disponível; a sombra é o único sinal real. |
| **High Contrast** | **borda explícita** (40–80%) | superfície do Dark | sombra é imperceptível para baixa visão; a borda é inequívoca. |

**Valores de sombra por tema** (`shadow.color` = `#000000` no Dark/High Contrast; `base.900` no Light):

| Token | Dark | **Light** | High Contrast |
|-------|:----:|:---------:|:-------------:|
| `shadow.raised` | `y2 blur8 @ 24%` | **`y1 blur3 @ 8%`** | `y2 blur8 @ 24%` |
| `shadow.floating` | `y6 blur16 @ 30%` | **`y4 blur12 @ 12%`** | `y6 blur16 @ 30%` |
| `shadow.overlay` | `y12 blur32 @ 40%` | **`y8 blur24 @ 16%`** | `y12 blur32 @ 40%` |

> [!note] Por que a sombra do Light é mais fraca, não mais forte
> Contra-intuitivo, mas correto: no Dark a sombra precisa de opacidade alta para existir sobre quase-preto; no Light, uma sombra pesada sobre branco vira **sujeira visual** e quebra a calma ([DS 003 §10](./003-design-system.md)). O Light eleva com **sombra curta e leve** — a elegância por subtração da [Brand](../../brand/000-brand-dna.md). **O tema escuro permanece exatamente como estava.**

---

## 10. Motion System

> **Nunca animação por estética. Sempre por significado.** Movimento comunica **mudança de estado** — e sempre com calma operacional ([DS 003 §10](./003-design-system.md), [Brand 000 §Calma](../../brand/000-brand-dna.md)).

### 10.1 Durações
| Token | Valor | Uso |
|-------|:-----:|-----|
| `motion.duration.instant` | 0 ms | mudanças que não devem ser percebidas como animação |
| `motion.duration.micro` | 80 ms | hover, foco, toques de estado |
| `motion.duration.quick` | 140 ms | badges, chips, tooltips |
| `motion.duration.standard` | 220 ms | cards entrando/saindo, painéis |
| `motion.duration.deliberate` | 320 ms | drawers, overlays |
| `motion.duration.slow` | 480 ms | celebração de marco (raro, DS §Emoção) |

### 10.2 Acelerações (curvas)
| Token | Curva (referência) | Uso |
|-------|--------------------|-----|
| `motion.easing.standard` | saída suave | mudanças gerais |
| `motion.easing.entrance` | desacelera ao chegar | algo aparecendo |
| `motion.easing.exit` | acelera ao sair | algo saindo |
| `motion.easing.emphasized` | suave com leve ênfase | Missão concluída sobe, Health atualiza |

### 10.3 Princípios
- **Só para significado:** uma Missão que sai, uma nova que sobe, um Health que muda, um skeleton que resolve.
- **Calma:** curto, suave, nunca chama atenção para si.
- **Nunca desloca o alvo do clique:** atualização em tempo real "assenta", nunca "salta" sob o cursor ([bp/001 §13.10](../blueprints/001-operation-center-blueprint.md)).
- **Respeita redução de movimento:** `motion.reduced` desliga transições não essenciais e mantém apenas mudanças instantâneas de estado ([§14](#14-accessibility-tokens)).

---

## 11. Iconography

| Token | Valor | Significado |
|-------|:-----:|-------------|
| `icon.size.s` | 16 | inline em texto, badges |
| `icon.size.m` | 20 | ações, itens de lista |
| `icon.size.l` | 24 | cabeçalhos, ações principais |
| `icon.stroke` | ~1.5–2 (proporcional) | peso de linha único e consistente |
| `icon.style` | linha (outline) | conjunto de traço, nunca preenchido pesado |

Critérios: **um único conjunto** de ícones de linha, peso consistente, alinhado à baseline do texto; ícone **reforça** o rótulo (nunca substitui) para significados codificados por cor. Referência neutra: um set de linha coerente *(o produto já usa um)*. Ícone jamais é decorativo (DS §Notas para Design).

---

## 12. Grid System

### 12.1 Breakpoints (por composição, não por dispositivo — [UICS 001 §9](./001-ui-composition-system.md))
| Token | Faixa | Composição |
|-------|-------|-----------|
| `grid.bp.mobile` | < 640 | 1 coluna, empilha preservando hierarquia |
| `grid.bp.tablet` | 640–1024 | 2 colunas; `ActionPanel`→Drawer; Sidebar→menu |
| `grid.bp.notebook` | 1024–1280 | 3 colunas; `ActionPanel` colapsável |
| `grid.bp.desktop` | ≥ 1280 | 3 colunas plenas |

### 12.2 Colunas e margens
| Token | Desktop | Tablet | Mobile |
|-------|:------:|:------:|:------:|
| `grid.columns` | 12 | 8 | 4 |
| `grid.gutter` | `space.6` (24) | `space.4` (16) | `space.4` (16) |
| `grid.margin` | `space.12` (48) | `space.6` (24) | `space.4` (16) |
| `grid.content.max` | 1440 | — | — |

### 12.3 Larguras de região (Layout Tokens — [UICS 001 §3](./001-ui-composition-system.md))
| Token | Valor | Região |
|-------|:-----:|--------|
| `layout.sidebar.width` | 240 | Sidebar (destinos globais) |
| `layout.sidebar.collapsed` | 64 | Sidebar recolhida |
| `layout.actionpanel.width` | 320 | Painel Lateral (`ActionPanel`: Coach + QuickActions) |
| `layout.header.height` | 64 | Header/TopBar |
| `layout.main.max` | fluido até `grid.content.max` | Área Principal |

*(Larguras consolidam a casca já existente — Sidebar 240, Header 64.)*

### 12.4 Camada de Tokens — Grid

Estrutura **equivalente às demais Collections**, **theme-independent** (a estrutura da tela não muda por tema):

| Token | Valor | Token | Valor |
|-------|:-----:|-------|:-----:|
| `grid.bp.mobile` | 640 | `grid.columns.desktop` | 12 |
| `grid.bp.tablet` | 1024 | `grid.columns.tablet` | 8 |
| `grid.bp.notebook` | 1280 | `grid.columns.mobile` | 4 |
| `grid.content.max` | 1440 | `grid.gutter.desktop` | 24 |
| `grid.margin.desktop` | 48 | `grid.gutter.tablet` | 16 |
| `grid.margin.tablet` | 24 | `grid.gutter.mobile` | 16 |
| `grid.margin.mobile` | 16 | — | — |
| `layout.sidebar.width` | 240 | `layout.actionpanel.width` | 320 |
| `layout.sidebar.collapsed` | 64 | `layout.header.height` | 64 |

> [!note] Grid é token, não desenho
> Os breakpoints são **pontos de recomposição** ([UICS 001 §9](./001-ui-composition-system.md)), não dispositivos. Tokenizá-los garante que Figma (Layout Grids), React, Flutter, Swift e Android **quebrem a tela nos mesmos pontos** — preservando a hierarquia ao empilhar.

---

## 13. Component States

Vocabulário de estados **único** ([Catalog 004 §4](../blueprints/004-component-catalog.md)), aqui com sua expressão em tokens. Cada estado é uma **transformação** sobre os semânticos — não uma cor nova.

| Estado | Token de transformação | Expressão canônica |
|--------|------------------------|--------------------|
| `DEFAULT` | — | superfície/conteúdo semânticos nominais |
| `HOVER` | `state.hover.overlay` | +8% de conteúdo sobre a superfície; `motion.micro` |
| `FOCUS` | `state.focus.ring` | anel `2` em `color.border.focus` (brand.400), offset `2`; **sempre visível** |
| `PRESSED` | `state.pressed.overlay` | +12% de overlay; leve recuo de elevação |
| `LOADING` | `state.loading.skeleton` | `LoadingSkeleton`, nunca tela branca |
| `EMPTY` | `state.empty` | `EmptyState`; comunica próximo passo/calma |
| `ERROR` | `state.error` | `color.critical` + texto que acolhe e re-tenta (nunca culpa) |
| `CRITICAL` | `state.critical` | `color.critical` com calma; no máx. **1** por tela |
| `DISABLED` | `state.disabled.content` | `color.text.disabled` / `color.icon.disabled`; **sempre com motivo visível** |
| `PERMISSION_DENIED` | `state.permission-denied` | **não busca nem revela dado**; oferece retorno ([RLS 010](../../architecture/010-database-compliance.md)) |

Princípios: o foco **nunca** é removido; estados críticos comunicam "aja aqui", nunca pânico; `DISABLED` sem motivo é proibido.

---

## 14. Accessibility Tokens

Acessibilidade é **token de primeira classe**, não retoque:

| Token | Valor canônico | Regra |
|-------|----------------|-------|
| `a11y.contrast.text` | ≥ 4.5:1 (AA) · **≥ 7:1 no High Contrast (AAA)** | texto normal sobre sua superfície. |
| `a11y.contrast.large` | ≥ 3:1 · **≥ 4.5:1 no High Contrast (AAA)** | texto grande / elementos de UI e ícones. |
| `a11y.focus.ring.width` | 2 | anel de foco sempre perceptível. |
| `a11y.focus.ring.offset` | 2 | respiro entre elemento e anel. |
| `a11y.focus.ring.color` | `color.border.focus` | consistente em toda a plataforma. |
| `a11y.target.min` | 44 × 44 | área clicável mínima (toque). |
| `a11y.spacing.min` | `space.2` (8) | separação mínima entre alvos. |
| `a11y.motion.reduced` | on/off | respeita preferência de menos movimento. |
| `a11y.meaning.reinforce` | rótulo + ícone | significado **nunca** só por cor (L02/L17). |

> [!important] Hierarquia perceptiva
> A ordem de percepção é **posição → tamanho → peso → cor**. A cor é o **último** reforço. Um valor visual que só se distingue por cor está incompleto e é rejeitado ([§17](#17-critérios-de-qualidade)).

---

## 15. Governança

### 15.1 Quem pode criar tokens
| Camada | Quem aprova |
|--------|-------------|
| **Foundation** (rampas, escalas) | Design System + Brand (é decisão de identidade). |
| **Semantic** (significados) | Design System + Produto. |
| **Component** | Design System (deriva de Semantic; nunca introduz valor novo). |
| **Layout/Motion/State/A11y** | Design System, sob as [Product Laws](./002-product-laws.md). |

### 15.2 Como evoluem
Espelha o processo das [Product Laws (002 §Evolução)](./002-product-laws.md): necessidade → impacto → revisão (Design + Produto/Brand) → atualização deste documento → **versionamento** (v1.0→v1.1→v2.0) → comunicação. Um token novo só entra se **não** for expressável por um existente.

### 15.3 Quando depreciar
Um token superado é **marcado como deprecado** apontando o substituto; permanece legível por um ciclo (para migração), depois é removido. Nunca se reusa um nome para outro significado.

### 15.4 Critérios para um token novo
```
□ Expressa um significado que nenhum token atual cobre?
□ Vale para toda a plataforma (não é caso de uma tela)?
□ Reduz carga cognitiva ou reforça identidade?
□ Respeita as Product Laws e a acessibilidade?
□ Pode ser lido por qualquer tecnologia (neutro)?
```
Se qualquer resposta for "não", **não é um token** — é um valor local (defeito) que deve virar variação de um token existente.

> [!important] Valor mágico é dívida
> Qualquer aparência fora de token é um rombo na identidade. A plataforma cresce **absorvendo** a necessidade como token — nunca tolerando exceções ([DS 003 §11](./003-design-system.md)).

### 15.5 Convenção de transcrição (documentação ⇄ ferramentas)

Convenção **oficial e permanente**. Cada ferramenta escreve o mesmo token no seu próprio dialeto; **o token é um só**.

| Camada | Escrita | Motivo |
|--------|---------|--------|
| **Documentação** (este doc, Glossário, Blueprints) | `surface.default` | o **`.`** é a **separação lógica** do significado. |
| **Figma** (Variables) | `surface/default` | a **`/`** é o **agrupamento nativo**; o Figma **proíbe** `.` em nomes de variável. |
| **Código** (qualquer plataforma) | conforme o idioma do alvo | derivado por transformação determinística. |

**Regras:**
1. A tradução é **1:1 e bidirecional**: `a.b.c` ⇄ `a/b/c`. Nada se perde.
2. É **transcrição, nunca renomeação**. `surface.default` e `surface/default` **jamais** são tokens diferentes.
3. **Nenhum documento** adota `/`; **nenhuma ferramenta Figma** adota `.`. Cada camada usa seu dialeto, sempre.
4. Um token novo nasce na **documentação** (com `.`) e desce para as ferramentas — nunca o contrário.
5. A restrição de caractere é da **plataforma**, não da Zion: se um dia o Figma aceitar `.`, a convenção continua válida (o significado nunca dependeu do separador).

---

## 16. Relação com os Componentes

Como os componentes do [Catálogo (004)](../blueprints/004-component-catalog.md) **consomem** tokens (nunca definem aparência própria):

| Componente | Superfície | Conteúdo | Cor de significado | Espaço/Raio | Estado/Motion |
|-----------|-----------|----------|--------------------|-------------|---------------|
| **`MissionCard`** | `surface.default`→`raised` (topo) | `text.primary` (título), `text.secondary` ("por quê") | `color.priority.*`, ação em `color.mission` | `space.4`, `radius.md` | `hover/pressed`, saída `emphasized` ao concluir |
| **`CoachCard`** | `surface.overlay` no `ActionPanel`, `elevation.floating` | `text.primary`; ganho/confiança em `text.secondary` | `color.coach`, `PrecisionBadge`→`color.precision.*` | `space.4`, `radius.lg` | `VISIBLE/DISMISSED/NONE`; entra `entrance` |
| **`HealthCard`** | `surface.default` | rótulos `text.secondary`, ícones `icon.secondary` | `HealthMeter`→`color.health.*` (`healthy/attention/critical/empty`) | `space.4`, `radius.md` | `DIMENSION_CRITICAL`→`state.critical` |
| **`TimelineCard`** | `surface.default` | narrativa `text.primary`, hora `text.tertiary` | âncoras em `color.timeline`/`color.information` | `space.3` entre eventos | `LOADING` skeleton |
| **`AnalyticsCard`** | `surface.default` | deltas `text.primary` | `color.analytics`; ▲▼ com `icon.*` + texto | `space.4`, `radius.md` | `ATTENTION`→`state.critical` sutil |
| **`WorkspaceHeader`** | `surface.default`, `elevation.surface` | `type.title-l` em `text.primary` | Health/estado por `StatusChip` | `space.6`, `layout.header.height` | `CRITICAL/BLOCKED/ARCHIVED` |
| **`OriginBadge`** | chip `surface.raised` | `type.label` em `text.secondary` | `color.origin.*` (reforço; taxonomia da Arquitetura) | `space.1`, `radius.xs` | `DEFAULT` |
| **`PrecisionBadge`** | chip `surface.raised` | `type.label` em `text.secondary` | `color.precision.*` (+ texto: confirmado/estimado) | `space.1`, `radius.xs` | `HIGH/MEDIUM/LOW` |
| **`PriorityBadge`** | chip `surface.raised` | `type.label` em `text.primary` | `color.priority.*` (`low/medium/high` — três níveis) | `space.1`, `radius.xs` | `HIGH/MEDIUM/LOW` |

> [!important] O contrato
> Todo valor acima é um **token**, não um número solto. Trocar `color.coach` uma vez muda o Coach em todo lugar. Nenhum componente "escolhe" cor, tamanho, raio ou tempo — todos **consultam** este documento.

---

## 17. Critérios de Qualidade

Um sistema de tokens é bom quando:

| Critério | Significa |
|----------|-----------|
| **Semântico** | todo token tem nome de significado, nunca de cor/valor cru. |
| **Escalável** | valores vivem em escalas matemáticas previsíveis. |
| **Neutro** | qualquer tecnologia lê os mesmos valores sem tradução ambígua. |
| **Acessível** | contraste, foco e alvo mínimos são cumpridos por construção. |
| **Consistente** | o mesmo significado tem o mesmo valor em toda a plataforma. |
| **Calmo** | a soma dos tokens produz sobriedade, não ruído (Brand/DS). |
| **Aplicável** | simples o bastante para uso diário; rigoroso o bastante para impedir divergência. |
| **Rastreável** | cada token aponta o significado (DS 003) que materializa. |

---

## 18. Critérios de Aceite

- [ ] **Toda cor é um significado** (`health/critical/coach…`), nunca "vermelho/verde".
- [ ] **Hierarquia respeitada:** componentes leem Semantic/Component, nunca Foundation.
- [ ] **Escalas definidas:** cor, tipografia, espaço, raio, elevação, movimento, grid — todas com valores canônicos.
- [ ] **Estados canônicos** ([Catalog §4](../blueprints/004-component-catalog.md)) expressos como transformações de token.
- [ ] **Acessibilidade** com contraste, foco, alvo e "cor nunca sozinha" tokenizados.
- [ ] **Temas** claro e escuro resolvem o mesmo significado.
- [ ] **Governança** define criação, evolução e depreciação.
- [ ] **Mapa componente↔token** cobre os principais componentes do Catálogo.
- [ ] **Neutralidade** comprovada: nenhum token menciona framework, CSS, Figma ou código.
- [ ] **Registros oficiais** presentes e verdadeiros.
- [ ] **Rastreável** ao [Design System 003](./003-design-system.md) e às [Product Laws 002](./002-product-laws.md).

---

## Seção especial — O Design Tokens daqui a 10 anos

Daqui a dez anos, a Zion terá trocado de framework, talvez de plataforma, talvez de ferramenta de design. **Os tokens permanecem.**

Porque um token não é uma linha de CSS nem um estilo de Figma — é um **significado com um valor**. "`color.health.critical` é a expressão da saúde comprometida, com calma" é uma frase verdadeira em React, em Swift, em Flutter e no que vier depois. A tecnologia é o **tradutor**; o token é o **idioma**.

Este documento foi escrito para **ganhar valores, nunca ser reescrito**. Um tema novo é uma nova resolução dos mesmos significados. Um rebrand é trocar as rampas Foundation — uma camada — sem tocar em um único componente. Uma nova plataforma lê a mesma tabela. Enquanto a disciplina "um significado, um token; componente só consome" for honrada, a identidade visual da Zion atravessará a década **intacta**.

> Um sistema de tokens que precisa ser reescrito falhou. Este foi feito para apenas **evoluir** — e nunca perder o significado do que já tem.

---

## Seção especial — A Identidade que Sobrevive

React vai mudar. Tailwind vai mudar. Figma vai mudar. Virão Flutter, Swift, Android, e tecnologias que ainda não existem.

**Os tokens não mudam com elas.**

A `MissionCard` construída em React de 2026 e a `MissionCard` construída em qualquer tecnologia de 2036 são **a mesma Missão** — porque ambas consomem `color.mission`, `space.4`, `radius.md`, `type.title.s`. O que muda é o *como* cada plataforma desenha; o *que* ela desenha é o mesmo contrato.

Essa é a promessa: a identidade da Zion não vive no código — vive nos tokens. O código é substituível; a identidade não. **Trocar de tecnologia nunca deve significar trocar de cara.**

---

## Seção especial — O Sistema Nervoso Visual

Por que a `MissionCard` no cockpit, o `HealthCard` no workspace e o `CoachCard` no portal parecem — inconfundivelmente — **o mesmo produto**?

Não porque a mesma equipe os desenhou. Porque **compartilham os mesmos tokens.**

Os Design Tokens são o **sistema nervoso visual** da Zion: cada componente, em cada tela, em cada plataforma, recebe os mesmos sinais — a mesma noção de "segurança" (Health), de "confiança" (Precisão), de "orientação" (Coach), do mesmo ritmo de espaço e do mesmo tempo de movimento. É por isso que a plataforma inteira "fala uma língua só" ([Brand 000 §5.7](../../brand/000-brand-dna.md), [L12/L20](./002-product-laws.md)).

Onde a linguagem se fragmenta, o produto se fragmenta. O Glossário garante uma língua para os **conceitos**; os Design Tokens garantem uma língua para a **percepção**. Juntos, fazem de dezenas de telas **uma só Zion**.

---

> **Registros oficiais:** **Os Design Tokens são a Fonte da Verdade da identidade visual da Zion. Nenhum componente define aparência própria. Todo componente consome Design Tokens. Os Tokens são independentes de tecnologia.**

> [!important] 🔒 Documento ESTABILIZADO (a partir da Sprint 2 · Atom 3)
> O `system/004` está **estabilizado**. A partir deste momento:
> - **Somente mudanças estruturais de Tokens** podem alterar este documento (um token nasce, muda de significado, ou é depreciado — [§15](#15-governança)).
> - **Regras específicas de componentes permanecem na documentação do componente**, dentro da Library — nunca aqui. Ex.: *"a origem é reconhecida primeiro pelo texto, depois pelo ícone e só por último pela cor"* pertence ao `OriginBadge`, não a este documento.
> - A fronteira: este documento define **o vocabulário visual**; os componentes definem **como o consomem**.

> **Status:** `system/004` — Design Tokens **v1.1**. Fonte da Verdade **definitiva** dos valores visuais: modelo conceitual (6 tipos), hierarquia (Foundation→Semantic→Component→Composition), sistemas de Cor (por significado), Tipografia, Espaço, Raio, Elevação, Movimento, Iconografia, Grid, Estados, Acessibilidade, Governança e o mapa componente↔token. Materializa o [Design System Filosófico (003)](./003-design-system.md), obedece às [Product Laws (002)](./002-product-laws.md), serve o [Component Catalog (004)](../blueprints/004-component-catalog.md). **Encerra a camada System.**
>
> **v1.1 — consolidação pós-Sprint 1 da Zion Design Library** (divergências encontradas na construção real do Figma): **(R1)** terceiro tema oficial **High Contrast** com objetivo AAA ([§5.6](#56-temas-oficiais)); **(R2)** `content.*` substituído por **`text.*`/`icon.*`** ([§5.2](#52-semantic--superfícies-texto-ícone-e-borda-sensíveis-a-tema)); **(R6)** **Elevation completa para o tema claro** ([§9.1](#91-o-sinal-de-elevação-muda-por-tema)); **(R7)** camadas de tokens de **Typography** ([§6.4](#64-camada-de-tokens--typography)) e **Grid** ([§12.4](#124-camada-de-tokens--grid)); **(R8)** **convenção `.` ⇄ `/`** oficializada ([§15.5](#155-convenção-de-transcrição-documentação--ferramentas)); e o alinhamento de **Health** ao vocabulário do Catálogo (`healthy/attention/critical`). Rejeitadas por contrariarem camadas superiores: `priority.critical` (Catálogo/Blueprint definem três níveis) e `origin.marketplace` (taxonomia é da Arquitetura).
