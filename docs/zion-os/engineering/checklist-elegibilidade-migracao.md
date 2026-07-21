# Checklist de Elegibilidade de Migração Arquitetural

> **Natureza.** Instrumento **operacional**. Consolida, em um único artefato, critérios já
> institucionalizados em outros documentos. **Não cria regra, critério, fase ou decisão.**
>
> **Fontes exclusivas.** Mapeamento Arquitetural · Protocolo de Migração Arquitetural ·
> Plano Executivo da Refatoração · Padrão de Release Engineering · Governança Arquitetural.
>
> **Subordinação.** Não substitui nenhum dos documentos acima. Em caso de divergência
> entre este checklist e sua fonte, **prevalece a fonte**. Em caso de conflito entre
> fontes, prevalece o Padrão de Release Engineering, conforme o próprio Protocolo declara.

---

## 1. Objetivo

Responder **uma única pergunta**, de forma objetiva, rastreável e auditável:

> **A responsabilidade está elegível para iniciar uma migração arquitetural?**

Hoje essa resposta exige consultar cinco artefatos distintos. O engenheiro precisa
localizar a responsabilidade no Mapeamento, confrontar a redação dos bloqueios de
governança, verificar a existência de linha de base no Plano Executivo, ler os critérios
de interrupção do Protocolo e conferir os gates do Padrão de Release Engineering. Isso
funciona — mas distribui a decisão.

Este documento **operacionaliza** essa consulta. Ele reúne as verificações onde elas já
existem e as apresenta na ordem em que precisam ser feitas. Toda linha abaixo aponta
explicitamente para o documento e o trecho que a originou.

**O que este documento não é.** Não é fonte de autoridade. Não altera governança,
arquitetura, protocolo, Plano Executivo, Mapeamento, releases, prioridades, bloqueios,
estados ou responsabilidades. Não cria exceções. Se um critério aqui parecer novo, ele
está errado e deve ser removido — não incorporado às fontes.

---

## 2. Quando utilizar

A execução deste checklist é **obrigatória** e ocorre **antes** de:

- a **abertura** de uma Release de migração arquitetural;
- a **criação da branch** correspondente;
- a **definição do escopo** da release.

**Posição no fluxo.** Corresponde à **Fase 1 do Protocolo de Migração Arquitetural**, que
antecede o estabelecimento da linha de base (Fase 2) e todo o fluxo de release (Fase 6).
O Protocolo é explícito: *"As Fases 1 a 5 acontecem antes do fluxo de release."*

Nada é movido, nenhum arquivo é tocado e nenhuma branch existe enquanto este documento
não estiver preenchido e assinado.

**Aplica-se a:** toda migração de responsabilidade da implementação legada para a
arquitetura modular do Zion OS — o alcance declarado do Protocolo.

---

## 3. Identificação

| Campo | Valor |
|---|---|
| **Responsabilidade** | *(ID e nome, conforme o Mapeamento — ex.: R11 — Determinação de exigência do modelo do canal)* |
| **Arquivo de origem** | *(caminho e faixa de linhas, conforme o Mapeamento)* |
| **Destino arquitetural** | *(módulo e papel, conforme a Matriz de Migração)* |
| **Release prevista** | *(número, conforme o Quadro Executivo do Plano Executivo)* |
| **Engenheiro responsável** | |
| **Data** | |

---

## 4. Verificação de elegibilidade

**Regra de preenchimento.** Cada linha exige **evidência**, não afirmação. O Protocolo
estabelece que *"toda conclusão deve ser sustentada por evidência verificável"* e que
*"evidência ambígua não é evidência"*. Uma linha sem evidência conta como **não
verificada**; por analogia direta ao Padrão de Release Engineering — *"um gate não
verificado conta como não aprovado"* — uma verificação não realizada **reprova**.

**Resultado admitido por linha:** `SIM` · `NÃO` · `N/A` *(com justificativa obrigatória)*.

