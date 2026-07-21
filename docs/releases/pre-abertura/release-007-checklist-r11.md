# Checklist de Elegibilidade — R11 · Pré-Abertura da Release 007

> **Instância preenchida** do `engineering/checklist-elegibilidade-migracao.md`.
> Primeira aplicação prática do instrumento, institucionalizado pelo ADR-008 na Release 013.
> Documento de evidência. Não altera artefato institucional algum.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **Responsabilidade** | **R11** — Determinação de exigência do modelo do canal |
| **Arquivo de origem** | `src/lib/marketplaces/mlUserProducts.ts` |
| **Símbolos** | `precisaUserProducts` (l. 49) · `dominioDaCategoria` (l. 143) · constantes privadas `CATEGORIAS_USER_PRODUCTS` (l. 47) e `DOMINIO_POR_CATEGORIA` (l. 139) |
| **Destino arquitetural** | `modules/integration` — **Capability** |
| **Release prevista** | **007** |
| **Estado no Plano Executivo** | **Não iniciada** · Grupo A · *"Pronta para migrar"* |
| **Engenheiro responsável** | Release Manager desta execução |
| **Data** | 21 de julho de 2026 |

**Observação de precisão.** O Mapeamento localiza R11 em `mlUserProducts.ts` **47–153**.
Verificado no código: essa faixa **contém também `montarItensUserProducts` (l. 90)**, que
o próprio Mapeamento atribui a **R12**. Os quatro símbolos de R11 **não são contíguos** —
ocupam as linhas 47–51 e 138–145, com R12 entre eles.

Isso **não é contradição**: o Mapeamento enumera os símbolos explicitamente, e o escopo da
migração é definido por eles, não pela faixa. A faixa é localizador. Registrado para que a
Fase 3 não tome "47–153" como recorte literal.

---

## 2. Verificação de elegibilidade

| # | Critério | Resultado | Evidência | Origem |
|---|---|---|---|---|
| **C1** | Identificada no Mapeamento | **SIM** | Mapeamento §2, l. 159–169 (finalidade, arquivo, símbolos, dependências, destino, acoplamento, prioridade); §7 matriz, l. 314 | Protocolo, Fase 1 |
| **C2** | Destino arquitetural definido | **SIM** | Matriz: *"Integration / Capability"*; §2: *"Módulo destino: **Integration — Capability**"* | Mapeamento §7 |
| **C3** | Módulo de destino existe | **SIM** | `src/modules/integration/` presente, com as 5 camadas (`domain`, `application`, `ports`, `adapters`, `infrastructure`) + README. Camada: **`domain`** — Capability é *"entidade interna (dentro de Channel)"* | Plano Executivo, *Fontes de classificação*; Integration §Modelo de Domínio l. 152 |
| **C4** | Prevista no Plano Executivo | **SIM** | Grupo A, l. 62–81; Roadmap l. 240–247; Quadro Executivo l. 293 | Plano Executivo |
| **C5** | Estado permite migração | **SIM** | Quadro Executivo: `Não iniciada` · Bloqueio `Nenhum` · *"Pronta para migrar"* | Plano Executivo |
| **C6** | **Sem bloqueio de governança** | **SIM** | Redação literal: *"bloqueadas as etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e `publicar/route.ts`"*. R11 reside em `mlUserProducts.ts` — **não nomeado**. Ver §2.1 quanto ao consumidor | Protocolo, Fase 1 — critério de aprovação; Plano Executivo, *Fontes de classificação* |
| **C7** | Dependências identificadas | **SIM** | Plano: *"Dependências: nenhuma"*; Matriz: *"1 consumidor"*. R14 **usa** R11, mas R14 é consumidora futura, não dependência de R11 | Mapeamento §7; Plano Executivo |
| **C8** | Consumidores por **busca no código** | **SIM** | `grep -rn` em `src/`: **1 consumidor de produção** — `app/api/ml/publicar/route.ts` (l. 19, 20, 143, 156); **1 de teste** — `mlUserProducts.test.ts` (l. 8, 9, 43–50). Nenhum outro | Protocolo, Fase 1 — evidência obrigatória nº 2 |
| **C9** | Estratégia definida | **SIM** | Plano: *"extrair funções e constantes para arquivo próprio no destino; atualizar o import do consumidor"*; Matriz: *"Extrair funções e constantes"* | Mapeamento §7; Plano Executivo |
| **C10** | **Linha de base mensurável** | **SIM** | `mlUserProducts.test.ts` contém **2 testes dedicados aos 2 símbolos públicos de R11** — l. 43 (`precisaUserProducts`) e l. 48 (`dominioDaCategoria`) — dentro dos 9 testes do arquivo. Ver §2.2 | Protocolo, Fase 1 — critério de aprovação |
| **C11** | Testes verdes | **SIM** | Execução: `tests 9 · pass 9 · fail 0 · cancelled 0 · skipped 0`, duração 2619 ms | Protocolo, Fase 2; Padrão RE, G2 |
| **C12** | Build íntegro | **SIM** | `✓ Compiled successfully in 17.5s`, exit 0 | Protocolo, Fase 2; Padrão RE, G1 |
| **C13** | Evidências mínimas disponíveis | **SIM** | Plano enumera 5, todas obteníveis: assinatura pública · 9 testes antes/depois · build antes/depois · auditoria de commit · diff do consumidor. Evidência adicional definida em §4 | Plano Executivo — *Evidências mínimas*; Protocolo, princípio 3 |
| **C14** | Riscos conhecidos | **SIM** | **Baixo** — Mapeamento §7 e Plano | Mapeamento §7; Plano Executivo |
| **C15** | Complexidade conhecida | **SIM** | **Baixa** — Plano | Plano Executivo |
| **C16** | Nenhuma decisão pendente | **SIM** | Nenhum ADR pendente alcança R11. ADR-007 trata do ciclo de vida da Publication (módulo diverso); ADR-008 está **Aprovado**. Nenhuma RFC aberta | Governança §5, §10 |
| **C17** | Uma responsabilidade por migração | **SIM** | Escopo declarado: exclusivamente R11. R12 e R13 permanecem em `mlUserProducts.ts` | Protocolo, princípios 4 e 5 |

