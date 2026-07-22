# RFC-AIL-002 — Modelo Canônico de Aprendizagem

> **Natureza.** Modelo **conceitual definitivo** da Adaptive Intelligence Layer. Define a
> **linguagem única** que toda RFC futura da AIL usará. **Não implementa** — não projeta
> código, banco, API nem eventos. Determinístico, sem ML, sem IA generativa. Onde faltou
> evidência: **EVIDÊNCIA INSUFICIENTE**.
>
> **Fonte:** ARQ-003 (Adaptive Intelligence Architecture), RFC-AIL-001 (Decision Journal),
> Cap. 02 (Bounded Contexts), Epic 00 (Memória Comercial). `HEAD d2b0fe5`.

> ### Nota de série
> Esta RFC adota oficialmente a série **RFC-AIL-NNN** para as RFCs da Adaptive Intelligence
> Layer. O **Decision Journal**, produzido como "RFC-001-decision-journal" (colisão registrada
> com a RFC-001 de governança), passa a ser referido como **RFC-AIL-001**. A adoção da série
> resolve a colisão sem apagar o artefato original.

---

## 1. Objetivo

Responder, em modelo conceitual:

> **Como uma decisão observada evolui até se tornar conhecimento reutilizável?**

E fixar o **menor conjunto de entidades** capaz de representar todo o ciclo de aprendizado —
de forma que nenhuma RFC futura precise redefinir conceitos, e nenhum componente crie modelos
paralelos.

## 2. Visão geral

A AIL aprende **contando decisões que se repetem** e **oferecendo-as de volta** — nada além
disso. Este documento nomeia as peças desse mecanismo e as regras que as governam.

**Princípio da minimalidade:** as oito entidades-hipótese da missão (Decision, Outcome,
Pattern, Suggestion, Validation, Knowledge, Confidence, Memory) foram reduzidas ao **menor
conjunto suficiente**. Quatro sobrevivem como **entidades fundamentais**; quatro são
**demovidas** a conceitos derivados ou eliminadas — cada movimento justificado.

---

## 3. Entidades Canônicas

### 3.1 Resultado da análise de minimalidade

| Hipótese | Veredito | Justificativa |
|---|---|---|
| **Decision** | **ENTIDADE** | O átomo observado — a escolha do cliente (RFC-AIL-001) |
| **Pattern** | **ENTIDADE** | A recorrência detectada por contagem |
| **Suggestion** | **ENTIDADE** | A oferta derivada de um Pattern confiável |
| **Knowledge** | **ENTIDADE** | A unidade validada, reutilizável e esquecível |
| **Outcome** | **derivado** | É o *destino* de uma Suggestion — **computado** da Decision seguinte, não armazenado como raiz (§3.6) |
| **Confidence** | **objeto de valor** | É o *nível de maturidade* de um Pattern/Knowledge — atributo, não raiz (§7) |
| **Memory** | **escopo/ciclo** | É o *onde e por quanto tempo* o Knowledge vive — dimensão de retenção, não raiz (§9) |
| **Validation** | **ELIMINADA** | Redundante — "validar" é atingir o nível de Confidence *Validado* via Outcomes consistentes (§3.7) |

> **Quatro entidades fundamentais: Decision → Pattern → Suggestion → Knowledge.** Todo o resto
> é derivado, atributo ou processo. Este é o "menor conjunto".

### 3.2 Decision *(entidade — o átomo)*
A escolha do cliente que **corrige ou sobrescreve** uma proposta do sistema. Definida na
RFC-AIL-001. **Imutável.** É a única **entrada** do modelo.

### 3.3 Pattern *(entidade — a recorrência)*
Um conjunto de **Decisions consistentes** sobre a mesma chave `(Empresa, Contexto, Campo,
ValorNovo)`, detectado por **contagem determinística**. Carrega uma **Confidence** (§7).

### 3.4 Suggestion *(entidade — a oferta)*
Uma oferta derivada de um Pattern cuja Confidence é suficiente. É o que um Bounded Context
**consulta** (pull) antes de agir. Carrega sua **explicação** (§8).

