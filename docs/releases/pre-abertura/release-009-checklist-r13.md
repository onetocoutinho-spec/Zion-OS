# Checklist de Elegibilidade — R13 · Pré-Abertura da Release 009

> **Instância preenchida** do `engineering/checklist-elegibilidade-migracao.md`.
> Quarta aplicação prática do instrumento.
>
> **Independência declarada.** Nenhuma evidência foi reutilizada de execuções anteriores.
> Testes, build, hashes, buscas de consumidor e leitura de documentos foram produzidos
> novamente sobre o commit `0b8357d`.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **Responsabilidade** | **R13** — Composição do conteúdo pretendido |
| **Release** | **009** |
| **Commit atual** | `0b8357decab336a6038e92bc0c6f06bd55dbd659` · `master` == `origin/master` |
| **Arquivo de origem** | `src/lib/marketplaces/mlUserProducts.ts` — 288 linhas · SHA-256 `eb0822c2…4ea7e` |
| **Destino arquitetural** | **`modules/publication` — domínio (Planejamento)** |
| **Tipo da migração** | **EXTRAÇÃO DE RESPONSABILIDADE** — divisão de arquivo. **Não** é movimentação integral |
| **Linha de base** | `mlUserProducts.test.ts` — **7 testes**, rastreado, SHA-256 `5a1014dc…97ad9` |
| **Estado no Plano Executivo** | **Não iniciada** · Release prevista **009** |

### 1.1 Superfície de R13 — obtida por leitura do código

**Símbolos públicos de R13:**

| Símbolo | Linha | Natureza |
|---|---|---|
| `montarBundleUserProducts` | 216 | função — a responsabilidade |
| `BundleUserProducts` | 133 | interface — contrato de saída |
| `ResultadoBundle` | 149 | union type — desfecho |

**Símbolos internos usados exclusivamente por R13** — verificado linha a linha:

| Helper | Definido | Usado em | Fora de R13? |
|---|---|---|---|
| `semAcento` | 153 | 173, 175, 177, 185, 198 | **Não** |
| `paraNumero` | 161 | 256, 257 | **Não** |
| `fichaValor` | 172 | 220, 223, 228, 230 | **Não** |
| `generoParaId` | 184 | 223 | **Não** |
| `footwearParaId` | 197 | 228 | **Não** |
| `primeiroNumero` | 206 | 269 | **Não** |

**Constatação:** todas as ocorrências caem na região de R13 (153–288).
`montarItensUserProducts` (R12, l. 79–127) **não usa nenhum deles**.

**Constantes exportadas sem consumidor externo**, usadas apenas pelos helpers de R13:
`GENERO_ID` (l. 23) via `generoParaId`; `FOOTWEAR_TYPE_ID` (l. 32) via `footwearParaId`.

**Dependências de saída de R13:**

| Dependência | Origem | Situação |
|---|---|---|
| `normalizarTamanho` | R9 — `modules/publication/domain` | **migrada** (Release 003) |
| `medidasDaMarca` | R10 — `modules/catalog/domain` | **migrada** (Release 008) |
| `AnuncioGerado` | tipo da esteira de IA | fora do backlog |
| **`LinhaGuiaTamanho`** | **`./mercadolivre` — R7, Grupo C** | **não registrada no Mapeamento** — ver §6 |
| **`VariacaoUP`** | **mesmo arquivo, l. 44 — tipo de R12** | **não registrada no Mapeamento** — ver §6 |

**Consumidores de R13** — obtidos por busca:

| Consumidor | Símbolo | Forma do import |
|---|---|---|
| `src/lib/services/publicacaoML.ts` (l. 8) | `montarBundleUserProducts` | relativo, sem extensão |
| `src/app/api/ml/publicar/route.ts` (l. 18–21) | `BundleUserProducts` *(tipo)* | alias `@/`, sem extensão — **na mesma instrução que R12** |

---

## 2. Verificação de elegibilidade — os 17 critérios

