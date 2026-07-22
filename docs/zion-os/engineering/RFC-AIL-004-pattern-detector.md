# RFC-AIL-004 — Pattern Detector

> **Natureza.** RFC de **comportamento**. Define **como uma sequência de Decisions produz
> Patterns** — nada mais. **Não implementa código, não fala de banco, fila, evento, índice,
> persistência ou performance. Não cria entidade nova, não altera a Decision nem a Pattern Key.**
> Projeta apenas o algoritmo conceitual do Detector. Onde faltou evidência: **EVIDÊNCIA
> INSUFICIENTE**.
>
> **Fonte:** ARQ-003 (§4, §6.2, princ. 6/7/10), RFC-AIL-001 (§4, §7, §9), RFC-AIL-002 (§3, §4,
> §5, §7), RFC-AIL-003 (Pattern Key). Objeto: a `Decision` de R-DJ-1 e a chave de RFC-AIL-003.

> ### ⚠ Nota de numeração
> A RFC-AIL-002 §12 chamava o Pattern Detector de **RFC-AIL-003**; a RFC-AIL-003 passou a ser a
> **Pattern Key** (artefato logicamente anterior), deslocando o Detector para **RFC-AIL-004** —
> conforme a recomendação registrada na própria RFC-AIL-003. Este documento ocupa esse número.
> Governança confirma a renumeração; o conteúdo independe do identificador.

> ### ⚠ Parâmetros quantitativos — fixados aqui
> A RFC-AIL-002 §7 deixou os limiares da escada de Confidence "de projeto"; a RFC-AIL-003 §5.4 os
> adiou "para o Pattern Detector". **Esta RFC os fixa** (§4.3): são os **únicos** números do
> algoritmo, canônicos e estáveis. Alterá-los é ato de governança (ADR), não escolha de
> implementação — por isso "toda implementação correta produz os mesmos Patterns".

---

## 1. Problema

O Journal acumula `Decision`s; a RFC-AIL-003 define **quando duas Decisions são o mesmo
aprendizado** (a Pattern Key). Falta o mecanismo que **transforma a sequência de Decisions no
conjunto de Patterns**:

> **Dada uma sequência arbitrária de Decisions, qual é o conjunto exato de Patterns produzido?**

A resposta precisa ser **determinística** (mesma entrada → mesmos Patterns, em qualquer
implementação), **explicável** (todo Pattern aponta as Decisions que o formaram), **incremental**
(uma Decision de cada vez), **idempotente** (a mesma Decision repetida não infla nada) e
**isolada da Esteira** (o Core Domain não muda; ARQ-003 princ. 10).

A propriedade que ancora todas: o conjunto de Patterns é uma **função pura do multiconjunto de
Decisions elegíveis e deduplicadas** — **independente da ordem** de processamento. É isso que
torna "aplicação incremental" e "recomputação total" convergentes (§7.3) e garante que qualquer
implementação correta chegue ao mesmo resultado.

---

## 2. Responsabilidades

### 2.1 O que o Pattern Detector faz (PASSO 1)

1. **Filtra elegibilidade** de cada Decision (RFC-AIL-003 §4.4/§5): contexto ∈ Bounded Contexts,
   `campo` substantivo, `valorNovo` de domínio significativo, e **delta** (`valorAnterior` ≠
   `valorNovo`). Inelegível → ignorada, sem efeito.
2. **Calcula a Pattern Key canônica** da Decision elegível (RFC-AIL-003 §3.2/§4.2).
3. **Localiza ou cria** o Pattern daquela chave (§3).
4. **Acumula** no Pattern: incorpora a Decision ao seu conjunto de suporte, atualiza `support`,
   `ultimaOcorrencia` e a **Confidence derivada** (§5).
5. **Mantém a consistência do slot** `(empresa, contexto, campo)`: registra os Patterns
   concorrentes e deriva o estado do slot — CONSISTENTE ou EM_DISPUTA (§4.4).
6. **Expõe** o conjunto de Patterns como **projeção** consultável (§2.3).

### 2.2 O que ele **nunca** faz (PASSO 8)

