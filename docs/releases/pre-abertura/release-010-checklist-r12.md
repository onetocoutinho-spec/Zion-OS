# Checklist de Elegibilidade — R12 · Pré-Abertura da Release 010

> **Instância preenchida** do `engineering/checklist-elegibilidade-migracao.md`.
> Quinta aplicação prática do instrumento.
>
> **Independência declarada.** Nenhuma evidência foi reutilizada de execuções anteriores.
> Testes, build, hashes, inventário de símbolos, buscas de consumidor e o ensaio de
> `git mv` foram produzidos sobre o commit `e78ab0c`.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **Responsabilidade** | **R12** — Montagem do payload no formato do canal |
| **Release** | **010** |
| **Commit atual** | `e78ab0c85aef18c53989eb96c128a0e5ee4be552` · `master` == `origin/master` |
| **Destino arquitetural** | **`modules/integration`** — Tradutor · camada **`domain`** |
| **Estado no Plano Executivo** | `Não iniciada` · Bloqueio **Nenhum** · **Categoria A** · *"Linha de base pronta (Release 015)"* |
| **Linha de base** | **16 testes** institucionalizados na Release 015 · rastreados · `==HEAD` |

### 1.1 Arquivos que hoje implementam R12

| Arquivo | Linhas | SHA-256 |
|---|---|---|
| `src/lib/marketplaces/mlUserProducts.ts` | 105 | `f76a1237125f29bb…` |
| `src/lib/marketplaces/mlPayload.ts` | 138 | `6741660408e27133…` |
| `src/lib/marketplaces/mlUserProducts.test.ts` | — | 8 testes |
| `src/lib/marketplaces/mlPayload.test.ts` | — | 8 testes |

### 1.2 Símbolos — inventário por leitura do código

**`mlUserProducts.ts` — 4 exports, 0 símbolos internos:**

| Símbolo | Linha |
|---|---|
| `EMPTY_GTIN_REASON_ID` | 21 |
| `VariacaoUP` | 25 |
| `OpcoesUserProducts` | 36 |
| `montarItensUserProducts` | 60 |

Único import: `listingTypeId` de `./mlPayload.ts` — **interno a R12**.

**`mlPayload.ts` — 3 exports, 3 símbolos internos:**

| Símbolo | Linha | Serve a |
|---|---|---|
| `listingTypeId` | 15 | R12 · usado em l. 117 e por `mlUserProducts.ts` |
| `OpcoesPayloadML` | 56 | contrato de `montarItemML` (l. 67) |
| `montarItemML` | 67 | R12 |
| `MAPA_ATRIBUTOS_ML` *(interno)* | 20 | usado em l. 74, dentro de `montarItemML` |
| `normalizar` *(interno)* | 38 | usado em l. 74 |
| `paraNumero` *(interno)* | 46 | usado em l. 99 e 100 |

Imports: `AnuncioGerado` *(usado por `OpcoesPayloadML`)* e `Produto` — **não utilizado**,
ver §7, achado **O4**.

### 1.3 Consumidores — obtidos por busca

| Consumidor | Símbolo | Forma do import |
|---|---|---|
| `src/app/api/ml/publicar/route.ts` (l. 18) | `montarItensUserProducts` | alias `@/`, sem extensão |
| `src/modules/publication/domain/composicaoConteudo.ts` (l. 9) | `VariacaoUP` *(tipo)* | relativo, sem extensão |
| `src/lib/services/publicacaoML.ts` (l. 7) | `montarItemML` | relativo, sem extensão |

**Três consumidores externos** — o Mapeamento registra **dois**. Ver §7, achado **O2**.

---

## 2. Classificação da natureza da migração

# MOVIMENTO INTEGRAL DE QUATRO ARQUIVOS

**Não é extração. Não é híbrido.**

### 2.1 Determinação por evidência

**Quais arquivos pertencem integralmente à R12: os quatro.**

Verificado símbolo a símbolo: em `mlPayload.ts`, cada um dos 6 símbolos serve
exclusivamente a `montarItemML` ou a `listingTypeId`. Em `mlUserProducts.ts`, os 4 exports
são R12 e não há símbolo interno algum. Após a Release 009 — que extraiu R13 —, **nenhuma
outra responsabilidade habita esses arquivos**.

