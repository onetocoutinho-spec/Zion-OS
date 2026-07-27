# EXP-003 — Experiment Design: Runtime Factory Adoption (/z)

## Status

```
Status:                    Approved for Execution
Owner:                     Platform v2
Experiment:                EXP-003
Depends on:                ADR-010 — Composition Root de Integração
                           EXP-002 — Ergonomia do Composition Root
Produces evidence for:     Adoção da runtime-factory em superfícies reais
Last architectural review: 2026-07-26
```

> Terceiro experimento da Platform v2. Testa **adoção**, não funcionamento.
>
> Este documento representa o desenho **aprovado antes da execução**. Ele não deve ser
> alterado durante o experimento — a evidência produzida é registrada separadamente.

---

## 1. Contexto

A ADR-010 normatizou e a implementação materializou uma conveniência de construção (`criarRuntime`), verificada por testes de equivalência comportamental em condições isoladas (dublê de `CapabilityPort`, coletor simples, fora de React). A norma declara a conveniência **opcional** e nenhuma superfície foi migrada. Permanece **não observado** o efeito de sua **adoção** numa superfície existente — em particular sob condições que os testes não exercitaram: `ShellPort` ativo alimentando feedback, Adapter com alvo no construtor e construção dentro de contexto React.

## 2. Pergunta experimental

Substituir o composition root explícito pela runtime-factory oficial em `src/app/z/page.tsx` reduz de forma real a cerimônia de construção, **preservando simultaneamente** comportamento observável, feedback, todas as responsabilidades que a ADR-010 mantém explícitas e a compreensibilidade do caminho arquitetural na superfície?

## 3. Hipótese

> **A adoção da runtime-factory em `/z` elimina da superfície a montagem explícita da fábrica de decisões, do despachante e do aninhamento entre eles, mantendo inalterados: o comportamento observável, o trajeto dos RuntimeEvents até o feedback, e a explicitação de `ShellPort`, Adapter, `UserIntent` e `receive()` — sem tocar nenhuma camada congelada e sem exigir nada não previsto pela ADR-010.**

## 4. Hipótese nula

A hipótese é falsa se a adoção: não eliminar a montagem; alterar comportamento observável ou o feedback; tornar implícito qualquer item que a ADR-010 mantém explícito; exigir alteração de camada congelada ou da API da factory; exigir criação de helper/abstração; ou tornar o caminho arquitetural não identificável na leitura da superfície.

## 5. Variável independente

**Única:** a forma de obter o `Runtime` na linha de construção — composition root explícito **→** `criarRuntime` da ADR-010. Nada mais.

## 6. Variáveis mantidas constantes

Runtime · Mission · Shell · Adaptive Intelligence · Capabilities · Adapters · serviços · a API da runtime-factory · a UI e a UX de `/z` · o fluxo de seleção de produto · a Missão de categoria · o `ShellPort` e seu conteúdo · o mapeamento `RuntimeEvents → FeedbackState` · o local de armazenamento (`runtimeRef`) · o ponto de chamada de `receive()` · todo código adjacente (nenhuma refatoração).

## 7. Baseline de Adoção *(medido em `master` `469807f` — sem interpretação)*

| # | Medida | Valor observado |
|---|---|---|
| 1 | Imports relacionados ao composition root | **7** — `Runtime`, `DecisionFactory`, `RuntimeDispatcher`, `ShellPort` (type), `CatalogCapability`, `CatalogCapabilityAdapter`, `mapRuntimeEventToFeedback` |
| 2 | Linhas dedicadas à montagem | **2** (linhas 95–96); antecedidas pela criação do `ShellPort` (linha 94) |
| 3 | Construtores no composition root | **5** — `CatalogCapability`, `CatalogCapabilityAdapter`, `Runtime`, `DecisionFactory`, `RuntimeDispatcher` |
| 4 | Conceitos arquiteturais explícitos na superfície | `Runtime` · `DecisionFactory` · `RuntimeDispatcher` · `ShellPort` · Capability · Adapter · `UserIntent` (via `e.intent`) · `receive` · `RuntimeEvent` (via `mapRuntimeEventToFeedback`) |
| 5 | Onde o Runtime é criado | Linha 96, dentro de `selecionar()` no componente `ProductFlow` — **um Runtime por produto selecionado** |
| 6 | Onde é armazenado | `runtimeRef` — `useRef<Runtime \| null>` (linha 124) em `ZPage`, passado como prop a `ProductFlow` (linha 69). **`Runtime` é usado como tipo** nas linhas 69 e 124 |
| 7 | Onde `receive()` é chamado | Linha 129, no `onEvent` do `MissionProvider`: `runtimeRef.current?.receive(e.intent)` — condicionado a `UserIntentEmitted` |
| 8 | Como o `ShellPort` é criado | Linha 94, objeto literal inline dentro de `selecionar()`: `{ publish: (e) => setFeedback(mapRuntimeEventToFeedback(e)) }`, capturando `setFeedback` de `useShell()` |
| 9 | Como RuntimeEvents chegam ao feedback | `ShellPort.publish` → `mapRuntimeEventToFeedback(e)` → `setFeedback` → `<FeedbackLayer />` (linha 138) |
| 10 | Responsabilidades da superfície hoje | resolver a fonte de dados; selecionar o produto; criar o `ShellPort`; construir Capability + Adapter; **montar o Runtime**; armazenar o Runtime; abrir a Missão; rotear o `UserIntent` para `receive()`; traduzir RuntimeEvents em feedback |