| # | Critério | Origem da regra | Resultado | Evidência | Observações |
|---|---|---|---|---|---|
| **C1** | Responsabilidade identificada no Mapeamento | Protocolo, Fase 1 — *"Localizar a responsabilidade no Mapeamento (arquivo, funções, módulo destino)"*; Checklist operacional, item 1 | | *(seção do Mapeamento; ID; linhas)* | |
| **C2** | Destino arquitetural definido | Mapeamento, §7 Matriz de Migração — coluna *Módulo destino* | | *(célula da matriz)* | Grupo D existe precisamente por falhar aqui |
| **C3** | Módulo de destino existente em `src/modules/` | Plano Executivo, *Fontes de classificação* — *"Módulos existentes: `catalog`, `publication`, `integration`, `operation-center`. **Não existem** `identity-access` nem `ai-services`"* | | *(listagem do diretório)* | R16 é bloqueada por este critério |
| **C4** | Responsabilidade prevista no Plano Executivo | Plano Executivo — Backlog por responsabilidade e Quadro Executivo | | *(entrada do backlog)* | |
| **C5** | Estado permite migração | Plano Executivo, Quadro Executivo — coluna *Estado* | | *(estado registrado)* | `Bloqueada` reprova; `Concluída` torna a migração inaplicável |
| **C6** | Nenhum bloqueio de governança alcança a responsabilidade | Protocolo, Fase 1 — *"Confrontar com bloqueios de governança vigentes, **lendo sua redação exata** e verificando se ela alcança esta responsabilidade"*; Critério de interrupção nº 1 | | *(citação literal do bloqueio + por que alcança ou não)* | **Leitura, nunca interpretação** |
| **C7** | Dependências identificadas | Mapeamento, §7 — coluna *Dependências*; Plano Executivo — campo *Dependências* | | *(lista + estado de cada dependência)* | Dependência não migrada reprova |
| **C8** | Consumidores identificados **por busca no código** | Protocolo, Fase 1 — *"Identificar todos os consumidores, por busca no código — **nunca de memória**"*; Evidência obrigatória nº 2 | | *(comando de busca e sua saída)* | Memória ou documentação não satisfazem |
| **C9** | Estratégia de migração definida | Mapeamento, §7 — coluna *Estratégia*; Plano Executivo — campo *Estratégia* | | *(estratégia registrada)* | |
| **C10** | Linha de base mensurável existente | Protocolo, Fase 1 — *"Verificar se existe linha de base disponível"*; Critério de aprovação; Plano Executivo — tabela *Linha de base disponível* | | *(arquivo de teste e nº de testes, ou outra evidência comportamental mensurável)* | **Ausência interrompe a migração** |
| **C11** | Testes da responsabilidade e dos consumidores **verdes** | Protocolo, **Fase 2** — Critério de interrupção: *"Algum teste já falha antes da migração — a linha de base está corrompida"*; Padrão de Release Engineering, **G2** | | *(total / passou / falhou)* | ⚠ *Verificação antecipada — ver Nota de Atribuição* |
| **C12** | Build íntegro **antes** da migração | Protocolo, **Fase 2** — *"Executar o build"*; Checklist operacional, item 8; Padrão de Release Engineering, **G1** | | *(saída do build e código de saída)* | ⚠ *Verificação antecipada — ver Nota de Atribuição* |
| **C13** | Critérios mínimos de evidência disponíveis | Plano Executivo — campo *Evidências mínimas* de cada responsabilidade; Protocolo, princípio 3 — *"a quantidade de evidências é proporcional ao risco"* e Nota sobre proporcionalidade | | *(enumeração das evidências e confirmação de que são obteníveis)* | Quando o Plano registra *"a definir na Fase 1"*, definir **aqui** |
| **C14** | Riscos conhecidos | Mapeamento, §7 — coluna *Risco*; Plano Executivo — campo *Risco* | | *(classificação registrada)* | Risco alto não reprova; **exige evidência adicional** (princípio 3) |
| **C15** | Complexidade conhecida | Plano Executivo — campo *Complexidade* de cada responsabilidade | | *(classificação registrada)* | |
| **C16** | Nenhuma decisão pendente | Plano Executivo — R15: *"decisão sobre a mudança de camada — **não coberta** por este plano"*; Governança, §5 — *"Nenhuma alteração normativa ocorre sem ADR aprovado"*; §10 — Estados de um ADR; §13 — *"A ausência de decisão é registrada como decisão"* | | *(ADR aplicável e seu estado, ou declaração de que nenhuma decisão é exigida)* | ADR `Proposto` **não autoriza nada** |
| **C17** | Escopo restrito a **uma** responsabilidade | Protocolo, princípio 4 — *"Escopo mínimo"* e princípio 5 — *"Uma responsabilidade por migração"*; Plano Executivo, Roadmap — *"Uma responsabilidade por migração, conforme o Protocolo"* | | *(escopo declarado)* | |

