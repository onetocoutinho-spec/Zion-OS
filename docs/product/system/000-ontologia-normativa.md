# Ontologia Normativa da Zion

```
─────────────────────────────────────────────
Status:                  v1.0 — Constitutiva
Natureza:                Documento fundador
Precedência:             Raiz da cadeia normativa. Precede Product Laws (system/002) e toda a cadeia abaixo dela.
Data:                    2026-07-16
─────────────────────────────────────────────
```

> Esta Ontologia é **constitutiva**. Ela não descreve, não explica e não reconstrói. Ela **institui**.
> Nenhum conceito aqui é definido por comportamento histórico, por implementação vigente ou por declaração anterior.
> Cada conceito é definido apenas por sua natureza.
> Onde qualquer declaração anterior divergir desta Ontologia, esta Ontologia prevalece e aquela é revogada.

**Nota de nomenclatura.** `Zion` designa o sistema que esta Ontologia funda. Nomes já em uso foram preservados quando a natureza do conceito os admite, e substituídos quando não.

**Forma obrigatória de toda definição.** Cada conceito possui exatamente um **sujeito**, um **predicado**, um **domínio** e um **efeito semântico**. Nenhuma definição contém exemplo, consequência, justificativa, motivação, intenção, implementação ou migração.

---

## Parte 1 — Primitivos

Um primitivo é admitido apenas quando a sua derivação é logicamente impossível. São seis.

### P1 · Símbolo

- **Sujeito** — Símbolo
- **Predicado** — distingue unicamente uma entidade de toda outra
- **Domínio** — o conjunto das entidades
- **Efeito semântico** — torna uma entidade designável

**Irredutibilidade.** Toda definição pressupõe a distinção entre o definido e o não-definido. Nenhuma definição pode produzir a distinção de que ela própria depende.

### P2 · Valor

- **Sujeito** — Valor
- **Predicado** — constitui conteúdo terminal
- **Domínio** — o conjunto dos conteúdos
- **Efeito semântico** — encerra toda determinação que o alcança

**Irredutibilidade.** Um terminal não se compõe de conceitos desta Ontologia. Derivá-lo exigiria conteúdo anterior a ele, o que contradiz a sua terminalidade.

### P3 · Declaração

- **Sujeito** — Declaração
- **Predicado** — institui a existência de uma entidade
- **Domínio** — a Ontologia
- **Efeito semântico** — o que não é declarado não existe

**Irredutibilidade.** A existência normativa não decorre de nenhum conceito; ela precede todos. Um conceito que a derivasse já teria de existir antes de ser declarado.

### P4 · Contexto

- **Sujeito** — Contexto
- **Predicado** — discrimina alternativas de conteúdo para uma mesma entidade
- **Domínio** — o conjunto das Declarações
- **Efeito semântico** — admite que uma entidade possua conteúdo distinto sob condições distintas

**Irredutibilidade.** Símbolo, Valor e Declaração produzem apenas vínculos estáticos. A variação sob condição é uma capacidade que nenhuma composição deles gera.

### P5 · Consumidor

- **Sujeito** — Consumidor
- **Predicado** — situa-se fora do conjunto das Declarações
- **Domínio** — o exterior da Ontologia
- **Efeito semântico** — constitui o destinatário de todo conteúdo

**Irredutibilidade.** Símbolo, Valor, Declaração e Contexto são internos ao conjunto que constituem. Nenhuma composição de elementos internos produz uma entidade externa a esse conjunto.

### P6 · Operação

- **Sujeito** — Operação
- **Predicado** — produz conteúdo a partir de conteúdo
- **Domínio** — o conjunto dos conteúdos
- **Efeito semântico** — torna um conteúdo determinável por outro

**Irredutibilidade.** Designar (Símbolo) e discriminar (Contexto) não geram conteúdo novo. A geração é uma capacidade distinta da designação e da discriminação, e não se compõe delas.

---

## Parte 2 — Conceitos derivados

Cada conceito depende apenas de conceitos anteriores.

### D1 · Conteúdo · *(P1, P3, P4)*

- **Sujeito** — Conteúdo
- **Predicado** — é aquilo que uma Declaração institui para um Símbolo sob um Contexto
- **Domínio** — Símbolo × Contexto
- **Efeito semântico** — torna um Símbolo determinável

