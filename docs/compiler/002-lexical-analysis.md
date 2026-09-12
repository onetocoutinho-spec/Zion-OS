# 002 — Lexical Analysis

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [001 — Compiler Architecture](001-compiler-architecture.md) · Especificação da Linguagem Zion *(futura — define a forma concreta da Source)*

---

## Purpose

Definir a **arquitetura** capaz de transformar uma **Source** abstrata num **Token Stream** léxico. Este documento **MUST NOT** definir lexemas, palavras-chave ou gramática: ele especifica o *processo* de análise léxica, não a *linguagem*. A forma concreta da Source e o conjunto concreto de lexemas **SHALL** ser definidos pela futura Especificação da Linguagem Zion ([001 · Constraints — Source abstrata](001-compiler-architecture.md#constraints)).

## Scope

Esta fase **SHALL** cobrir a arquitetura de: Source Reader, Scanner, Tokenizer, contrato de Token e recuperação de erro léxico. Ela **MUST NOT** interpretar significado (Posição, Matéria, Escopo) — [004](004-semantic-analysis.md) — nem estrutura de Declaração — [003](003-ast.md) — nem assumir qualquer representação textual concreta da Source.

## Input

- **Source:** entidade abstrata, exposta como um fluxo ordenado de **Source Units** opacas. A natureza concreta de uma Source Unit (caractere, byte, símbolo gráfico, nó de outra representação) **SHALL** ser definida pela Especificação da Linguagem Zion; esta fase a trata como opaca.

## Output

- **Token Stream:** sequência ordenada de **Tokens léxicos**, cada um com um `kind` abstrato, um lexeme span sobre a Source e uma [Source Position](001-compiler-architecture.md#contrato-partilhado--source-position). A ordem **SHALL** ser a ordem da Source.

## Responsibilities

1. **Source Reader** — expor a Source como fluxo de Source Units com posição corrente; **SHALL** ser a única origem de Source Position. **MUST NOT** interpretar o conteúdo de uma Source Unit.
2. **Scanner** — agrupar Source Units em lexemas segundo as **regras léxicas fornecidas pela Especificação da Linguagem** (contrato abstrato — ver abaixo).
3. **Tokenizer** — associar a cada lexema um `kind` do **conjunto de kinds definido pela Especificação da Linguagem**.
4. **Error Recovery** — perante Source Unit inesperada, emitir Diagnostic `lexical` e **SHALL** retomar num ponto de ressincronização determinístico, para que uma execução relate todos os erros léxicos.

### Contrato abstrato — Token & regras léxicas

Esta fase define a **forma** de um Token, não os seus valores concretos:

| Elemento | Contrato (abstrato) | Quem define o concreto |
|---|---|---|
| `Token.kind` | um valor de um conjunto **finito e fechado** de kinds | Especificação da Linguagem Zion |
| `Token.span` | intervalo `[início, fim)` sobre a Source | esta fase |
| `Token.position` | [Source Position](001-compiler-architecture.md#contrato-partilhado--source-position) | esta fase |
| Regras léxicas | função total `Source Units → (Token \| Diagnostic)` | Especificação da Linguagem Zion |

> Esta fase **SHALL** consumir o conjunto de kinds e as regras léxicas como um **contrato injetado** pela Especificação da Linguagem. Ela **MUST NOT** enumerar kinds concretos nem presumir qualquer lexema — enquanto a Especificação da Linguagem não existir, o conjunto de kinds é um parâmetro aberto do contrato, não um dado deste documento.

## Constraints

- Esta fase **MUST NOT** definir sintaxe, palavras-chave, gramática ou DSL ([001 · Constraints](001-compiler-architecture.md#constraints), Regra da Separação de artefatos).
- O Token Stream **MUST** ser lossless: toda Source Unit **SHALL** ser coberta por um Token ou por um Diagnostic; nada é descartado em silêncio.
- Esta fase **MUST NOT** resolver Referência, atribuir Matéria/Espécie ou eleger Conteúdo.

## Determinism

A tokenização **SHALL** ser função pura da Source e do contrato léxico injetado: mesma Source + mesmo contrato → mesmo Token Stream ([001 · Determinism](001-compiler-architecture.md#determinism)). A recuperação de erro **MUST** ser determinística, para que o conjunto e a ordem dos Diagnostics sejam reprodutíveis.

## Diagnostics

Família `lexical` ([001](001-compiler-architecture.md#contrato-partilhado--diagnostic)). Os **códigos** são arquiteturais; a **condição concreta** que os dispara é diferida à Especificação da Linguagem:

| Código | Condição (arquitetural) |
|---|---|
| `lexical.unrecognized-lexeme` | sequência de Source Units que nenhuma regra léxica aceita |
| `lexical.unexpected-source-unit` | Source Unit fora de qualquer lexema em curso |
| `lexical.incomplete-lexeme` | lexema iniciado e não concluído ao fim da Source |

## Invariants

1. **Ordem preservada** — a ordem dos Tokens **SHALL** ser a ordem da Source.
2. **Posições monotônicas** — as Source Positions **SHALL** ser estritamente crescentes.
3. **Cobertura total** — toda Source Unit **SHALL** pertencer a exatamente um Token ou a exatamente um Diagnostic.
4. **Sem semântica** — o Token Stream **MUST NOT** conter Posição, Matéria, Espécie, Escopo ou Completude.
5. **Sem linguagem embutida** — nenhum kind concreto nem regra léxica concreta **SHALL** aparecer neste documento.

## Acceptance Criteria

- [ ] O documento não enuncia nenhum lexema, palavra-chave ou gramática concreta.
- [ ] Source e Source Unit são tratadas como abstratas; nenhuma representação textual é assumida.
- [ ] `Token.kind` e as regras léxicas são um contrato injetado pela Especificação da Linguagem.
- [ ] Source inválida produz Diagnostic `lexical`, nunca Token silencioso.
- [ ] Mesma Source + mesmo contrato → mesmo Token Stream e mesmos Diagnostics.
- [ ] Cobertura total (lossless) e ausência de semântica verificadas.
- [ ] Nenhuma referência quebrada.

## Change Policy

Esta fase **SHALL** mudar apenas se o **contrato** entre Lexer e Especificação da Linguagem mudar, ou se [001](001-compiler-architecture.md) mudar. Enquanto a Especificação da Linguagem Zion não existir, o conjunto de kinds e as regras léxicas permanecem parâmetros abertos; introduzi-los aqui é antecipar a fase de Linguagem — proibido ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