**Resultado: 17 SIM · 0 NÃO · 0 NÃO APLICÁVEL.**

### 2.1 Sobre C6 — o consumidor é um arquivo bloqueado

O único consumidor de produção de R11 é `publicar/route.ts`, que **é** um dos dois arquivos
nomeados no bloqueio. A distinção decisiva está na redação: o bloqueio incide sobre etapas
que **movem, dividem ou reorganizam** *aqueles arquivos*. A migração de R11 **não move,
não divide e não reorganiza** `publicar/route.ts` — altera **linhas de import**.

O Plano Executivo já havia registrado exatamente esta distinção: *"o consumidor é
`publicar/route.ts` — alterar **apenas seu import** não constitui reorganização do arquivo,
mas exige registro explícito da distinção na release."* Registro cumprido aqui.

**Constatação adicional, obtida por leitura do código.** O consumidor importa os dois
símbolos de R11 na **mesma instrução** que `montarItensUserProducts` (R12) e o tipo
`BundleUserProducts` (R13), em `route.ts` l. 18–23. A migração exigirá **dividir essa
instrução de import em duas** — uma apontando para o destino, outra permanecendo na
origem.

Dividir uma *instrução de import* não é dividir o *arquivo*. A conclusão de C6 permanece
**SIM**, mas a operação é registrada aqui para que a Fase 3 não a descubra como surpresa e
para que o diff do consumidor seja avaliado contra esta expectativa declarada.

### 2.2 Sobre C10 — o que a linha de base cobre

Os dois símbolos **públicos** de R11 possuem teste dedicado e direto. As duas constantes
**não são exportadas** — são implementação privada, exercitada indiretamente pelas funções.
A assinatura pública de R11 é, portanto, **duas funções**.

**Consequência para a Fase 3:** o Protocolo determina *"migrar o teste junto com o
código"*. Os 2 testes de R11 deverão acompanhar os símbolos para o destino, permanecendo os
outros 7 na origem. O total de 9 é preservado, **redistribuído entre dois arquivos** — uma
diferença que a Fase 5 encontrará e que fica **explicada antecipadamente aqui**, conforme
exige o critério *"toda diferença explicada"*.

---

## 3. Verificação do Protocolo — Fase 1

