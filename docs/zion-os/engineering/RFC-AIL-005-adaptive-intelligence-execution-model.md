# RFC-AIL-005 — Adaptive Intelligence Execution Model · Architecture Freeze v1

> **Natureza.** RFC **de consolidação** — a **última RFC conceitual** da Adaptive Intelligence
> Layer. Une ARQ-003 e RFC-AIL-001…004 num único modelo operacional. **Não cria entidade, não
> altera o modelo canônico, a Pattern Key nem o Pattern Detector. Não fala de banco, tabela,
> persistência; não escreve código.** Consolida — não inventa. Onde faltou evidência: **EVIDÊNCIA
> INSUFICIENTE**.
>
> **Fonte:** ARQ-003; RFC-AIL-001 (Decision Journal); RFC-AIL-002 (Canonical Learning Model);
> RFC-AIL-003 (Canonical Pattern Key); RFC-AIL-004 (Pattern Detector); ARCH-REVIEW-001.

---

## 1. Objetivo

Responder, em um só documento, à pergunta que atravessa toda a AIL:

> **Como uma decisão observada percorre toda a camada até, eventualmente, tornar-se conhecimento
> reutilizável — preservando todos os invariantes do Zion OS?**

E, ao final, declarar oficialmente o **Architecture Freeze v1**: a partir dele, as quatro peças —
Persistência, Pattern Detector, Suggestion Engine e Knowledge Repository — são implementáveis
**sem nenhuma decisão arquitetural adicional**, e qualquer mudança conceitual exigirá **ADR**.

## 2. Escopo

**Consolida:** lifecycle completo, elegibilidade, Suggestion, explainability, Confidence,
promoção, aposentadoria e reaprendizado — **reusando** as quatro entidades já canônicas
(RFC-AIL-002 §3): **Decision, Pattern, Suggestion, Knowledge**. Outcome, Confidence e Memory
permanecem, respectivamente, **derivado, objeto de valor e escopo** — não entidades.

**Não faz:** nova entidade, novo conceito, nova chave, alteração de qualquer RFC anterior. Toda
"novidade" aparente deste documento é **consolidação** do que já foi decidido, com a fonte citada.

## 3. Fluxo Geral (PASSO 1)

```
   [Bounded Context]  o cliente corrige/sobrescreve uma proposta do sistema
          │  (push, fire-and-forget — ARQ-003 §3.1a)
          ▼
   ① DECISION ──► Decision Journal  (append-only, por empresa — RFC-AIL-001)
          │
          │  ELEGIBILIDADE (RFC-AIL-003 §4.4/§5): contexto∈BC, campo substantivo,
          │  valorNovo significativo, delta (anterior≠novo). Inelegível ⇒ para aqui.
          ▼
   ② PATTERN KEY  (empresa, contexto, campo, valorNovo)  — RFC-AIL-003
          │
          ▼
   ③ PATTERN DETECTOR  (RFC-AIL-004): cria/acumula Pattern; support=|DecisionIds distintos|;
          │  Confidence por contagem até **Consistente**; estado do slot (CONSISTENTE/EM_DISPUTA)
          ▼
   ④ PATTERN  ──(Confidence ≥ Consistente ∧ slot CONSISTENTE)──► ELEGÍVEL a sugerir
          │
          │  (pull, opcional — ARQ-003 §3.1b)         ┌─────────────────────────────┐
          ▼                                           │  um Bounded Context consulta │
   ⑤ SUGGESTION ENGINE: oferta editável + explicação  ◄─┤  "há algo aprendido p/ isto?"│
          │                                           └─────────────────────────────┘
          │  a próxima Decision no slot vira OUTCOME (confirmada/contradita/ignorada — §3.6/002)
          ▼
   ⑥ OUTCOME ──► ajusta Confidence:  confirmada↑ (Confiável→Validado) · contradita↓ · ignorada→estável
          │
          ▼
   ⑦ KNOWLEDGE  (Pattern promovido a **Validado** — RFC-AIL-002 §3.5): fato reutilizável, curado,
          │  explicável, esquecível — no Knowledge Repository, por empresa.
          │
          └──► contradição sustentada (Outcomes contraditos) ⇒ ⑧ APOSENTADO / reaprendizado
                                                                (histórico permanece — princ. 11)
```

Uma frase: **o cliente decide → o Journal observa → o Detector conta → o Pattern amadurece → o
Engine oferece e escuta o Outcome → o Pattern promovido vira Knowledge → contradição sustentada o
aposenta e o ciclo recomeça** — tudo determinístico, explicável e reversível.