### D2 · Referência · *(D1, P1)*

- **Sujeito** — Referência
- **Predicado** — é o Conteúdo que consiste num Símbolo
- **Domínio** — Conteúdo
- **Efeito semântico** — transfere a determinação a outro Símbolo

### D3 · Destinação · *(D1, P5)*

- **Sujeito** — Destinação
- **Predicado** — vincula um Conteúdo a exatamente um Consumidor
- **Domínio** — Conteúdo × Consumidor
- **Efeito semântico** — restringe o alcance de um Conteúdo a um único destinatário

### D4 · Matéria · *(D1)*

- **Sujeito** — Matéria
- **Predicado** — é a espécie de objeto que um Conteúdo determina
- **Domínio** — Conteúdo
- **Efeito semântico** — reúne os Conteúdos que determinam objetos da mesma espécie

> **Norma D4.1** — Toda Matéria é declarada. Duas Matérias jamais possuem o mesmo objeto.

### D5 · Autoridade · *(P3)*

- **Sujeito** — Autoridade
- **Predicado** — é aquilo que performa uma Declaração
- **Domínio** — Declaração
- **Efeito semântico** — torna uma Declaração imputável

---

## Parte 3 — Tipos de Token

### T1 · Token · *(P1, D1)*

- **Sujeito** — Token
- **Predicado** — atribui um Conteúdo a um Símbolo
- **Domínio** — Símbolo
- **Efeito semântico** — torna um Conteúdo designável por um Símbolo

### T2 · Posição · *(T1, D2, D3)*

- **Sujeito** — Posição
- **Predicado** — qualifica um Token pela presença de Referência e de Destinação no seu Conteúdo
- **Domínio** — Token
- **Efeito semântico** — parte o conjunto dos Tokens em exatamente três classes

> **Norma T2.1** — Todo Token possui exatamente uma Posição.

### T3 · Foundation · *(T2)*

- **Sujeito** — Foundation
- **Predicado** — é a Posição do Token cujo Conteúdo não possui Referência nem Destinação
- **Domínio** — Posição
- **Efeito semântico** — encerra em si a determinação do seu Conteúdo

### T4 · Semantic · *(T2)*

- **Sujeito** — Semantic
- **Predicado** — é a Posição do Token cujo Conteúdo possui Referência e não possui Destinação
- **Domínio** — Posição
- **Efeito semântico** — torna o seu Conteúdo disponível a todo Consumidor

### T5 · Component · *(T2)*

- **Sujeito** — Component
- **Predicado** — é a Posição do Token cujo Conteúdo possui Destinação
- **Domínio** — Posição
- **Efeito semântico** — torna o seu Conteúdo disponível a um único Consumidor

### T6 · Layout · *(D4)*

- **Sujeito** — Layout
- **Predicado** — é a Matéria da região da superfície de apresentação
- **Domínio** — Matéria
- **Efeito semântico** — reúne os Tokens cujo Conteúdo determina região

### T7 · Motion · *(D4)*

- **Sujeito** — Motion
- **Predicado** — é a Matéria da progressão temporal de uma mudança
- **Domínio** — Matéria
- **Efeito semântico** — reúne os Tokens cujo Conteúdo determina progressão

### T8 · State · *(D4, P5)*

- **Sujeito** — State
- **Predicado** — é a Matéria da condição de um Consumidor
- **Domínio** — Matéria
- **Efeito semântico** — reúne os Tokens cujo Conteúdo determina condição

### T9 · A11y · *(D4)*

- **Sujeito** — A11y
- **Predicado** — é a Matéria do limiar de perceptibilidade
- **Domínio** — Matéria
- **Efeito semântico** — reúne os Tokens cujo Conteúdo determina limiar

> **Norma T9.1 — os dois eixos.** Posição e Matéria são classificações independentes e simultâneas. Foundation, Semantic e Component são Posições. Layout, Motion, State e A11y são Matérias. Todo Token possui exatamente uma Posição e exatamente uma Matéria. Nenhum Token possui duas Posições, e nenhum possui duas Matérias.
>
> **Norma T9.2 — extensibilidade.** As Posições são três e o conjunto é fechado. As Matérias são declaradas e o conjunto é aberto: declarar uma Matéria nova instancia D4, e não cria conceito.