| # | Critério | Resultado | Evidência produzida nesta execução | Origem |
|---|---|---|---|---|
| **C1** | Identificada no Mapeamento | **SIM** | §2 do Mapeamento: finalidade, arquivo, função `montarBundleUserProducts`, dependências, destino **Publication — domínio (Planejamento)**, acoplamento **alto**, prioridade *"alta por valor; contida por risco"*. §7 matriz l. 321 | Protocolo, Fase 1 |
| **C2** | Destino arquitetural definido | **SIM** | Matriz l. 321: `Publication / domínio`. §2: *"Módulo destino: **Publication — domínio (Planejamento)**"*. Plano: *"Destino: `modules/publication` — domínio"* | Mapeamento §7 |
| **C3** | Módulo de destino existe | **SIM** | `src/modules/publication/domain/` existe e **já contém R9** (`normalizarTamanho.ts` + teste), migrada na Release 003 | Plano Executivo, *Fontes de classificação* |
| **C4** | Prevista no Plano Executivo | **SIM** | Grupo B; Roadmap *"Release 009 — R13 (Composição do conteúdo)"*; Quadro l. 306 | Plano Executivo |
| **C5** | Estado permite migração | **SIM** | Quadro l. 306, coluna *Estado*: **`Não iniciada`**. Não é `Bloqueada` nem `Concluída` | Plano Executivo |
| **C6** | **Sem bloqueio de governança** | **SIM** | Redação relida: *"bloqueadas as etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e `publicar/route.ts`"*. R13 reside em `mlUserProducts.ts` — não nomeado. Sobre o consumidor `publicar/route.ts` e a RFC-001, ver §3.3 e §3.4 | Protocolo, Fase 1 — critério de aprovação |
| **C7** | Dependências identificadas | **SIM** | **5 dependências de saída** identificadas por leitura do código — tabela §1.1. As duas registradas como pré-requisito (R9, R10) estão **migradas**. Duas não constam do Mapeamento; identificadas aqui — ver §6 | Mapeamento §7; Plano Executivo |
| **C8** | Consumidores por **busca no código** | **SIM** | `grep -rl` por símbolo em `src/`: **2 consumidores de produção** — `publicacaoML.ts` e `publicar/route.ts` — mais o arquivo de teste. Tabela §1.1 | Protocolo, Fase 1 — evidência obrigatória nº 2 |
| **C9** | Estratégia definida | **SIM** | Matriz: *"**Dividir** do arquivo de tradução"*. Plano: *"dividir de R11/R12; mover a parcela de composição para Publication"*. Ver §5 quanto ao ponto que a estratégia não resolve | Mapeamento §7; Plano Executivo |
| **C10** | **Linha de base mensurável** | **SIM** | `mlUserProducts.test.ts` **rastreado**, blob idêntico a `HEAD`. Importa **exclusivamente** `montarBundleUserProducts` — todos os 7 testes exercitam R13 diretamente. Execução nova: **7 tests · 7 pass · 0 fail · 0 skipped** | Protocolo, Fase 1 — critério de aprovação |
| **C11** | Testes verdes | **SIM** | R13: 7/7. Suíte completa, execução nova: **215 tests · 215 pass · 0 fail · 0 skipped** | Protocolo, Fase 2; Padrão RE, G2 |
| **C12** | Build íntegro | **SIM** | Execução nova: **`✓ Compiled successfully in 50s`**, exit 0 | Protocolo, Fase 2; Padrão RE, G1 |
| **C13** | Evidências mínimas disponíveis | **SIM** | Plano exige *"divisão sem alteração de lógica demonstrada; build; auditoria de commit"* — todas obteníveis. A evidência substitutiva à similaridade está definida em §3.5 | Plano Executivo; Protocolo, princípio 3 |
| **C14** | Riscos conhecidos | **SIM** | **Alto** — Matriz l. 321 e Plano. Motivo registrado: exige **dividir** o arquivo entre dois módulos | Mapeamento §7; Plano Executivo |
| **C15** | Complexidade conhecida | **SIM** | **Alta** | Plano Executivo |
| **C16** | Nenhuma decisão pendente | **SIM** | ADR-007 **APROVADO**, ADR-008 **APROVADO** — nenhum menciona R13. RFC-001 investigada em §3.4: **não alcança R13** sob nenhuma das duas leituras | Governança §5, §10 |
| **C17** | Uma responsabilidade por migração | **SIM** | Escopo: exclusivamente R13. R12 (`montarItensUserProducts`) permanece na origem | Protocolo, princípios 4 e 5 |

**Resultado: 17 SIM · 0 NÃO · 0 NÃO APLICÁVEL.**

---

## 3. Verificação do Protocolo — Fase 1

### 3.1 Execução

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| **P1** | Localizada no Mapeamento | **Sim** | §2 e §7 relidos. Divergências de conteúdo registradas em §6 |
| **P2** | Bloqueios confrontados **pela redação exata** | **Sim** | Bloqueio de gestão e RFC-001 relidos integralmente — §3.3 e §3.4 |
| **P3** | Existência de linha de base verificada | **Sim** | 7 testes, rastreados, verdes; o arquivo de teste importa **somente** R13 |
| **P4** | **Todos** os consumidores por busca no código | **Sim** | Busca por cada símbolo público de R13. Nenhum de memória |

