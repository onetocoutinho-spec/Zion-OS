# Compilador Zion — Especificação Oficial

```
─────────────────────────────────────────────
Pilar:                   docs/compiler/ (4º pilar documental)
Status:                  Proposed (congela após auditoria — COMPILER SPECIFICATION FROZEN)
Owner:                   Compiler Engineering (Zion)
Autoridade conceitual:   Ontologia (system/000) — precede toda esta especificação
─────────────────────────────────────────────
```

> Esta especificação **não cria arquitetura**. Ela **documenta** a mecanização já implícita na arquitetura congelada: o Compilador Zion é o processo que lê as **declarações de Token** e produz os artefatos de plataforma, aplicando exclusivamente os conceitos da [Ontologia (system/000)](../product/system/000-ontologia-normativa.md) e as materializações nomeadas em [Design Tokens (system/004)](../product/system/004-design-tokens.md).
>
> Nenhum conceito ontológico novo é introduzido. Todo termo de engenharia de compiladores (Scanner, Tokenizer, AST, IR, Diagnostics, Generator) **mapeia** para um conceito já congelado — ver [Mapeamento de terminologia](#mapeamento-de-terminologia). Onde a arquitetura congelada não determina um detalhe, esta especificação declara o **contrato**, nunca um conceito novo.

---

## Propósito do compilador

O Compilador Zion transforma **declarações de Token** — Símbolo → Conteúdo por Contexto, com Matéria, Posição, Espécie, Escopo, Completude e Destinação ([system/004 · Como ler um Token](../product/system/004-design-tokens.md)) — em artefatos que cada plataforma consome, **sem que a identidade mude de tecnologia** ([system/004 · A Identidade que Sobrevive](../product/system/004-design-tokens.md)).

O compilador é a mecanização de duas capacidades já constitutivas:

1. **Resolução** — a substituição de toda Referência pelo Conteúdo terminal de um Token sob um Contexto ([Ontologia · 5.1 Resolução](../product/system/000-ontologia-normativa.md)).
2. **Materialização determinística** — a transcrição 1:1 e bidirecional do Token para o dialeto de cada ferramenta ([system/004 · §15.5 Convenção de transcrição](../product/system/004-design-tokens.md)).

---

## Visão geral

```
Source (abstrata — forma concreta diferida à Especificação da Linguagem)
        │
   [Lexer]            002 — Token Stream
        ▼
   [Parser]           003 — AST
        ▼
   [Semantic]         004 — Semantic Model  (Posição · Matéria · Escopo · Completude)
        ▼
   [IR]               005 — Resolução por Contexto
        ▼
   [Validator]        007 — IR validada (invariantes da Ontologia · Diagnostics)
        ▼
   [Generators]       008–013 — CSS · React · TypeScript · JSON · Documentation · Figma
```

Orquestração, [Runtime](015-runtime.md), [CLI](014-cli.md) e [Language Server](016-language-server.md) consomem esse mesmo núcleo; a [Certificação](017-testing-certification.md) prova a sua conformidade.

---

## Pipeline completo

| # | Fase | Entrada | Saída |
|--:|------|---------|-------|
| 002 | Lexical Analysis | Source | Token Stream |
| 003 | AST | Token Stream | AST |
| 004 | Semantic Analysis | AST | Semantic Model |
| 005 | Intermediate Representation | Semantic Model | IR |
| 007 | Validator | IR | IR validada + Diagnostics |
| 008 | CSS Generator | IR validada | CSS |
| 009 | React Generator | IR validada | React |
| 010 | TypeScript Generator | IR validada | TypeScript |
| 011 | Documentation Generator | IR validada | Documentation |
| 012 | JSON Generator | IR validada | JSON |
| 013 | Figma Generator | IR validada | Figma Variables |

[006 — Compiler Pipeline](006-compiler-pipeline.md) define a orquestração; [001 — Compiler Architecture](001-compiler-architecture.md) define os contratos partilhados (Source Position, Diagnostics, Determinismo).

---

## Relação com a Ontologia

A Ontologia ([system/000](../product/system/000-ontologia-normativa.md)) é a **autoridade conceitual** e precede toda esta especificação ([system/002 · Hierarquia das Decisões](../product/system/002-product-laws.md)). O compilador **não interpreta** a Ontologia: ele a **executa**. As fases de Semantic Analysis, IR e Validator implementam, respectivamente, a classificação (Partes 1–6), a Resolução (5.1–5.5) e a Validação (Parte 7) já definidas. Nenhuma fase pode produzir um resultado que a Ontologia não exprima; toda lacuna é uma **incompatibilidade** ([system/004 · Parte C](../product/system/004-design-tokens.md)), reportada como Diagnostic, nunca resolvida por invenção.

---

## Relação com a Product Architecture

O compilador é uma ferramenta transversal e **não altera** as engines de produto ([architecture/001–017](../architecture/)). Ele obedece à mesma [Hierarquia das Decisões (system/002 §3)](../product/system/002-product-laws.md): Ontologia → Product Laws → … → Design Tokens. O compilador situa-se **abaixo** de Design Tokens (system/004) como a sua materialização executável, e **acima** da Implementação (código gerado).

---

## Relação com Design Tokens

[system/004](../product/system/004-design-tokens.md) é a **autoridade do dado de Token** que o compilador processa: os Símbolos, Conteúdos, Matérias, Posições, Escopos, Completudes e Destinações da Parte B. A **forma concreta da Source** que expressa esse dado é diferida à Especificação da Linguagem Zion (futura) — o compilador trata a entrada como Source abstrata ([001 · Constraints](001-compiler-architecture.md#constraints)). Os **alvos de geração** (008–013) são exatamente as materializações que o 004 nomeia (CSS/React/TypeScript/JSON/Documentation/Figma). A transcrição de nome (`.` ⇄ `/`) na **saída** segue [system/004 §15.5](../product/system/004-design-tokens.md), sem desvio.

---

## Índice dos 17 documentos

| # | Documento | Fase |
|--:|-----------|------|
| 001 | [Compiler Architecture](001-compiler-architecture.md) | Fundação |
| 002 | [Lexical Analysis](002-lexical-analysis.md) | Lexer |
| 003 | [AST](003-ast.md) | Parser |
| 004 | [Semantic Analysis](004-semantic-analysis.md) | Semantic |
| 005 | [Intermediate Representation](005-intermediate-representation.md) | IR |
| 006 | [Compiler Pipeline](006-compiler-pipeline.md) | Orquestração |
| 007 | [Validator](007-validator.md) | Validação |
| 008 | [CSS Generator](008-css-generator.md) | Geração |
| 009 | [React Generator](009-react-generator.md) | Geração |
| 010 | [TypeScript Generator](010-typescript-generator.md) | Geração |
| 011 | [Documentation Generator](011-documentation-generator.md) | Geração |
| 012 | [JSON Generator](012-json-generator.md) | Geração |
| 013 | [Figma Generator](013-figma-generator.md) | Geração |
| 014 | [CLI](014-cli.md) | Ferramenta |
| 015 | [Runtime](015-runtime.md) | Ferramenta |
| 016 | [Language Server](016-language-server.md) | Ferramenta |
| 017 | [Testing & Certification](017-testing-certification.md) | Certificação |

---

## Ordem de leitura

1. **001** — Compiler Architecture (contratos partilhados; leia primeiro).
2. **002 → 005** — as fases do núcleo, em ordem (cada uma consome a saída da anterior).
3. **006** — Compiler Pipeline (a orquestração das fases 002–005 + 007).
4. **007** — Validator (invariantes e Diagnostics sobre a IR).
5. **008 → 013** — os Generators (independentes entre si; todos consomem a IR validada).
6. **014 → 016** — CLI, Runtime, Language Server (superfícies que consomem o núcleo).
7. **017** — Testing & Certification (prova de conformidade de tudo acima).

---

## Mapeamento de terminologia

Nenhum conceito novo. Cada termo de compilador é um nome operacional de um conceito já congelado:

| Termo do compilador | Conceito congelado (fonte) |
|---|---|
| Token (léxico) | categoria léxica cujo conjunto concreto é definido pela **Especificação da Linguagem Zion** (futura); aqui, contrato abstrato ([002](002-lexical-analysis.md)) |
| AST | conjunto de Declarações (Símbolo × Contexto → Conteúdo) — [Ontologia · P3, D1](../product/system/000-ontologia-normativa.md) |
| Semantic Model | classificação da Ontologia (Posição T2, Matéria D4, Espécie Parte 4, Escopo 6.1, Completude 5.5) |
| IR | Resolução por Contexto — [Ontologia · 5.1 Resolução, 5.2 Cadeia de Resolução](../product/system/000-ontologia-normativa.md) |
| Diagnostic | uma verificação da [Ontologia · Parte 7](../product/system/000-ontologia-normativa.md) ou uma [incompatibilidade (system/004 · Parte C)](../product/system/004-design-tokens.md) |
| Generator target | materialização nomeada em [system/004](../product/system/004-design-tokens.md) |

---

> **Change Policy.** Esta especificação é derivada. Se a Ontologia, os ADRs ou o system/004 mudarem, os documentos afetados deste pilar **SHALL** ser atualizados para permanecerem fiéis; nunca o contrário. Nenhum documento deste pilar pode introduzir um conceito ausente das suas fontes — tal conceito é uma incompatibilidade a reportar, não a implementar.