### Nota de Atribuição *(C11, C12 e parte de C13)*

Estes critérios são **legítimos e institucionalizados**, mas o Protocolo os situa na
**Fase 2 — Estabelecimento da linha de base**, não na Fase 1. Os critérios de aprovação da
Fase 1 são, em sua redação literal, **exatamente dois**: *"Nenhum bloqueio vigente a
alcança **e** existe linha de base mensurável"* — ou seja, **C6 e C10**.

Antecipá-los para este checklist é **operacionalmente vantajoso** — descobrir uma suíte
vermelha antes de abrir a branch evita trabalho perdido — e não contradiz nenhuma fonte,
pois a Fase 2 os exigirá de todo modo. Mas a distinção é registrada aqui para que a
leitura deste documento **não seja confundida com uma alteração do Protocolo**:

- **C6 e C10 são condições de elegibilidade.** Reprovar qualquer um deles significa que a
  migração **não começa**.
- **C11, C12 e C13 são condições de execução, verificadas antecipadamente.** Reprová-los
  significa que a migração **não pode prosseguir para a Fase 2** — o que, na prática,
  também a impede de começar, mas por fundamento diferente.

Este checklist **não reatribui fases**. Ele apenas as executa em ordem útil.

---

## 5. Verificação do Protocolo — Fase 1

Reprodução integral das verificações obrigatórias da Fase 1, na redação da fonte.
**Resultado admitido:** `Sim` · `Não` · `Não aplicável`. Evidência é obrigatória em todos
os casos, inclusive em `Não aplicável`.

### 5.1 Execução

| # | Verificação (Protocolo, Fase 1 — Execução) | Resultado | Evidência |
|---|---|---|---|
| P1 | Responsabilidade localizada no Mapeamento — arquivo, funções, módulo destino | | |
| P2 | Bloqueios de governança vigentes confrontados, **lendo sua redação exata**, verificando se alcançam esta responsabilidade | | |
| P3 | Existência de **linha de base disponível** verificada — testes ou outra evidência comportamental mensurável | | |
| P4 | **Todos** os consumidores identificados, **por busca no código** | | |

### 5.2 Evidências obrigatórias

| # | Evidência (Protocolo, Fase 1 — Evidências obrigatórias) | Resultado | Registro |
|---|---|---|---|
| E1 | Citação do bloqueio de governança e por que alcança — ou não — esta responsabilidade | | |
| E2 | Lista de consumidores **obtida por busca** | | |
| E3 | Confirmação de existência — ou ausência — de linha de base | | |

### 5.3 Critérios de aprovação e interrupção

| Condição | Fonte (redação literal) | Verificado |
|---|---|---|
| **Aprovação** | *"Nenhum bloqueio vigente a alcança **e** existe linha de base mensurável."* | |
| **Interrupção** | *"Um bloqueio a alcança; ou não existe linha de base — nesse caso a migração **não começa**, pois não haveria como comprovar preservação."* | |

### 5.4 Proporcionalidade da evidência

O Protocolo declara, em sua Nota final, que estabelece o **mínimo, não o suficiente para
todos os casos**, e que responsabilidades *"sem testes próprios, com múltiplos
consumidores ou entrelaçadas a funções maiores exigirão **evidência adicional**, definida
caso a caso na Fase 1"*.

| Item | Registro |
|---|---|
| A responsabilidade possui testes próprios? | |
| Quantos consumidores? | |
| Está entrelaçada a funções maiores? | |
| **Evidência adicional exigida** *(definida aqui, conforme o Protocolo)* | |

---

## 6. Bloqueadores

Registrar **todo** bloqueador identificado. O Protocolo é explícito: *"Nenhuma exceção
silenciosa."* Ausência de bloqueadores é declarada, nunca omitida.