Os dois arquivos de teste foram criados na Release 015 exclusivamente para R12.

| Pergunta | Resposta por evidência |
|---|---|
| Arquivos que permanecerão após a migração | **Nenhum** dos quatro |
| Arquivos que deixarão de existir na origem | **Os quatro** |
| Arquivos que poderão usar `git mv` | **Os quatro** |
| Arquivos que exigirão extração | **Nenhum** |
| Símbolos que ficam para trás | **Nenhum** |

### 2.2 Ensaio de `git mv` — executado em clone descartável

**Ensaio 1 — movimento puro, conteúdo intocado:**

```
R100  mlPayload.test.ts        → modules/integration/domain/mlPayload.test.ts
R100  mlPayload.ts             → modules/integration/domain/mlPayload.ts
R100  mlUserProducts.test.ts   → modules/integration/domain/mlUserProducts.test.ts
R100  mlUserProducts.ts        → modules/integration/domain/mlUserProducts.ts
```

**Ensaio 2 — após ajustar apenas os imports que deixam de resolver:**

| Arquivo | Similaridade | Linhas alteradas | Motivo |
|---|---|---|---|
| `mlUserProducts.ts` | **R100** | `0 0` | Único import é `./mlPayload.ts`, que **move junto** — caminho inalterado |
| `mlUserProducts.test.ts` | **R100** | `0 0` | Único import local é `./mlUserProducts.ts` — inalterado |
| `mlPayload.test.ts` | **R099** | `1 1` | `../agentes/esteira.ts` muda de profundidade |
| `mlPayload.ts` | **R097** | `2 2` | `../agentes/esteira` e `../types` mudam de profundidade |

O clone foi descartado. **Nenhuma alteração foi feita no repositório.**

### 2.3 Padrão probatório aplicável

**Um único padrão: `git mv`**, para os quatro arquivos — com **duas classes de
similaridade**, ambas explicáveis linha a linha:

- **Classe A — R100** *(`mlUserProducts.ts` e seu teste)*: prova direta de que nenhum byte
  mudou. É a evidência característica da Fase 3 do Protocolo, aplicável integralmente.
- **Classe B — R099 e R097** *(`mlPayload.ts` e seu teste)*: a diferença corresponde
  **exatamente** às linhas de import cuja profundidade relativa muda. Cada linha deve ser
  exibida no registro da release; a similaridade inferior a 100% é **explicada, não
  tolerada**.

**Isto difere de todas as migrações anteriores.** A Release 008 (R10) teve R100 puro; as
Releases 007 (R11) e 009 (R13) foram extrações, sem `git mv` para o código de produção.
R12 é o primeiro caso de **movimento integral com similaridade mista**.

### 2.4 Condição que preserva o R100 — restrição descoberta por evidência

O `R100` de `mlUserProducts.ts` **depende de duas condições simultâneas**:

1. `mlPayload.ts` **conservar seu nome de arquivo**; e
2. ambos aterrissarem **no mesmo diretório**.

Se a Release 010 renomear qualquer um dos dois, o import `./mlPayload.ts` muda e
`mlUserProducts.ts` **perde o R100**. A escolha de nomes é decisão da Fase 3 — esta
Pré-Abertura **não a toma** —, mas registra que ela tem consequência probatória direta.

---

## 3. Verificação de elegibilidade — os 17 critérios