### 3.1 Execução

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| **P1** | Responsabilidade localizada no Mapeamento — arquivo, funções, módulo destino | **Sim** | Mapeamento §2 l. 159–169 e §7 l. 314. Arquivo, 4 símbolos com linha, destino *Integration — Capability* |
| **P2** | Bloqueios de governança confrontados **pela redação exata** | **Sim** | Redação citada integralmente em C6. Objeto do bloqueio: `mercadolivre.ts` e `publicar/route.ts`. R11 reside em `mlUserProducts.ts`. Conclusão por leitura, **não por interpretação** |
| **P3** | Existência de linha de base verificada | **Sim** | `mlUserProducts.test.ts` executado: 9/9 verdes, dos quais 2 exercitam diretamente os símbolos de R11 |
| **P4** | **Todos** os consumidores identificados por busca no código | **Sim** | `grep -rn` sobre `src/` para ambos os símbolos. Resultado exaustivo em C8. Nenhum consumidor obtido de memória |

### 3.2 Evidências obrigatórias

| # | Evidência | Registro |
|---|---|---|
| **E1** | Citação do bloqueio e por que **não** alcança R11 | *"bloqueadas as etapas que movem, dividem ou reorganizam `mercadolivre.ts` e `publicar/route.ts`"*. R11 vive em `mlUserProducts.ts`, arquivo não nomeado. O consumidor bloqueado sofre alteração de import, que não é movimento, divisão nem reorganização do arquivo |
| **E2** | Lista de consumidores **obtida por busca** | Produção: `src/app/api/ml/publicar/route.ts` (4 ocorrências). Teste: `src/lib/marketplaces/mlUserProducts.test.ts` (6 ocorrências). Definição: `mlUserProducts.ts` (2). Total exaustivo |
| **E3** | Confirmação de linha de base | **Existe.** 2 testes dedicados aos 2 símbolos públicos; 9 testes no arquivo; todos verdes |

### 3.3 Critérios de aprovação e interrupção

| Condição | Redação literal | Verificado |
|---|---|---|
| **Aprovação** | *"Nenhum bloqueio vigente a alcança **e** existe linha de base mensurável."* | **SATISFEITA** — ambas as condições |
| **Interrupção** | *"Um bloqueio a alcança; ou não existe linha de base."* | **NÃO ACIONADA** |

### 3.4 Proporcionalidade — evidência adicional definida

O Protocolo determina que responsabilidades *"sem testes próprios, com múltiplos
consumidores ou entrelaçadas a funções maiores exigirão evidência adicional, **definida
caso a caso na Fase 1**"*.

| Item | Registro |
|---|---|
| Possui testes próprios? | **Sim** — 2 dedicados |
| Quantos consumidores? | **1** de produção, **1** de teste |
| Entrelaçada a funções maiores? | **Sim** — coabita `mlUserProducts.ts` com R12 e R13 (Mapeamento **M2**) |

**Constatação que exige evidência adicional.** A Fase 3 do Protocolo foi extraída da
Release 003, que foi um **movimento de arquivo inteiro**: suas evidências características
são `git mv`, *rename* registrado e **similaridade 100%**. A migração de R11 é uma
**extração de símbolos**, não um movimento de arquivo. **Não haverá rename, e a
similaridade de 100% é inaplicável** — o instrumento probatório central da Fase 3 não se
aplica a este caso.

Isto **não reprova a elegibilidade**: as duas condições da Fase 1 estão satisfeitas. O
Protocolo previu expressamente esta situação ao declarar-se *"o mínimo, não o suficiente
para todos os casos"* e ao delegar à Fase 1 a definição da evidência adicional.

**Evidência adicional definida para a Release 007**, substituindo a prova de similaridade:

1. **Conteúdo dos símbolos idêntico** — comparação textual dos 4 símbolos entre origem e
   destino, byte a byte.
2. **Assinatura pública preservada** — `precisaUserProducts(categoryId: string): boolean` e
   `dominioDaCategoria(categoryId: string): string | null`, inalteradas.
3. **Diff da origem restrito a remoção** — `mlUserProducts.ts` perde exatamente os 4
   símbolos e ganha, se necessário, apenas o import de reexportação; nenhuma outra linha.
4. **Diff do consumidor restrito a import** — `publicar/route.ts` altera **apenas** a
   divisão da instrução de import, preservando o alias `@/` já usado no arquivo.