## 4. Componentes — responsabilidade única, sem duplicação (PASSO 2)

| Componente | Responsabilidade **única** | Nunca faz (é de outro) | Fonte |
|---|---|---|---|
| **Decision Journal** | **Observar e gravar** Decisions canônicas, append-only, por empresa; deduplicar o *semântico* (§7). | Não conta, não sugere, não decide. | RFC-AIL-001 |
| **Pattern Detector** | **Contar**: Decisions elegíveis → Patterns; Confidence **por contagem até Consistente**; estado do slot. | Não sugere, não infere, não ranqueia, não escuta Outcome. | RFC-AIL-004 |
| **Pattern** *(entidade)* | **Ser** a recorrência: carrega a identidade (Pattern Key), o suporte e a Confidence. | Não age; é dado, não comportamento. | RFC-AIL-002 §3.3 / RFC-AIL-003 |
| **Suggestion Engine** | **Oferecer** (pull) um Pattern elegível com explicação; **computar Outcome** da próxima Decision; alimentar o ajuste de Confidence acima de Consistente. | Não escreve valor, não decide, não conta suporte (isso é do Detector). | RFC-AIL-002 §3.4/§3.6; ARQ-003 §3.1b |
| **Knowledge Repository** | **Curar** Patterns promovidos (Validado) como Knowledge por empresa; guardar esquecimento/aposentadoria; garantir isolamento por tenant. | Não detecta, não sugere; apenas retém/expõe o curado. | RFC-AIL-002 §3.5/§9 |

**Não-duplicação verificada:** *contar* mora só no Detector; *oferecer/escutar Outcome* só no
Engine; *observar* só no Journal; *curar/reter* só no Repository. A **Confidence** não é "de
ninguém mutar à vontade": é **derivada** de duas entradas determinísticas — `support` (Detector) e
o **ledger de Outcomes** (Engine) — §9.

## 5. Lifecycle (PASSO 3)

### 5.1 Os eixos — por que "Elegível", "Sugestão Emitida" e "Confirmado" **não** são estados do Pattern

O encadeamento sugerido na missão mistura **três eixos distintos**. Consolidar exige separá-los —
esta é a correção conceitual central do lifecycle:

| Rótulo da missão | A que eixo pertence | Veredito |
|---|---|---|
| **Observado → Recorrente → Consistente** | **Confidence do Pattern** (por contagem) | ✓ Estados de Confidence — RFC-AIL-004 §4.3 |
| **Elegível** | **Predicado derivado** sobre Pattern+slot (§6.1) | **Não é estado** — é a condição `Confidence≥Consistente ∧ slot CONSISTENTE` |
| **Sugestão Emitida** | **Estado da Suggestion** (Oferecida) | **Não é estado do Pattern** — a Suggestion tem lifecycle próprio (§6.4) |
| **Confirmado** | **Outcome** (derivado da Decision seguinte) | **Não é estado do Pattern** — é feedback que ajusta Confidence |
| **Confiável → Validado → Automatizável** | **Confidence do Pattern** (por Outcome/permissão) | ✓ Níveis acima de Consistente — RFC-AIL-002 §7 |
| **Knowledge** | **Pattern promovido** (Confidence = Validado) | ✓ RFC-AIL-002 §3.5 — não é entidade nova, é o Pattern a Validado |
| **Aposentado** | **Estado do Pattern/Knowledge** | ✓ RFC-AIL-002 §5.1 — por contradição sustentada |

### 5.2 Os três lifecycles consolidados

**(a) Pattern — eixo Confidence (RFC-AIL-002 §5.1 + §7, RFC-AIL-004):**
```
Observado ─(support≥2)─► Recorrente ─(support≥3 ∧ slot CONSISTENTE)─► Consistente
   │                                                                      │
 Emergente ───────────────────────────────────────────────► Estabelecido │
   (por contagem — Detector; até aqui, e só até aqui)                     │
                                                                          ▼
   ┌───────────────────────── por OUTCOMES (Engine) ─────────────────────┐
   │  Consistente ─(Outcomes confirmam)─► Confiável ─(sustentado)─► Validado = KNOWLEDGE
   │                                                                       │
   │  Validado ─(+ permissão explícita do cliente)─► Automatizável (R-AIL-4)│
   └───────────────────────────────────────────────────────────────────────┘
                                                                          │
   qualquer nível ─(contradição sustentada / esquecimento / inatividade)─► Aposentado
```