### 3.2 Evidências obrigatórias

| # | Evidência | Registro |
|---|---|---|
| **E1** | Citação do bloqueio e por que não alcança R13 | Ver §3.3 |
| **E2** | Lista de consumidores obtida por busca | `publicacaoML.ts` (`montarBundleUserProducts`); `publicar/route.ts` (`BundleUserProducts`) |
| **E3** | Confirmação de linha de base | **Existe, é mensurável, está versionada.** 7 testes exercitando R13 diretamente |

### 3.3 Bloqueio de gestão — leitura

A redação bloqueia etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e
`publicar/route.ts`. R13 vive em `mlUserProducts.ts` — **não nomeado**.

**Dois pontos de contato exigem registro explícito:**

**(a) O consumidor `publicar/route.ts` é um arquivo bloqueado.** A migração alterará
**apenas sua linha de import**. O Plano Executivo já estabeleceu esta distinção para R11:
*"alterar **apenas seu import** não constitui reorganização do arquivo, mas exige registro
explícito da distinção na release."* Aplicada e cumprida na **Release 007**, cujo registro
oficial a documenta. Precedente direto.

**(b) R13 importa um tipo de `mercadolivre.ts`.** `BundleUserProducts.guiaLinhas` é
tipado como `LinhaGuiaTamanho[]`, definido em `mercadolivre.ts`. Importar um tipo **não é**
mover, dividir nem reorganizar o arquivo. `mercadolivre.ts` permanecerá intocado. Ver §5
quanto à consequência arquitetural.

**Conclusão de C6 por leitura, não por interpretação: o bloqueio não alcança R13.**

### 3.4 RFC-001 — investigação obrigatória

**Por que esta verificação foi necessária.** O destino de R13 é **Publication** — o módulo
que a RFC-001 nomeia como bloqueado. Diferentemente de R10, cujo destino (Catalog) a RFC
lista entre os *implementáveis*, aqui a leitura superficial sugeriria impedimento.

**Estado documental encontrado.** Contradição no acervo:

| Documento | Redação |
|---|---|
| `RFC-001` — cabeçalho | *"**Estado:** **ABERTA — aguardando decisão arquitetural**"* |
| `ADR-007` — cabeçalho | *"**Estado:** **APROVADO**"* · *"**Efeito:** encerra a RFC-001"* |

**Resolução — sem necessidade de interpretação.** A própria RFC-001 delimita o alcance do
bloqueio em sua §5:

> *"**Quais módulos ficam bloqueados.** Diretamente, **Publication** (**seu agregado raiz e
> sua máquina de estados**). Indiretamente, qualquer consumidor que precise reagir aos
> estados terminais da Publication ou ao retorno de uma presença."*

E, antes: *"O que fica bloqueado é a **implementação do ciclo de vida da Publication**."*

R13 destina-se a **Planejamento**, que a arquitetura do módulo Publication descreve na
l. 189 como *"Compor o conteúdo pretendido…"* — um **serviço de domínio**, distinto do
**Agregado raiz: Publication** descrito na l. 132. R13 **não é** o agregado raiz, **não é**
a máquina de estados, e **não reage** a estados terminais: é função pura e determinística.

**Sob as duas leituras possíveis, R13 fica fora do bloqueio:**

1. *RFC encerrada pelo ADR-007 (APROVADO):* nenhuma decisão pendente.
2. *RFC aberta, ao pé da letra:* o bloqueio é do agregado raiz e da máquina de estados;
   R13 é nenhum dos dois.

**Precedente confirmatório:** **R9 já reside em `modules/publication/domain`** desde a
Release 003, com o mesmo perfil — função pura de domínio.

**Registrado, não corrigido:** o cabeçalho da RFC-001 contradiz o ADR-007. Pela Governança
§9, uma RFC deliberada deve estar *Aceita* e depois *Arquivada*. A correção é ato de
governança e está fora do escopo desta missão, que proíbe alterar RFC e ADR. **A conclusão
de C16 não depende dessa correção.**

### 3.5 Tipo da migração — confirmação explícita

# EXTRAÇÃO DE RESPONSABILIDADE

**Não é movimentação integral de arquivo.** Confirmado por evidência: `mlUserProducts.ts`
contém, além de R13, a responsabilidade **R12** (`montarItensUserProducts`, l. 79) e os
tipos que ela usa. O arquivo **permanecerá existindo** após a migração.