| # | Critério | Resultado | Evidência produzida nesta execução | Origem |
|---|---|---|---|---|
| **C1** | Identificada no Mapeamento | **SIM** | §7 matriz l. 318: `R12 Payload do canal \| mlUserProducts.ts 90; mlPayload.ts \| Integration / Tradutor \| Mover e separar de R13 \| Médio \| 2 consumidores`. Divergências em §7 | Protocolo, Fase 1 |
| **C2** | Destino arquitetural definido | **SIM** | Matriz: `Integration / Tradutor`. Camada: **`domain`** — a arquitetura do módulo lista *Tradutores* sob **Serviços de Domínio** (l. 95–97) | Mapeamento §7; Integration §Modelo de Domínio |
| **C3** | Módulo de destino existe | **SIM** | `src/modules/integration/domain/` existe e **já contém R11** (`exigenciaModeloCanal.ts` + teste) | Plano Executivo, *Fontes de classificação* |
| **C4** | Prevista no Plano Executivo | **SIM** | Grupo B; Quadro l. 310; Roadmap *"Release 010 — R12"* | Plano Executivo |
| **C5** | Estado permite migração | **SIM** | Quadro l. 310: `Não iniciada` · `Nenhum` · *"Linha de base pronta (Release 015)"* · `Executar Pré-Abertura`. Entrada: **Categoria A** | Plano Executivo |
| **C6** | **Sem bloqueio de governança** | **SIM** | Redação relida: bloqueiam-se etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e `publicar/route.ts`. Nenhum dos 4 arquivos de R12 é um deles. Sobre o consumidor `publicar/route.ts`, ver §4.3 | Protocolo, Fase 1 |
| **C7** | Dependências identificadas | **SIM** | Dependência registrada **R13 — satisfeita (Release 009)**. Dependências de saída: `AnuncioGerado` e `Produto` *(não utilizado)*. `listingTypeId` é dependência **interna** a R12 | Mapeamento §7; Plano Executivo |
| **C8** | Consumidores por **busca no código** | **SIM** | **3 consumidores externos**, tabela §1.3. Nenhum de memória | Protocolo, Fase 1 — evidência obrigatória nº 2 |
| **C9** | Estratégia definida | **SIM** | Matriz: *"Mover e separar de R13"*. A **separação já ocorreu** na Release 009; resta o movimento. Ver §7, achado **O3** | Mapeamento §7; Plano Executivo |
| **C10** | **Linha de base mensurável** | **SIM** | 16 testes, **rastreados**, blob `==HEAD` nos 4 arquivos. Execução nova: **16 tests · 16 pass · 0 fail** | Protocolo, Fase 1 |
| **C11** | Testes verdes | **SIM** | R12: 16/16. Suíte completa, **duas execuções independentes**: **231 · 231 pass · 0 fail** em ambas | Protocolo, Fase 2; Padrão RE, G2 |
| **C12** | Build íntegro | **SIM** | Execução nova: **`✓ Compiled successfully in 14.0s`**, exit 0 | Protocolo, Fase 2; Padrão RE, G1 |
| **C13** | Evidências mínimas disponíveis | **SIM** | Plano: *"linhas de base de ambos os arquivos — **disponíveis**; consumidores atualizados; build"*. Padrão probatório definido em §2.3 | Plano Executivo |
| **C14** | Riscos conhecidos | **SIM** | **Médio** — Matriz l. 318 e Plano | Mapeamento §7; Plano Executivo |
| **C15** | Complexidade conhecida | **SIM** | **Média** | Plano Executivo |
| **C16** | Nenhuma decisão pendente | **SIM** | ADR-007 **APROVADO**, ADR-008 **APROVADO** — **0 menções a R12** em ambos. RFC-001 lista **Integration** entre os módulos que *"permanecem implementáveis"* | Governança §5, §10 |
| **C17** | Uma responsabilidade por migração | **SIM** | Escopo: exclusivamente R12. Nenhum símbolo de outra responsabilidade habita os arquivos | Protocolo, princípios 4 e 5 |

**Resultado: 17 SIM · 0 NÃO · 0 NÃO APLICÁVEL.**

---

## 4. Verificação do Protocolo — Fase 1

### 4.1 Execução

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| **P1** | Localizada no Mapeamento | **Sim** | §7 matriz l. 318, relida |
| **P2** | Bloqueios confrontados **pela redação exata** | **Sim** | Bloqueio de gestão e RFC-001 relidos — §4.3 e §4.4 |
| **P3** | Existência de linha de base verificada | **Sim** | 16 testes rastreados e verdes; independência de R13 confirmada — §5 |
| **P4** | **Todos** os consumidores por busca no código | **Sim** | Busca por arquivo e por símbolo. 3 externos + 1 interno a R12 |

