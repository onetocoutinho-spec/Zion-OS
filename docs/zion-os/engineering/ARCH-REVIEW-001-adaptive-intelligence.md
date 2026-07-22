# ARCH-REVIEW-001 — Architecture Review da Adaptive Intelligence Layer

> **Natureza.** Revisão arquitetural **baseada em evidência**. Não implementa código, não
> cria design novo, não propõe funcionalidade, não revisa estilo. Avalia **exclusivamente**
> a aderência da implementação (R-DJ-1 + R-DJ-2) aos invariantes definidos por ARQ-003,
> RFC-AIL-001 e RFC-AIL-002. Toda não conformidade cita `arquivo:linha` ou `documento §`.
>
> **Objeto:** branch `feat/r-dj-2-primeiro-producer`, `HEAD 44452cf`
> (R-DJ-2 sobre `93b88b3` R-DJ-1). **Baseline:** 249 → 254 testes, todos verdes.
>
> **Pergunta única:** *A primeira implementação da AIL preserva integralmente a arquitetura
> definida para o Zion OS?*

---

## 1. Escopo

### 1.1 Artefatos revisados (código)

| Arquivo | Papel |
|---|---|
| `src/modules/adaptive-intelligence/domain/decision.ts` | Modelo canônico `Decision` |
| `src/modules/adaptive-intelligence/ports/decision-journal.port.ts` | Port `DecisionJournal` |
| `src/modules/adaptive-intelligence/infrastructure/decision-journal.noop.ts` | Implementação ativa (NoOp) |
| `src/modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts` | Adaptador em memória (teste) |
| `src/modules/adaptive-intelligence/decision-journal.ts` | Factory / API pública |
| `src/lib/services/pendencias.ts` | **Producer** (R-DJ-2) |
| `src/lib/services/pendencias.test.ts` | Testes do Producer |

### 1.2 Invariantes de referência (contrato a validar)

- **ARQ-003:** §2 (observa e oferece, nunca controla; reversibilidade); §3.1 (push fire-and-forget
  desacoplado); §11 (12 princípios arquiteturais).
- **RFC-AIL-001:** §4.2 (critério de entrada); §5 (modelo canônico e a chave de padrão);
  §6.2 (invariante do observador lateral); §10 (roadmap de releases); §12 (reversibilidade).
- **RFC-AIL-002:** §3 (quatro entidades fundamentais); §3.3 (chave `(Empresa, Contexto, Campo,
  ValorNovo)`); §4 (invariante da Decision); §11 (fronteira / linguagem ubíqua); §14 (proibição
  de entidade paralela).

### 1.3 Fora de escopo (por instrução da missão)

Estilo de código, performance, proposta de funcionalidade, alteração de arquitetura,
implementação de correção. Onde há divergência, ela é **registrada**, não corrigida.

---

## 2. Conformidade Arquitetural

### PASSO 1 — Aderência ao ARQ-003

**A implementação respeita a AIL?** Sim, nos invariantes centrais.

| Invariante (ARQ-003) | Evidência | Veredito |
|---|---|---|
| §2 / princípio 6 — *observa e oferece, nunca controla* | `pendencias.ts:66-82`: `observarResolucao` é `void`, chamada após a persistência; o retorno de `resolverPendencia` (`resultado`) independe dela (`pendencias.ts:43-45`) | ✓ |
| §3.1 — push *fire-and-forget* desacoplado | `pendencias.ts:68-81` envolto em `try/catch` que engole qualquer erro; o Producer não espera resposta | ✓ |
| princípio 7 — *reversibilidade arquitetural* | Ver §4 deste parecer | ✓ |
| princípio 8 — *isolamento por empresa* | A Decision carrega `empresa: pendencia.clienteId` (`pendencias.ts:70`); o NoOp nada persiste (`noop.ts:14-16`) — nenhum cruzamento de tenant é possível | ✓ |
| princípio 10 — *Core Domain intocável* | `git diff` não toca Esteira/A10/regras-mãe; `pendencias.ts` não é Core Domain | ✓ |
| princípio 12 — *toda inteligência vive na AIL* | Único ponto de observação é o módulo `adaptive-intelligence`; nenhuma memória oculta criada no Producer | ✓ |

**Existe violação?** Nenhuma violação de invariante.
**Existe acoplamento indevido?** Não no sentido arquitetural: o Producer importa **apenas a API
pública** `decision-journal.ts` (`pendencias.ts:5-8`), nunca `domain/`, `ports/` ou
`infrastructure/` — ponto único de acesso, coerente com ADR-009 ("mover atrás de porta"). Há
**um acoplamento de superfície menor**, registrado em §6 (R-1).