### 3.5 Knowledge *(entidade — a unidade reutilizável)*
Um Pattern **promovido**: validado por Outcomes consistentes, reutilizável, **explicável** e
**esquecível pelo cliente**. É a diferença entre *"o cliente escolheu X cinco vezes"* (Pattern)
e *"esta empresa prefere X para Y"* (Knowledge — um fato curado, com exceções e controle do
cliente).

### 3.6 Outcome *(conceito derivado — o destino de uma Suggestion)*
O que **aconteceu** com uma Suggestion: **confirmada**, **contradita** ou **ignorada**. Não é
armazenado como entidade raiz — é **computado** da relação entre uma Suggestion e a **Decision
seguinte** sobre a mesma entidade/campo:
- Cliente mantém o valor sugerido → **confirmada** (a ausência de correção é confirmação).
- Cliente sobrescreve → **contradita** (essa sobrescrita **é** uma nova Decision).
- Cliente nem engaja → **ignorada**.

**Por que derivado, não raiz:** o feedback do aprendizado **já está** nas Decisions. Criar
Outcome como entidade duplicaria informação. O Outcome é a **leitura** dessa relação.

### 3.7 Por que Validation foi eliminada
"Validar um conhecimento" é o mesmo que sua Confidence **atingir o nível *Validado*** por
acúmulo de Outcomes confirmadores (§7). Uma entidade `Validation` separada seria um segundo
nome para um estado que a Confidence já expressa — proibido pelo invariante *"um significado
novo exige um termo novo"* (e seu corolário: um significado já nomeado não recebe segundo
nome). **Eliminada.**

---

## 4. Responsabilidades

| Entidade | Responsabilidade | Nasce quando | Deixa de existir | Cria | Altera | Consulta | Invariante |
|---|---|---|---|---|---|---|---|
| **Decision** | Registrar uma escolha do cliente | O cliente corrige/sobrescreve | Nunca (append-only; pode ser arquivada) | O Contexto (via Journal) | **Ninguém** (imutável) | AIL | Sempre tem Empresa, Autor, Campo, Anterior→Novo |
| **Pattern** | Consolidar Decisions recorrentes | N Decisions consistentes na mesma chave | Quando contradito o suficiente (reaprendizado) | A AIL (Pattern Detector) | A AIL (contagem/Confidence) | Suggestion | Pertence a **uma** empresa; nasce só de Decisions reais |
| **Suggestion** | Oferecer um Pattern confiável a um Contexto | Confidence do Pattern ≥ *Consistente* | Ao ser confirmada/contradita/ignorada (vira Outcome) | A AIL | **Ninguém** (é uma oferta pontual) | O Contexto (pull) | Sempre carrega sua explicação; nunca bloqueia |
| **Knowledge** | Ser o fato reutilizável e curado | Um Pattern atinge *Validado* | Ao ser **esquecido** pelo cliente ou expirar | A AIL | O cliente (esquecer, exceção); a AIL (Confidence) | Contextos | Sempre explicável, reversível e do tenant |

---

## 5. Ciclo de Vida do Conhecimento

```
   Decision            (observada — RFC-AIL-001)
      │  acumula (contagem determinística, mesma chave)
      ▼
   Pattern             Confidence: Observado → Recorrente → Consistente
      │  promove quando Confidence ≥ Consistente
      ▼
   Suggestion          (oferecida ao Contexto via pull)
      │  Outcome derivado da Decision seguinte:
      │    confirmada ─► Confidence sobe ──┐
      │    contradita ─► Confidence cai ───┤
      │    ignorada   ─► Confidence estável┘
      ▼
   Knowledge           Confidence: Confiável → Validado (→ Automatizável, se permitido)
      │  vive em
      ▼
   Memory              Estados: Ativo → Arquivado → Esquecido
      │
      └─► Reaprendizado: contradição sustentada aposenta o Knowledge,
                          reseta o Pattern, o ciclo recomeça do zero para aquela chave
```

### 5.1 Estados por entidade

| Entidade | Estados |
|---|---|
| **Decision** | *Registrada* → *Arquivada* (histórico; nunca apagada) |
| **Pattern** | *Emergente* → *Estabelecido* → *Aposentado* (por contradição) |
| **Suggestion** | *Oferecida* → *Confirmada* \| *Contradita* \| *Ignorada* |
| **Knowledge** | *Ativo* → *Arquivado* → *Esquecido* |