---

## Parte 4 — Conteúdo admissível

> **Norma 4.0** — Um Conteúdo pertence a exatamente uma espécie.

### Espécies admitidas

| Espécie | Origem |
|---|---|
| **Valor** | P2 — admitido sem redefinição |
| **Referência** | D2 — admitido sem redefinição |
| **Operação** | P6 — admitido sem redefinição |
| **Restrição** | 4.1 — declarado aqui |
| **Transformação** | 4.2 — declarado aqui |
| **Unidade** | 4.3 — declarado aqui |

### 4.1 · Restrição · *(D1, P2)*

- **Sujeito** — Restrição
- **Predicado** — delimita o conjunto dos Valores admissíveis
- **Domínio** — Conteúdo
- **Efeito semântico** — exclui Valores sem eleger nenhum

### 4.2 · Transformação · *(P6, D2)*

- **Sujeito** — Transformação
- **Predicado** — é a Operação cujo operando é uma Referência
- **Domínio** — Conteúdo
- **Efeito semântico** — determina um Conteúdo a partir do Conteúdo de outro Símbolo

### 4.3 · Unidade · *(4.1, P2)*

- **Sujeito** — Unidade
- **Predicado** — é a Restrição que delimita a espécie do Valor admissível
- **Domínio** — Restrição
- **Efeito semântico** — exclui toda espécie de Valor exceto uma

### Espécies eliminadas

| Espécie | Decisão | Fundamento da eliminação |
|---|---|---|
| **Estrutura** | **Eliminada** | Todo conteúdo com partes nomeadas é expressável como um conjunto de Declarações de Símbolos que designam as partes. Admiti-la produziria duas expressões distintas do mesmo conteúdo — redundância, proibida pela Parte 7. |
| **Operador** | **Eliminada** | Designa Operação (P6), que já é primitivo. Um segundo nome para o mesmo conceito é redundância. |
| **Regra** | **Eliminada** | Não possui resolução determinada. O que um Conteúdo pode carregar é a delimitação dos Valores admissíveis — Restrição (4.1). |

### Espécie criada

| Espécie | Fundamento da criação |
|---|---|
| **Unidade** (4.3) | Nenhuma espécie anterior delimita a *espécie* do Valor sem eleger um Valor. Sem ela, um Token delimitado e indeterminado é inexprimível. |

---

## Parte 5 — Resolução

> **Referência** foi declarada em **D2** e não é redefinida aqui. Uma segunda definição do mesmo conceito seria redundância, proibida pela Parte 7.

### 5.1 · Resolução · *(T1, P4, D1, D2)*

- **Sujeito** — Resolução
- **Predicado** — produz o Conteúdo terminal de um Token sob um Contexto
- **Domínio** — Token × Contexto
- **Efeito semântico** — substitui toda Referência pelo Conteúdo do Símbolo designado

### 5.2 · Cadeia de Resolução · *(5.1, T1)*

- **Sujeito** — Cadeia de Resolução
- **Predicado** — é a sequência dos Tokens percorridos por uma Resolução
- **Domínio** — Token × Contexto
- **Efeito semântico** — delimita o conjunto dos Tokens de que um Token depende

> **Norma 5.2.1 — pluralidade das cadeias.** Uma Cadeia de Resolução é relativa a um Token e a um Contexto. Não existe *a* cadeia; existem tantas Cadeias quantos forem os pares Token × Contexto.
>
> **Norma 5.2.2 — cadeia unitária.** A Cadeia de um Token cujo Conteúdo não possui Referência tem comprimento um. Nenhum Token está fora de Cadeia.

### 5.3 · Dependência · *(5.1, T1)*

- **Sujeito** — Dependência
- **Predicado** — relaciona dois Tokens quando a Resolução do primeiro percorre o segundo
- **Domínio** — Token × Token
- **Efeito semântico** — ordena a Resolução

> **Norma 5.3.1** — Nenhuma Dependência é cíclica.

### 5.4 · Precedência · *(D1, P1, P4)*