### PASSO 2 — Aderência à RFC-AIL-001

**O Journal continua apenas um observador?** Sim. `NoOpDecisionJournal.registrarDecisao`
(`noop.ts:14-16`) é intencionalmente vazio: recebe e descarta.
**Responsabilidade extra?** Nenhuma — o Port expõe um único verbo `registrarDecisao(decisao):
void` (`decision-journal.port.ts:19`).
**Alguma decisão tomada dentro do Journal?** Não — o NoOp não ramifica, não computa, não decide.
Satisfaz o invariante do observador lateral (§6.2).

**Ressalvas de aderência (não violam invariante — ver §7):**
- **Ponto vs. roadmap:** a RFC-AIL-001 §10 designa **R-DJ-2 = "correção de categoria"** e lista
  **"pendência resolvida" sob R-DJ-4**. A implementação conectou *pendência* como R-DJ-2. Foi
  **autorizado pelo brief da missão R-DJ-2** (que ofereceu explicitamente os quatro pontos), mas
  é uma **divergência de roadmap** registrada (⚠ A-3).
- **Critério de entrada §4.2:** "escolha do cliente que **corrige ou sobrescreve uma proposta do
  sistema**". Resolver pendência é *"fornecer o dado que faltava"* (§4.1); o valor substantivo é
  gravado **em outra tela** (a edição do campo), não no toggle `resolvida`. O delta capturado
  (`campo:"resolvida"`, `false→true`) é o **flag de status**, não o valor aprendível que §4.1
  aponta (⚠ A-2).

### PASSO 3 — Aderência à RFC-AIL-002

**A implementação usa o modelo Decision → Pattern → Suggestion → Knowledge?** Corretamente e de
forma **mínima**: apenas a entidade **Decision** é materializada (`decision.ts:14-39`).
Pattern, Suggestion e Knowledge **não existem em código** — o esperado para R-DJ-1/2 (§12:
Pattern só em RFC-AIL-003).
**Foi introduzida entidade paralela?** Não.
**Conceito concorrente?** Não. Nenhuma violação da regra de governança §14 (proibição de modelo
paralelo).

**Ressalvas de aderência ao modelo canônico (⚠ — ver §7):**
- **Chave de padrão degenerada.** A chave canônica é `(Empresa, Contexto, Campo, ValorNovo)`
  (§3.3). Na instrumentação: `Contexto="pendencia"`, `Campo="resolvida"`, `ValorNovo="true"`
  (`pendencias.ts:72,74,76`) — **constantes**. A chave colapsa em `(empresa, "pendencia",
  "resolvida", "true")` para toda resolução: não há delta aprendível (⚠ A-2).
- **`Contexto` não é um Bounded Context.** §3.3/§11 e ARQ-003 §4 definem `Contexto` como o
  Bounded Context de Cap. 02 (Catálogo, Esteira, Precificação, Conexão, Publicação, Vendas,
  Identidade). `"pendencia"` (`pendencias.ts:72`) **não é** um dos sete. O tipo permite (o campo é
  `string`, `decision.ts:22`), mas o valor diverge da definição conceitual (⚠ A-1).
- **`Autor` vazio.** §4 exige que a Decision "sempre tem Empresa, **Autor**, Campo, Anterior→Novo".
  `autor: ""` (`pendencias.ts:71`) satisfaz **estruturalmente**, não **semanticamente**. É lacuna
  real de dado: a `Pendencia` não possui campo de autor (`types.ts:408-418`) (⚠ A-4).

---

## 3. Dependências (PASSO 4)

### 3.1 Grafo (quem depende de quem)

```
   pendencias.ts  (Producer — camada de serviço)
        │  importa SÓ a API pública
        ▼
   decision-journal.ts  (Factory = composition root)
        │  (type)                 │  (concreto)
        ▼                         ▼
   ports/                    infrastructure/
   decision-journal.port     decision-journal.noop
        │                         │
        │  (type)                 │  (type)
        └────────────┬────────────┘
                     ▼
             domain/decision.ts   ← importa NADA (sumidouro)
```

Arestas verificadas (por `import`):
- `ports/decision-journal.port.ts:10` → `domain/decision.ts`
- `infrastructure/decision-journal.noop.ts:9-10` → `ports/…` + `domain/…`
- `infrastructure/decision-journal.memory.ts:6-7` → `ports/…` + `domain/…`
- `decision-journal.ts:10-11` → `ports/…` (tipo) + `infrastructure/noop` (concreto)
- `pendencias.ts:5-8` → `decision-journal.ts` (API pública) **apenas**
- `domain/decision.ts` → **nenhum import**

