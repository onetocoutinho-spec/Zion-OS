# ADR-003 — Declarar a família `interaction.*` no system/004 e substituir a lista de consumo do Component Catalog §14 por uma regra verdadeira

> **Status:** `Proposed`
> **Data:** 2026-07-15 · **Responsável:** Arquitetura Zion (proposta — aguarda ratificação humana, [decisions/000 §6](./000-decision-record-methodology.md))
> **Metodologia:** [decisions/000 — Decision Record Methodology](./000-decision-record-methodology.md)

---

## Contexto

O [ADR-002](./ADR-002-interaction-controls-vs-semantic-atoms.md) criou a categoria `Interaction Controls` e autorizou a Sprint 2.5 a construir os 7 controles. `Button` e `Input` já foram construídos; a Sprint 2.5.4 (`TextArea`) foi aberta para resolver o teto de linhas do componente.

Ao auditar o `TextArea`, a Sprint 2.5.4 parou — não pelo motivo previsto. O achado original (nenhum documento define o teto do `TextArea`) **confirmou-se integralmente**. Mas a evolução mínima proposta — criar `control.textarea.max-lines` no `system/004` — esbarrou numa frase do Catálogo que, ao ser verificada, revelou-se falsa em três pontos independentes.

A frase é o preâmbulo da [§14 do Component Catalog](../product/blueprints/004-component-catalog.md):

> *"Consomem exclusivamente `interaction.*`, `state.*`, `border.focus`, `radius.sm`, `text.on-accent` e `type.label` ([system/004]) — **jamais** `health.*`, `priority.*`, `origin.*`, `precision.*` ou `feedback.*`."*

---

## Problema

**O Component Catalog §14 obriga os Interaction Controls a consumirem uma lista que não descreve o que eles consomem — e cita, como fonte, uma família de tokens que o `system/004` nunca declarou.**

### Defeito 1 — `interaction.*` não existe

O `system/004` é a **Fonte da Verdade** dos valores visuais. A string `interaction` aparece nele **uma única vez**, na [linha 182](../product/system/004-design-tokens.md) — **usada** dentro de uma tabela de contraste (`on-accent` sobre `interaction.primary`), **nunca declarada**. Não há seção, não há tabela, não há valores.

O ADR-002 afirma o contrário, duas vezes:
- *"collection `Interaction` (`primary`, `danger`, `focus`), `State` (`hover`, `pressed`, `focus`, `disabled`)"* (§Onde a lacuna realmente estava);
- *"Os tokens não precisarão de nova camada. O `system/004` já provisiona `interaction.*`, `state.*`, `a11y.*` — e permanece estabilizado."* (§Impacto na evolução futura).

Verificado: `state.*` está declarado (§13) ✅ · `a11y.*` está declarado (§14) ✅ · **`interaction.*` não está** ❌. A afirmação do ADR-002 é verdadeira para dois dos três. O `Button[primary]`, já construído, consome uma família que a Fonte da Verdade nunca definiu.

### Defeito 2 — a lista "exclusiva" omite o que os controles comprovadamente consomem

| Token consumido | Evidência documental | Está na lista do §14? |
|---|---|:--:|
| `icon.size.*` | §14.2 — *"Dependências: o conjunto oficial de ícones ([system/004 §11])"* | ❌ |
| `border.control` | [system/004 §5.2](../product/system/004-design-tokens.md) — *"**Origem:** revelado pelo `Input` (Sprint 2.5.3) — o primeiro componente cuja afordância **é** a borda"* | ❌ |
| `space.*` · `text.*` | §16 do 004 mapeia espaço e texto para todo componente; nenhum controle desenha sem padding nem rótulo | ❌ |

O caso do `border.control` é o mais eloquente: é o token **criado para o `Input`**, o controle que a lista deveria descrever — e a lista não o contém. Ela ficou congelada antes da Sprint 2.5.3.

### Defeito 3 — o "jamais `feedback.*`" contradiz os próprios contratos do §14

