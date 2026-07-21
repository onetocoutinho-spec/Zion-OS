# Registro da Release 015 — Institucionalização da Linha de Base da R12

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Institucionalizar a linha de base da responsabilidade **R12 — Montagem do payload no
formato do canal**, removendo o bloqueador operacional **B1** antes da Pré-Abertura da
Release 010.

**Nenhuma migração arquitetural foi realizada.** Nenhum arquivo de produção foi alterado.

- **Release:** 015 · **Tipo:** Documentação / Engenharia · **Data:** 21 de julho de 2026
- **Linha principal antes:** `cf4b9fe` · **depois:** `5a482fd`
- **Branch:** `docs/release-015-linha-de-base-r12` · **Commit:** `db3486e`
- **Volume:** 4 arquivos — 3 adições, 1 modificação

**Precedente aplicado.** É a segunda vez que o padrão da **Release 014** é executado: a
Pré-Abertura da Release 008 reprovou por **B1** — linha de base existente na árvore de
trabalho, ausente do repositório — e a lição virou procedimento. Desta vez a
institucionalização ocorre **antes** da Pré-Abertura, não depois de uma reprovação.

---

## 2. Artefatos institucionalizados

| Arquivo | Natureza | Conteúdo |
|---|---|---|
| `src/lib/marketplaces/mlPayload.test.ts` | **A** | **8 testes** — `listingTypeId` e `montarItemML` |
| `src/lib/marketplaces/mlUserProducts.test.ts` | **A** | **8 testes** — `montarItensUserProducts` |
| `docs/zion-os/engineering/linha-de-base-r12.md` | **A** | Registro da construção: delimitação, superfície comportamental, projeto, execução, mutação, limitações, achados e parecer |
| `docs/zion-os/engineering/plano-executivo-refatoracao.md` | **M** | Exclusivamente R12 |

### 2.1 O que a linha de base protege

R12 é a **única responsabilidade do backlog que atravessa dois arquivos**. A linha de base
protege a **responsabilidade**, não os arquivos: **16 testes** cobrindo os **7 símbolos
públicos** — `montarItensUserProducts`, `montarItemML`, `listingTypeId`,
`EMPTY_GTIN_REASON_ID`, `OpcoesUserProducts`, `VariacaoUP`, `OpcoesPayloadML`.

Incluídos os **dois invariantes centrais** que distinguem os modelos do canal:

- `montarItensUserProducts` → **`family_name`, nunca `title`**;
- `montarItemML` → **`title` truncado em 60, nunca `family_name`**.

### 2.2 Decisão de estrutura registrada

**Dois arquivos de teste, e não um** — deliberadamente. A decisão sobre o tipo da migração
de R12 (movimento integral, extração ou híbrido) pertence à **Pré-Abertura da Release
010**. Manter os testes alinhados à estrutura de arquivos atual permite que cada um
acompanhe seu código qualquer que seja a divisão escolhida; um arquivo único presumiria
que R12 migra como bloco indivisível.

**Esta release não decidiu o tipo da futura migração.**

---

## 3. Evidências

| # | Evidência | Resultado |
|---|---|---|
| **EV1** | `mlPayload.test.ts` | **8 tests · 8 pass · 0 fail** |
| **EV2** | `mlUserProducts.test.ts` | **8 tests · 8 pass · 0 fail** |
| **EV3** | Suíte completa | **231 tests · 231 pass · 0 fail · 0 skipped** — era 215 |
| **EV4** | Build | **`✓ Compiled successfully in 14.7s`**, exit 0 |
| **EV5** | Arquivos de produção alterados | **0** |
| **EV6** | `mlPayload.ts` — hash vs `origin/master` | **IDENTICO** |
| **EV7** | `mlUserProducts.ts` — hash vs `origin/master` | **IDENTICO** |
| **EV8** | Detecção de regressão *(produzida na engenharia da linha de base)* | **14 de 14 mutações** |
| **EV9** | **Reprodução por auditor** | Clone limpo em `db3486e`, **0 não rastreados**: ambos os testes presentes, **16/16** |
| **EV10** | Artefatos normativos alterados | **0** — Protocolo, Checklist, ADRs, RFC, Constituição, Organização, Módulos |
| — | Pós-merge | escopo preservado (3 `A` + 1 `M`); 0 conflitos; local == remoto; árvore limpa |

**Sobre EV9 — a evidência que encerra o bloqueador.** As demais mostram que a release fez o
que declarou. Apenas esta demonstra que **B1 deixou de existir**: o teste foi executado num
clone independente, sem acesso à árvore de trabalho que originalmente continha os arquivos.