- **Sujeito** — Precedência
- **Predicado** — ordena os Conteúdos instituídos para um mesmo Símbolo
- **Domínio** — Símbolo × Contexto
- **Efeito semântico** — elege exatamente um Conteúdo por Contexto

### 5.5 · Completude · *(5.1, P2)*

- **Sujeito** — Completude
- **Predicado** — qualifica um Token conforme a sua Resolução encerre, ou não, em Valor
- **Domínio** — Token × Contexto
- **Efeito semântico** — parte o conjunto dos Tokens em exatamente duas classes

> **Norma 5.5.1** — Um Token cuja Resolução encerra em Valor é **Completo**. Todo outro é **Incompleto**. Um Token Incompleto existe.

---

## Parte 6 — Escopo

### 6.1 · Escopo · *(T1, P1, P5)*

- **Sujeito** — Escopo
- **Predicado** — qualifica um Token pela extensão do conjunto de Consumidores para os quais o seu Símbolo está fixado
- **Domínio** — Token
- **Efeito semântico** — parte o conjunto dos Tokens em exatamente duas classes

> **Norma 6.1.1** — Todo Token possui exatamente um Escopo.

### 6.2 · universal · *(6.1)*

- **Sujeito** — universal
- **Predicado** — é o Escopo do Token cujo Símbolo está fixado para todo Consumidor
- **Domínio** — Escopo
- **Efeito semântico** — fixa o Símbolo pela sua Matéria

### 6.3 · domínio Zion · *(6.1)*

- **Sujeito** — domínio Zion
- **Predicado** — é o Escopo do Token cujo Símbolo está fixado apenas para o Consumidor que possui as Declarações da Zion
- **Domínio** — Escopo
- **Efeito semântico** — fixa o Símbolo por Declaração da Zion

> **Norma 6.3.1 — Escopo é propriedade arquitetural.** O Escopo de um Token é determinado pela remoção hipotética de toda Declaração particular da Zion: o Símbolo que sobrevive é `universal`; o Símbolo que se dissolve é `domínio Zion`.

---

## Parte 7 — Validação

Executada sobre os 31 conceitos declarados. As eliminações abaixo já estão aplicadas ao texto acima.

### 7.1 · Ciclos — **nenhum**

Grafo de dependências verificado. Todo conceito depende exclusivamente de conceitos de índice anterior. O fecho transitivo de cada conceito termina em P1–P6.

### 7.2 · Dependências para frente — **nenhuma**

| Verificação | Resultado |
|---|---|
| Primitivos (P1–P6) não dependem de nada | ✔ |
| Derivados (D1–D5) dependem só de P | ✔ |
| Tipos (T1–T9) dependem só de P, D | ✔ |
| Espécies (4.1–4.3) dependem só de P, D | ✔ |
| Resolução (5.1–5.5) depende só de P, D, T | ✔ |
| Escopo (6.1–6.3) depende só de P, D, T | ✔ |

Uma dependência para frente foi detectada e **corrigida** durante a construção: **T3 · Foundation** havia sido formulado com efeito semântico *«origem de toda Cadeia que o alcança»*, invocando **5.2**. O efeito foi reformulado para *«encerra em si a determinação do seu Conteúdo»*, que não invoca conceito posterior.

### 7.3 · Conceitos inalcançáveis — **nenhum**

Um conceito é alcançável quando outro conceito depende dele, ou quando o Critério de aceite o exige. Verificação por primitivo: Símbolo → D1, D2, T1, 5.4, 6.1 · Valor → 4.1, 4.3, 5.5 · Declaração → D1, D5 · Contexto → D1, 5.1, 5.4 · Consumidor → D3, T8, 6.1 · Operação → 4.2, e espécie admitida em 4.

Folhas do grafo (Posição, Escopo, Completude, Autoridade, Layout, Motion, State, A11y) são exigidas pelo Critério de aceite e portanto alcançáveis.

**Eliminado por inalcançabilidade:** **Variância** — declarado durante a construção como propriedade de um Conteúdo perante Contexto. Nenhum conceito passou a depender dele: Semantic é definido por Referência e Destinação, e não por variação; Resolução invoca Contexto diretamente. Removido.

