# 001 — Compiler Architecture

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [system/000 — Ontologia](../product/system/000-ontologia-normativa.md) · [system/004 — Design Tokens](../product/system/004-design-tokens.md) · [system/002 — Product Laws §3](../product/system/002-product-laws.md) · [decisions/ADR-005](../decisions/ADR-005-escopo-cadeia-de-resolucao.md)

---

## Purpose

Este documento define a **fundação** do Compilador Zion: os contratos partilhados por todas as fases (002–017). Ele **SHALL** ser lido antes de qualquer outro documento deste pilar. O compilador existe para **executar** a arquitetura congelada — não para estendê-la. Toda fase mecaniza um conceito já definido na Ontologia ([system/000](../product/system/000-ontologia-normativa.md)) ou uma materialização já nomeada em [system/004](../product/system/004-design-tokens.md).

## Scope

Este documento **SHALL** especificar apenas: o grafo de fases, os contratos partilhados (Source Position, Diagnostic, Determinismo), a regra de propagação de erro e a ligação terminológica com a Ontologia. Ele **MUST NOT** especificar o comportamento interno de nenhuma fase individual — isso pertence aos documentos 002–017.

## Input

- O corpus congelado, como única fonte da verdade: a Ontologia ([system/000](../product/system/000-ontologia-normativa.md)), os Design Tokens ([system/004](../product/system/004-design-tokens.md)) e os ADRs ([decisions/](../decisions/)).

## Output

- Os **contratos partilhados** que os documentos 002–017 herdam por referência. Este documento não produz artefato executável próprio; ele **SHALL** ser a fundação normativa dos que produzem.

## Responsibilities