**Sobre EV6 e EV7 — produção byte a byte idêntica.** Comparar o hash de árvore de cada
arquivo de implementação antes e depois é prova mecânica e não interpretável de que a
construção da linha de base não tocou o comportamento.

---

## 4. Auditoria do Commit

Executada conforme a **Fase 4 do Protocolo**.

| Verificação | Resultado |
|---|---|
| Arquivos esperados / presentes | 4 / **4** |
| Staging composto só por caminhos existentes | **sim** — 4 de 4 verificados antes; exit 0 |
| Ausentes | **0** |
| Excedentes | **0** |
| Arquivos de produção no commit | **0** |
| Diff compatível com o escopo | **`A A A M`** |
| Árvore consistente com o commit | **0** pendências |

**APROVADA — 7 de 7, na primeira execução.** Nenhuma recorrência do incidente **E1**.

---

## 5. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Escopo restrito | 4 arquivos, todos declarados | **APROVADO** |
| 2 | Nenhuma alteração de produção | 0 em `src/` fora de `.test.` | **APROVADO** |
| 3 | `mlPayload.ts` inalterado | hash idêntico | **APROVADO** |
| 4 | `mlUserProducts.ts` inalterado | hash idêntico | **APROVADO** |
| 5 | Documentação consistente | `linha-de-base-r12.md` não cita artefato não rastreado; a estratégia do Grupo B já é rastreada desde a Release 014 | **APROVADO** |
| 6 | Plano Executivo consistente | 3 hunks, todas de R12; **0** outras responsabilidades | **APROVADO** |
| 7 | Protocolo, Checklist, ADRs e RFC intactos | 0 arquivos tocados | **APROVADO** |
| 8 | Nenhuma responsabilidade movida | 0 | **APROVADO** |
| 9 | Build e testes | `✓ 14.7s` · 16/16 · 231/231 | **APROVADO** |
| 10 | Reproduzível por auditor | clone limpo, 0 não rastreados, 16/16 | **APROVADO** |

**APROVADO — 10 de 10.**

---

## 6. Merge

| Verificação | Resultado |
|---|---|
| Conflitos | **0** |
| Commit final | `5a482fd` |
| Sincronização local / remota | local == `origin/master` |
| Árvore limpa | **0** pendências em `src/` e `docs/zion-os/` |
| Escopo preservado | 3 `A` + 1 `M` |

---

## 7. Atualização do Plano Executivo

Volume: **+13 / −11**. Três hunks, **todas de R12**.

**Entrada de R12:**

| Campo | Antes | Depois |
|---|---|---|
| Estado | `Não iniciada` · Release prevista 010 | `Não iniciada` · Release prevista 010 · **Categoria A** |
| Motivo de bloqueio | *"linha de base **parcial** — `mlUserProducts.ts` tem testes, `mlPayload.ts` **não**"* | **removido** |
| Pré-requisitos | *"linha de base para `mlPayload.ts`"* | **CONCLUÍDO (Release 015)** — 16 testes, 7 símbolos, mutação 14/14 |
| Evidências mínimas | *"linhas de base de ambos os arquivos"* | *"**disponíveis**"* |

**Quadro Executivo:**

| Antes | Depois |
|---|---|
| `Não iniciada \| Linha de base parcial \| 010 \| Aguardando preparação \| Criar linha de base p/ mlPayload` | `Não iniciada \| Nenhum \| 010 \| Linha de base pronta (Release 015) \| Executar Pré-Abertura` |

**Tabela *Linha de base disponível* — duas linhas, ambas de arquivos que hoje implementam
apenas R12:**

| Arquivo | Antes | Depois |
|---|---|---|
| `mlUserProducts.ts` | **SIM** (9 testes) | **SIM** (8 testes — R12, Release 015) |
| `mlPayload.ts` | **NÃO** | **SIM** (8 testes — R12, Release 015) |

**Verificado:** responsabilidades no diff além de R12: **0**. As linhas de R13 e R15
aparecem apenas como contexto.

---

## 8. Exceções e achados registrados

**E1 — Linha da tabela de linha de base referente a R10 permanece desatualizada.**
*Constatação:* a tabela *Linha de base disponível* ainda registra
`` `tabelasMedidas.ts` | **NÃO** ``. Essa linha tornou-se falsa na **Release 014**, que
institucionalizou 14 testes para R10.
*Decisão:* **não corrigida.** A linha pertence a **R10**, e o escopo desta release veda
alterar outras responsabilidades.
*Destino:* registrado para deliberação. Mesma disciplina aplicada ao achado **E3** da
Release 008, quando a entrada de R13 foi deixada desatualizada por restrição de escopo.