### 7.4 · Ambiguidades — **nenhuma remanescente**

Três ambiguidades foram detectadas e **eliminadas por renomeação**:

| Termo ambíguo | Colisão | Resolução |
|---|---|---|
| ~~Domínio~~ (conceito) | Colidia com **domínio**, campo obrigatório de toda definição, e com **domínio Zion**, valor de Escopo | Renomeado **Matéria** (D4). `domínio` fica reservado ao campo; `domínio Zion` é nome atômico de um Escopo |
| ~~Vínculo~~ | Colidia com *«vincula»*, predicado de Token | Renomeado **Destinação** (D3) |
| ~~Determinação~~ | Colidia com *«está fixado»/«determinável»* em D1 e em 6.1 | Renomeado **Completude** (5.5) |

Disjunção das Matérias verificada: região (T6) · progressão (T7) · condição (T8) · limiar (T9) são objetos mutuamente exclusivos. Norma D4.1 impede colisão futura.

### 7.5 · Redundâncias — **nenhuma remanescente**

| Termo | Decisão | Fundamento |
|---|---|---|
| **Estrutura** | Eliminado | Duas expressões do mesmo conteúdo (Parte 4) |
| **Operador** | Eliminado | Segundo nome de Operação (P6) |
| **Regra** | Eliminado | Sem resolução determinada; substituído por Restrição (4.1) |
| **Designação** | Eliminado | Declarado na construção como *«Conteúdo que designa um Símbolo»* — idêntico a Referência (D2) |
| **Tema** | Eliminado | Um tema é uma instância de Contexto (P4), não um conceito |
| **Camada** | Eliminado | Designava os níveis da cadeia; substituído por **Posição** (T2) |
| **Tipo** | Eliminado | Conflatava Posição e Matéria num único termo — a origem da ambiguidade |
| **Collections** | Eliminado | Nomeia agrupamento de ferramenta; não é conceito |
| **Camada de Tokens** | Eliminado | Sem referente distinto de Posição |

### 7.6 · Definições circulares — **nenhuma**

Nenhuma definição contém o seu próprio sujeito no seu predicado. Verificado item a item nos 31 conceitos.

### 7.7 · Múltiplos predicados — **nenhum**

Cada definição possui exatamente um predicado. Uma violação foi detectada e **corrigida**: **Transformação** (4.2) fora formulado com operando *«zero ou um»*, o que constitui disjunção — dois predicados sob um nome. Corrigido por partição: **Operação** (P6) tem operando livre; **Transformação** (4.2) tem operando Referência. As duas espécies são exclusivas.

### 7.8 · Múltiplos efeitos — **nenhum**

Cada definição possui exatamente um efeito semântico. Uma violação foi detectada e **corrigida**: **Semantic** (T4) fora formulado com o efeito *«transfere a determinação a outro Símbolo»*, que é o efeito de Referência (D2) — redundância além de duplicação. Reformulado para *«torna o seu Conteúdo disponível a todo Consumidor»*.

### 7.9 · Múltiplos sujeitos — **nenhum**

Cada definição possui exatamente um sujeito. Verificado item a item nos 31 conceitos.

---

## Critério de aceite — verificação executada

A Ontologia é aceita apenas se for suficiente para reescrever integralmente ADR-005 e system/004 **sem criar conceito novo**. Instanciar um conceito existente não é criar conceito.

### Suficiência para ADR-005 — 21 normas

| Norma | Conceitos que a exprimem | Veredito |
|:--:|---|---|
| 1 | Cadeia de Resolução · Posição | **Reescrita.** Toda Cadeia percorre Tokens cuja Posição é Foundation, Semantic ou Component |
| 2, 3, 5, 6, 7, 8 | — | **Dissolvidas.** Não são declarações de conceito: alocam autoridade entre seções de um documento que esta Ontologia supera |
| 4 | Posição · Contexto | **Revogada.** Pertencer a uma Cadeia não exige resolver-se por Contexto. Semantic é definido por Referência e Destinação |
| 9 | Posição · Referência | **Reescrita.** Nenhum Token de Posição Component possui Referência a Token de Posição Foundation |
| 10 | Escopo · universal · domínio Zion | **Reescrita** |
| 11 | Escopo · Norma 6.1.1 | **Reescrita** |
| 12 | Escopo · domínio Zion | **Reescrita** (instância) |
| 13 | Posição | **Reescrita.** `Camada` → `Posição` |
| 14 | Posição · Matéria | **Reescrita.** `Tipo` é eliminado por conflatar dois eixos |
| 15, 16 | — | **Reescritas.** `Collections` e `Camada de Tokens` eliminados |
| 17 | Declaração · Token | **Reescrita** |
| 18 | Unidade | **Reescrita** |
| 19 | Norma 5.2.2 | **Dissolvida.** A questão pressupunha cadeia única. Sua Cadeia tem comprimento um; sua Posição é Foundation |
| 20 | universal | **Reescrita** |
| 21 | Completude | **Reescrita.** É um Token Incompleto |