| Não pode | Por quê |
|---|---|
| **Sugerir** | Sugestão é *pull* de um Contexto ao Suggestion Engine (ARQ-003 §3.1b). O Detector não conhece Contextos; sugerir o acoplaria e quebraria "observa, nunca controla" (princ. 6). |
| **Inferir** | Todo o modelo é **contagem determinística, não ML** (RFC-AIL-002 §7; ARQ-003 §14/R8). Inferência introduziria não-determinismo e quebraria a explicabilidade. |
| **Escolher / ranquear** | Eleger um "vencedor" entre Patterns concorrentes de um slot é leitura do Suggestion Engine. O Detector **registra os suportes**; não ordena para agir. Ranquear embutiria política a jusante. |
| **Decidir** | O que fazer com um Pattern é decisão de outra camada. O Detector só mantém **fatos**. |
| **Aprender sozinho** | Não se auto-ajusta, não cria laço de realimentação. É **função pura** de Decisions. Auto-aprendizado violaria determinismo, explicabilidade e reversibilidade. |

**Razão unificadora:** separação de responsabilidades + determinismo + explicabilidade +
**reversibilidade**. Como projeção pura (contagem), remover a AIL devolve o sistema ao estado atual
(ARQ-003 princ. 7). Se o Detector sugerisse ou decidisse, a remoção mudaria comportamento — o
invariante cairia. Todo juízo e ação vivem a jusante e permanecem **opcionais e reversíveis**.

### 2.3 O que o Detector entrega (PASSO 7)

A saída é o **Pattern atualizado** — mais precisamente, o **conjunto de Patterns** como projeção
determinística do log de Decisions, consultável a qualquer momento.

- **Não** é um evento. (Além da restrição desta RFC, ARQ-003 §10 dispensa barramento de eventos; o
  Detector não *emite* nem *dispara* nada — manter estado projetado é sua essência.)
- **Não** é "nada": ele mantém e disponibiliza o conjunto de Patterns.

O Detector é **reativo e silencioso**: transforma Decisions em Patterns e para por aí. Quem lê a
projeção (Suggestion Engine, métricas, explicabilidade) é responsabilidade de outra camada.

---

## 3. Fluxo (PASSO 2)

Para **cada** Decision `d` da sequência:

```
   Decision d
      │
      ▼
   ┌─────────────────────────────┐
   │ d é ELEGÍVEL? (RFC-AIL-003)  │──NÃO──► ignora d (sem efeito algum)
   └─────────────┬───────────────┘
                 │ SIM
                 ▼
   ┌─────────────────────────────┐
   │ d.id já foi contado?         │──SIM──► no-op (idempotência, §7)
   └─────────────┬───────────────┘
                 │ NÃO
                 ▼
   k ← PatternKey canônica de d   (empresa, contexto, campo, valorNovo)
                 │
                 ▼
   ┌─────────────────────────────┐
   │ Existe Pattern com chave k?  │
   └───────┬─────────────┬───────┘
       SIM │             │ NÃO
           ▼             ▼
     ATUALIZAR (§5)   CRIAR (§4)
           │             │
           └──────┬──────┘
                  ▼
   Recalcular estado do SLOT (empresa, contexto, campo):
   CONSISTENTE ↔ um único Pattern recorrente; EM_DISPUTA ↔ dois ou mais (§4.4)
```

O fluxo é o mesmo processado incrementalmente (uma Decision) ou em lote (a sequência inteira): o
resultado final é idêntico (§7.3).

---

## 4. Criação (PASSO 3)

### 4.1 Quando nasce um Pattern

Um Pattern nasce quando chega a **primeira** Decision **elegível** cuja Pattern Key canônica
**ainda não existe** no conjunto. Não antes (Decision inelegível não cria nada), não depois (a
segunda Decision da mesma chave **atualiza**, não recria).

### 4.2 Estado inicial

| Atributo do Pattern | Valor inicial | Natureza |
|---|---|---|
| **chave** (Pattern Key) | `(empresa, contexto, campo, valorNovo)` canônica de `d` | **imutável** para sempre (§6) |
| **suporte** (`support`) | `1` | cardinalidade de DecisionIds distintos |
| **decisoesDeSuporte** | `{ d.id }` | conjunto (para explicabilidade) |
| **primeiraOcorrencia** | `d.timestamp` | **imutável** (marco de origem) |
| **ultimaOcorrencia** | `d.timestamp` | avança com novas Decisions |
| **confidence** | `Observado` | derivada (§4.3) |
| **estado** | `Emergente` | derivado (§4.3) |

Nenhuma sugestão, nenhuma inferência: nascer é apenas registrar a primeira ocorrência de uma
chave.