§14.3 (`Input`) e §14.4 (`TextArea`) declaram o estado **`ERROR`**. O [system/004 §13](../product/system/004-design-tokens.md) resolve `ERROR` como *"`state.error` → **`color.critical`** + texto que acolhe e re-tenta"*. E `color.critical` é [§5.3 — *Semantic — feedback funcional*](../product/system/004-design-tokens.md).

Ou seja: o mesmo §14 proíbe `feedback.*` no preâmbulo e o exige dois parágrafos abaixo.

### A questão a resolver

**Onde vive a fronteira real entre "token universal" e "token de domínio", dado que a enumeração que hoje a expressa é factualmente falsa?**

Esta é a mesma espécie de defeito que o ADR-002 corrigiu nos Átomos: *"A categoria descrevia 'ausência de domínio' enquanto abrigava componentes inteiramente feitos de domínio."* Ali, uma **definição** mentia. Aqui, uma **enumeração** mente. A causa-raiz é idêntica: uma lista fechada, escrita antes dos fatos, que ninguém reconciliou quando os fatos chegaram.

---

## Alternativas consideradas

| # | Alternativa | Prós | Contras | Veredito |
|:--:|---|---|---|:--:|
| **A1** | **Não fazer nada** — seguir a Sprint 2.5.4 sob a leitura caridosa (a allow-list é ilustrativa; o que obriga é o "jamais") | Zero trabalho; destrava o `TextArea` hoje. | Deixa a Fonte da Verdade sem `interaction.*` enquanto dois controles já o consomem. Preserva três afirmações falsas num documento que o ADR-002 chama de contrato. É exatamente o improviso que o ADR-002 recusou: *"uma lacuna preenchida às pressas deixa de ser visível, e o que não se vê não se corrige."* | ❌ **Rejeitada** |
| **A2** | **Remover `interaction.*` do §14** e mandar os controles consumirem os `color.*` existentes | Nenhuma família nova; usa só o que já está declarado. | O único acento não-domínio disponível seria `color.mission` — que é **token de domínio** ([004 §5.4](../product/system/004-design-tokens.md)), proibido pelo próprio §14 e pela fronteira do ADR-002. O `Button[primary]` ficaria sem accent legal. Quebra a [linha 182 do 004](../product/system/004-design-tokens.md), que já referencia `interaction.primary`. | ❌ **Rejeitada** |
| **A3** | **Declarar `interaction.*` completa**, conforme o ADR-002 descreve (`primary`, `danger`, `focus`) | Honra literalmente o texto do ADR-002; família "simétrica". | `interaction.focus` duplicaria `color.border.focus`, já declarado (§5.2), já consumido (§13, §14 `a11y.focus.ring.color`) e já listado **em separado** no próprio §14. `interaction.danger` não tem **nenhum** consumidor documentado — §14.1 define as variantes `primary\|secondary\|ghost\|link`, sem variante destrutiva — e duplicaria `color.critical`. Viola *"um significado, um token"* ([004 §2.2](../product/system/004-design-tokens.md)) e reprova em [§15.4](../product/system/004-design-tokens.md) (*"Expressa um significado que nenhum token atual cobre?"*). Seria inflação por simetria — o que o ADR-002 rejeitou em `Radio`. | ❌ **Rejeitada** |
| **A4** | **Declarar apenas `interaction.primary`** (o único com valor e consumidor documentados), registrar `danger`/`focus` como rejeitados, e **substituir a enumeração do §14 por uma regra** | Cria só o que a evidência sustenta (*"criar é sempre a última opção"*). Torna a fronteira verdadeira **e** à prova de novos tokens, em vez de uma lista que envelhece a cada Sprint. Preserva as rejeições como patrimônio. | Exige descongelar o Catálogo (2ª vez) e tocar o `system/004` (estabilizado). Uma correção **não-aditiva** (a frase do §14) é inevitável. | ✅ **Escolhida** |

---