**(b) Suggestion — eixo oferta (RFC-AIL-002 §5.1):** `Oferecida → Confirmada | Contradita | Ignorada`.
Cada oferta gera **um** Outcome (§3.6/002). A Suggestion é **pontual e efêmera**; o Pattern é
permanente.

**(c) Knowledge — eixo curadoria (RFC-AIL-002 §9):** `Ativo → Arquivado (inatividade) → Esquecido
(o cliente esquece)`. Em todos, **o histórico de Decisions permanece** ("esquecer não é apagar").

### 5.3 A fronteira dura entre (a)-por-contagem e (a)-por-Outcome

> O **Pattern Detector** move a Confidence **apenas até Consistente** (contagem). **Confiável,
> Validado e Automatizável exigem Outcomes** (feedback de Suggestions) **e permissão** — território
> do **Suggestion Engine** e da automação, **nunca** do Detector (RFC-AIL-004 §4.3). É esta
> fronteira que fecha o laço que a RFC-AIL-004 §6.4 deixou explicitamente deferido.

## 6. Suggestion (PASSO 4 + PASSO 5)

### 6.1 Elegibilidade — quando um Pattern pode gerar Suggestion (PASSO 4)

| Situação | Pode sugerir? | Regra |
|---|---|---|
| **Elegível** | **Sim** | `Confidence ≥ Consistente` **e** slot **CONSISTENTE** (é o único valor recorrente) e não aposentado. |
| Abaixo de Consistente | Não | Observado/Recorrente — recorrência insuficiente (RFC-AIL-004 §4.3). |
| **Em disputa** | Não | slot **EM_DISPUTA** — dois+ valores recorrem; **nenhum** sugere (RFC-AIL-004 §4.4; ARQ-003 §6.2). |
| **Perdeu elegibilidade** | Não | um valor concorrente passou a recorrer (slot→EM_DISPUTA); **ou** Outcomes contraditos rebaixaram; **ou** inatividade expirou a Confidence (RFC-AIL-002 §7); **ou** o cliente **esqueceu** o Knowledge (§9/002). |

### 6.2 O Engine (PASSO 5)

| Elemento | Definição |
|---|---|
| **Entrada** | Uma consulta *pull* de um Bounded Context por um **slot** `(empresa, contexto, campo)` — antes de agir (ARQ-003 §3.1b). |
| **Processamento** | Localiza o Pattern **elegível** (§6.1) do slot. Determinístico: há no máximo **um** (slot CONSISTENTE ⇒ um único recorrente). |
| **Saída** | A **Suggestion**: o `valorNovo` do Pattern, **editável**, **acompanhado da explicação obrigatória** (§8). |
| **Explainability obrigatória** | Uma Suggestion **não pode existir** sem explicação derivável (§8; RFC-AIL-002 §8). Invariante. |
| **Ausência de sugestão** | Sem Pattern elegível ⇒ **nenhuma** Suggestion ⇒ o contexto age **exatamente como hoje**. É a garantia de aditividade/reversibilidade (§10). |

> **O Suggestion Engine nunca decide.** Ele **oferece** um valor editável; quem escolhe é o
> cliente/contexto. Não escreve o valor, não age, não automatiza. A escolha do cliente vira a
> **próxima Decision**, da qual o Engine **deriva o Outcome** — fechando o laço sem jamais tomar o
> lugar do cliente.

## 7. Knowledge (PASSO 6)

**Quando um Pattern deixa de ser mera recorrência e vira conhecimento consolidado?** Quando sua
Confidence alcança **Validado** — isto é, quando **Outcomes confirmadores sustentados** (o cliente
mantém o valor sugerido, sem corrigir) elevam o Pattern acima de Consistente (RFC-AIL-002 §7). A
diferença é semântica: *"escolheu X três vezes"* (Pattern Consistente) vs *"esta empresa prefere X
para Y, confirmado ao longo do tempo"* (Knowledge).

| Pergunta | Resposta consolidada |
|---|---|
| **Quem promove?** | Ninguém *escolhe* promover — a promoção é **derivada**: a Confidence atinge Validado pelo **ledger de Outcomes**. O **Knowledge Repository** apenas cura o resultado. |
| **Quem pode rebaixar?** | **O cliente**, por seus atos: Outcomes **contraditos** (sobrescrever a sugestão) derrubam a Confidence; e o cliente pode **esquecer** explicitamente (RFC-AIL-002 §9). Nenhum componente rebaixa por conta própria. |
| **Knowledge pode voltar a ser Pattern?** | **Sim** — Knowledge **é** o Pattern a Validado (mesma identidade, RFC-AIL-003). Se contradito, a Confidence cai e ele volta a ser um Pattern de nível inferior; se esquecido/inativo, vai a *Arquivado/Esquecido* e **para de sugerir**. **A identidade e o histórico nunca se perdem** — só o nível e o estado mudam. |