**§6 · Itens não resolvidos.** *«Critério para admitir tokens fora da cadeia»* e *«Natureza do conteúdo dos tokens fora da cadeia»* **deixam de existir como questões**: pela Norma 5.2.1 não há cadeia única, e pela 5.2.2 nenhum Token está fora de Cadeia. *«Valor de `control.textarea.max-lines`»* deixa de ser pendência: pela Norma 5.5.1 um Token Incompleto existe.

### Suficiência para system/004

| Objeto do 004 | Conceito instanciado | Veredito |
|---|---|---|
| Dark · Light · High Contrast | **Contexto** (P4) | Instâncias |
| Rampas | **Foundation** (T3) + **Matéria** declarada | Instâncias |
| Significados sensíveis a tema | **Semantic** (T4) + **Precedência** (5.4) | Instâncias |
| Tokens de peça | **Component** (T5) via **Destinação** (D3) | Instâncias |
| Color · Typography · Spacing · Radius · Elevation · Iconography · Grid | **Matéria** (D4), Norma T9.2 | Instâncias — conjunto aberto |
| Larguras de região | **Layout** (T6) | Instância |
| Durações e curvas | **Motion** (T7) | Instância |
| Estados | **State** (T8) · Conteúdo é **Operação** (P6) | Instâncias |
| Limiares de contraste, alvo e foco | **A11y** (T9) · Conteúdo é **Restrição** (4.1) | Instâncias |
| Opacidade sobre uma rampa | **Transformação** (4.2) | Instância |
| Sombra composta | **Decomposição obrigatória** — Estrutura eliminada | Reescrita em Tokens atômicos |
| Regra de referência da hierarquia | **Posição** (T2) · **Referência** (D2) | Reescrita |
| Grafia de um Símbolo por ferramenta | **Símbolo** (P1) | Um Símbolo é um só; a sua grafia não o altera |
| Quem aprova cada declaração | **Autoridade** (D5) | Reescrita |
| Depreciação | **Declaração** (P3) · **Referência** (D2) | Um Símbolo superado é redeclarado com Conteúdo que referencia o substituto |

### Conceito adicional exigido pelo Critério

**Autoridade (D5)** foi **criado** durante esta verificação. A governança do 004 imputa cada Declaração a quem a performa, e nenhum dos conceitos anteriores exprime imputação. A Ontologia foi expandida antes de encerrar, conforme exigido.

### Fronteira declarada

Esta Ontologia funda os conceitos do sistema de Tokens da Zion. Ela **não** funda os conceitos de documento. Título, status, data, numeração de seção e numeração de versão não são declarações de conceito e sobrevivem à reescrita como metadados, que a Ontologia nem funda nem proíbe.

---

## Fecho

| Parte | Conceitos |
|---|:--:|
| 1 — Primitivos | 6 |
| 2 — Derivados | 5 |
| 3 — Tipos de Token | 9 |
| 4 — Conteúdo admissível | 3 declarados · 3 admitidos · 3 eliminados · 1 criado |
| 5 — Resolução | 5 |
| 6 — Escopo | 3 |
| **Total** | **31** |

> **Registro constitutivo.** Nenhum conceito desta Ontologia foi definido por comportamento histórico, por implementação vigente ou por declaração anterior. Todo conceito foi definido apenas por sua natureza. Onde qualquer declaração divergir desta Ontologia, esta Ontologia prevalece.