### 4.2 Evidências obrigatórias

| # | Evidência | Registro |
|---|---|---|
| **E1** | Citação do bloqueio e por que não alcança R12 | *"bloqueadas as etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e `publicar/route.ts`"*. R12 reside em `mlUserProducts.ts` e `mlPayload.ts` — **nenhum dos dois é nomeado** |
| **E2** | Lista de consumidores obtida por busca | Tabela §1.3 — três externos, com a forma de import de cada um |
| **E3** | Confirmação de linha de base | **Existe, é mensurável, está versionada e é independente de R13** |

### 4.3 O consumidor `publicar/route.ts` — distinção registrada

`publicar/route.ts` **é** um dos arquivos nomeados no bloqueio, e importa
`montarItensUserProducts`. A migração alterará **apenas sua linha de import**.

Precedente institucional direto: o Plano Executivo registrou a distinção para R11 —
*"alterar **apenas seu import** não constitui reorganização do arquivo"* —, aplicada nas
**Releases 007 e 009**, ambas com registro oficial. `mercadolivre.ts` permanecerá intocado.

### 4.4 RFC-001 — verificação

O destino de R12 é **Integration**, que a RFC-001 nomeia explicitamente entre os módulos
que *"permanecem implementáveis"*. Sob qualquer leitura da RFC — encerrada pelo ADR-007
APROVADO, ou aberta ao pé da letra —, **ela não alcança R12**. Nenhuma investigação
adicional foi necessária.

### 4.5 Riscos e estratégia candidata

| Item | Registro |
|---|---|
| Risco declarado | **Médio** — 3 consumidores, dois arquivos de produção |
| Complexidade | **Média** |
| Estratégia candidata | `git mv` dos 4 arquivos para `modules/integration/domain/`; ajuste de 3 linhas de import nos consumidores e de 3 linhas nos arquivos movidos |
| Evidência adicional | Não é necessária: o padrão probatório da Fase 3 aplica-se integralmente, com a explicação linha a linha da Classe B |

---

## 5. Validação da linha de base

| # | Verificação | Resultado |
|---|---|---|
| 1 | 16 testes específicos | **Presentes** — 8 + 8 |
| 2 | Aprovação dos 16 | **16 tests · 16 pass · 0 fail** |
| 3 | Suíte completa verde | **231/231**, em **duas execuções independentes** |
| 4 | Build verde | **`✓ 14.0s`**, exit 0 |
| 5 | Hashes dos arquivos de produção | `mlUserProducts.ts` `f76a1237…` · `mlPayload.ts` `6741660…` |
| 6 | Produção inalterada | Os 4 arquivos **rastreados** e com blob `==HEAD` |
| 7 | Independência de R13 | **0 imports** de `publication/domain` ou `montarBundleUserProducts` — ver §7, achado **O7** |

---

## 6. Bloqueadores

| Categoria | Situação | Evidência objetiva |
|---|---|---|
| **Técnico** | **Ausente** | 4 arquivos integralmente de R12; `git mv` demonstrado com R100 em todos com conteúdo intacto; 16/16 verdes; build exit 0 |
| **Arquitetural** | **Ausente** | `modules/integration/domain` existe e já hospeda R11. Tradutor é Serviço de Domínio pela arquitetura do módulo |
| **Governança** | **Ausente** | Bloqueio nomeia dois arquivos; nenhum é de R12. RFC-001 lista Integration como implementável. 0 ADRs pendentes |
| **Operacional** | **Ausente** | Linha de base institucionalizada na Release 015, rastreada e reproduzível — **B1 não se repete** |

**Bloqueadores identificados: 0.**

---

## 7. Constatações registradas — não classificadas como bloqueador