**Reaprendizado (consolidação de RFC-AIL-002 §5.3 + ARQ-003 §6.3):** uma **sequência de Outcomes
contraditos** — o cliente passa a escolher outro valor — derruba a Confidence do Knowledge até
**Aposentado**; o valor concorrente, agora recorrente, inicia sua **própria** subida na escada e
pode tornar-se o novo Knowledge. Isto fecha, por **Outcomes** (não por nova regra), a lacuna que a
RFC-AIL-004 §6.4 deixou deferida: o Detector nunca completou a troca por contagem pura; **é o
Outcome que a completa**. O histórico permanece (princ. 11).

## 8. Explainability (PASSO 8)

**Toda Suggestion responde, sem exceção, por projeção — nunca por geração** (RFC-AIL-002 §8):

| Pergunta | Derivada de | Sempre disponível porque… |
|---|---|---|
| **Por que foi gerada?** | O Pattern: a chave `(empresa, contexto, campo, valorNovo)` recorrente | a Suggestion **é** a projeção desse Pattern |
| **Quais Decisions a sustentam?** | O conjunto `decisoesDeSuporte` do Pattern (RFC-AIL-004 §4.2) | o Detector guarda as DecisionIds que formaram o Pattern |
| **Qual Pattern a originou?** | A Pattern Key | identidade imutável (RFC-AIL-003 §6) |
| **Qual Confidence possui?** | O nível derivado de `support` + Outcomes | função pura, determinística (§9) |
| **Há exceções?** | Os Patterns concorrentes do slot (EM_DISPUTA) | o Detector mantém o slot |
| **Como desfazer / impedir?** | Reverter a aplicação / **esquecer** o Knowledge | RFC-AIL-002 §8 |

> **Invariante de explicabilidade:** uma Suggestion **sem explicação derivável não pode existir**.
> Como a explicação **é** a evidência acumulada (as Decisions), ela é **sempre verdadeira e
> auditável** — não há Suggestion "de caixa-preta".

## 9. Confidence (PASSO 7)

**A Confidence é um Objeto de Valor derivado — nunca é livremente atribuída** (RFC-AIL-002 §7). A
escada canônica consolidada, com **quem** move cada trecho:

| Nível | Move quem | Quando | Fonte |
|---|---|---|---|
| **Observado** (support=1) | **Pattern Detector** | 1 Decision elegível | RFC-AIL-004 §4.3 |
| **Recorrente** (support≥2) | **Pattern Detector** | primeira repetição | RFC-AIL-004 §4.3 |
| **Consistente** (support≥3 ∧ slot CONSISTENTE) | **Pattern Detector** | repetição estável, valor único no slot | RFC-AIL-004 §4.3 |
| **Confiável** | **Suggestion Engine** (via Outcomes) | Outcomes confirmam | RFC-AIL-002 §7 |
| **Validado** = Knowledge | **Suggestion Engine** (via Outcomes) | confirmação sustentada | RFC-AIL-002 §7 |
| **Automatizável** | **Cliente** (permissão) **+** Validado | dois gatilhos, nunca um | RFC-AIL-002 §7; ARQ-003 §7 regra 2 |

- **Sobe:** contagem consistente (Detector) e Outcomes confirmados (Engine).
- **Cai:** Outcomes contraditos; expira por inatividade.
- **Quem NUNCA altera Confidence:** a **Esteira/Core Domain** (não sabe da AIL); qualquer componente
  "escolhendo" um número — não há escolha, só **derivação** de `support` + ledger de Outcomes. O
  cliente nunca digita um nível; ele o **move indiretamente** por suas Decisions/Outcomes e pela
  permissão de automação.

## 10. Reversibilidade — invariante permanente (PASSO 9)

> **Remover completamente a Adaptive Intelligence Layer não altera o Core Domain, não altera a
> Esteira, e apenas elimina observação e sugestões.**

Demonstração por construção, camada a camada:

| Camada | Por que a remoção não muda comportamento |
|---|---|
| **Observação (push)** | *fire-and-forget* — a Decision já é gravada pelo contexto; o registro na AIL é lateral e engolido em falha (RFC-AIL-001 §6.2; ARQ-003 §3.1a). Sem AIL, é no-op. |
| **Detecção** | Projeção pura; não chama ninguém. Removê-la só apaga Patterns — nada de produção depende deles. |
| **Sugestão (pull)** | **Opt-in e aditiva**: ausência de sugestão ⇒ o contexto age **como hoje** (§6.2). Sem AIL, toda consulta retorna vazio. |
| **Esteira / Core Domain** | A AIL **nunca** altera o veredito da Esteira, A10 ou regras-mãe (ARQ-003 princ. 10; RFC-AIL-004 §6.3). No máximo, oferece contexto de entrada — sempre editável. |

Consequência: a AIL é **aditiva por construção** (ARQ-003 princ. 7). Este invariante é
**permanente** e **congelado** — qualquer release que o viole é, por definição, não-conforme.
Validado empiricamente em R-DJ-2 (ARCH-REVIEW-001: reversibilidade total, +123/−2, módulo isolado).

## 11. Architecture Freeze v1 (PASSO 10)

### 11.1 Revisão das RFCs anteriores — achados e resolução por consolidação

| # | Achado | Tipo | Resolução (consolidação) |
|---|---|---|---|
| **F-1** | ARQ-003 §6.2 diz "contagem por `(empresa,contexto,campo)`"; RFC-AIL-002 §3.3 diz chave `(…,ValorNovo)` | Conflito aparente | **Resolvido** em RFC-AIL-003 §3.3: quádrupla = **identidade**; tripla = **slot** (projeção). Consolidado aqui (§3, §5, §6.1). Não é conflito — são dois níveis. |
| **F-2** | Numeração: RFC-AIL-002 §12 previa 003=Pattern Detector, 004=Suggestion Engine, 005=Copilot | Inconsistência | **Consolidada** (§12): 003=Pattern **Key**, 004=Pattern **Detector**, 005=**este modelo**. Suggestion Engine e Knowledge tornam-se **releases de implementação**, não RFCs conceituais. |
| **F-3** | Limiares da Confidence "de projeto", não fixados (RFC-AIL-002 §7) | Lacuna | **Fixados** em RFC-AIL-004 §4.3 (1/2/3) e consolidados em §9 — únicos números canônicos, ADR-tunáveis. |
| **F-4** | Reaprendizado incompleto por contagem pura (RFC-AIL-004 §6.4, deferido) | Lacuna | **Fechada** aqui (§7): completa-se por **Outcomes contraditos** (Engine), não por nova regra — reusa a escada existente. |
| **F-5** | A-1 (`contexto="pendencia"` não-BC) e A-2 (`valorNovo="true"` constante) em R-DJ-2 | Reconciliação pendente (ARCH-REVIEW-001) | **Resolvida conceitualmente** em RFC-AIL-003 §5.2/§5.3: são **inelegíveis** ⇒ o Detector corretamente **não forma Pattern** (RFC-AIL-004 §3, exemplo 6). Não bloqueia o freeze; é reconciliação de **instrumentação** (re-instrumentar o Producer para capturar o valor substantivo, `contexto=Catálogo`) — release de implementação, não mudança conceitual. |

### 11.2 Redundâncias, conflitos, lacunas restantes

- **Redundância:** nenhuma. A minimalidade da RFC-AIL-002 §3 (quatro entidades; Outcome/Confidence/
  Memory derivados; Validation eliminada) permanece — este documento **não** adiciona conceito.
- **Conflitos restantes:** nenhum — F-1…F-5 resolvidos por consolidação.
- **Lacunas restantes:** o **valor de recência** que caracteriza "contradição sustentada" e a
  **expiração por inatividade** têm forma consolidada (via ledger de Outcomes e `ultimaOcorrencia`)
  mas seu **limiar numérico** é o único parâmetro deixado a **ADR** — análogo aos limiares da §9,
  não uma decisão de implementação. Registrado como **EVIDÊNCIA INSUFICIENTE**; **não** impede a
  implementação das quatro peças (§12), pois todas operam com a escada já fixada.

### 11.3 Declaração