## Decisão

**Declarar no `system/004` a família `interaction.*` contendo exclusivamente `interaction.primary`, com os valores já documentados; registrar `interaction.danger` e `interaction.focus` como rejeitados com motivação permanente; e substituir a enumeração fechada do Component Catalog §14 pela regra que ela tentava expressar — a fronteira universal × domínio, verificável por teste, não por lista.**

### 1. `system/004` — nova subseção `§5.7 Semantic — interação (universal, sem domínio)`

| Token | Significado | Dark | Light | High Contrast |
|---|---|:---:|:---:|:---:|
| `interaction.primary` | a **ação principal** de um contexto — universal, sem domínio | `brand.500` | `brand.500` | `brand.300` |

Os valores **não são novos**: são os que a [§5.2 do 004](../product/system/004-design-tokens.md) já declara ao justificar a regra `on-accent` — *"Nos temas **Dark** e **Light** o acento é **escuro** (`brand.500`)… No **High Contrast** o acento é **claro por necessidade** (`brand.300`, para contrastar com o canvas preto)"* — e que a tabela de contraste da linha 182 já ratifica (Dark 4.70:1 AA · Light 5.03:1 AA · HC 7.23:1 AAA). **Esta declaração não decide valor algum: apenas escreve na tabela o que o documento já afirmava em prosa.**

Rejeitados, com registro permanente:

| Token | Veredito | Motivação |
|---|:--:|---|
| `interaction.focus` | ❌ | `color.border.focus` já é o anel de foco (§5.2), já é consumido por `state.focus.ring` (§13) e por `a11y.focus.ring.color` (§14), e o próprio Catálogo §14 já o lista **em separado**. Seria duplicata. |
| `interaction.danger` | ❌ | Zero consumidores: §14.1 não define variante destrutiva. `color.critical` (§5.3) já significa "erro/urgente". Um controle destrutivo, se um dia uma tela documentada o exigir, nasce reusando `color.critical` — não com accent próprio. |

> **Por que `interaction.primary` não é duplicata de `color.mission`.** Ambos resolvem para `brand`, mas são **significados distintos**: `color.mission` é *"ação — o que fazer agora"*, um token do **domínio Zion** (§5.4), consumido pelo `MissionCard`; `interaction.primary` é *"a ação principal"*, **universal**, consumido pelo `Button[primary]` em qualquer contexto. A fronteira do ADR-002 **exige** que sejam dois: um controle universal jamais pode consumir um token de domínio. O precedente já existe e é explícito — `color.coach`, `color.mission` e `color.organization` são **três** semânticos distintos apontando para a mesma família `brand` (§5.4).

### 2. `Component Catalog §14` — a enumeração vira regra

| | Texto |
|---|---|
| **Hoje** | *"Consomem **exclusivamente** `interaction.*`, `state.*`, `border.focus`, `radius.sm`, `text.on-accent` e `type.label` — **jamais** `health.*`, `priority.*`, `origin.*`, `precision.*` ou `feedback.*`."* |
| **Proposto** | *"Consomem **qualquer token universal** do [system/004] — `interaction.*`, `state.*`, `a11y.*`, `border.control`, `border.focus`, `space.*`, `radius.*`, `type.*`, `text.*`, `icon.*` — e **jamais** um token de **domínio Zion** ([004 §5.4](../product/system/004-design-tokens.md)): `health.*`, `priority.*`, `precision.*`, `origin.*`, `coach`, `mission`, `analytics`, `timeline`, `organization`. **Teste:** se o token nomeia um significado que só existe dentro da Zion, o controle não pode consumi-lo. Tokens de **feedback funcional** (§5.3) são universais e permitidos — o estado `ERROR` de um controle os exige (§13)."* |

---

## Justificativa

### Por que uma regra, e não uma lista corrigida

