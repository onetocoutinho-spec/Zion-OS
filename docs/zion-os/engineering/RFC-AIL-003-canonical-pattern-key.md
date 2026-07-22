# RFC-AIL-003 — Chave Canônica de Padrão (Canonical Pattern Key)

> **Natureza.** RFC de **identidade lógica**. Define **quando duas Decisions representam o mesmo
> aprendizado** — nada mais. **Não implementa código, não fala de banco, tabela, índice ou
> persistência, não cria entidade, não altera Decision/Pattern/Suggestion/Knowledge.** Trata
> exclusivamente da **identidade de um Pattern**. Onde faltou evidência: **EVIDÊNCIA INSUFICIENTE**.
>
> **Fonte:** ARQ-003 (§4, §6.2), RFC-AIL-001 (§4, §5, §7), RFC-AIL-002 (§3, §6),
> Cap. 02 (Bounded Contexts), Architecture Review ARCH-REVIEW-001 (A-1, A-2). Objeto: a
> `Decision` definida em `src/modules/adaptive-intelligence/domain/decision.ts` (R-DJ-1).

> ### ⚠ Nota de numeração — colisão registrada
> O roadmap da **RFC-AIL-002 §12** reservou **RFC-AIL-003 = Pattern Detector**. Esta RFC ocupa o
> número 003 por decisão da missão, mas trata de um artefato **logicamente anterior** ao Detector:
> a identidade que o Detector irá contar. **Recomendação (governança decide):** esta RFC
> permanece **RFC-AIL-003 (Pattern Key)** e o **Pattern Detector desloca-se para RFC-AIL-004**. O
> conteúdo independe do identificador final. Colisão **registrada, não ignorada** (precedente:
> RFC-001/RFC-AIL-001).

> ### ⚠ Reconciliação obrigatória — discrepância entre fontes
> **ARQ-003 §6.2** afirma *"a contagem é por `(empresa, contexto, campo)`"* (tripla).
> **RFC-AIL-002 §3.3/§8** afirma que a chave do Pattern é *`(Empresa, Contexto, Campo, ValorNovo)`*
> (quádrupla). **Não é contradição — são dois níveis.** Esta RFC os concilia formalmente (§3.3):
> a **quádrupla é a IDENTIDADE** do Pattern; a **tripla é a sua PROJEÇÃO** — o *slot* sobre o qual
> consistência e contradição são avaliadas. Ambos os documentos permanecem corretos.

---

## 1. Problema

O Zion registra `Decision`s (R-DJ-1/R-DJ-2). Para que qualquer aprendizado exista, o sistema
precisa responder, de forma **determinística**, a uma pergunta:

> **Dadas duas Decisions quaisquer, elas pertencem ao mesmo Pattern — representam o mesmo
> aprendizado — ou não?**

Sem essa resposta, não há como contar recorrências (Pattern Detector), oferecer o valor aprendido
(Suggestion Engine) nem curar um fato reutilizável (Knowledge). A resposta **não pode** depender de
heurística, de similaridade ou de contexto de execução: precisa depender **apenas** de uma chave
bem definida, calculável a partir da própria `Decision`.

Esta RFC define essa chave — a **Pattern Key** — e, com ela, a relação de **igualdade de
aprendizado** entre Decisions.

