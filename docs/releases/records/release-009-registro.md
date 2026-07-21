# Registro da Release 009 — Extração da R13 para Publication/domain

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Extrair a responsabilidade **R13 — Composição do conteúdo pretendido** de
`lib/marketplaces/mlUserProducts.ts` para `modules/publication/domain/`, preservando
integralmente comportamento, contratos e **a identidade dos símbolos compartilhados**.

**Migração mais complexa executada até aqui.** Risco **Alto** e complexidade **Alta**
registrados no Mapeamento, por exigir **dividir um arquivo entre dois módulos** mantendo a
outra responsabilidade intacta.

- **Release:** 009 · **Tipo:** **Refatoração** · **Data:** 21 de julho de 2026
- **Linha principal antes:** `0b8357d` · **depois:** `0419d8d`
- **Branch:** `refactor/release-009-r13-composicao-conteudo` · **Commit:** `2efc899`
- **Pré-Abertura:** parecer `ELEGÍVEL`, 17/17 critérios, 0 bloqueadores, 10 constatações

**Correção de caminho registrada.** O escopo da missão indicava a origem como
`src/lib/ml/mlUserProducts.ts`. O caminho real, verificado, é
`src/lib/marketplaces/mlUserProducts.ts`. A execução seguiu o caminho verificado.

---

## 2. Responsabilidade extraída

**Cinco símbolos públicos**, de `mlUserProducts.ts` para
`modules/publication/domain/composicaoConteudo.ts`:

| Símbolo | Natureza |
|---|---|
| `montarBundleUserProducts` | função — a responsabilidade |
| `BundleUserProducts` | interface — contrato de saída |
| `ResultadoBundle` | union type — desfecho |
| `GENERO_ID` | constante de value-ids |
| `FOOTWEAR_TYPE_ID` | constante de value-ids |

**Dois blocos contíguos** foram extraídos: linhas **23–37** (constantes) e **125–288**
(tipos, helpers e função).

---

## 3. Helpers movidos

Seis funções internas, **verificadas linha a linha** como exclusivas de R13 — nenhuma é
usada por `montarItensUserProducts` (R12):

| Helper | Usado nas linhas | Dentro de R13? |
|---|---|---|
| `semAcento` | 173, 175, 177, 185, 198 | sim |
| `paraNumero` | 256, 257 | sim |
| `fichaValor` | 220, 223, 228, 230 | sim |
| `generoParaId` | 223 | sim |
| `footwearParaId` | 228 | sim |
| `primeiroNumero` | 269 | sim |

---

## 4. Símbolos compartilhados preservados

**Nenhum foi duplicado.** Verificado no commit: cada um possui **exatamente uma**
definição no projeto.

| Símbolo | Onde permaneceu | Tratamento |
|---|---|---|
| **`VariacaoUP`** | origem — `mlUserProducts.ts` | **Importado** pelo novo módulo, conforme decidido na Pré-Abertura. Permanece **único** |
| `LinhaGuiaTamanho` | `mercadolivre.ts` | Importado como tipo. `mercadolivre.ts` **não foi tocado** — hash idêntico |
| `OpcoesUserProducts` | origem | Intacto — pertence a R12 |
| `EMPTY_GTIN_REASON_ID` | origem | Intacto — usado por R12 |
| `montarItensUserProducts` (R12) | origem | Intacto |

**Decisão registrada sobre `GENERO_ID` e `FOOTWEAR_TYPE_ID`.** A Fase 2 revelou que ambos
aparecem nas linhas 63 e 65, **dentro de `OpcoesUserProducts` (R12)** — o que a Pré-Abertura
não havia registrado. Investigado: são **comentários de documentação**
(`/** GENDER value_id (ver GENERO_ID). */`), **não uso de código**. Em código, as duas
constantes são usadas exclusivamente pelos helpers de R13. Migraram, conforme a autorização
da Pré-Abertura. As duas referências em comentário permanecem — ver §7, achado **A2**.

---

## 5. Evidências

### 5.1 Linha de base (Fase 2) e validação (Fase 4)