Corrigir a lista adicionando `icon.size.*`, `border.control`, `space.*` e `text.*` resolveria os fatos de hoje e **voltaria a ser falsa na próxima Sprint** — exatamente como envelheceu na 2.5.3, quando `border.control` nasceu e ninguém reconciliou o §14. Uma lista fechada de tokens permitidos é uma dívida que vence a cada token novo.

A regra não tem esse defeito porque expressa a **fronteira**, não o inventário. E a fronteira já existe, já é objetiva e já foi decidida pelo ADR-002: *"quem declara Origem dos dados é semântico; quem não declara e captura intenção é controle."* O §14 tentou traduzi-la em lista e perdeu a tradução. Esta decisão devolve a fronteira à sua forma original — um **teste**, não um catálogo.

### Por que `feedback.*` é universal

O "jamais `feedback.*`" parece defender a fronteira, mas mira no alvo errado. Sucesso, atenção, erro e informação **não são significados da Zion** — são significados de qualquer software. Um campo inválido é um campo inválido em qualquer produto do mundo; é isso que torna `color.critical` universal. O que é da Zion é `precision.medium` — *"confiança parcial"* —, que só faz sentido dentro de um produto que confessa quando o número é frágil.

A prova está no próprio §14: ele proíbe `feedback.*` no preâmbulo e declara `ERROR` em dois contratos abaixo. A proibição nunca foi cumprida porque nunca foi cumprível.

### Por que declarar `interaction.primary` não viola a estabilização

O [§15.2 do 004](../product/system/004-design-tokens.md) permite mudanças estruturais de token, e o selo de estabilização (linha 711) admite explicitamente que *"um token nasce"*. Mas o argumento mais forte é outro: **isto não é um token nascendo — é um token sendo escrito.** Ele já é referenciado pela linha 182, já é consumido pelo `Button[primary]` construído, e seus valores já estão declarados em prosa na §5.2. A tabela apenas registra o que o documento já afirma. Nenhum valor é decidido aqui.

### Por que não adiar até a Sprint 2.5.4 acabar

Porque a lacuna **não é do `TextArea`**. `Button` e `Input` já estão construídos consumindo `interaction.*`. O `TextArea` apenas foi o componente que a tornou visível — como o `MissionCard` tornou visível a ausência de controles (ADR-002) e o `Input` tornou visível a ausência de `border.control` (Sprint 2.5.3). **É o terceiro caso do mesmo padrão: a construção encontra o que a auditoria não encontrou.** Adiar significaria construir o terceiro controle sobre a mesma fundação não declarada.

---

## Consequências

### Positivas

- **A Fonte da Verdade volta a ser verdadeira.** O `system/004` passa a declarar tudo o que o Catálogo manda consumir.
- **O §14 para de envelhecer.** Uma regra sobrevive a tokens novos; uma lista não.
- **A fronteira ganha teste, não inventário** — coerente com o teste de classificação do [§3.2 do Catálogo](../product/blueprints/004-component-catalog.md), que o ADR-002 tornou obrigatório.
- **Rejeições viram patrimônio.** `interaction.danger` e `interaction.focus` ficam registrados com motivação — a Zion não re-debate o que já analisou.
- **A Sprint 2.5.4 fica trivialmente aditiva**, sem contradição pendente.

### Trade-offs assumidos

- **O Catálogo é descongelado pela 2ª vez** (v1.1 → v1.2). Aceito: a alternativa é manter três afirmações falsas num contrato.
- **Uma correção não-aditiva** (a frase do §14) é inevitável. Aceito: pelo mesmo critério do ADR-002 — *"a definição anterior era factualmente falsa"*.
- **O `system/004` estabilizado é tocado** (v1.1 → v1.2). Aceito: [§15.2](../product/system/004-design-tokens.md) prevê exatamente isto, e nenhum valor é decidido.
- **O ADR-002 fica com uma afirmação factualmente incorreta** (*"já provisiona `interaction.*`"*). **Não se reescreve um ZDR em silêncio** ([decisions/000 §7](./000-decision-record-methodology.md)); esta decisão a corrige e a registra aqui.
- **Dívida de forma:** `interaction.*` entra como **§5.7**, embora a ordem lógica o coloque junto a §5.3/§5.4. Renumerar quebraria referências no [system/001](../product/system/001-ui-composition-system.md), no Catálogo e no próprio 004. Aceito pelo precedente explícito do ADR-002: *"a ordem física do arquivo não é a hierarquia."*