5. **Testes redistribuídos sem perda** — 2 no destino + 7 na origem = **9**, idêntico à
   linha de base.
6. **Build íntegro** antes e depois.

---

## 4. Bloqueadores

| Categoria | Bloqueador | Origem | Impacto | Situação |
|---|---|---|---|---|
| **Técnico** | Nenhum | — | — | **Ausente** |
| **Arquitetural** | Nenhum | — | — | **Ausente** |
| **Governança** | Nenhum | — | — | **Ausente** |
| **Operacional** | Nenhum | — | — | **Ausente** |

**Bloqueadores identificados: 0.** Declaração explícita, conforme o princípio *"nenhuma
exceção silenciosa"*.

### Registrado, **não** classificado como bloqueador

| Constatação | Por que não bloqueia |
|---|---|
| A faixa "47–153" do Mapeamento contém R12 | O escopo é definido pelos símbolos enumerados, não pela faixa |
| O consumidor é um arquivo alcançado pelo bloqueio | O bloqueio incide sobre mover/dividir/reorganizar o arquivo; alteração de import não é nenhuma das três — distinção já registrada pelo Plano |
| O consumidor não possui teste próprio | O Plano **não** exige teste do consumidor para R11; exige *"diff do consumidor"* e *"build"* |
| A Fase 3 pressupõe movimento de arquivo | O Protocolo delega à Fase 1 a definição de evidência adicional; definida em §3.4 |
| A correspondência papel→camada não é direta | Resolvida por leitura combinada: Capability é entidade (Integration §Modelo de Domínio) e entidades residem em `domain` (Release 002) |

---

## 5. Parecer

# ELEGÍVEL

---

## 6. Justificativa

**A migração pode iniciar** pelas razões abaixo, cada uma ancorada em documento.

**Protocolo — as duas condições da Fase 1 estão satisfeitas.** Nenhum bloqueio vigente
alcança R11: a redação nomeia `mercadolivre.ts` e `publicar/route.ts`, e R11 reside em
`mlUserProducts.ts`. Existe linha de base mensurável: dois testes dedicados aos dois
símbolos públicos, verdes. A conclusão foi obtida **por leitura da redação**, exatamente
como o Protocolo registra ter ocorrido na Release 003.

**Plano Executivo — R11 é a única responsabilidade do Grupo A.** Estado *Não iniciada*,
bloqueio *Nenhum*, situação *Pronta para migrar*, Release prevista **007**. Os quatro
fundamentos que o Plano registra para *"por que PODE migrar"* foram verificados um a um
contra o código: não vive nos arquivos bloqueados **(confirmado)**; possui linha de base
**(confirmado — e mais precisamente do que o Plano declarava: 2 dos 9 testes são
dedicados a R11)**; acoplamento baixo e prioridade alta **(confirmado no Mapeamento)**;
consumidor único **(confirmado por busca exaustiva)**.

**Checklist — 17 critérios, 17 SIM, nenhum bloqueador.** Nenhuma evidência foi inferida.
Consumidores por busca, testes por execução, build por execução, bloqueio por citação
literal, destino por listagem de diretório.

**Governança — nenhuma decisão pendente alcança R11.** Nenhuma RFC aberta; ADR-007 trata
de módulo diverso; ADR-008 está Aprovado. Nenhuma alteração normativa é necessária para
executar esta migração.

**O que a verificação acrescentou ao que já se sabia.** Três fatos que só o exame do
código revelou, todos registrados antes da abertura da branch em vez de descobertos
durante a execução: a faixa de linhas do Mapeamento engloba R12; o import do consumidor
terá de ser dividido; e a Fase 3 do Protocolo, extraída de um movimento de arquivo, não
possui instrumento probatório aplicável a uma extração de símbolos — para o que se definiu
evidência substitutiva, conforme o próprio Protocolo autoriza.

---

## 7. Revalidação do ADR-008

**O Checklist conseguiu produzir um parecer utilizando exclusivamente critérios
institucionalizados?**

# SIM

Os 17 critérios e as 7 verificações da Fase 1 foram respondidos integralmente. Nenhum
critério precisou ser criado, reinterpretado ou suprido. O parecer é binário, e cada
resultado remete a documento e evidência.

**Nenhuma informação faltou para produzir o parecer.**