### 5.2 Quando uma entidade promove outra
- **Decisions → Pattern:** ao atingir repetição consistente na mesma chave.
- **Pattern → Suggestion:** quando a Confidence alcança *Consistente*.
- **Suggestion → (feedback):** o Outcome ajusta a Confidence do Pattern.
- **Pattern → Knowledge:** quando a Confidence alcança *Validado*.

### 5.3 Quando um padrão deixa de valer
Quando a **contradição se sustenta** — uma sequência de Outcomes *contraditos* mostra que a
empresa mudou de comportamento. O Pattern é **aposentado**; o Knowledge dele derivado é
**arquivado**; o **reaprendizado** recomeça.

---

## 6. Relacionamentos (cardinalidades)

| Relação | Cardinalidade | Significado |
|---|---|---|
| Decision → Pattern | **N : 1** | Muitas Decisions da mesma chave formam um Pattern |
| Pattern → Suggestion | **1 : N** | Um Pattern pode ser oferecido várias vezes (uma Suggestion por oferta) |
| Suggestion → Outcome | **1 : 1** | Cada oferta tem um destino |
| Outcome → Decision | **1 : 0..1** | Um Outcome se ancora na Decision seguinte (ou na ausência dela, se *ignorada*) |
| Pattern → Knowledge | **1 : 1** | Um Pattern validado **é** um Knowledge (promoção) |
| Knowledge → Confidence | **1 : 1** | Cada Knowledge carrega um nível de Confidence (VO) |
| Memory → Knowledge | **1 : N** | A Memory de uma empresa guarda muitos Knowledge |
| Empresa → tudo | **1 : N** | **Toda** entidade pertence a uma empresa — isolamento inviolável |

**Respostas diretas às perguntas do PASSO 4:**
- *Uma Decision gera vários Outcomes?* **Não** — uma Decision **ancora** o Outcome de **uma**
  Suggestion. Decision e Outcome são 1:0..1.
- *Um Pattern depende de quantas Decisions?* De **N consistentes** — o limiar é de projeto
  (RFC-AIL-003), não fixado aqui.
- *Uma Suggestion nasce de um único Pattern?* **Sim** — 1 Suggestion : 1 Pattern.
- *Knowledge depende de Validation?* **Não existe Validation** — Knowledge depende de a
  Confidence atingir *Validado*.
- *Memory guarda Pattern ou Decision?* **Guarda Knowledge.** Decisions vivem no Journal
  (histórico); Patterns são projeções; **Memory retém Knowledge**.

---

## 7. Modelo de Confiança

**Confidence é um Objeto de Valor** — o nível de maturidade de um Pattern/Knowledge. Não é
entidade; não tem identidade própria; **é um atributo que evolui**.

**Escala conceitual (sem números):**

| Nível | Significado | O que habilita |
|---|---|---|
| **Observado** | 1 Decision | Nada |
| **Recorrente** | repetição inicial | Candidato a Pattern |
| **Consistente** | repetição estável | **Suggestion** pode ser oferecida |
| **Confiável** | Outcomes confirmam | Promoção a **Knowledge** |
| **Validado** | confirmação sustentada | Knowledge maduro |
| **Automatizável** | Validado **+ permissão** | **Automação** (R-AIL-4) |

**Dinâmica:**
- **Sobe** com Outcomes *confirmados* e repetição consistente.
- **Cai** com Outcomes *contraditos*.
- **Expira** com **inatividade** — sem Decisions recentes na chave, a Confidence decai (o
  conhecimento envelhece).
- **Volta atrás** quando a contradição se sustenta — reaprendizado (§5.3).

**Invariante:** *Automatizável* **nunca** é alcançado só por confiança — exige **também**
permissão explícita do cliente. Dois gatilhos, sempre.

---

## 8. Modelo de Explicabilidade

**Toda Suggestion e todo Knowledge respondem a oito perguntas — e as respostas são DERIVADAS,
não geradas.** A explicação **é** a evidência acumulada; não há IA envolvida.