---

## Impactos

| Afetado | Impacto |
|---|---|
| **[system/004 — Design Tokens](../product/system/004-design-tokens.md)** | v1.1 → v1.2: nova **§5.7** (`interaction.primary` + rejeitados). Nenhum token existente alterado. Nenhum valor novo decidido. |
| **[blueprints/004 — Component Catalog](../product/blueprints/004-component-catalog.md)** | v1.1 → v1.2: preâmbulo da **§14** substituído (enumeração → regra). Nenhum contrato de componente (§14.1–§14.7) alterado. |
| **[ADR-002](./ADR-002-interaction-controls-vs-semantic-atoms.md)** | Corrigido, não superseded: a decisão (criar `Interaction Controls`) permanece **integralmente vigente**; apenas a afirmação *"o system/004 já provisiona `interaction.*`"* era falsa. |
| **`Button` · `Input`** (já construídos) | **Nenhum.** Passam a consumir uma família **declarada** — o valor que já usavam (`brand.500`/`brand.300`) não muda. Nenhum reteste visual. |
| **`TextArea`** (Sprint 2.5.4) | **Destravado.** Após `Accepted`, a 2.5.4 volta a ser o que se pretendia: uma evolução aditiva de um token no `system/004`. |
| **Architecture · Product · Product Laws · Brand · Design System · UI Composition · Blueprints 001/002/003** | **Nenhum.** Nenhuma responsabilidade muda; nenhuma Lei é tocada; nenhum Átomo é afetado. |
| **Zion Design Library (Figma)** | `interaction/primary` passa a ter origem documental. Transcrição por [§15.5](../product/system/004-design-tokens.md) (`.` ⇄ `/`). |

---

## Documentos relacionados

| Documento | Relação |
|---|---|
| [ADR-002 — Interaction Controls vs Semantic Atoms](./ADR-002-interaction-controls-vs-semantic-atoms.md) | **A decisão que esta corrige e completa.** Criou a categoria e afirmou que os tokens já existiam; dois dos três existiam. Permanece `Accepted`. |
| [blueprints/004 — Component Catalog](../product/blueprints/004-component-catalog.md) | §14 preâmbulo — o texto substituído. |
| [system/004 — Design Tokens](../product/system/004-design-tokens.md) | §5.7 — a família declarada. Fonte dos valores (§5.2, linha 182) e da governança (§15.2, §15.4). |
| [system/002 — Product Laws](../product/system/002-product-laws.md) | L12/L20 (nenhuma tela contradiz outra; nenhuma feature cria nova linguagem) sustentam a recusa à duplicata. |
| [meta/000 — Architecture Methodology](../meta/000-architecture-methodology.md) | *"Criar é sempre a última opção"* (§8) — a base da rejeição de `danger`/`focus`. |
| [decisions/000 — Decision Record Methodology](./000-decision-record-methodology.md) | A metodologia que este ZDR segue; §6 (`Proposed`) e §7 (Review antes da implementação). |

---

> **Registro oficial:** O ADR-002 encerrou dizendo que a lacuna *"nasceu de uma lacuna real, medida, entre os Tokens e os Átomos, descoberta quando um card não pôde ser construído."* Este ZDR registra a segunda metade da mesma história: ao fechar aquela lacuna, o Catálogo escreveu uma lista do que os controles consumiriam — e a lista nunca foi verificada contra o `system/004`. **Uma fronteira expressa como inventário envelhece; expressa como teste, permanece.** A correção não enfraquece o ADR-002 — ela entrega o andar que ele disse que já estava construído.