**Consequência probatória — a mesma da Release 007, não a da Release 008:**

| Evidência característica da Fase 3 | R13 |
|---|---|
| `git mv` | **Inaplicável** — não há arquivo a mover |
| Rename registrado | **Inaplicável** |
| **Similaridade 100% / R100** | **INAPLICÁVEL** |
| Migrar o teste junto com o código | **Aplicável** — os 7 testes acompanham |

**Evidência substitutiva definida nesta Fase 1**, conforme o Protocolo autoriza
(*"evidência adicional, definida caso a caso na Fase 1"*), replicando o que funcionou na
Release 007:

1. **SHA-256 idêntico** de cada bloco extraído — função, tipos, seis helpers e as duas
   constantes — entre origem e destino.
2. **Assinatura pública preservada** — `montarBundleUserProducts`, `BundleUserProducts`,
   `ResultadoBundle` com tipos inalterados.
3. **Diff da origem restrito a remoção** — nenhuma linha de lógica de R12 alterada.
4. **Diff dos consumidores restrito a import** — 2 arquivos, preservando a convenção de
   cada um.
5. **Testes redistribuídos sem perda** — 7 migram para o destino; o total do projeto
   permanece **215**.
6. **Build íntegro** antes e depois.

---

## 4. Validação da linha de base

| # | Verificação | Resultado |
|---|---|---|
| 1 | 7 testes específicos presentes | **SIM** — l. 39, 68, 85, 92, 112, 126, 142 |
| 2 | Testes executam | **SIM** |
| 3 | Todos aprovados | **7 tests · 7 pass · 0 fail · 0 skipped** |
| 4 | Build verde | **`✓ Compiled successfully in 50s`**, exit 0 |
| 5 | Suíte completa verde | **215 tests · 215 pass · 0 fail · 0 skipped** |
| 6 | Hash do arquivo de teste | SHA-256 `5a1014dc…97ad9` · blob `c61d93fa…` idêntico a `HEAD` |
| 7 | Cobertura dos símbolos públicos | O teste importa **exclusivamente** `montarBundleUserProducts`; os três símbolos públicos são exercitados por ele — caminho feliz, quatro modos de falha, deduplicação |
| 8 | Arquivo de teste versionado | **SIM** — `git ls-files --error-unmatch` confirma |

---

## 5. Validação das dependências

| Exigência | Evidência produzida nesta execução | Resultado |
|---|---|---|
| **R10 migrada** | `src/modules/catalog/domain/tabelasMedidas.ts` **presente**; `src/lib/data/tabelasMedidas.ts` **não existe mais** | ✓ |
| **Consumidores de R13 resolvem a nova localização de R10** | `mlUserProducts.ts` l. 19: `import { medidasDaMarca } from "../../modules/catalog/domain/tabelasMedidas.ts"` | ✓ |
| **Nenhum import quebrado após a Release 008** | Referências órfãs a `lib/data/tabelasMedidas` em `src/`: **0**. Build exit 0; suíte 215/215 | ✓ |
| **Nenhuma dependência adicional apareceu** | Cinco dependências de saída identificadas — as mesmas do código antes da Release 008, com R9 e R10 apenas reapontadas para seus novos caminhos | ✓ |
| **R9 migrada** *(dependência registrada)* | `src/modules/publication/domain/normalizarTamanho.ts` presente; `mlUserProducts.ts` l. 18 resolve | ✓ |

**Nota sobre a natureza da revalidação.** As duas dependências que o Plano registra — R9 e
R10 — não apenas existem: **estão nos destinos arquiteturais corretos**, e R13 já as
consome de lá. A Release 009 herdará imports que já apontam para `modules/`.

---

## 6. Bloqueadores

| Categoria | Situação | Evidência objetiva |
|---|---|---|
| **Técnico** | **Ausente** | Função pura e determinística; 7 testes verdes; build exit 0; helpers exclusivos verificados linha a linha |
| **Arquitetural** | **Ausente** | `modules/publication/domain` existe e já hospeda R9. Nenhum ADR alterou o destino de R13 |
| **Governança** | **Ausente** | Bloqueio de gestão não nomeia `mlUserProducts.ts`. RFC-001 não alcança R13 sob nenhuma das duas leituras — §3.4 |
| **Operacional** | **Ausente** | Linha de base versionada, verde e reproduzível a partir do repositório |

**Bloqueadores identificados: 0.**