| Pergunta | Derivada de |
|---|---|
| Qual **Decision** originou este conhecimento? | A primeira Decision da chave |
| Quais **Outcomes** confirmaram? | Os Outcomes *confirmados* do Pattern |
| Qual **Pattern** foi identificado? | A chave `(Empresa, Contexto, Campo, ValorNovo)` |
| Qual **Confidence** possui? | O nível atual (§7) |
| Quando foi observado por último? | O timestamp da Decision mais recente |
| Existe **exceção** conhecida? | Os Outcomes *contraditos* registrados |
| Como **desfazer**? | Reverter a aplicação da Suggestion |
| Como **impedir** novas semelhantes? | **Esquecer** o Knowledge |

**Arquitetura da explicabilidade:** como toda resposta é uma **projeção** das Decisions e
Outcomes, a explicação é **sempre verdadeira e auditável**. Um Knowledge sem explicação
derivável **não pode existir** — é invariante.

---

## 9. Modelo de Memória

**Memory é o escopo e o ciclo de retenção do Knowledge**, não uma entidade com comportamento
próprio. Herda os tipos da ARQ-003 §9.

| Dimensão | Contém | Isolamento |
|---|---|---|
| **Temporária** | Observação em curso (uma sessão) | Por sessão |
| **Persistente** | O Journal de Decisions | Por empresa |
| **Da Empresa** | Patterns e **Knowledge** de uma empresa | **NUNCA** cruza o tenant |
| **Global** | Só agregado anônimo | Condicionada a ADR (ARQ-003 §9.1) |

**Ciclo de retenção do Knowledge:**
- **O que permanece só como histórico:** Decisions (no Journal — nunca viram Knowledge por si).
- **O que vira conhecimento:** Patterns validados → Knowledge.
- **O que pode ser descartado:** Patterns *emergentes* que nunca se consolidaram.
- **O que nunca se perde:** o **histórico de Decisions** (auditoria) — mesmo após esquecimento.
- **Arquivamento:** um Knowledge que expira (inatividade) vai a *Arquivado* — consultável, não
  sugerido.
- **Esquecimento:** o cliente marca um Knowledge como *Esquecido* — deixa de sugerir; **o
  histórico permanece** ("esquecer não é apagar").
- **Reaprendizado:** contradição sustentada aposenta o Knowledge e recomeça o ciclo.

---

## 10. Linguagem Ubíqua

**Vocabulário oficial. Obrigatório em todas as RFCs futuras da AIL.**

| Termo | Definição | Responsabilidade | Diferença do vizinho |
|---|---|---|---|
| **Observation** | O ato da AIL *notar* um fato | Entrada bruta | É o gênero; **Decision** e **Outcome** são espécies |
| **Decision** | Escolha do cliente que corrige/sobrescreve o sistema | Átomo de entrada | ≠ Observation: é uma *escolha*, não qualquer fato |
| **Outcome** | O destino de uma Suggestion (confirmada/contradita/ignorada) | Feedback | ≠ Decision: é a *leitura* do que aconteceu com uma oferta; deriva de uma Decision |
| **Pattern** | Recorrência de Decisions na mesma chave | Consolidação | ≠ Knowledge: é *estatístico* (contagem), ainda não curado |
| **Confidence** | Nível de maturidade de um Pattern/Knowledge | Medida de maturidade | Não é entidade — é atributo |
| **Suggestion** | Oferta derivada de um Pattern confiável | Saída ao Contexto | ≠ Knowledge: é *pontual e efêmera*; o Knowledge é permanente |
| **Knowledge** | Fato reutilizável, validado, curado, esquecível | Ativo de aprendizado | ≠ Pattern: tem *semântica*, exceções e controle do cliente |
| **Memory** | Escopo e ciclo de retenção do Knowledge | Retenção e isolamento | Não é entidade — é dimensão |
| **Learning** | O **processo** do ciclo Decision→Knowledge | Nome do fluxo | Não é entidade — é o processo |
| **Validation** | *(termo aposentado)* | — | Substituído pela Confidence *Validado* |

---

## 11. Integração com os Bounded Contexts

**Os Contextos apenas produzem ou consomem conhecimento. Nunca conhecem o interior da AIL.**
(ARQ-003 §10 — push de Decisions, pull de Suggestions.)