## 8. Mudança experimental permitida

**Exclusivamente**, no arquivo `src/app/z/page.tsx`:

- substituir a expressão de construção do `Runtime` (linha 96) por uma chamada a `criarRuntime`;
- ajustar **apenas** os imports que essa substituição torna desnecessários ou necessários.

**Vedado:** alterar qualquer outra linha; mover, renomear ou reorganizar código; alterar o `ShellPort`, o Adapter, a Missão, o `receive()`, o `runtimeRef`, o mapeamento de feedback ou qualquer import não afetado pela substituição.

## 9. Critérios objetivos de sucesso *(todos exigidos, simultaneamente)*

| # | Critério | Forma de verificação |
|---|---|---|
| S1 | **Redução objetiva da cerimônia** | contagem de construtores do composition root **diminui**; imports de valor da montagem **diminuem** |
| S2 | **Comportamento observável idêntico** | suíte completa verde; nenhuma mudança na sequência de RuntimeEvents produzida |
| S3 | **RuntimeEvents e feedback preservados** | o mapeamento `publish → mapRuntimeEventToFeedback → setFeedback → FeedbackLayer` permanece **textualmente inalterado** |
| S4 | **`ShellPort` continua explícito** | a superfície continua criando o objeto e passando-o na construção |
| S5 | **Adapter continua explícito** | `new CatalogCapabilityAdapter(produto.id)` permanece na superfície |
| S6 | **`UserIntent` continua explícito** | o roteamento `e.intent` permanece inalterado |
| S7 | **`receive()` continua explícito** | a chamada permanece na linha 129, inalterada |
| S8 | **Caminho compreensível na superfície** | permanecem visíveis no arquivo, simultaneamente: o símbolo `Runtime`, a obtenção do Runtime, a Capability, o `ShellPort` e `receive` — de modo que se possa nomear, lendo só a superfície, *qual Capability atende*, *que existe um Runtime*, *que uma intenção é enviada* e *para onde os eventos vão* |
| S9 | **Nenhuma camada congelada tocada** | `git status` vazio em Runtime, Mission, Shell, AIL, Capabilities, Adapters, serviços e na runtime-factory |
| S10 | **Escopo mínimo** | exatamente **1** arquivo alterado |

## 10. Critérios objetivos de falsificação

| # | Falsificação |
|---|---|
| F1 | A substituição exige alterar qualquer linha além da construção e dos imports afetados |
| F2 | Comportamento observável muda (suíte, sequência de eventos ou feedback resultante) |
| F3 | Qualquer item de S3–S7 deixa de ser explícito na superfície |
| F4 | O caminho arquitetural deixa de ser identificável na leitura (S8 não satisfeito) |
| F5 | É necessário tocar camada congelada, alterar a API da factory ou criar helper/abstração |
| F6 | A cerimônia **não** diminui (S1 falha) |
| F7 | Surge necessidade não prevista pela ADR-010 |

## 11. Evidências que deverão ser coletadas

1. `git diff` completo da mudança (arquivos e linhas).
2. Contagens **antes/depois**: imports de valor · imports de tipo · construtores · linhas de montagem.
3. Presença textual dos símbolos exigidos por S3–S8.
4. `git status` das camadas congeladas e da runtime-factory.
5. Gate: `tsc --noEmit`, `eslint`, suíte completa.
6. Registro de qualquer necessidade não prevista que surgir durante a substituição.

## 12. Cenários e consequências

**A · Confirmada** — S1–S10 satisfeitos, nenhuma falsificação. → A adoção é **evidenciada como benéfica nesta classe de superfície** (ShellPort ativo, Adapter com config, contexto React). A conveniência permanece opcional; nenhuma norma nova nasce deste experimento isoladamente.

**B · Parcialmente confirmada** — invariantes preservados, mas a redução é marginal ou surge necessidade não prevista **sem** violar a ADR. → A adoção é **viável, com benefício qualificado**; o limite observado é registrado como evidência para decisões futuras.

**C · Rejeitada** — qualquer falsificação de F1–F7. → A adoção **não é evidenciada** para esta superfície; o composition root explícito permanece nela. Resultado **válido**: a ADR-010 mantém a conveniência como opcional, e a evidência delimita onde ela não compensa.

## 13. Regra de decisão

Pergunta de encerramento: **"a substituição satisfez TODOS os critérios S1–S10 sem acionar NENHUMA falsificação F1–F7?"**

- **Sim** → Cenário A.
- **Invariantes preservados, mas S1 marginal ou necessidade não prevista sem violação** → Cenário B.
- **Qualquer F acionado** → Cenário C.

Nenhum critério pode ser reinterpretado após a execução. A redução de linhas **não** é critério isolado de sucesso: violar qualquer invariante torna o resultado falso independentemente do ganho de cerimônia.

## 14. Limites da evidência produzida

Este experimento observa **uma** superfície, **uma** Capability e **uma** configuração (Runtime por seleção, `ShellPort` ativo, Adapter com alvo no construtor, contexto React). Portanto **não** produz evidência sobre: reprodutibilidade em outras superfícies (incluindo Pendências); superfícies sem feedback; superfícies com Adapter sem config; nem sobre qualquer item em aberto da ADR-010 — que permanecem em aberto. Também **não** produz evidência sobre UX, UI ou experiência do usuário final.