| # | Constatação | Por que não bloqueia |
|---|---|---|
| **O1** | O Mapeamento localiza R12 em `mlUserProducts.ts` **90**; hoje `montarItensUserProducts` está na **l. 60**, e o arquivo tem 105 linhas | Deslocamento causado pelas Releases 007 e 009. O escopo é definido por símbolos, não por faixa — precedente das Pré-Aberturas 007 e 009 |
| **O2** | O Mapeamento registra **2 consumidores**; a busca encontra **3** | O terceiro (`composicaoConteudo.ts`, importando `VariacaoUP`) foi **criado pela Release 009** e está registrado no seu registro oficial como **A3**. C8 é satisfeito pela busca, não pelo documento |
| **O3** | A estratégia do Mapeamento diz *"Mover **e separar** de R13"* | A separação **já ocorreu** na Release 009. Resta apenas mover — o que esta Pré-Abertura classifica como movimento integral |
| **O4** | `mlPayload.ts` l. 12 importa `Produto`, **não utilizado** no arquivo | Código morto. **Consequência para a Fase 3:** ainda que inútil, o caminho `../types` deixa de resolver no destino e **terá de ser reapontado** — ou o build quebra. Removê-lo excederia o movimento |
| **O5** | O literal `"17055160"` está duplicado — constante em `mlUserProducts.ts` l. 21, *hardcoded* em `mlPayload.ts` l. 87 | Ambos migram juntos. A linha de base asserta o valor **nos dois caminhos** |
| **O6** | A tabela *Linha de base disponível* do Plano ainda registra `` `tabelasMedidas.ts` \| **NÃO** `` | Pertence a **R10**; registrado como **E1** no registro da Release 015 |
| **O7** | Os dois testes de R12 **mencionam** `montarBundleUserProducts` | Apenas no **comentário da linha 6** — precisamente o que declara a independência. **0 imports** verificados |

### 7.1 Evidência inválida produzida e descartada

O ensaio de `git mv` executou também testes e build no clone, que reportaram
**219 testes, 1 falha** em `serverAuthorization.test.ts` — arquivo **sem relação alguma
com R12**.

**Investigação.** Isolado no repositório real, o teste passa **13/13 em três execuções**.
A suíte completa no repositório real passa **231/231 em duas execuções**. Causa
identificada: **o clone não possui `node_modules`** — o diretório está no `.gitignore`, e
`git clone` não copia arquivos ignorados. O ambiente do ensaio **não era equivalente**.

**Decisão:** os resultados de **teste e build do clone** são **rejeitados como evidência
inválida**. As **medições de similaridade permanecem válidas** — são operações puras do
Git, independentes de dependências instaladas.

*Fundamento:* *evidência ambígua não é evidência*. Décima aplicação do princípio.

**Registro de método, para execuções futuras:** clones descartáveis servem para medir
renomeações e para reproduzir testes **sem dependências externas**; **não servem** para
executar a suíte completa nem o build.

---

## 8. Parecer

# ELEGÍVEL

**Regra de decisão aplicada**, na redação do Checklist:

> *"**ELEGÍVEL** exige `SIM` em **C6** e **C10** — os dois critérios de aprovação literais
> da Fase 1 — e ausência de qualquer bloqueador."*

- **C6 — SIM.** Nem o bloqueio de gestão nem a RFC-001 alcançam R12, por leitura da
  redação de ambos.
- **C10 — SIM.** Dezesseis testes verdes, versionados, independentes de R13.
- **Bloqueadores — 0** nas quatro categorias.
- **C11, C12, C13 — SIM.**

---

## 9. Justificativa

**Protocolo.** As duas condições literais da Fase 1 estão satisfeitas. O bloqueio de gestão
nomeia `mercadolivre.ts` e `publicar/route.ts`; **nenhum dos quatro arquivos de R12 é um
deles**. A linha de base é mensurável, versionada e foi reexecutada nesta execução.

**Plano Executivo.** R12 consta como `Não iniciada`, bloqueio `Nenhum`, **Categoria A**,
com o pré-requisito registrado como **CONCLUÍDO na Release 015** e a dependência de R13
satisfeita na Release 009.

**Checklist.** Dezessete critérios verificados nesta execução; dezessete aprovados; nenhum
copiado.