> Não restam conceitos redundantes, conflitos ou lacunas que impeçam a implementação. Declara-se
> oficialmente:
>
> ## **Adaptive Intelligence Architecture v1 — Architecture Freeze**
>
> Compõem o congelamento: **ARQ-003** e **RFC-AIL-001, 002, 003, 004, 005**.
>
> A partir deste ponto, **qualquer alteração conceitual** da AIL — entidades, Pattern Key,
> lifecycle, escada de Confidence, invariantes de reversibilidade/isolamento, ou os limiares
> canônicos — **exige um ADR aprovado** que demonstre, por evidência, a insuficiência do modelo v1
> (estende RFC-AIL-002 §14). Implementações e ajustes de parâmetro **dentro** do modelo não
> exigem RFC nova.

## 12. Roadmap de Implementação (PASSO 12)

Congelada a arquitetura, as quatro peças são implementáveis **sem nova decisão arquitetural**, em
ordem de dependência:

| Ordem | Release (implementação) | Materializa | Especificado por | Pré-requisito |
|---|---|---|---|---|
| 1 | **Persistência do Journal** (R-DJ-1b) | Journal durável, append-only, por empresa | RFC-AIL-001 | — (R-DJ-1/2 já existem) |
| 2 | **Pattern Detector** | Contagem → Patterns, Confidence até Consistente, slots | RFC-AIL-004 | Journal persistido |
| 3 | **Suggestion Engine** | Pull + explicação + Outcome + Confidence acima de Consistente | Este §6, §9; RFC-AIL-002 §3.4/§3.6 | Detector |
| 4 | **Knowledge Repository** | Curadoria de Patterns Validados; esquecimento; isolamento | Este §7; RFC-AIL-002 §3.5/§9 | Suggestion Engine (Outcomes) |
| (5) | **Automação opt-in / Reaprendizado** (R-AIL-4/5) | Automatizável (permissão) + aposentadoria por contradição | Este §5.2, §7 (+ ADR do limiar de recência) | Knowledge |

**Reconciliação prévia recomendada (não bloqueante):** re-instrumentar o Producer de R-DJ-2 para
emitir uma Decision **elegível** (F-5) antes que o Detector seja ligado — do contrário aquele
ponto simplesmente não forma Pattern (comportamento correto, porém sem aprendizado).

## 13. Decisão Arquitetural Final

> **A Adaptive Intelligence Layer transforma decisões observadas em conhecimento reutilizável por
> um pipeline determinístico, explicável e reversível:** o **Journal** observa (fire-and-forget); o
> **Detector** conta Decisions elegíveis em Patterns identificados pela Pattern Key, subindo a
> Confidence até **Consistente**; o **Suggestion Engine** oferece (pull, editável, sempre
> explicado) os Patterns elegíveis e, pelos **Outcomes** da decisão seguinte, move a Confidence a
> **Validado**, promovendo o Pattern a **Knowledge**; contradição sustentada o **aposenta** e o
> ciclo recomeça — **sem nunca** tocar o Core Domain nem a Esteira, e podendo ser removida sem
> alterar comportamento.

Invariantes permanentes do v1:

1. **Identidade imutável** (Pattern Key) — RFC-AIL-003.
2. **Contagem determinística, não ML** — RFC-AIL-004; ARQ-003 §14/R8.
3. **Confidence derivada** (support + Outcomes), nunca escolhida — §9.
4. **Explicabilidade obrigatória** — nenhuma Suggestion sem evidência derivável — §8.
5. **Automação exige dois gatilhos** (Validado **e** permissão) — §9; ARQ-003 §7.
6. **Isolamento por empresa inviolável** — dado bruto nunca cruza o tenant — ARQ-003 §9.
7. **Reversibilidade** — remover a AIL devolve o sistema ao estado atual — §10.
8. **Core Domain intocável** — a Esteira decide; a AIL aprende com as decisões — §10.
9. **Esquecer não é apagar** — auditoria sobrevive ao esquecimento — §7.
10. **Toda inteligência vive na AIL** — nenhum contexto cria memória oculta — ARQ-003 princ. 12.

### Critério de sucesso — atendido

Persistência, Pattern Detector, Suggestion Engine e Knowledge Repository estão **completamente
especificados** por RFC-AIL-001…005 — implementáveis **sem nenhuma nova decisão arquitetural**. A
fase de arquitetura da AIL está **encerrada**.

> **Adaptive Intelligence Architecture v1 — Architecture Freeze.** Vigente a partir de 21 de julho
> de 2026. Alteração conceitual, doravante, só por ADR.

---

*Produzido em 21 de julho de 2026 · RFC de consolidação e congelamento · sem código, banco,
persistência, entidade nova ou alteração de qualquer RFC anterior. Consolida — não inventa.*