| Medida | Antes | Depois | Resultado |
|---|---|---|---|
| Commit | `0b8357d` | `0419d8d` | — |
| **SHA-256 bloco A** *(constantes)* | `82e9a0c7…f32e` | `82e9a0c7…f32e` | **IDÊNTICO** |
| **SHA-256 bloco B** *(tipos, helpers, função)* | `b6762d35…3931` | `b6762d35…3931` | **IDÊNTICO** |
| Assinatura pública total | **9 exports** | **4 origem + 5 destino = 9** | **CONSERVADA** |
| Testes específicos R13 | 7 · 7 pass · 0 fail | 7 · 7 pass · 0 fail | **IDÊNTICO** |
| Suíte completa | 215 · 215 pass · 0 fail | 215 · 215 pass · 0 fail | **IDÊNTICO** |
| Build | `✓ 43s`, exit 0 | `✓ 32.0s`, exit 0 | **ÍNTEGRO** |
| Consumidores | 2 | 2 | **IDÊNTICO** |

### 5.2 Evidências substitutivas — migração sem `git mv`

O Protocolo extrai suas evidências características da Release 003, um movimento de arquivo
inteiro. R13 é **extração**: `mlUserProducts.ts` continua existindo com R12. A Pré-Abertura
definiu a evidência substitutiva; foi produzida integralmente:

| # | Evidência definida na Fase 1 | Resultado |
|---|---|---|
| **EV1** | SHA-256 idêntico por bloco extraído | **2 de 2 idênticos** |
| **EV2** | Assinatura pública preservada | 9 = 4 + 5, símbolos nominalmente idênticos |
| **EV3** | Diff da origem restrito a **remoção** | `0 183` — **zero inserções** |
| **EV4** | Diff dos consumidores restrito a import | `publicacaoML.ts` `1 1`; `publicar/route.ts` `2 4` |
| **EV5** | Testes acompanham o código; total preservado | 7 migrados; suíte permanece **215** |
| **EV6** | Build íntegro antes e depois | exit 0 em ambos |

**Sobre EV3 — a evidência mais forte desta release.** O arquivo de origem registra
`0 183`: **cento e oitenta e três remoções e nenhuma inserção**. Prova mecânica de que
nenhuma linha de R12 foi alterada, reescrita ou reindentada — apenas linhas de R13 saíram.

**Evidência adicional não prevista:** o arquivo de teste, sendo **100% de R13**, pôde ser
movido com `git mv`. O Git registrou **`R097`** — rename com 97% de similaridade, os 3%
correspondendo exatamente às duas linhas de import atualizadas. Não é a evidência
principal, conforme a missão determinou, mas confirma-a de forma independente.

### 5.3 Ausência de duplicação

| Símbolo | Definições no projeto após o commit |
|---|---|
| `VariacaoUP` | **1** |
| `LinhaGuiaTamanho` | **1** |
| `OpcoesUserProducts` | **1** |
| `EMPTY_GTIN_REASON_ID` | **1** |
| `montarItensUserProducts` | **1** |

### 5.4 Responsabilidades e arquivos intactos

| Item | Verificação |
|---|---|
| R9 — `normalizarTamanho.ts` | hash **idêntico** |
| R10 — `tabelasMedidas.ts` | hash **idêntico** |
| R11 — `exigenciaModeloCanal.ts` | hash **idêntico** |
| R12 — `mlPayload.ts` | hash **idêntico** |
| R7 — **`mercadolivre.ts`** | hash **idêntico** — **bloqueio de governança respeitado** |
| `publicar/route.ts` | alterado **apenas** em linhas de import |

---

## 6. Auditoria do Commit

**Nenhuma recorrência do incidente E1.** O staging foi montado com **apenas caminhos
existentes** após a extração, verificados um a um antes do `git add`, que retornou exit 0
sem qualquer `pathspec did not match`.

| Verificação | Resultado |
|---|---|
| Arquivos esperados / presentes | 5 / **5** |
| Staging composto só por caminhos existentes | **sim** — 5 de 5 verificados antes |
| Ausentes | **0** |
| Excedentes | **0** |
| Documentação no commit | **0** |
| Árvore consistente com o commit | **0** pendências em `src/` |
| **Conteúdo commitado — `publicacaoML.ts`** | novo import **1**, antigo **0** |
| **Conteúdo commitado — `publicar/route.ts`** | novo import **1**, R12 preservado **1** |
| Conteúdo commitado — origem / destino | **4** exports / **5** exports |
| Conteúdo commitado — `VariacaoUP` | **1** definição |

**APROVADA — 10 de 10, na primeira execução.**

---