**Duas dívidas herdadas que esta RFC quita** (ARCH-REVIEW-001, adiadas explicitamente "para antes
de RFC-AIL-003"):
- **A-1** — `contexto` gravado como `"pendencia"` (R-DJ-2), que **não é** um Bounded Context.
- **A-2** — delta gravado como `campo:"resolvida"`, `valorNovo:"true"` — um **flag de status
  constante**, não um valor aprendível.

Ambas são, na verdade, **violações da chave** — e a chave, uma vez definida, dá o critério objetivo
para rejeitá-las (§5.3).

---

## 2. Objetivos

Definir, no plano puramente lógico:

1. A **identidade de um Pattern** — o que o torna "o mesmo" ao longo do tempo.
2. A **Pattern Key canônica** — sua composição exata.
3. Os atributos da `Decision` que **participam** da identidade.
4. Os atributos que **nunca** participam.
5. A relação de **igualdade** (e de desigualdade) entre Decisions para fins de aprendizado.
6. O **impacto** sobre Pattern Detector, Suggestion Engine e Knowledge — sem redefinir identidade.

Fora de escopo (por restrição): algoritmo de contagem, limiares de Confidence, persistência,
qualquer código.

---

## 3. Pattern Key

### 3.1 Análise atributo a atributo (PASSO 1)

Os treze atributos da `Decision` (`decision.ts:16-38`). Para cada um: **participa da identidade
do Pattern?**

| Atributo | Participa? | Justificativa |
|---|---|---|
| **empresa** (tenant) | **SIM** | O isolamento é inviolável (ARQ-003 princ. 8). Duas Decisions de empresas distintas **nunca** são o mesmo aprendizado. Sem empresa na chave, haveria vazamento entre tenants — o pior falso positivo possível. |
| **contexto** (Bounded Context) | **SIM** | O mesmo nome de campo tem significados diferentes em Bounded Contexts diferentes (`tipo` em Catálogo ≠ `tipo` em Publicação). O contexto desambigua o campo. **Condição (A-1):** o domínio de `contexto` é o **conjunto fechado** dos Bounded Contexts de Cap. 02 (§5.2). |
| **campo** | **SIM** | O campo decidido **é** o assunto do aprendizado. "categoria" e "tipoAnuncio" são aprendizados distintos. **Condição (A-2):** `campo` deve nomear um **campo substantivo decidido**, não um flag de status (§5.3). |
| **valorNovo** | **SIM** | É a **escolha** do cliente — exatamente o que será sugerido de volta. Sem `valorNovo` na identidade, saberíamos *que* o cliente mexe no campo, não *para qual valor*. **Condição (A-2):** deve pertencer a um **domínio de valor significativo**, não a uma constante (ex.: `"true"`). |
| **entidade.id** | **NÃO** | O id da entidade concreta (produto `prod-123`) é **onde** a decisão aconteceu, não **o que** se aprende. Incluí-lo tornaria cada entidade um padrão de um só membro — **impediria a generalização** ("esta empresa sempre usa Premium" jamais se formaria). |
| **entidade.tipo** | **NÃO** *(ver §6, R-5)* | O tipo ("produto"/"canal"/"anuncio") é, em regra, **redundante** com `(contexto, campo)`, que já escopam o significado. Incluí-lo fragmenta padrões sem ganho. Onde o escopo de aprendizado for genuinamente mais estreito (ex.: "medida por marca"), o escopo pertence à **identidade semântica do `campo`** (§5.4), não à entidade. |
| **valorAnterior** | **NÃO** | O valor de **origem** não define o aprendizado. Ir de `MLB100→MLB273770` ou de `null→MLB273770` é o **mesmo** aprendizado: "quer MLB273770". Incluí-lo fragmentaria um mesmo alvo por ponto de partida (falso negativo). É **critério de elegibilidade** (§4.4), não identidade. |
| **autor** | **NÃO** | O Pattern é da **empresa**, não do usuário. Dois funcionários do mesmo tenant escolhendo o mesmo valor são o **mesmo** aprendizado (ARQ-003 §9 — memória "Da Empresa"). Incluir `autor` fragmentaria a preferência da empresa por pessoa. Serve à auditoria (RFC-AIL-001 §8), não à identidade. |
| **origem** (tela/ação) | **NÃO** | O mesmo aprendizado pode vir de telas diferentes (editar da lista vs. do detalhe). Incluir `origem` fragmentaria por caminho de UI. Serve à rastreabilidade/explicação, não à identidade. |
| **timestamp** | **NÃO** *(exclusão dura)* | Único por Decision. Na chave, cada Decision seria seu próprio padrão — **nada jamais recorreria**. Serve à **recência/decaimento** (RFC-AIL-002 §7) e a janelas, nunca à identidade. |
| **correlacao** | **NÃO** *(exclusão dura)* | Liga decisões da **mesma sessão/passada** (RFC-AIL-001 §5). Na chave, cada sessão seria um padrão isolado — aprendizado entre sessões impossível. Serve à idempotência (RFC-AIL-001 §7) e à reconstrução de uma passada, não à identidade. |
| **id** (DecisionId) | **NÃO** *(exclusão dura)* | Identidade do **registro**, não do **aprendizado**. Único por definição. |
| **metadados** | **NÃO** | Bolsa de extensão opcional (RFC-AIL-001 §5). Por definição não integra a identidade. |

### 3.2 A chave

> **Pattern Key ≝ ( empresa, contexto, campo, valorNovo )**

Quatro componentes, todos obrigatórios e não-nulos, tomados na **forma canônica** de cada valor
(§4.2). A quádrupla **é** a identidade lógica do Pattern: a resposta a *"que aprendizado é este?"*.

### 3.3 O slot: a projeção `(empresa, contexto, campo)` — reconciliação ARQ-003 §6.2 × RFC-AIL-002 §3.3

A identidade (quádrupla) e a **contagem de consistência** (tripla) operam em níveis diferentes:

| Nível | Composição | Pergunta que responde |
|---|---|---|
| **Pattern (identidade)** | `(empresa, contexto, campo, valorNovo)` | "Estas duas Decisions são **o mesmo** aprendizado?" |
| **Slot (projeção)** | `(empresa, contexto, campo)` | "Para este campo, nesta empresa e contexto, **qual valor** vem prevalecendo — e há contradição?" |

O **slot** é a Pattern Key **menos** o `valorNovo` — não é uma entidade nova, é uma **projeção da
própria chave**. Dentro de um slot podem coexistir vários Patterns (um por `valorNovo`
observado). A relação entre eles é o sinal de aprendizado:

- **Consistência** = um slot em que **um** Pattern (um `valorNovo`) domina → sugerível.
- **Contradição** = um slot em que **múltiplos** Patterns disputam (vários `valorNovo` com suporte)
  → nenhuma sugestão confiável; e, se a contradição se sustenta, é o gatilho de reaprendizado
  (RFC-AIL-002 §5.3).

Assim, **ARQ-003 §6.2** ("contagem por `(empresa, contexto, campo)`") descreve o **slot**;
**RFC-AIL-002 §3.3** ("chave `(…, ValorNovo)`") descreve a **identidade**. As duas afirmações são
verdadeiras e complementares.

### 3.4 Alternativas avaliadas (PASSO 2)

| Alternativa | Veredito | Motivo |
|---|---|---|
| `(empresa, campo, valorNovo)` — sem contexto | **Rejeitada** | Conflui campos homônimos de Bounded Contexts distintos → **falso positivo**. |
| `(empresa, contexto, campo, valorNovo, autor)` | **Rejeitada** | Fragmenta o aprendizado da empresa por usuário → **falso negativo**; fere memória por tenant. |
| `(empresa, contexto, entidade, campo, valorNovo)` | **Rejeitada** | `entidade.id` impede generalização (cada entidade um padrão de um); `entidade.tipo` é redundante com `(contexto, campo)`. |
| `(empresa, contexto, campo, valorNovo, valorAnterior)` | **Rejeitada** | Fragmenta o mesmo alvo por valor de origem → **falso negativo** e explosão de cardinalidade. |
| `(empresa, contexto, campo)` — sem valorNovo | **Rejeitada como identidade** | É o **slot**, não a identidade: um Pattern sem o valor não tem **o que** sugerir. Sobrevive como projeção (§3.3). |
| **`(empresa, contexto, campo, valorNovo)`** | **Adotada** | Isola o tenant, desambigua por contexto, nomeia o assunto (campo) e carrega a escolha (valorNovo). Nem mais (fragmentaria) nem menos (confundiria). |

---

## 4. Igualdade (PASSO 3)

### 4.1 Definição

> **Duas Decisions são iguais para fins de aprendizado se, e somente se, suas Pattern Keys são
> iguais** — isto é, coincidem em **todos os quatro** componentes, cada um em forma canônica:
> `empresa` ∧ `contexto` ∧ `campo` ∧ `valorNovo`.

Deixam de ser iguais quando **qualquer** um dos quatro difere. Em particular:

- Mesma `(empresa, contexto, campo)` e **`valorNovo` diferente** → **não são o mesmo Pattern**.
  São Patterns **concorrentes no mesmo slot** — a matéria-prima da detecção de contradição (§3.3).
- Diferença em `empresa`, `contexto` ou `campo` → aprendizados **sem relação**; nem sequer
  compartilham slot.

Nada fora dos quatro componentes afeta a igualdade: duas Decisions com autores, telas, horários,
correlações, valores anteriores e entidades **completamente diferentes** são o **mesmo**
aprendizado se, e só se, as quatro coordenadas coincidem.

### 4.2 Forma canônica (determinismo)

A igualdade precisa ser **determinística e total** — sem similaridade, sem fuzzy, sem ML. Cada
componente entra na chave por sua **forma canônica**, obtida por uma normalização **determinística
e total**:

- **Normalização estrutural (todos):** aparar espaços de borda; unificar espaços internos;
  normalização Unicode canônica (NFC).
- **Política de caixa (por domínio do campo):** valores de **domínio fechado e sensível a caixa**
  (ex.: ids de categoria como `MLB273770`) comparam-se **exatos**; valores de **texto livre**
  comparam-se com caixa dobrada (case-fold). A política é **fixa por campo**, publicada e estável.
- **Proibido:** qualquer aproximação semântica ("Premium" ≈ "premium plan"), sinônimos, distância
  de edição. Igualdade é **coincidência exata da forma canônica** — nada além.

> **Invariante de determinismo:** dadas duas Decisions, a resposta "mesmo Pattern?" é uma função
> pura das duas Pattern Keys canônicas. Nenhum estado externo, relógio ou aleatoriedade participa.

### 4.3 O que a igualdade **não** é

Não é igualdade de `Decision` (registros distintos, com ids/timestamps distintos, são o **mesmo**
Pattern). Não é idempotência: a deduplicação de re-disparos idênticos usa
`(tenant, entidade, campo, valorNovo, correlacao)` (RFC-AIL-001 §7) — chave **diferente**, com
propósito diferente (evitar contar duas vezes o mesmo salvamento), que **inclui** correlação
justamente para **não** apagar recorrências legítimas entre sessões.

### 4.4 Elegibilidade (pré-condição da igualdade)

Antes de ter Pattern Key, uma Decision precisa ser **elegível a padrão** — ser uma *escolha que
corrige/sobrescreve* (RFC-AIL-001 §4.2):

- **`valorAnterior` ≠ `valorNovo`** (após canonicalização): sem delta, não há correção a aprender.
- **`campo` substantivo** e **`valorNovo` de domínio significativo** (§5.3).

Decisions inelegíveis **não recebem** Pattern Key e **não** participam de igualdade — são
observações operacionais, não aprendizado.

---

## 5. Exclusões (PASSO 4)

### 5.1 O que **nunca** entra na chave

| Excluído | Por quê (o que aconteceria se entrasse) |
|---|---|
| **id (UUID)** | Único por registro → cada Decision vira um Pattern → **nada recorre** → aprendizado zero. |
| **timestamp** | Único por evento → mesma patologia do UUID. (Uso legítimo: recência/decaimento, fora da identidade.) |
| **correlacao** | Única por sessão/passada → aprendizado **entre** sessões impossível → o cliente "reensina" a cada vez. |
| **autor** | Fragmenta a preferência da **empresa** por indivíduo → falso negativo; fere memória por tenant. |
| **origem** | Fragmenta por tela/caminho de UI → o mesmo aprendizado se parte em vários. |
| **valorAnterior** | Fragmenta o mesmo alvo por ponto de partida → falso negativo + cardinalidade. |
| **entidade.id** | Cada entidade um padrão de um só → **impede a generalização**, que é o propósito. |
| **metadados** | Bolsa de extensão; não é identidade por definição. |

**Regra geral:** **nenhum atributo de alta cardinalidade** (identificadores únicos, tempo,
correlação, entidade concreta) pode compor a identidade — todos empurram a cardinalidade de
Patterns para ≈ nº de Decisions, o que é o **colapso do aprendizado**.

### 5.2 Restrição de domínio de `contexto` (quita A-1)

`contexto` participa da identidade — logo seu **domínio é fechado**: exatamente os Bounded
Contexts de Cap. 02 — **Catálogo, Esteira, Precificação, Conexão de Canal, Publicação, Vendas,
Identidade**. Valores fora desse conjunto (ex.: `"pendencia"`, gravado em R-DJ-2) **não são
`contexto` válidos**: quebram o alinhamento com a taxonomia e produzem falsos negativos (o mesmo
contexto real sob rótulos distintos). **A resolução de pendência pertence ao Bounded Context de
Catálogo** (é o cliente preenchendo dado do catálogo sinalizado como faltante); é lá que seu
`contexto` deve ser classificado quando/se ela produzir aprendizado.

### 5.3 Restrição de `campo` e `valorNovo` (quita A-2)

`campo` deve nomear um **campo substantivo decidido**; `valorNovo` deve pertencer a um **domínio
de valor significativo**. Um **flag de status** (`campo:"resolvida"`, `valorNovo:"true"`) é
**inelegível a padrão**: `valorNovo` constante colapsa a identidade — o "Pattern"
`(emp, …, resolvida, true)` recorre trivialmente e **não carrega nada sugerível** ("true" não é
uma escolha reutilizável). Isso é **perda de aprendizado** disfarçada de recorrência.

> **Consequência direta para R-DJ-2:** o Producer de pendência, como instrumentado, grava um
> **marco operacional**, não um aprendizado. Ou é **re-instrumentado** para capturar o **valor
> substantivo preenchido** (o que RFC-AIL-001 §4.1 chamou de "o valor preenchido é aprendível") —
> aí com `contexto=Catálogo`, `campo` = o campo preenchido, `valorNovo` = o valor —, ou permanece
> como **observação não formadora de padrão**. Nenhuma das duas exige mudar a `Decision`; é
> decisão de *qual* Decision emitir.

### 5.4 Escopo mais estreito que o Bounded Context

Alguns aprendizados são mais estreitos que `(contexto, campo)` — ex.: "medida **por marca**"
(RFC-AIL-001 §4.1). O escopo adicional pertence à **identidade semântica do `campo`** (um `campo`
qualificado e estável, cuja semântica inclui o qualificador), **não** à `entidade`. Assim a chave
permanece a quádrupla, e a generalização entre entidades concretas é preservada. O catálogo desses
`campo` qualificados é **EVIDÊNCIA INSUFICIENTE** aqui — pertence ao Pattern Detector (próxima RFC),
que enumerará os campos aprendíveis; esta RFC apenas fixa **onde** o escopo mora (no `campo`).

---

## 6. Exemplos

Todos com a mesma empresa `emp-A`. Forma canônica assumida.

**(a) Mesmo Pattern — recorrência legítima**
```
D1: (emp-A, Catálogo, categoria, MLB273770)   [autor=ana, tela=lista,    2026-07-01]
D2: (emp-A, Catálogo, categoria, MLB273770)   [autor=léo, tela=detalhe,  2026-07-09]
→ MESMA Pattern Key → mesmo aprendizado. Autor, tela e data diferentes NÃO importam.
```

**(b) Patterns concorrentes no mesmo slot — contradição**
```
D3: (emp-A, Catálogo, categoria, MLB273770)
D4: (emp-A, Catálogo, categoria, MLB999999)
→ mesmo slot (emp-A, Catálogo, categoria), valorNovo diferente
→ Patterns DIFERENTES; o slot está em disputa → sem sugestão confiável (sinal de contradição).
```

**(c) Aprendizados sem relação — contexto/campo distintos**
```
D5: (emp-A, Publicação, tipoAnuncio, Premium)
D6: (emp-A, Catálogo,   categoria,   Premium)
→ campos e contextos diferentes → Patterns distintos, nem compartilham slot,
   ainda que o texto do valorNovo coincida ("Premium").
```

**(d) Inelegível — degenerado (A-2)**
```
D7: (emp-A, "pendencia", resolvida, true)
→ contexto fora do conjunto de BCs (§5.2) E valorNovo constante (§5.3)
→ INELEGÍVEL a padrão: não recebe Pattern Key.
```

**(e) Delta ausente — não é correção**
```
D8: valorAnterior=Premium, valorNovo=Premium
→ sem delta (§4.4) → inelegível.
```

---

## 7. Impacto Futuro (PASSO 5)

A chave é a **fundação estável** que as três fases seguintes consomem **sem redefinir identidade**:

| Fase futura | Como usa a Pattern Key | Por que não redefine identidade |
|---|---|---|
| **Pattern Detector** (próxima RFC) | Agrupa Decisions **elegíveis** pela quádrupla; conta recorrência; avalia consistência/contradição no **slot** (§3.3). | Só **conta** sobre a chave desta RFC; "mesmo Pattern?" já está respondido aqui, deterministicamente. |
| **Suggestion Engine** | Ao ser consultado (pull) por `(empresa, contexto, campo)` — um **slot** —, devolve o `valorNovo` do Pattern dominante. | A consulta **é** uma projeção da chave; a oferta **é** o `valorNovo` da identidade. Nenhum conceito novo. |
| **Knowledge Repository** | Um Knowledge **é** um Pattern promovido; sua identidade **é** a Pattern Key. Decisions novas com a mesma chave **acretam** confiança em vez de fragmentar. | Como a chave nunca muda, o Knowledge é **estável no tempo**; esquecer/reaprender operam sobre o slot. |

Consequência: a explicabilidade (RFC-AIL-002 §8) fica **endereçável** — "qual Pattern?" responde-se
com a quádrupla; "há exceções?" responde-se com os Patterns concorrentes do slot. Tudo derivado da
**mesma** identidade.

---

## 8. Riscos (PASSO 6)

| Patologia | Chave que a causa | Efeito | Evitada por |
|---|---|---|---|
| **Falso positivo** (junta o que é distinto) | Falta `empresa` → vazamento entre tenants; falta `contexto` → campos homônimos fundidos; `campo` genérico demais; `valorNovo` mal normalizado (funde valores distintos) | Sugere o de **outra** empresa/campo; contamina o aprendizado | `empresa`+`contexto` obrigatórios (§3.2); domínio fechado de `contexto` (§5.2); forma canônica **determinística** (§4.2) |
| **Falso negativo** (parte o que é o mesmo) | Inclui `timestamp`/`id`/`correlacao`/`autor`/`origem`/`valorAnterior`/`entidade.id`; ou `contexto` como string livre inconsistente | O mesmo aprendizado vira N padrões fracos → **nunca** recorre → cliente reensina | Exclusões duras (§5.1); domínio fechado de `contexto` (§5.2) |
| **Explosão de cardinalidade** | Qualquer atributo de **alta cardinalidade** na chave (tempo, UUID, correlação, entidade concreta) | Nº de Patterns ≈ nº de Decisions; agregação impossível | Regra geral de exclusão de alta cardinalidade (§5.1) |
| **Perda de aprendizado** | Chave **degenerada**: `campo`/`valorNovo` constantes (flag de status) | "Padrão" trivial sem nada a sugerir; recorrência falsa | Elegibilidade + restrição de `campo`/`valorNovo` (§4.4, §5.3) |
| **Sobre-escopo** | `entidade.id` na chave (ou escopo estreito na entidade) | Cada produto/canal um padrão de um → não generaliza | `entidade` fora da chave; escopo estreito vai ao `campo` (§5.4) |

**Assimetria a lembrar:** falso positivo **contamina** (sugere o errado); falso negativo
**emudece** (não sugere). Ambos são inaceitáveis, mas a chave desta RFC é calibrada para **não
fundir o distinto** (mínimo de componentes discriminantes) **nem partir o mesmo** (exclusão
rigorosa de tudo que é único por registro).

---

## 9. Decisão Arquitetural Final

> **A identidade lógica de um Pattern é a Pattern Key:**
>
> **( empresa, contexto, campo, valorNovo )** — em forma canônica determinística.
>
> **Duas Decisions representam exatamente o mesmo aprendizado se, e somente se, suas Pattern Keys
> são iguais.** Deixam de sê-lo quando qualquer um dos quatro componentes difere; em especial,
> mesmo `(empresa, contexto, campo)` com `valorNovo` distinto são Patterns **concorrentes no mesmo
> slot** — não o mesmo Pattern.

Cláusulas vinculantes:

1. **Slot = projeção** `(empresa, contexto, campo)` da própria chave — nível em que consistência e
   contradição são avaliadas (concilia ARQ-003 §6.2 × RFC-AIL-002 §3.3). **Não é entidade nova.**
2. **`contexto`** ∈ conjunto fechado dos Bounded Contexts de Cap. 02 (quita **A-1**).
3. **`campo` substantivo** e **`valorNovo` de domínio significativo**; flags de status são
   **inelegíveis** (quita **A-2**).
4. **Elegibilidade** exige delta (`valorAnterior` ≠ `valorNovo`) — pré-condição da chave.
5. **Exclusão dura** de `id`, `timestamp`, `correlacao`, `autor`, `origem`, `valorAnterior`,
   `entidade`, `metadados` — nenhum participa da identidade.
6. **Determinismo total:** "mesmo Pattern?" é função pura das duas Pattern Keys canônicas.

**Nenhuma entidade foi criada; `Decision`, `Pattern`, `Suggestion` e `Knowledge` permanecem
inalteradas.** Esta RFC apenas **nomeia a identidade** que a RFC-AIL-002 §3.3 deixou tentativa —
e a reconcilia com ARQ-003 §6.2.

### Critério de sucesso — atendido

> *"Dadas duas Decisions quaisquer, pertencem ao mesmo Pattern ou não?"*

Resposta determinística: **compare as duas `(empresa, contexto, campo, valorNovo)` canônicas.
Iguais → mesmo Pattern. Qualquer diferença → Patterns distintos.** A resposta depende **apenas** da
Pattern Key definida aqui — nada mais.

---

*Produzido em 21 de julho de 2026 · RFC de identidade lógica · sem código, banco, tabela, índice,
persistência, entidade nova ou alteração de Decision/Pattern/Suggestion/Knowledge.*