### Observações registradas — evidência, sem proposta de solução

O ADR-008 estabelece que *"se a primeira execução exigir critério não previsto, ou se algum
critério previsto se revelar inverificável na prática, o Checklist será objeto de RFC — não
de correção silenciosa"*. Nenhuma das duas hipóteses ocorreu. As constatações abaixo são
registradas como evidência da primeira aplicação, sem juízo e sem encaminhamento.

**O1 — Correspondência entre papel arquitetural e camada física não é direta.** O
Mapeamento designa destinos por **papel** (*Capability*, *Tradutor*, *Connection*). A
estrutura física criada na Release 002 possui **cinco camadas** (`domain`, `application`,
`ports`, `adapters`, `infrastructure`). Nenhum documento institucionalizado mapeia papel →
camada. Para R11 a correspondência foi resolvida por leitura combinada — Capability é
entidade interna de Channel, e entidades residem em `domain`. **O parecer não dependeu
disso**, pois C2 e C3 exigem destino e módulo, não camada.

**O2 — A Fase 3 do Protocolo não possui instrumento probatório para extração de
símbolos.** Suas evidências características — `git mv`, rename, similaridade 100% — foram
extraídas de um movimento de arquivo inteiro (Release 003). R11 é a primeira migração por
**extração**. O Protocolo já previa a lacuna ao declarar-se *"o mínimo, não o suficiente
para todos os casos"* e ao delegar a evidência adicional à Fase 1 — que a definiu em §3.4.
**Registro factual, sem interpretação:** não foi avaliado se as demais responsabilidades
por extração (R3, R4, R8, R1, R12) apresentarão a mesma condição.

**O3 — A faixa de linhas de R11 no Mapeamento engloba símbolo de R12.** Constatação
factual. Não altera o escopo, definido por símbolos enumerados.

---

## 8. Autorização

**Parecer:** `ELEGÍVEL` · **Bloqueadores:** 0 · **Critérios:** 17 SIM / 0 NÃO

**A abertura da Release 007 está formalmente AUTORIZADA.**

| Item | Valor |
|---|---|
| **Release** | 007 |
| **Tipo** | **Refatoração** *(Padrão de Release Engineering §3)* |
| **Responsabilidade** | R11 — exclusivamente |
| **Origem** | `src/lib/marketplaces/mlUserProducts.ts` — 4 símbolos |
| **Destino** | `src/modules/integration/domain/` |
| **Consumidor a alterar** | `src/app/api/ml/publicar/route.ts` — apenas import |
| **Linha de base** | 9 testes · build íntegro |
| **Próxima fase** | Protocolo, **Fase 2** — estabelecimento da linha de base |

**Regra de reclassificação, registrada antecipadamente.** O Padrão de Release Engineering
determina, para o tipo Refatoração: *"se for necessário alterar comportamento para
concluir, deixa de ser refatoração — a entrega é interrompida e reclassificada."* Vale
integralmente para esta release.

**Esta autorização não inicia a migração.** Nenhuma branch foi criada. Nenhum arquivo de
código foi alterado nesta fase.

---

## Anexo — Matriz resumida

| Critério | Resultado |
|---|---|
| C1 · Identificada no Mapeamento | ✓ |
| C2 · Destino arquitetural definido | ✓ |
| C3 · Módulo de destino existe | ✓ |
| C4 · Prevista no Plano Executivo | ✓ |
| C5 · Estado permite migração | ✓ |
| C6 · **Sem bloqueio de governança** | ✓ |
| C7 · Dependências identificadas | ✓ |
| C8 · Consumidores identificados por busca | ✓ |
| C9 · Estratégia definida | ✓ |
| C10 · **Linha de base existente** | ✓ |
| C11 · Testes verdes | ✓ |
| C12 · Build íntegro | ✓ |
| C13 · Evidências mínimas disponíveis | ✓ |
| C14 · Riscos conhecidos | ✓ |
| C15 · Complexidade conhecida | ✓ |
| C16 · Nenhuma decisão pendente | ✓ |
| C17 · Uma responsabilidade por migração | ✓ |
| Protocolo · Fase 1 (P1–P4, E1–E3) | ✓ |
| Bloqueadores registrados | 0 |
| **ELEGÍVEL** | **SIM** |