| Bloqueador | Origem | Situação | Ação necessária |
|---|---|---|---|
| *(ex.)* Governança — validação operacional pendente | Plano Executivo, *Fontes de classificação*: bloqueadas as etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e `publicar/route.ts` | **Bloqueada** | Aguardar a validação operacional do comportamento de reutilização de guias em produção |
| *(ex.)* Ausência de linha de base | Protocolo, Fase 1 — critério de interrupção | **Bloqueada** | Criar linha de base local antes de abrir a release |
| *(ex.)* Dependência não migrada | Plano Executivo — campo *Dependências* | **Bloqueada** | Concluir a migração da dependência registrada |
| *(ex.)* Módulo de destino inexistente | Plano Executivo, *Fontes de classificação* | **Bloqueada** | Especificar a arquitetura do módulo e criar seu espaço |
| *(ex.)* Domínio de destino não especificado | Mapeamento, §8 — observação **B5** | **Bloqueada** | Especificar a arquitetura do domínio |
| *(ex.)* Decisão arquitetural pendente | Governança, §5 e §10 | **Bloqueada** | Obter ADR **aprovado** |
| | | | |

**Bloqueadores identificados nesta verificação:** *(número — declarar `0` quando não houver)*

---

## 7. Parecer técnico

Marcar **exatamente um** resultado:

- ☐ **ELEGÍVEL**
- ☐ **NÃO ELEGÍVEL**

**Vocabulário proibido.** Não é admitido registrar *parcialmente*, *quase*,
*provavelmente*, *aparentemente*, nem qualquer formulação equivalente. A pergunta admite
duas respostas; a ausência de certeza é **NÃO ELEGÍVEL**.

**Regra de decisão**, derivada dos critérios de aprovação e interrupção do Protocolo:

- **ELEGÍVEL** exige `SIM` em **C6** e **C10** — os dois critérios de aprovação literais
  da Fase 1 — e ausência de qualquer bloqueador na seção 6, com as verificações
  antecipadas C11–C13 igualmente satisfeitas.
- **NÃO ELEGÍVEL** decorre de **qualquer** reprovação, de qualquer bloqueador registrado,
  ou de qualquer critério **não verificado**.

Um único `NÃO` reprova. Não há compensação entre critérios.

---

## 8. Justificativa

Redigir objetivamente, **citando as fontes**. Uma justificativa que não cite documento não
é justificativa — é opinião, e o Protocolo não admite conclusão sem evidência verificável.

**Se ELEGÍVEL, declarar:**

- **Plano Executivo:** estado, grupo, release prevista e o registro de *por que PODE
  migrar*.
- **Protocolo:** que os dois critérios da Fase 1 foram satisfeitos, com a citação do
  bloqueio e a confirmação da linha de base.
- **Governança:** que nenhum bloqueio vigente alcança a responsabilidade, **por leitura da
  redação**, e que nenhuma decisão pendente a condiciona.
- **Mapeamento:** destino, estratégia, risco, dependências e consumidores registrados.

**Se NÃO ELEGÍVEL, declarar:**

- **Qual critério reprovou**, com sua origem documental.
- **Qual condição de desbloqueio** é exigida, e por qual documento.
- **Que ação** a torna elegível — e a qual artefato compete executá-la.

> **Registro obrigatório.** A reprovação **não é descartada**. Ela é registrada com sua
> justificativa, conforme a Governança: *"A ausência de decisão é registrada como
> decisão"* e *"saber que um problema foi considerado e deliberadamente não tratado é tão
> valioso quanto saber que foi resolvido."*

---

## 9. Aprovação

| Campo | Valor |
|---|---|
| **Data** | |
| **Responsável** | |
| **Responsabilidade** | |
| **Release prevista** | |
| **Resultado** | `ELEGÍVEL` \| `NÃO ELEGÍVEL` |

**Vínculo com a release.** Quando o resultado for `ELEGÍVEL`, este documento preenchido é
a evidência de entrada da **Fase 2** do Protocolo e integra o registro oficial da release,
conforme o Padrão de Release Engineering — que exige, no gate **G7 (Rastreabilidade)**,
*"vínculo com a decisão de origem quando houver"*.

**Independência entre autor e revisor.** Quando não houver, a dispensa é **registrada como
exceção**, nunca omitida — prática já estabelecida nos registros das Releases 004, 005 e
006.

---

## 10. Anexo — Matriz resumida