### 3.2 Verificações exigidas

| Verificação | Resultado | Evidência |
|---|---|---|
| **Dependência circular** | **Ausente** — o grafo é um DAG estrito; `domain` é sumidouro, `pendencias` é fonte | grafo §3.1 |
| **Inversão de dependência** | **Correta** — `infrastructure` depende da abstração `DecisionJournal` (`noop.ts:9`), não o contrário; a Factory é o único ponto que liga port→concreto | `noop.ts:9`, `decision-journal.ts:10-11` |
| **Infraestrutura → domínio** | **Presente e correto** — `noop.ts:10` e `memory.ts:7` importam `Decision` do domínio (direção permitida) | `noop.ts:10` |
| **Domínio → infraestrutura** | **Ausente** — `domain/decision.ts` não importa nada; o domínio não conhece infraestrutura (invariante crítico preservado) | `domain/decision.ts` (0 imports) |

**Conclusão do PASSO 4:** ✓ Conforme. Direções corretas, sem ciclo, DDD respeitado (domínio no
núcleo, infraestrutura na borda, port como fronteira).

---

## 4. Reversibilidade (PASSO 5)

Cenário: **remover completamente a AIL**.

| Pergunta | Resposta | Evidência |
|---|---|---|
| **O sistema continua compilando?** | Sim. Reverter `resolverPendencia` ao corpo de uma linha, remover o `import` (`pendencias.ts:5-8`), o parâmetro `journal` (`pendencias.ts:40`), o helper (`pendencias.ts:47-82`) e o teste — nenhum outro arquivo referencia a AIL (`grep`: só `pendencias.ts`/`pendencias.test.ts` a importam) | consumidores da AIL = 2 arquivos |
| **O comportamento continua igual?** | Sim. O único chamador de produção passa só o `id` (`pendencias/page.tsx:89`); o NoOp nada faz; o retorno de `resolverPendencia` é `resultado` independentemente da observação | `pendencias.ts:43-45` |
| **Existe resíduo?** | **Um resíduo menor, registrado:** a assinatura pública de `resolverPendencia` ganhou o parâmetro opcional `journal: DecisionJournal` (`pendencias.ts:39-41`), que referencia um tipo da AIL. Remover a AIL exige **também** remover esse parâmetro — não basta apagar a chamada. Está documentado como parte do rollback no próprio arquivo (`pendencias.ts:62-63`) | ⚠ R-1 |

**Reversibilidade em três níveis (RFC-AIL-001 §12):** por ponto (remover a chamada) · por release
(`git revert 44452cf`) · total (remover o módulo). Todos disponíveis. O commit é **+123 / −2 em 2
arquivos**; o módulo `adaptive-intelligence` permanece **intacto** (R-DJ-2 só o consome).

**Veredito:** ✓ Conforme, com o resíduo R-1 registrado (não bloqueante — o rollback documentado
já o cobre).

---

## 5. Extensibilidade (PASSO 6)

A arquitetura suporta as próximas fases **sem refatorar o código existente**?

| Fase futura | Suportada sem refatoração? | Evidência / seam |
|---|---|---|
| **Persistência (R-DJ-1b)** | **Sim** — trocar o NoOp por um adaptador Supabase que implemente o mesmo Port é uma alteração **de um único ponto**: `resolverDecisionJournal()` (`decision-journal.ts:14-16`). Nenhum Producer muda | Factory como composition root |
| **Pattern Detector (RFC-AIL-003)** | **Aditivo** — requer um **novo port de leitura** (o Port atual é só escrita: `registrarDecisao`, `port.ts:19`) sobre um Journal persistido. Adicionar um port de leitura **não refatora** a escrita nem o Producer | Port de leitura ainda inexistente — adição, não refatoração |
| **Suggestion Engine (RFC-AIL-004)** | **Aditivo** — o *pull* é uma segunda direção desacoplada (ARQ-003 §3.1b); novo port de consulta, sem tocar o *push* atual | direção pull ainda inexistente |
| **Knowledge Repository (RFC-AIL-005)** | **Aditivo** — projeção sobre o Journal; nova infraestrutura, domínio existente intacto | — |