**A1 — Import não utilizado em `mlPayload.ts`.**
*Constatação:* a linha 12 declara `import type { Produto } from "../types";`, e `Produto`
não é referenciado em nenhum outro ponto do arquivo.
*Decisão:* **não corrigido** — removê-lo alteraria produção.
*Destino:* candidato natural à Release 010, que tocará o arquivo.

**A2 — Literal `"17055160"` duplicado.**
*Constatação:* definido como `EMPTY_GTIN_REASON_ID` em `mlUserProducts.ts` l. 21 e repetido
*hardcoded* em `mlPayload.ts` l. 87.
*Decisão:* **não corrigido** — unificá-los é alteração de implementação.
*Cobertura:* os testes assertam o valor **nos dois caminhos**, de modo que uma divergência
futura entre eles seria detectada.

**A3 — `VariacaoUP` é consumido por R13, já migrada.**
*Constatação:* `modules/publication/domain/composicaoConteudo.ts` importa `VariacaoUP` de
`lib/marketplaces/mlUserProducts.ts` — consequência declarada da Release 009.
*Relevância registrada:* quando R12 migrar, haverá **três** importadores a reapontar, e não
os dois consumidores de produção que o Mapeamento registra.

**E2 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável —
hashes, contagens, execução em clone independente.

**Observação factual:** permanecem não rastreados na árvore `platform/` (projeto congelado),
`docs/compiler/`, `docs/product/`, `docs/representation/`, ADR-003 e ADR-005 — todos alheios
a esta release e já registrados em execuções anteriores.

---

## 9. Commit

| Item | Valor |
|---|---|
| Commit da release | **`db3486e`** |
| Merge | `5a482fd` |
| Autor | `onetocoutinho-spec` |
| Tipo declarado | **Documentação / Engenharia** |

---

## 10. Resultado final

- **Integração técnica:** concluída. Auditoria aprovada na primeira execução; gates
  verificados; merge preservou o histórico; reversão possível.
- **Integração documental:** concluída. O Plano Executivo reflete o estado real; nenhum
  documento existente contradiz o estado resultante.
- **Encerramento operacional:** concluído. Três achados e duas exceções registrados;
  nenhum silencioso.

**Release 015 — CONCLUÍDA.**

**Bloqueador B1 — ELIMINADO para R12.**

### Critérios de sucesso

| Critério | Resultado |
|---|---|
| Artefatos da linha de base versionados | **SIM** — commit `db3486e` |
| Produção byte a byte idêntica | **SIM** — hash idêntico nos dois arquivos |
| Build verde | **SIM** — `✓ 14.7s` |
| Suíte completa verde | **SIM** — 231/231 |
| Auditoria aprovar | **SIM** — 7/7 |
| Integration Review aprovar | **SIM** — 10/10 |
| Merge concluído | **SIM** — 0 conflitos |
| Plano Executivo atualizado | **SIM** |
| Registro oficial produzido | **SIM** — este documento |

---

## 11. Estado do backlog

| Grupo | Situação |
|---|---|
| **Concluídas** | **R9** (003) · **R11** (007) · **R10** (008) · **R13** (009) |
| **Grupo B — categoria A** | **R12** → Release 010 — linha de base pronta |
| **Grupo B — categoria C** | R15 → 011 · R2 → 012 |
| **Grupo C** | 8 responsabilidades, bloqueadas pela validação operacional em produção |
| **Grupo D** | R5 e R16, sem destino arquitetural |

**A Release 010 deixa de estar bloqueada por ausência de linha de base.**

**Próxima ação prevista:** **Pré-Abertura da Release 010** para R12. Deverá executar os 17
critérios do Checklist na íntegra e, entre outras determinações, **decidir o tipo da
migração** — questão que esta release deliberadamente não decidiu e que é inédita no
backlog: `mlUserProducts.ts` contém **apenas R12**, enquanto `mlPayload.ts` contém R12
**e mais nada**. Ambos os arquivos são integralmente de R12, o que pode configurar
**movimento integral de dois arquivos** em vez de extração — determinação que cabe à
Pré-Abertura, por evidência própria.

**Pendências que permanecem em aberto:** validação operacional da reutilização de guias
(bloqueia as 8 do Grupo C); remoção da rota `/api/ml/diagnostico-guias`; consolidação dos
ADR-003, ADR-005 e ADR-006 em `governance/`; atualização do cabeçalho da RFC-001; linha
`tabelasMedidas.ts` da tabela de linha de base (**E1** desta release); import não utilizado
e literal duplicado em `mlPayload.ts` (**A1** e **A2**).