Sumário de uma linha por critério, para leitura imediata. **Não substitui a seção 4** — é
sua projeção. Divergência entre as duas resolve-se sempre pela seção 4.

| Critério | Resultado |
|---|---|
| C1 · Identificada no Mapeamento | |
| C2 · Destino arquitetural definido | |
| C3 · Módulo de destino existe | |
| C4 · Prevista no Plano Executivo | |
| C5 · Estado permite migração | |
| C6 · **Sem bloqueio de governança** | |
| C7 · Dependências identificadas | |
| C8 · Consumidores identificados por busca | |
| C9 · Estratégia definida | |
| C10 · **Linha de base existente** | |
| C11 · Testes verdes | |
| C12 · Build íntegro | |
| C13 · Evidências mínimas disponíveis | |
| C14 · Riscos conhecidos | |
| C15 · Complexidade conhecida | |
| C16 · Nenhuma decisão pendente | |
| C17 · Uma responsabilidade por migração | |
| Protocolo · Fase 1 (P1–P4, E1–E3) | |
| Bloqueadores registrados | |
| **ELEGÍVEL** | `SIM` \| `NÃO` |

> **C6 e C10 em negrito** porque são os dois critérios de aprovação literais da Fase 1 do
> Protocolo. Os demais são verificações que o conjunto documental já exige, consolidadas
> aqui — não hierarquizadas por este documento.

---

## Rastreabilidade documental

Toda regra deste checklist e onde ela já existia:

| Origem | O que este documento consome |
|---|---|
| **Protocolo de Migração Arquitetural** | Fase 1 integral (execução, evidências, critérios de aprovação e interrupção); princípios 3, 4, 5, 6, 7 e 8; Nota sobre proporcionalidade; Fase 2 (critério de interrupção por teste falhando; execução do build) |
| **Plano Executivo da Refatoração** | Fontes de classificação; bloqueio de governança vigente e sua condição de desbloqueio; tabela de linha de base; módulos existentes; campos por responsabilidade (estado, pré-requisitos, evidências mínimas, dependências, risco, complexidade, estratégia); Quadro Executivo |
| **Mapeamento Arquitetural** | §7 Matriz de Migração (módulo destino, estratégia, risco, dependências); §8 Observações de linha de base (B5) |
| **Padrão de Release Engineering** | G1 (Build), G2 (Testes), G7 (Rastreabilidade); regra *"um gate não verificado conta como não aprovado"*; tipo de release **Refatoração** |
| **Governança Arquitetural** | §5 Regras de Alteração; §10 Estados de um ADR; §13 Invariantes |

**Nenhum critério deste documento carece de origem.** Nenhuma regra nova foi criada.

---

## Validação deste documento

Verificação executada antes de sua institucionalização:

- ☑ **Todos os critérios possuem origem documental.** Os 17 critérios e as 7 verificações
  do Protocolo citam documento e trecho.
- ☑ **Nenhum critério foi inventado.** C17 foi acrescido aos 16 exigidos por derivar
  literalmente dos princípios 4 e 5 do Protocolo e do Roadmap do Plano Executivo — já
  institucionalizados, apenas não enumerados na lista mínima.
- ☑ **Nenhuma regra nova foi criada.** A única formulação própria deste documento é a
  ordem de execução e a Nota de Atribuição — que **registra** uma distinção existente
  entre Fase 1 e Fase 2 em vez de alterá-la.
- ☑ **O checklist apenas operacionaliza documentos existentes.** Em caso de divergência,
  prevalece a fonte.
- ☑ **O documento pode ser utilizado antes de qualquer Release de migração.** É agnóstico
  quanto à responsabilidade e ao grupo; aplica-se igualmente a Grupo A, B, C e D, e
  produz `NÃO ELEGÍVEL` corretamente para os três últimos pelas razões que suas
  respectivas fontes já registram.

---

## Encerramento

Este checklist não decide. Ele **lê** decisões que já foram tomadas e as apresenta na
ordem em que precisam ser conferidas.

Quando produz `NÃO ELEGÍVEL`, não é o checklist que impede a migração — é o bloqueio de
governança, a ausência de linha de base, a dependência não satisfeita ou o módulo
inexistente. O documento apenas torna esse impedimento **visível antes** de a branch
existir, em vez de descoberto no meio de uma release.