### 4.3 A escada de Confidence e de estado — a parte alcançável por contagem

O Detector deriva Confidence e estado **exclusivamente** de `support` e da consistência do slot.
Os limiares canônicos (RFC-AIL-002 §7: Observado=1, Recorrente=primeira repetição, Consistente=
repetição estável):

| Confidence | Condição (determinística) |
|---|---|
| **Observado** | `support = 1` |
| **Recorrente** | `support ≥ 2` |
| **Consistente** | `support ≥ 3` **e** o slot está **CONSISTENTE** (este é o único Pattern recorrente do slot) |

| Estado (RFC-AIL-002 §5.1) | Condição |
|---|---|
| **Emergente** | Confidence ∈ {Observado, Recorrente} |
| **Estabelecido** | Confidence = Consistente |
| **Aposentado** | *(reaprendizado — deferido, §6.4)* |

> **Fronteira dura:** os níveis **Confiável, Validado e Automatizável** (RFC-AIL-002 §7)
> **NÃO são alcançáveis pelo Detector** — dependem de **Outcomes** (realimentação de Suggestions)
> e de **permissão**, que pertencem ao Suggestion Engine e à automação, não à contagem. O Detector
> **nunca** atribui esses níveis. Ele sobe a escada só até **Consistente**.

### 4.4 Consistência do slot

O slot `(empresa, contexto, campo)` é a projeção da chave (RFC-AIL-003 §3.3). Seu estado, derivado
dos suportes dos Patterns que o compõem:

| Estado do slot | Condição determinística | Significado |
|---|---|---|
| **EMERGENTE** | nenhum Pattern do slot tem `support ≥ 2` | só ocorrências isoladas |
| **CONSISTENTE** | **exatamente um** Pattern do slot tem `support ≥ 2` | um valor recorre; os demais são isolados |
| **EM_DISPUTA** | **dois ou mais** Patterns do slot têm `support ≥ 2` | valores concorrentes recorrem — contradição (ARQ-003 §6.2: "correções contraditórias não formam padrão") |

Consequência: um Pattern só atinge **Consistente** enquanto for o **único** valor recorrente do
seu slot. Quando um segundo valor passa a recorrer, o slot vira **EM_DISPUTA** e **nenhum** dos
concorrentes é Consistente — a contradição **bloqueia** a graduação, sem apagar suporte algum.

---

## 5. Atualização (PASSO 4)

Quando chega uma nova Decision `d` **elegível, não duplicada**, cuja chave já tem Pattern `P`:

| No Pattern `P` | O que acontece | Regra |
|---|---|---|
| **decisoesDeSuporte** | `+ d.id` (união de conjunto) | cresce; nunca remove |
| **suporte** | `= |decisoesDeSuporte|` | **monotônico não-decrescente** |
| **ultimaOcorrencia** | `= max(ultima, d.timestamp)` | avança |
| **confidence** | recalculada (§4.3) | pode **subir**, nunca desce por contagem |
| **estado** | recalculado (§4.3) | Emergente → Estabelecido |
| **estado do slot** | recalculado (§4.4) | CONSISTENTE ↔ EM_DISPUTA |

### 5.1 O que permanece imutável / nunca é sobrescrito

- **A Pattern Key** (`empresa, contexto, campo, valorNovo`) — a identidade (§6).
- **primeiraOcorrencia** e a **Decision de origem** — o marco de nascimento.
- **O suporte histórico** — só cresce; **nunca** é decrementado nem zerado por contradição
  (append-only: "esquecer não é apagar", ARQ-003 princ. 11). A contradição muda **estado
  derivado**, jamais o suporte acumulado.

Atualizar é **acumular**, nunca reescrever. Tudo que muda é derivado do conjunto de suporte; a
identidade e a história são intocáveis.

---

## 6. Invariantes (PASSO 5)