| Contexto (Cap. 02) | Produz (Decision) | Consome (Suggestion/Knowledge) |
|---|---|---|
| **Catálogo** | correção de categoria, atributos, medida | categoria/medida aprendida |
| **Esteira (Core)** | **nada — intocada** | preferência como *contexto de entrada*, sem mudar o veredito A10 |
| **Publication** | tipo de anúncio escolhido | tipo de anúncio preferido |
| **Portal** | — | exibe Knowledge (o painel de "o que o Zion aprendeu de você") |
| **Asset Intelligence (futuro)** | **EVIDÊNCIA INSUFICIENTE** — contexto ainda inexistente | — |

**Invariante de fronteira:** um Contexto conhece apenas dois verbos — *"registrar uma
Decision"* e *"consultar uma Suggestion"*. Não conhece Pattern, Confidence, Outcome nem
Memory. **A linguagem interna da AIL não vaza para os Contextos.**

---

## 12. Roadmap evolutivo

| RFC | Entrega | Entidades que introduz | Estado |
|---|---|---|---|
| **RFC-AIL-001** | Decision Journal | **Decision** | Projetada |
| **RFC-AIL-002** | **Este modelo canônico** | Pattern, Suggestion, Knowledge (conceituais) | **Esta RFC** |
| **RFC-AIL-003** | Pattern Detector | Materializa **Pattern** + Confidence | Futura |
| **RFC-AIL-004** | Suggestion Engine | Materializa **Suggestion** + Outcome + explicabilidade | Futura |
| **RFC-AIL-005** | Adaptive Copilot | Materializa **Knowledge** ativo + automação opt-in | Futura |

**A ordem confirma-se pela dependência conceitual:** não se detecta Pattern sem Decisions
(001); não se sugere sem Pattern (003); não há copiloto sem Suggestions validadas (004). A
sequência da missão está correta.

---

## 13. Riscos

| # | Risco | Mitigação (conceitual) |
|---|---|---|
| **R1** | Uma RFC futura inventar entidade nova | §14 — proibido sem ADR que justifique a insuficiência do modelo |
| **R2** | Confidence virar entidade e criar modelo paralelo | §7 — Confidence é VO, por definição |
| **R3** | Outcome ser armazenado e duplicar Decisions | §3.6 — Outcome é derivado |
| **R4** | Vazamento entre empresas | §6/§9 — toda entidade é do tenant |
| **R5** | Conhecimento obsoleto persistir | §7 expiração + §9 reaprendizado |
| **R6** | Contexto acoplar-se ao interior da AIL | §11 — dois verbos apenas |
| **R7** | Introduzir ML disfarçado | Todo o modelo é contagem determinística; nenhuma entidade infere |

---

## 14. Conclusões

O ciclo de aprendizado do Zion cabe em **quatro entidades**: uma **Decision** observada
acumula em um **Pattern**, que — ao amadurecer em Confidence — vira uma **Suggestion**, cujo
Outcome a promove a **Knowledge** reutilizável, retido na **Memory** da empresa até ser
esquecido ou reaprendido.

**A disciplina de minimalidade é o valor central:** ao eliminar *Validation* e demover
*Outcome*, *Confidence* e *Memory* a conceitos derivados, o modelo evita a proliferação de
entidades que criaria ambiguidade nas RFCs futuras. Quatro nomes fundamentais, uma escala de
confiança, um ciclo de retenção — suficientes para todo o aprendizado, sem redefinição.

**A explicabilidade é estrutural, não adicionada:** como toda resposta é uma projeção das
Decisions e Outcomes, um Knowledge sem explicação **não pode existir**. E como toda entidade
pertence a uma empresa, o isolamento é invariante, não configuração.

> ### Regra de governança (obrigatória a partir desta RFC)
> **Nenhuma RFC futura da Adaptive Intelligence Layer poderá introduzir uma entidade
> fundamental nova sem um ADR aprovado que demonstre, por evidência, por que Decision,
> Pattern, Suggestion e Knowledge — com Confidence, Outcome e Memory como conceitos derivados —
> foram insuficientes.** Este modelo é a linguagem única. Modelos paralelos são proibidos.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · modelo conceitual · sem código, banco,
API, eventos, ML ou alteração de comportamento.*