## 7. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Somente R13 extraída | 5 exports no destino, todos de R13 | **APROVADO** |
| 2 | Apenas R13 deixou a origem | 9 → 4; os 5 ausentes são exatamente os de R13 | **APROVADO** |
| 3 | R12 intacta | `montarItensUserProducts` presente; `mlPayload.ts` hash idêntico; origem com `0` inserções | **APROVADO** |
| 4 | R9 intacta | hash idêntico | **APROVADO** |
| 5 | R10 intacta | hash idêntico | **APROVADO** |
| 6 | R11 intacta | hash idêntico | **APROVADO** |
| 7 | `mercadolivre.ts` intacto | hash idêntico — bloqueio respeitado | **APROVADO** |
| 8 | `VariacaoUP` único | 1 definição | **APROVADO** |
| 9 | Nenhum tipo duplicado | 5 símbolos, 1 definição cada | **APROVADO** |
| 10 | SHA-256 dos blocos | 2 de 2 idênticos | **APROVADO** |
| 11 | Assinatura conservada | 4 + 5 = 9 | **APROVADO** |
| 12 | Build e testes | `✓ 32.0s` · 7/7 · 215/215 | **APROVADO** |
| 13 | Documentação e governança | 0 arquivos em `docs/` no commit | **APROVADO** |

**APROVADO — 13 de 13.**

---

## 8. Achados e exceções

**A1 — Comentário de execução obsoleto no arquivo de teste.**
*Constatação:* a linha 2 de `composicaoConteudo.test.ts` mantém
`// Rodar: node --test src/lib/marketplaces/mlUserProducts.test.ts`.
*Decisão:* **não corrigido** — a missão veda alterar comentários; corrigi-lo reduziria a
similaridade do rename. Mesmo tratamento das Releases 003 e 008.

**A2 — Referências de documentação a constantes migradas.**
*Constatação:* `OpcoesUserProducts`, em R12, mantém
`/** GENDER value_id (ver GENERO_ID). */` e
`/** FOOTWEAR_TYPE value_id (ver FOOTWEAR_TYPE_ID). */`. Ambas as constantes agora residem
em `modules/publication/domain/composicaoConteudo.ts`.
*Decisão:* **não corrigido** — são comentários, e alterá-los está vedado.
*Impacto:* nulo sobre compilação e comportamento. Referência cruzada de documentação
apontando para outro módulo.
*Destino:* registrado para deliberação futura.

**E1 — Evidência ambígua produzida e descartada.**
*Constatação:* a primeira comparação de hash do bloco extraído acusou divergência
(`da5caf57…` vs `bc70e4e8…`). Investigada: **o método de comparação estava errado** — a
concatenação da origem não contém a linha em branco que separa os dois blocos no destino,
e a faixa de linhas do destino estava deslocada.
*Decisão:* evidência **rejeitada**; comparação refeita **bloco a bloco**, que é a forma
correta para dois blocos não contíguos na origem. Ambos **idênticos**.
*Fundamento:* *evidência ambígua não é evidência*. Oitava aplicação do princípio.

**E2 — Erro de caminho no escopo da missão.**
*Constatação:* a missão indicou a origem como `src/lib/ml/mlUserProducts.ts`; o caminho
real é `src/lib/marketplaces/mlUserProducts.ts`. Segundo desvio de caminho consecutivo no
briefing, após a Pré-Abertura da 009 indicar destino "Catalog" em vez de Publication.
*Decisão:* execução conduzida sobre o caminho verificado no repositório.

**E3 — Comando `sed` falhou por conflito de delimitador.**
*Constatação:* a atualização da linha do Quadro Executivo falhou com
`unknown option to 's'` — o padrão continha `|`, usado como delimitador.
*Decisão:* detectado pela conferência do diff; refeito com edição direta. Sem impacto.

**E4 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável.

---

## 9. Merge

| Verificação | Resultado |
|---|---|
| Conflitos | **0** |
| Commit final | `0419d8d` |
| Sincronização local / remota | local == `origin/master` |
| Árvore limpa | **0** pendências em `src/` |
| Escopo preservado | 1 `A` + 1 `R097` + 3 `M` |
| Verificação pós-merge | 7/7 reexecutados na linha principal |

---

## 10. Atualização do Plano Executivo

Volume: **+16 / −15**.

**Entrada de R13** — alterada integralmente:

| Campo | Antes | Depois |
|---|---|---|
| Estado | **Não iniciada** | **CONCLUÍDA** ✅ |
| Release | prevista 009 | **executada 009** |
| Destino | `modules/publication` — domínio | `modules/publication/domain/composicaoConteudo.ts` ✔ |
| Pré-requisitos | *"R10 migrada"* | **CONCLUÍDOS** — R9 (003) e R10 (008) |
| Evidências mínimas | *"9 testes"* | **7 testes** — corrigido; a Release 007 migrou 2 |
| Quadro Executivo | `Depende de R10 · Aguardando R10 · Aguardar Release 008` | `✅ Concluída · — · Migrada · Nenhuma` |

**Referência cuja veracidade dependia da conclusão de R13** — atualizada conforme a Fase 7
autoriza:

- **R12**, campo *Dependências*: de *"**R13** (recomendável, para não dividir o mesmo
  arquivo duas vezes)"* para *"**R13** — satisfeita (Release 009)"*.

**Resumo do backlog:** de *3 concluídas · 4 aguardando* para **4 concluídas · 3
aguardando**.

**Verificado:** exatamente **uma** linha do Quadro Executivo alterada. Responsabilidades no
diff além de R13 e R12: **0**. Campos protegidos com contagem idêntica — `Release prevista:
010`, `Risco: Alto`, `Complexidade: Alta`, `dividir de R11/R12`.

---

## 11. Resultado final

- **Integração técnica:** concluída. Auditoria aprovada na primeira execução; gates
  verificados; merge preservou o histórico; verificação pós-merge reproduziu o resultado.
- **Integração documental:** concluída. O Plano Executivo reflete o estado resultante.
- **Encerramento operacional:** concluído. Dois achados e quatro exceções registrados;
  nenhum silencioso.

**Release 009 — CONCLUÍDA.**

**R13 — EXTRAÍDA.** O módulo **Publication** passa a conter **duas** responsabilidades de
domínio: R9 (canonização de tamanhos) e R13 (composição do conteúdo pretendido).

### Critérios de sucesso

| Critério | Resultado |
|---|---|
| R13 extraída integralmente | **SIM** — 5 símbolos públicos + 6 helpers |
| Apenas R13 deixou a origem | **SIM** — origem com 0 inserções |
| `VariacaoUP` permaneceu único | **SIM** — 1 definição |
| Nenhum símbolo compartilhado duplicado | **SIM** — 5 verificados |
| SHA-256 confirma preservação | **SIM** — 2 blocos idênticos |
| Build verde | **SIM** — `✓ 32.0s` |
| Suíte completa verde | **SIM** — 215/215 |
| 7 testes específicos verdes | **SIM** |
| Auditoria aprovar | **SIM** — 10/10, sem E1 |
| Integration Review aprovar | **SIM** — 13/13 |
| Merge concluído | **SIM** — 0 conflitos |
| Plano Executivo atualizado | **SIM** |
| Registro oficial produzido | **SIM** |

---

## 12. Estado do backlog

| Grupo | Situação |
|---|---|
| **Concluídas** | **R9** (003) · **R11** (007) · **R10** (008) · **R13** (009) |
| **Grupo B restante** | R12 → 010 · R15 → 011 · R2 → 012 |
| **Grupo C** | 8 responsabilidades, bloqueadas pela validação operacional em produção |
| **Grupo D** | R5 e R16, sem destino arquitetural |

**Ocupação dos módulos:** `publication/domain` com 2 responsabilidades; `catalog/domain` e
`integration/domain` com 1 cada. `operation-center` permanece vazio.

**Próxima responsabilidade prevista: R12 — Release 010.** Sua dependência registrada (R13)
está satisfeita. Permanece o pré-requisito próprio: **linha de base para `mlPayload.ts`**,
que não possui teste. Conforme a análise do Grupo B, R12 está em **categoria C** — sem
cobertura identificável —, o que exige uma construção de linha de base antes da
Pré-Abertura, nos moldes da Release 014.

**Observação registrada, sem interpretação:** após esta release, `mlUserProducts.ts` contém
**apenas R12** — 105 linhas, 4 exports. A migração de R12 esvaziaria o arquivo. **Não foi
avaliado** se isso configura movimento de arquivo inteiro ou extração; a Pré-Abertura da
Release 010 deverá determiná-lo por evidência.