**Ressalva factual (não é defeito):** o Port hoje é **write-only** (`registrarDecisao`). Pattern
Detector e Suggestion Engine exigirão **novos ports** (leitura, pull) e a **persistência real** —
capacidades **ainda inexistentes**. Elas são **aditivas** (não refatoram o que existe), mas
"suportar naturalmente" significa *"o desenho não impede e não obriga reescrita"*, não *"já estão
prontas"*. Com essa leitura: ✓ Conforme.

---

## 6. Riscos (PASSO 7 — somente comprovados)

| # | Risco | Natureza | Evidência | Severidade |
|---|---|---|---|---|
| **R-1** | **Acoplamento de superfície** — a assinatura pública de `resolverPendencia` expõe o tipo `DecisionJournal` da AIL via parâmetro opcional | Acoplamento oculto / resíduo de reversão | `pendencias.ts:39-41`, `pendencias.ts:8` | Baixa — documentado no rollback (`pendencias.ts:62-63`) |
| **R-2** | **Dívida de delta inerte** — `campo/valorAnterior/valorNovo/autor` constantes ou vazios não produzem chave de padrão aprendível | Dívida técnica | `pendencias.ts:71-76` | Média — inócua sob NoOp; **precisa reconciliar antes de RFC-AIL-003** |
| **R-3** | **`Contexto` sem guarda** — o campo é `string` livre (`decision.ts:22`), permitindo valores fora dos sete Bounded Contexts; já ocorreu (`"pendencia"`) | Risco de evolução | `decision.ts:22`, `pendencias.ts:72` | Baixa — sem enum/validação, futuros Producers podem divergir |

**Não há** fragilidade de execução comprovada: o *default* `= resolverDecisionJournal()`
(`pendencias.ts:40`) cria um NoOp por chamada — custo desprezível, sem estado, não frágil. Nenhum
outro risco é afirmado sem evidência.

---

## 7. Não Conformidades

Nenhuma **✗ Não Conforme** (nenhum invariante arquitetural violado). Quatro **⚠ Atenção**, todas
**semânticas ou de roadmap**, todas **inócuas sob o NoOp atual**, todas com evidência:

| ID | Achado | Evidência | Documento violado (em grau) |
|---|---|---|---|
| **A-1** | `contexto:"pendencia"` não é um Bounded Context de Cap. 02 | `pendencias.ts:72` | RFC-AIL-002 §3.3/§11; ARQ-003 §4 (definição de `Contexto`) |
| **A-2** | Delta registrado é o flag de status (`resolvida:false→true`), não o valor aprendível que §4.1 identifica; chave de padrão degenera em constante | `pendencias.ts:74-76` | RFC-AIL-001 §4.1/§4.2/§5; RFC-AIL-002 §3.3 |
| **A-3** | *Pendência* conectada como R-DJ-2; o roadmap a designa para R-DJ-4 (R-DJ-2 = categoria) — **autorizado pela missão**, registrado | RFC-AIL-001 §10 vs. `pendencias.ts` | RFC-AIL-001 §10 (roadmap) |
| **A-4** | `autor:""` — invariante "Decision sempre tem Autor" satisfeito estruturalmente, não semanticamente (lacuna real de dado) | `pendencias.ts:71`; `types.ts:408-418` | RFC-AIL-002 §4 |

**Por que nenhuma é ✗:** os 12 princípios de ARQ-003 §11, o invariante do observador lateral
(RFC-AIL-001 §6.2), o isolamento por tenant, a reversibilidade e a proibição de entidade paralela
(RFC-AIL-002 §14) estão **todos preservados**. A-1…A-4 dizem respeito ao **conteúdo semântico** da
`Decision` neste ponto — que, sob um Journal NoOp que descarta tudo, **não é consumido por nada**.
São correções de **grau**, exigíveis **antes** que um Producer desta forma alimente o Pattern
Detector (RFC-AIL-003), não antes do merge.

---

## 8. Recomendações

*(Registro de reconciliação — não são funcionalidades novas nem alteração de arquitetura; são
condições de conformidade para as fases seguintes.)*

1. **Registrar A-1…A-4 no acervo** como pendências de reconciliação vinculadas a **RFC-AIL-003**
   (Pattern Detector) — o ponto onde a chave `(Empresa, Contexto, Campo, ValorNovo)` passa a ser
   consumida. Antes disso, são inócuas.
2. **A-2 / valor de aprendizado:** a decisão de arquitetura pendente é *o que* uma "resolução de
   pendência" deve registrar como delta aprendível (o valor preenchido, §4.1) vs. o marco de
   status atual. Deliberação de modelo, não de código — candidata a nota em RFC-AIL-003.