| Pergunta | Resposta | Justificativa |
|---|---|---|
| Um Pattern pode **mudar de identidade**? | **Não** | A identidade **é** a Pattern Key; ela é fixada na criação e nunca reescrita. |
| Pode **trocar de Pattern Key**? | **Não** | Trocar qualquer componente da chave produz, por RFC-AIL-003, **outro** Pattern. Uma Decision de chave diferente **cria/atualiza outro** Pattern — não "move" este. |
| Pode **mudar de empresa**? | **Não** | `empresa` é componente da chave e a fronteira de isolamento (ARQ-003 princ. 8). Mudá-la seria vazamento entre tenants. |
| Pode **mudar de contexto**? | **Não** | `contexto` é componente da chave; é o que desambigua o campo entre Bounded Contexts. |
| Pode **mudar de campo**? | **Não** | `campo` é o assunto do aprendizado e componente da chave. |
| Pode **mudar de valor** (`valorNovo`)? | **Não** | `valorNovo` é o que se aprende e componente da chave. Um novo valor é **outro** Pattern, concorrente no mesmo slot. |

### 6.1 Invariante-mãe

> **A identidade de um Pattern é imutável.** Tudo que o Detector altera são **acúmulos derivados**
> (suporte, últimaOcorrência, Confidence, estado) — nunca a chave. Não há operação que reescreva a
> identidade de um Pattern; só há *criar outro* e *acumular no existente*.

### 6.2 Monotonicidade

Suporte e Confidence-por-contagem **nunca regridem** durante a detecção: contradição e inatividade
alteram **estado derivado** (slot EM_DISPUTA; futura expiração), não o suporte. Isso garante que
reprocessar não "desfaz" aprendizado.

### 6.3 Isolamento da Esteira

O Detector lê Decisions e mantém Patterns; **não** chama, consulta ou altera a Esteira (A10,
regras-mãe). O veredito da Esteira é intocado (ARQ-003 princ. 10). O Detector é observador puro.

### 6.4 Aposentadoria / reaprendizado — deferido, com sinal já disponível

O estado **Aposentado** (RFC-AIL-002 §5.1) e o **reaprendizado** (aposentar o Pattern quando um
novo valor se sustenta) pertencem à fase **R-AIL-5** (ARQ-003 §13). Esta RFC **não** os
implementa, mas **já produz o sinal cru** necessário: o slot EM_DISPUTA e a `ultimaOcorrencia` por
Pattern. Nada aqui precisará ser refeito para adicioná-los — apenas uma política de recência sobre
dados que o Detector já mantém. **EVIDÊNCIA INSUFICIENTE** para fixar a política de recência agora.

---

## 7. Idempotência (PASSO 6)

### 7.1 A mesma Decision chegando duas vezes

O `support` é a **cardinalidade do conjunto de DecisionIds distintos** de suporte — **não** um
contador incrementado. Reprocessar uma Decision cujo `id` já pertence ao conjunto é, por
construção, um **no-op**: a união de conjunto não muda nada. Não há dupla contagem possível.

### 7.2 De quem é a responsabilidade — em camadas

| Camada | Responsabilidade | Chave |
|---|---|---|
| **Journal** (RFC-AIL-001 §7) | Deduplicação **semântica** na escrita: o *mesmo salvamento* disparando duas vezes (possíveis ids distintos) vira **DecisionDuplicated** e não infla o log. | `(tenant, entidade, campo, valorNovo, correlacao)` |
| **Pattern Detector** (esta RFC) | Idempotência de **replay**: a *mesma Decision* (mesmo `DecisionId`) reprocessada não altera o Pattern. Torna o Detector seguro para recomputar. | `DecisionId` |

**Não** é responsabilidade da persistência (fora do escopo e do plano lógico). São **dois níveis
complementares**: o Journal evita duplicatas *semânticas* entrarem; o Detector é imune a *replay*
do que entrou. Um não substitui o outro — o Journal protege a contagem de re-disparos do mesmo
salvamento; o Detector protege a recomputação de reprocessar o mesmo registro.

### 7.3 Confluência (o teorema que fecha o determinismo)

Como `support` é uma cardinalidade de conjunto e `primeira/ultimaOcorrencia` são `min/max` de
timestamps de Decisions (não da ordem de chegada), o estado final de cada Pattern é **função pura
do multiconjunto de Decisions elegíveis distintas** — **independente da ordem** de processamento.

> **Aplicação incremental (uma a uma) e recomputação em lote convergem para o mesmo conjunto de
> Patterns.** Daí decorrem, simultaneamente: determinismo, incrementalidade e idempotência. Esta é
> a base do critério de sucesso: qualquer implementação correta produz **exatamente** os mesmos
> Patterns.

---

## 8. Exemplos (PASSO 10)

Empresa `emp-A` salvo indicação. Notação de estado do Pattern:
`⟨chave | support | confidence | estado⟩`. Forma canônica assumida.