1. Definir o **grafo de fases** e a sua ordem (ver *Invariants*).
2. Definir o contrato **Source Position** (abaixo).
3. Definir o contrato **Diagnostic** (abaixo).
4. Definir a garantia de **Determinismo** herdada por todas as fases (ver *Determinism*).
5. Ligar cada termo de compilador ao conceito congelado que ele mecaniza ([README · Mapeamento de terminologia](README.md#mapeamento-de-terminologia)).

### Contrato partilhado — Source Position

Toda unidade produzida por qualquer fase **SHALL** carregar uma Source Position: a localização, na Fonte, da Declaração que a originou. Source Position é **metadado de documento** — a Ontologia nem o funda nem o proíbe ([system/004 · Parte C · Fronteira declarada](../product/system/004-design-tokens.md)) — e existe exclusivamente para que Diagnostics apontem a origem. Uma Source Position **MUST** ser suficiente para localizar unicamente a Declaração; **MUST NOT** alterar o Conteúdo, a Matéria, a Posição, o Escopo ou a Completude de nenhum Token.

### Contrato partilhado — Diagnostic

Um Diagnostic é a única forma pela qual o compilador comunica um problema. Um Diagnostic **SHALL** conter: (a) um código estável; (b) uma severidade `error | warning`; (c) uma Source Position; (d) uma mensagem; (e) uma referência ao conceito congelado violado. Todo Diagnostic **MUST** rastrear-se a uma verificação da [Ontologia · Parte 7](../product/system/000-ontologia-normativa.md) ou a uma incompatibilidade da [system/004 · Parte C](../product/system/004-design-tokens.md). O compilador **MUST NOT** emitir um Diagnostic que não corresponda a um desses; e **MUST NOT** resolver por invenção aquilo que a Ontologia não exprime — tal caso é sempre um Diagnostic, nunca uma correção silenciosa.

## Constraints

- O compilador **MUST NOT** criar conceito ontológico novo, alterar contrato, ou "melhorar" a arquitetura.
- Em conflito entre código e documentação, a documentação **SHALL** vencer ([system/002 §3](../product/system/002-product-laws.md)).
- A ordem de autoridade **SHALL** ser a Hierarquia das Decisões: Ontologia → Product Laws → … → Design Tokens → Implementação. O compilador situa-se na Implementação e **MUST** obedecer a tudo acima.
- Nenhuma fase **MUST** depender de uma fase posterior (ver *Invariants* — aciclicidade).
- **Separação de artefatos.** Três artefatos **SHALL** permanecer rigorosamente separados e nunca se misturar: (a) **Arquitetura do Compilador** — este pilar; (b) **Especificação da Linguagem Zion** — futura, ainda inexistente; (c) **Implementação** — código. Nenhum documento deste pilar **MUST** definir gramática, lexemas, palavras-chave ou sintaxe: isso pertence exclusivamente à Especificação da Linguagem.
- **Source abstrata.** A entrada do compilador **SHALL** ser tratada como **Source** — uma entidade abstrata. Nenhum documento **MUST** assumir uma representação textual concreta da Source; a sua forma será definida pela futura Especificação da Linguagem Zion. Onde uma fase depender de gramática, léxico ou sintaxe concretos, ela **SHALL** expor um **contrato abstrato** e declarar explicitamente que o concreto é diferido à Especificação da Linguagem.

## Determinism

O compilador **SHALL** ser uma função pura da Source: a mesma Source produz **byte a byte** a mesma saída, em qualquer execução e plataforma. Esta garantia herda de duas fontes congeladas: a transcrição de nome é "1:1, determinística e bidirecional" ([system/004 · §15.5](../product/system/004-design-tokens.md)); e a Resolução é função de Token × Contexto ([Ontologia · 5.1](../product/system/000-ontologia-normativa.md)). Nenhuma fase **MUST** ler relógio, aleatoriedade, ambiente, rede ou ordem de iteração não-determinística. Toda ordenação de saída **SHALL** ser total e derivada do Símbolo (ordenação lexicográfica) ou de uma ordem explícita declarada na fase.

## Diagnostics

Este documento não emite Diagnostics próprios (não processa Fonte). Ele define o **contrato** Diagnostic que as fases 002–017 emitem. As famílias de Diagnostic **SHALL** ser exatamente:

| Família | Origem congelada |
|---|---|
| `lexical` | Source inválida perante a **Especificação da Linguagem Zion** (futura) — forma concreta diferida |
| `syntactic` | Declaração malformada perante [Ontologia · D1](../product/system/000-ontologia-normativa.md) |
| `semantic` | violação de classificação ([Ontologia · Partes 3–6](../product/system/000-ontologia-normativa.md)) |
| `resolution` | Cadeia que não encerra em Valor — Incompletude ([Ontologia · 5.5](../product/system/000-ontologia-normativa.md)) |
| `validation` | violação de invariante da [Ontologia · Parte 7](../product/system/000-ontologia-normativa.md) |
| `incompatibility` | conceito ausente ([system/004 · Parte C](../product/system/004-design-tokens.md)) |

## Invariants

1. **Grafo de fases é um DAG.** A ordem `002 → 003 → 004 → 005 → 007 → {008..013}` **SHALL** ser respeitada; nenhuma aresta aponta para trás. `006` orquestra, `014–016` consomem, `017` certifica — nenhum deles é dependência de uma fase de núcleo.
2. **Uma Posição por Token, uma Matéria por Token** ([Ontologia · T9.1, T2.1](../product/system/000-ontologia-normativa.md)) — preservado por todas as fases.
3. **Preservação de Símbolo.** Nenhuma fase **MUST** renomear, fundir ou dividir um Símbolo salvo por transcrição determinística ([system/004 · §15.5](../product/system/004-design-tokens.md)).
4. **Nada declarado, nada existe** ([Ontologia · P3](../product/system/000-ontologia-normativa.md)) — nenhuma fase **MUST** materializar um Token que a Fonte não declara.

## Acceptance Criteria

- [ ] O grafo de fases é acíclico e cobre 002–017.
- [ ] Source Position e Diagnostic estão definidos e são herdáveis sem ambiguidade.
- [ ] Toda família de Diagnostic rastreia-se a uma fonte congelada.
- [ ] A garantia de Determinismo está declarada e ancorada em [system/004 §15.5](../product/system/004-design-tokens.md) e [Ontologia 5.1](../product/system/000-ontologia-normativa.md).
- [ ] Nenhum conceito novo é introduzido; toda terminologia liga-se ao [README · Mapeamento](README.md#mapeamento-de-terminologia).
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas quando a Ontologia, os ADRs ou o system/004 mudarem, e apenas para permanecer fiel a eles. Uma mudança que introduza um conceito, contrato ou fase ausente das fontes congeladas é **proibida**; a necessidade de tal conceito é uma incompatibilidade a reportar a Arquitetura ([system/002 §3](../product/system/002-product-laws.md)), não a implementar aqui.