**Governança.** Nenhum ADR pendente menciona R12. A RFC-001 lista **Integration** entre os
módulos que permanecem implementáveis — verificação direta, sem necessidade de
interpretação.

**O que esta execução determinou, e que nenhum documento registrava.** A natureza da
migração de R12 era, até aqui, uma questão em aberto — o Plano supunha *"mover e separar"*.
A evidência estabelece que **os quatro arquivos pertencem integralmente a R12** e que a
migração é **movimento integral**, com `git mv` aplicável a todos. Mais: o ensaio mediu a
similaridade real e revelou que **dois arquivos preservam R100 e dois não**, com a
diferença correspondendo exatamente às linhas de import cuja profundidade relativa muda —
e que o R100 de `mlUserProducts.ts` **depende de `mlPayload.ts` conservar seu nome**.

---

## 10. Autorização

**A abertura da Release 010 está formalmente AUTORIZADA.**

| Item | Valor |
|---|---|
| **Release** | 010 |
| **Tipo** | **Refatoração** *(Padrão de Release Engineering §3)* |
| **Responsabilidade** | R12 — exclusivamente |
| **Natureza definitiva da migração** | **MOVIMENTO INTEGRAL DE QUATRO ARQUIVOS** |
| **Padrão probatório** | **`git mv`** para os quatro — Classe A com R100, Classe B com similaridade explicada |
| **Origem** | `src/lib/marketplaces/` — `mlUserProducts.ts`, `mlPayload.ts` e seus dois testes |
| **Destino** | `src/modules/integration/domain/` |
| **Consumidores a alterar** | **3** — apenas linha de import, preservando a convenção de cada um |
| **Linha de base** | 16 testes · suíte 231 · build verde |
| **Próxima fase** | Protocolo, **Fase 2** |

### 10.1 Evidências que deverão ser produzidas durante a Release 010

1. **Rename registrado para os quatro arquivos** — `git mv`, nunca copiar-e-apagar.
2. **R100 para `mlUserProducts.ts` e `mlUserProducts.test.ts`** — prova de que nenhum byte
   mudou. **Se não for 100%, interromper**: significa que algo além do movimento ocorreu.
3. **Similaridade de `mlPayload.ts` e `mlPayload.test.ts` explicada linha a linha** —
   exibir o diff completo, demonstrando que a diferença é **exclusivamente** de caminho de
   import.
4. **SHA-256 dos quatro arquivos antes e depois** — evidência independente da similaridade,
   conforme o princípio de que *"as evidências devem ser independentes entre si"*.
   Para os arquivos da Classe B, o hash **mudará**; a diferença deve corresponder às linhas
   exibidas em (3).
5. **Assinatura pública conservada** — 4 + 3 = 7 exports, nominalmente idênticos.
6. **Diff dos 3 consumidores restrito a import**, preservando alias e extensão de cada um.
7. **16 testes e suíte 231** antes e depois, número a número.
8. **Build íntegro** antes e depois.
9. **Auditoria do Commit** com inspeção do **conteúdo commitado** dos três consumidores.

### 10.2 Alertas registrados antecipadamente

1. **O incidente E1 ocorreu duas vezes** — Releases 003 e 008 —, sempre por `git add`
   referenciando caminhos de origem já movidos. O staging deve indexar **apenas caminhos
   existentes**, verificados um a um.
2. **O import morto de `Produto`** *(achado O4)* precisará ser reapontado, sob pena de o
   build quebrar. Removê-lo excederia o escopo do movimento.
3. **Nomes de arquivo** — a decisão é da Fase 3, mas renomear `mlPayload.ts` custa o R100
   de `mlUserProducts.ts`. A consequência probatória deve ser declarada se a renomeação for
   escolhida.
4. **Regra de reclassificação** — *"se for necessário alterar comportamento para concluir,
   deixa de ser refatoração"*.

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
| **Natureza determinada** | **Movimento integral de 4 arquivos** |
| **Padrão probatório** | **`git mv` — R100 em 2, similaridade explicada em 2** |
| Bloqueadores registrados | **0** |
| Constatações registradas sem bloquear | **7** |
| **ELEGÍVEL** | **SIM** |