### Cenário 1 — Nascimento
```
D1 = (emp-A, Catálogo, categoria, MLB273770)  id=d1
→ chave nova → CRIA
Pattern P1: ⟨(emp-A,Catálogo,categoria,MLB273770) | 1 | Observado | Emergente⟩
Slot (emp-A,Catálogo,categoria): EMERGENTE
```

### Cenário 2 — Atualização (recorrência)
```
D2 = (emp-A, Catálogo, categoria, MLB273770)  id=d2   [outro autor, outra tela, outro dia]
→ mesma chave → ATUALIZA P1
P1: ⟨… | 2 | Recorrente | Emergente⟩
Slot: CONSISTENTE (um único Pattern com support≥2)
```

### Cenário 3 — Estabelecimento
```
D3 = (emp-A, Catálogo, categoria, MLB273770)  id=d3
→ ATUALIZA P1
P1: ⟨… | 3 | Consistente | Estabelecido⟩     (support≥3 ∧ slot CONSISTENTE)
Slot: CONSISTENTE
```

### Cenário 4 — Novo Pattern no mesmo slot → contradição
```
D4 = (emp-A, Catálogo, categoria, MLB999999)  id=d4
→ chave nova (valorNovo diferente) → CRIA P2
P1: ⟨…MLB273770 | 3 | Consistente→? | …⟩      (support intacto = 3)
P2: ⟨…MLB999999 | 1 | Observado | Emergente⟩
Slot: ainda CONSISTENTE (só P1 tem support≥2; P2 é isolado) → P1 continua Consistente

D5 = (emp-A, Catálogo, categoria, MLB999999)  id=d5
→ ATUALIZA P2
P2: ⟨…MLB999999 | 2 | Recorrente | Emergente⟩
Slot: EM_DISPUTA (P1 e P2 ambos com support≥2)
→ P1 REBAIXA de Consistente para Recorrente (perde o "único recorrente"); support de P1 SEGUE = 3
→ Nenhum dos dois é Consistente enquanto durar a disputa. Nada foi apagado.
```

### Cenário 5 — Idempotência (replay)
```
D3' = a MESMA Decision d3 reprocessada (id=d3)
→ d3 já ∈ decisoesDeSuporte(P1) → NO-OP
P1 inalterado. support continua o que era. (Confluência: recomputar não muda nada.)
```

### Cenário 6 — Inelegível (não produz Pattern)
```
D6 = (emp-A, "pendencia", resolvida, true)  id=d6
→ contexto fora dos Bounded Contexts E valorNovo constante (RFC-AIL-003 §5.2/§5.3)
→ INELEGÍVEL → IGNORADA. Nenhum Pattern criado ou tocado.

D7 = (emp-A, Publicação, tipoAnuncio, Premium→Premium)  id=d7   [sem delta]
→ valorAnterior = valorNovo → INELEGÍVEL → IGNORADA.
```

### Cenário 7 — Isolamento por empresa
```
D8 = (emp-B, Catálogo, categoria, MLB273770)  id=d8
→ empresa diferente → chave diferente → CRIA P3 (de emp-B), separado de P1
P3: ⟨(emp-B,Catálogo,categoria,MLB273770) | 1 | Observado | Emergente⟩
P1 (emp-A) intocado. Nenhum cruzamento de tenant.
```

**Conjunto final de Patterns após D1…D8** (função pura do multiconjunto, em qualquer ordem):

| Pattern | support | confidence | estado | slot |
|---|---|---|---|---|
| P1 (emp-A, Catálogo, categoria, **MLB273770**) | 3 | Recorrente | Emergente | EM_DISPUTA |
| P2 (emp-A, Catálogo, categoria, **MLB999999**) | 2 | Recorrente | Emergente | EM_DISPUTA |
| P3 (emp-B, Catálogo, categoria, **MLB273770**) | 1 | Observado | Emergente | EMERGENTE |

D6 e D7 não produziram Pattern (inelegíveis). D3' foi no-op. **Este é o conjunto exato** — e seria
o mesmo em qualquer ordem de chegada.

---

## 9. Impacto Futuro (PASSO 9)

Sem refatoração, porque cada consumidor apenas **lê** a projeção que o Detector já mantém:

| Consumidor | Como usa o Detector | Por que não exige refatoração |
|---|---|---|
| **Suggestion Engine** | Consulta o **slot** `(empresa, contexto, campo)`; se **CONSISTENTE**, oferece o `valorNovo` do Pattern Consistente. | Todos os fatos (suportes, consistência, Confidence) já existem; o Engine é **leitor**, não altera o Detector. |
| **Knowledge Repository** | Um Knowledge é um Pattern **promovido** por Outcomes a Validado; herda chave, suporte e decisões de origem do Pattern. | A promoção acontece **acima** (via Outcomes), sem tocar a contagem. O Detector já entrega a base. |
| **Métricas** (RFC-AIL-001 §9) | "Campos mais corrigidos", "decisões repetidas", "decisões por contexto" são projeções diretas de suportes/slots. | São leituras da mesma projeção — sem estrutura nova. |
| **Explainability** (RFC-AIL-002 §8) | "Qual Decision originou?" → primeira de suporte; "Qual Pattern?" → a chave; "Há exceções?" → Patterns concorrentes do slot. | O estado mantido **é** o substrato da explicação. Derivada, sempre verdadeira. |

Todos consomem a **mesma** identidade e a **mesma** projeção — nenhum redefine o que é um Pattern
nem como ele é contado.

---

## 10. Decisão Arquitetural Final

> **O Pattern Detector é uma projeção pura e determinística do log de Decisions.** Para cada
> Decision **elegível e não duplicada**, calcula a Pattern Key canônica, **cria** o Pattern (se a
> chave é nova) ou **acumula** nele (se já existe), mantendo `support` como cardinalidade de
> DecisionIds distintos, `Confidence`/`estado` derivados por contagem até no máximo **Consistente**,
> e o estado do **slot** (CONSISTENTE ↔ EM_DISPUTA). **Não sugere, não infere, não escolhe, não
> ranqueia, não decide, não aprende sozinho.**

Cláusulas vinculantes:

1. **Identidade imutável:** um Pattern nunca troca de chave, empresa, contexto, campo ou valor
   (§6). Só existe *criar outro* e *acumular no existente*.
2. **Acúmulo, nunca reescrita:** suporte é monotônico; chave, primeiraOcorrência e história são
   intocáveis; contradição altera estado derivado, jamais o suporte (§5.1, §6.2).
3. **Elegibilidade porta de entrada:** Decisions inelegíveis (RFC-AIL-003) não têm efeito (§3).
4. **Confidence por contagem até Consistente:** níveis acima exigem Outcomes/permissão e **não**
   são do Detector (§4.3).
5. **Idempotência em camadas:** Journal deduplica o semântico; o Detector é imune a replay por
   contar DecisionIds distintos (§7).
6. **Confluência:** incremental ≡ lote; o conjunto de Patterns é função pura do multiconjunto de
   Decisions (§7.3).
7. **Isolamento:** a Esteira e o Core Domain permanecem intocados (§6.3).

**Nenhuma entidade nova foi criada; a `Decision` e a Pattern Key permanecem inalteradas.** O
Detector apenas dá **comportamento** ao Pattern que a RFC-AIL-002 definiu e à identidade que a
RFC-AIL-003 fixou.

### Critério de sucesso — atendido

- **Implementável sem decisão arquitetural adicional:** o algoritmo (§3), o estado inicial (§4.2),
  a escada com limiares fixos (§4.3), as regras de slot (§4.4), a atualização (§5) e a idempotência
  (§7) estão todos especificados e fechados.
- **Mesma sequência → mesmos Patterns:** garantido pela confluência (§7.3) — função pura do
  multiconjunto.
- **Determinístico e explicável:** sem ML, sem aleatoriedade, sem relógio na identidade; todo
  Pattern aponta as Decisions que o formaram.

> **Resposta à pergunta final:** *dada uma sequência arbitrária de Decisions, o conjunto exato de
> Patterns é* — para cada **chave canônica distinta** entre as Decisions **elegíveis e
> deduplicadas**, um Pattern cujo `support` é o número de DecisionIds distintos daquela chave, com
> `primeira/ultimaOcorrencia`, Confidence e estado **derivados** por §4.3–§4.4. Nada mais, nada a
> menos — e igual em qualquer ordem.

---

*Produzido em 21 de julho de 2026 · RFC de comportamento · sem código, banco, fila, evento, índice,
persistência, performance, entidade nova ou alteração de Decision/Pattern Key.*