### 6.1 Registrado, **não** classificado como bloqueador

| # | Constatação | Por que não bloqueia |
|---|---|---|
| **O1** | **O enunciado desta missão pede confirmar que "o destino continua sendo Catalog".** Ambos os documentos institucionalizados registram **Publication — domínio (Planejamento)**. Catalog era o destino de **R10** | Verificação conduzida contra os **documentos**, não contra o enunciado. O destino não mudou: sempre foi Publication |
| **O2** | O Mapeamento lista as dependências de R13 como *"`normalizarTamanho` (R9), `medidasDaMarca` (R10), `AnuncioGerado`"* — **omite `LinhaGuiaTamanho`** (de `mercadolivre.ts`) e **`VariacaoUP`** (tipo de R12) | C7 exige que as dependências sejam **identificadas** — e foram, por leitura do código. A omissão do Mapeamento é registrada, não corrigida |
| **O3** | O Mapeamento registra *"Dependências recebidas: `publicacaoML.ts`"* — **omite `publicar/route.ts`**, que importa `BundleUserProducts` | Idem. Consumidor identificado por busca |
| **O4** | O Mapeamento localiza R13 em **238–310**; hoje está em **216–288** | Deslocamento causado pela extração de R11 na Release 007. O escopo é definido por símbolos, não por faixa |
| **O5** | O Plano exige *"9 testes de `mlUserProducts` antes e depois"*; hoje são **7** | A Release 007 migrou 2 testes para `exigenciaModeloCanal.test.ts`. O número correto é 7; o total do projeto (215) é a medida estável |
| **O6** | A entrada de R13 no Plano afirma *"**R10 (não migrada)**"* e *"Pré-requisitos: R10 migrada"*; o Quadro registra *"Aguardando R10 · Aguardar Release 008"* | Já registrado como **E3** no registro da Release 008, cuja missão vedava tocar a entrada de R13. O fato subjacente — R10 migrada — é **verificável no repositório**. A Release 009 reescreverá esta entrada ao marcá-la Concluída |
| **O7** | O cabeçalho da RFC-001 contradiz o ADR-007 | §3.4. A conclusão de C16 não depende da correção |
| **O8** | **`VariacaoUP` é compartilhado entre R12 e R13** — usado por `OpcoesUserProducts.variacoes` (R12) e `BundleUserProducts.variacoes` (R13) | É o **principal ponto técnico** da Fase 3, não da Fase 1. Ver §6.2 |
| **O9** | Migrar R13 criará um import **Publication → `lib/marketplaces/mercadolivre.ts`** (tipo `LinhaGuiaTamanho`) | Consequência da preservação de contrato, que o Protocolo **exige**. Ver §6.2 |
| **O10** | `publicar/route.ts` importa R12 e o tipo de R13 **na mesma instrução** | A migração exigirá dividi-la, como ocorreu na Release 007. Dividir instrução de import não é dividir arquivo |

### 6.2 Os dois pontos que a Release 009 terá de declarar

**O8 — `VariacaoUP`.** É o único símbolo genuinamente compartilhado entre R12 e R13.
Não tem consumidor externo. A Fase 3 precisará decidir onde ele reside, sob a restrição de
que **refatoração não altera contratos**: duplicá-lo alteraria a identidade do tipo;
movê-lo levaria consigo parte de R12. A alternativa que preserva o contrato é mantê-lo na
origem e importá-lo do destino — o que reforça O9.

**O9 — fronteira Publication → Integration legado.** `BundleUserProducts.guiaLinhas` é
tipado com `LinhaGuiaTamanho`, conceito de **canal**, cuja verdade o README do Integration
declara possuir. Movendo R13, um tipo de domínio da Publication passará a referenciar um
tipo definido em arquivo legado de marketplace.

**Isto não é criado pela migração — já existe hoje**, dentro do mesmo arquivo. A migração
o torna **visível como dependência entre módulos**. Alterá-lo exigiria mudar o contrato de
`BundleUserProducts`, o que **descaracterizaria a refatoração**, conforme o Padrão de
Release Engineering: *"se for necessário alterar comportamento para concluir, deixa de ser
refatoração."*

**Registro factual, sem proposta:** não foi avaliado se esta fronteira deve ser objeto de
decisão arquitetural futura. Não é matéria desta Pré-Abertura.

---

## 7. Parecer

# ELEGÍVEL

**Regra de decisão aplicada**, na redação do Checklist:

> *"**ELEGÍVEL** exige `SIM` em **C6** e **C10** — os dois critérios de aprovação literais
> da Fase 1 — e ausência de qualquer bloqueador."*

- **C6 — SIM.** Nem o bloqueio de gestão nem a RFC-001 alcançam R13, por leitura da
  redação de ambos.
- **C10 — SIM.** Sete testes verdes, versionados, exercitando R13 diretamente.
- **Bloqueadores — 0** nas quatro categorias.
- **C11, C12, C13 — SIM.**

---

## 8. Justificativa

**Protocolo.** As duas condições literais da Fase 1 estão satisfeitas. A conclusão sobre os
bloqueios veio da **leitura de suas redações**: o bloqueio de gestão nomeia dois arquivos,
nenhum deles o de R13; a RFC-001 delimita seu alcance ao agregado raiz e à máquina de
estados da Publication, e R13 é um serviço de domínio de Planejamento.

**Plano Executivo.** R13 consta como `Não iniciada`, Release prevista **009**, Grupo B. Seu
único pré-requisito registrado — *R10 migrada* — foi **cumprido pela Release 008** e
revalidado nesta execução por evidência produzida do zero.

**Checklist.** Dezessete critérios verificados nesta execução; dezessete aprovados.

**Governança.** Nenhum ADR pendente alcança R13. A contradição documental encontrada na
RFC-001 foi investigada e **resolvida sem interpretação** — a própria RFC delimita o que
bloqueia, e R13 fica fora sob as duas leituras possíveis.

**O que esta execução acrescentou ao que os documentos registravam.** Cinco fatos que só a
leitura do código revelou: os seis helpers internos são **exclusivos de R13**, o que torna a
extração limpa; `GENERO_ID` e `FOOTWEAR_TYPE_ID` não têm consumidor externo e viajam junto;
`VariacaoUP` é **compartilhado com R12** e é o ponto técnico central da Fase 3; o Mapeamento
**omite duas dependências** e **um consumidor**; e o número de testes da linha de base é
**7**, não os 9 que o Plano registra.

---

## 9. Autorização

**A abertura da Release 009 está formalmente AUTORIZADA.**

| Item | Valor |
|---|---|
| **Release** | 009 |
| **Tipo** | **Refatoração** *(Padrão de Release Engineering §3)* |
| **Responsabilidade** | R13 — exclusivamente |
| **Tipo de migração** | **Extração de responsabilidade** — sem `git mv`, sem R100 |
| **Origem** | `src/lib/marketplaces/mlUserProducts.ts` |
| **Destino** | `src/modules/publication/domain/` |
| **Move junto** | `montarBundleUserProducts`, `BundleUserProducts`, `ResultadoBundle`, 6 helpers, `GENERO_ID`, `FOOTWEAR_TYPE_ID`, os 7 testes |
| **Permanece na origem** | R12 (`montarItensUserProducts`), `OpcoesUserProducts`, `EMPTY_GTIN_REASON_ID` |
| **A decidir na Fase 3** | `VariacaoUP` — ver §6.2 |
| **Consumidores a alterar** | 2 — apenas import; `publicar/route.ts` exigirá divisão da instrução |
| **Linha de base** | 7 testes · suíte 215 · build verde |
| **Evidência da Fase 3** | Substitutiva, definida em §3.5 — SHA-256 por bloco |
| **Próxima fase** | Protocolo, **Fase 2** |

**Alertas registrados antecipadamente para a execução:**

1. **O `git add` deve indexar apenas os caminhos que existem após a extração.** O incidente
   **E1** ocorreu duas vezes — Releases 003 e 008 —, sempre por staging que referenciava
   caminhos de origem já movidos. A Auditoria do Commit é obrigatória e deve inspecionar o
   **conteúdo commitado** dos dois consumidores.
2. **Risco Alto declarado.** O Mapeamento classifica R13 como risco **alto** por exigir
   divisão entre dois módulos. A evidência deve ser proporcional.
3. **Regra de reclassificação.** *"Se for necessário alterar comportamento para concluir,
   deixa de ser refatoração — a entrega é interrompida e reclassificada."*

**Esta autorização não inicia a migração.** Nenhuma branch foi criada. Nenhum arquivo de
código ou documentação foi alterado nesta execução.

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
| Tipo confirmado · **EXTRAÇÃO**, não movimentação | ✓ |
| Dependência R10 revalidada após a Release 008 | ✓ |
| Bloqueadores registrados | **0** |
| Constatações registradas sem bloquear | **10** |
| **ELEGÍVEL** | **SIM** |