3. **A-1 / A-3 (R-3):** ao materializar o Pattern Detector, decidir se `Contexto` passa a ser um
   enum de Bounded Contexts (guarda) e a qual BC de Cap. 02 a pendência pertence.
4. **R-1:** manter o parâmetro `journal` documentado como seam de teste; se a reversibilidade
   "por deleção pura" for requisito, considerar (em release futura) obter o Journal sem alargar a
   assinatura pública. Não bloqueante.

Nenhuma recomendação exige alteração antes do merge.

---

## 9. Parecer Final

### 9.1 Classificação por item (PASSO 8)

| Item revisado | Classificação | Justificativa (evidência) |
|---|---|---|
| **ARQ-003 — observa/oferece, nunca controla** | ✓ Conforme | `pendencias.ts:66-82` fire-and-forget; retorno independe da observação |
| **ARQ-003 — reversibilidade (princ. 7)** | ✓ Conforme | §4; módulo intacto; +123/−2; NoOp |
| **ARQ-003 — Core Domain intocável (princ. 10)** | ✓ Conforme | Esteira/A10 não tocados |
| **ARQ-003 — isolamento por tenant (princ. 8)** | ✓ Conforme | `empresa=clienteId` (`pendencias.ts:70`); NoOp nada persiste |
| **RFC-AIL-001 — observador lateral (§6.2)** | ✓ Conforme | `noop.ts:14-16` vazio; nenhuma decisão no Journal |
| **RFC-AIL-001 — critério de entrada (§4.2)** | ⚠ Atenção | A-2: delta é flag de status, não o valor aprendível |
| **RFC-AIL-001 — roadmap (§10)** | ⚠ Atenção | A-3: pendência era R-DJ-4 (autorizado pela missão) |
| **RFC-AIL-002 — quatro entidades / sem paralelo (§14)** | ✓ Conforme | só `Decision` materializada; nenhuma entidade concorrente |
| **RFC-AIL-002 — chave de padrão (§3.3)** | ⚠ Atenção | A-1/A-2: `Contexto` não-BC; chave degenerada |
| **RFC-AIL-002 — invariante da Decision (§4)** | ⚠ Atenção | A-4: `autor` vazio |
| **Dependências (PASSO 4)** | ✓ Conforme | DAG; inversão correta; domínio não → infra |
| **Reversibilidade (PASSO 5)** | ✓ Conforme | resíduo R-1 registrado e documentado |
| **Extensibilidade (PASSO 6)** | ✓ Conforme | Factory como seam; próximas fases aditivas |

### 9.2 Resposta à pergunta única

> **A primeira implementação da AIL preserva integralmente a arquitetura definida para o Zion OS?**

**Sim quanto aos invariantes arquiteturais.** Todos os invariantes duros — não-controle,
observador lateral fire-and-forget, isolamento por tenant, Core Domain intocável, reversibilidade,
direções de dependência (DDD), ausência de entidade paralela — estão **preservados, com
evidência**. A arquitetura da AIL foi **validada ponta a ponta** em um fluxo real
(Producer → Port → Factory → NoOp), que era o objetivo de R-DJ-2.

**Com quatro ⚠ Atenção de natureza semântica/roadmap** (A-1…A-4): a `Decision` produzida neste
ponto carrega um `Contexto` que não é Bounded Context, um delta de status em vez do valor
aprendível, e `autor` vazio; e o ponto foi antecipado do R-DJ-4 para o R-DJ-2. Nenhuma viola um
invariante; **todas são inócuas enquanto o Journal for NoOp** (nada é gravado nem contado) e
**exigíveis apenas antes de RFC-AIL-003** (Pattern Detector), quando a chave de padrão passa a ser
consumida.

### 9.3 Decisão de merge

> **A PR pode seguir para merge.** ✅

Condição: **registrar A-1…A-4** como pendências de reconciliação vinculadas a RFC-AIL-003 (§8).
São **não bloqueantes** — não há alteração de comportamento (254 testes verdes; NoOp), não há
violação de invariante, e a reversibilidade total permanece garantida. O merge incorpora um passo
de **validação de arquitetura**, não de aprendizado: nenhuma inteligência é produzida ainda, por
projeto.

---

*Produzido em 21 de julho de 2026 · objeto `HEAD 44452cf` (branch `feat/r-dj-2-primeiro-producer`)
· revisão arquitetural · sem alteração de código, comportamento ou Core Domain.*
