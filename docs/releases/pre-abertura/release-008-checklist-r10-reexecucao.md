# Checklist de Elegibilidade — R10 · Pré-Abertura da Release 008 (reexecução)

> **Instância preenchida** do `engineering/checklist-elegibilidade-migracao.md`.
> **Reexecução integral** após a Release 014. Terceira aplicação prática do instrumento.
>
> **Independência declarada.** Nenhuma evidência desta execução foi reutilizada da
> Pré-Abertura anterior. Todos os testes, builds, buscas de consumidor e hashes foram
> produzidos novamente sobre o commit `049f2cf`. As divergências encontradas estão
> investigadas e resolvidas na §6, **antes** do parecer.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **Responsabilidade** | **R10** — Conhecimento de medidas por marca |
| **Release** | **008** |
| **Arquivo de origem** | `src/lib/data/tabelasMedidas.ts` — 290 linhas · blob `fde18b7c7eba` |
| **Destino arquitetural** | `modules/catalog` — verdade de produto |
| **Consumidores** | **4**, obtidos por busca: `cliente/medidas/page.tsx` · `cliente/produtos/page.tsx` · `lib/contexto.ts` · `lib/marketplaces/mlUserProducts.ts` |
| **Estado no Plano Executivo** | **Não iniciada** · Bloqueio: **Nenhum** · Situação: *"Linha de base pronta (Release 014)"* · Próxima ação: *"Executar Pré-Abertura"* |
| **Commit atual** | `049f2cfa23b14943c7d4d12780d47d023e634649` · `master` == `origin/master` |
| **Linha de base institucionalizada** | **SIM** — `src/lib/data/tabelasMedidas.test.ts`, **rastreado**, blob `0d27260f9f9c`, idêntico a `HEAD` |

**Árvore de trabalho:** `0` pendências em `src/` e `docs/zion-os/`.

---

## 2. Verificação de elegibilidade — os 17 critérios

| # | Critério | Resultado | Evidência produzida nesta execução | Origem |
|---|---|---|---|---|
| **C1** | Identificada no Mapeamento | **SIM** | §2: finalidade, arquivo *(290 linhas)*, funções *(`medidasDaMarca` e tabelas de referência)*, 5 dependências recebidas, destino **Catalog**, acoplamento **médio-alto**, prioridade **média**. §7 matriz, l. 319 | Protocolo, Fase 1 |
| **C2** | Destino arquitetural definido | **SIM** | Matriz l. 319: `Catalog` · estratégia `Mover arquivo inteiro`. §2: *"Módulo destino: **Catalog** (verdade de produto)"* | Mapeamento §7 |
| **C3** | Módulo de destino existe | **SIM** | `src/modules/catalog/` com as 5 camadas — `domain`, `application`, `ports`, `adapters`, `infrastructure` — e `README.md` presente | Plano Executivo, *Fontes de classificação* |
| **C4** | Prevista no Plano Executivo | **SIM** | Grupo B; Roadmap *"Release 008 — R10 (Medidas por marca)"*; Quadro Executivo l. 300 | Plano Executivo |
| **C5** | Estado permite migração | **SIM** | Quadro l. 300: `Estado: Não iniciada` · `Bloqueio: Nenhum` · `Próxima ação: Executar Pré-Abertura`. Entrada de R10: *"**Pré-requisito — CONCLUÍDO (Release 014)**"* | Plano Executivo |
| **C6** | **Sem bloqueio de governança** | **SIM** | Redação literal relida: *"bloqueadas as etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e `publicar/route.ts`"*. R10 reside em `src/lib/data/tabelasMedidas.ts`. Verificado por busca: **0 ocorrências** dos dois arquivos nomeados entre os consumidores de R10 | Protocolo, Fase 1 — critério de aprovação |
| **C7** | Dependências identificadas | **SIM** | Plano: *"Dependências: nenhuma. **Bloqueia:** R13"*. Matriz: *"Nenhuma de saída"*. Confirmado no arquivo: **zero imports** | Mapeamento §7; Plano Executivo |
| **C8** | Consumidores por **busca no código** | **SIM** | `grep -rn "data/tabelasMedidas"` em `src/` + verificação cruzada símbolo a símbolo. **4 consumidores de produção**, mapeados por símbolo — ver §3.2. `PADRAO_BR`, `TABELAS_MARCA` e `COMO_MEDIR` **não possuem consumidor externo** | Protocolo, Fase 1 — evidência obrigatória nº 2 |
| **C9** | Estratégia definida | **SIM** | Matriz: *"Mover arquivo inteiro"*. Plano: *"mover arquivo inteiro; atualizar 5 importadores"* | Mapeamento §7; Plano Executivo |
| **C10** | **Linha de base mensurável** | **SIM** | `tabelasMedidas.test.ts` **rastreado** (`git ls-files` confirma), blob `0d27260f9f9c` idêntico a `HEAD`. Execução nova: **14 tests · 14 pass · 0 fail · 0 skipped** | Protocolo, Fase 1 — critério de aprovação |
| **C11** | Testes verdes | **SIM** | R10: 14/14. Suíte completa, execução nova: **215 tests · 215 pass · 0 fail · 0 skipped** | Protocolo, Fase 2; Padrão RE, G2 |
| **C12** | Build íntegro | **SIM** | Execução nova: **`✓ Compiled successfully in 25.9s`**, exit 0 | Protocolo, Fase 2; Padrão RE, G1 |
| **C13** | Evidências mínimas disponíveis | **SIM** | Plano: *"linha de base criada e verde antes da migração; 5 consumidores atualizados; build"*. As três obteníveis — a primeira já demonstrada | Plano Executivo — *Evidências mínimas* |
| **C14** | Riscos conhecidos | **SIM** | **Médio** — Matriz l. 319 e Plano: *"5 consumidores, três deles telas"* | Mapeamento §7; Plano Executivo |
| **C15** | Complexidade conhecida | **SIM** | **Média** | Plano Executivo |
| **C16** | Nenhuma decisão pendente | **SIM** | ADR-007: **APROVADO**. ADR-008: **APROVADO**. RFC-001: ver §6.2 — **não alcança R10**; a própria RFC nomeia **Catalog** entre os módulos que *"permanecem implementáveis"* | Governança §5, §10 |
| **C17** | Uma responsabilidade por migração | **SIM** | Escopo: exclusivamente R10. Arquivo folha; nenhum símbolo de outra responsabilidade reside nele | Protocolo, princípios 4 e 5 |

**Resultado: 17 SIM · 0 NÃO · 0 NÃO APLICÁVEL.**

---

## 3. Verificação do Protocolo — Fase 1

### 3.1 Execução

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| **P1** | Localizada no Mapeamento — arquivo, funções, módulo destino | **Sim** | §2 e §7 relidos nesta execução |
| **P2** | Bloqueios confrontados **pela redação exata** | **Sim** | Bloqueio relido integralmente. Objeto: `mercadolivre.ts` e `publicar/route.ts`. R10 vive em `lib/data/`. Interseção com os consumidores: **0**. Conclusão por leitura |
| **P3** | Existência de linha de base verificada | **Sim** | Arquivo **versionado**; 14/14 verdes; reproduzido em clone independente — §4 |
| **P4** | **Todos** os consumidores por busca no código | **Sim** | Busca exaustiva + verificação cruzada por símbolo. Nenhum obtido de memória |

### 3.2 Consumidores — mapeamento por símbolo

| Símbolo público | Consumidor externo | Forma do import |
|---|---|---|
| `MODELOS_PADRAO` | `src/app/cliente/medidas/page.tsx` | alias `@/`, sem extensão |
| `montarTabelaMedidas` | `src/app/cliente/produtos/page.tsx` | alias `@/`, sem extensão |
| `montarTabelaMedidas` | `src/lib/contexto.ts` | relativo `./data/…`, **sem** extensão |
| `medidasDaMarca` | `src/lib/marketplaces/mlUserProducts.ts` | relativo `../data/…`, **com** extensão `.ts` |
| `PADRAO_BR` · `TABELAS_MARCA` · `COMO_MEDIR` | **nenhum** | — |

**Convenção a preservar na Fase 3:** três formas distintas de import entre quatro
consumidores. Cada arquivo deve manter a sua — o Protocolo exige *"preservar as convenções
do arquivo consumidor: forma do caminho (relativo ou alias) e extensão explícita quando o
projeto a exigir."*

### 3.3 Evidências obrigatórias

| # | Evidência | Registro |
|---|---|---|
| **E1** | Citação do bloqueio e por que **não** alcança R10 | *"bloqueadas as etapas que movem, dividem ou reorganizam `mercadolivre.ts` e `publicar/route.ts`"*. R10 reside em `src/lib/data/tabelasMedidas.ts` — arquivo não nomeado. Seus 4 consumidores são duas telas, `contexto.ts` e `mlUserProducts.ts`; **nenhum é um dos dois arquivos bloqueados**, verificado por contagem: 0 |
| **E2** | Lista de consumidores **obtida por busca** | Tabela §3.2 — exaustiva, por símbolo |
| **E3** | Confirmação de linha de base | **Existe, é mensurável e está versionada.** 14 testes, 9 símbolos públicos cobertos |

### 3.4 Tipo da migração e compatibilidade com a Fase 3

**Tipo: movimento de arquivo inteiro** — o mesmo formato da Release 003 (R9), e distinto da
Release 007 (R11), que foi extração de símbolos.

**Compatibilidade demonstrada, não presumida.** Executou-se um **ensaio de `git mv` em
clone descartável**, sobre o commit `049f2cf`, movendo origem e teste para
`src/modules/catalog/domain/`:

```
R100  src/lib/data/tabelasMedidas.ts       → src/modules/catalog/domain/tabelasMedidas.ts
R100  src/lib/data/tabelasMedidas.test.ts  → src/modules/catalog/domain/tabelasMedidas.test.ts

rename src/{lib/data => modules/catalog/domain}/tabelasMedidas.ts      (100%)
rename src/{lib/data => modules/catalog/domain}/tabelasMedidas.test.ts (100%)
```

| Evidência característica da Fase 3 | Situação |
|---|---|
| `git mv` — nunca copiar-e-apagar | **Aplicável** |
| Rename registrado pelo Git | **Demonstrado** — `R100` em ambos |
| **Similaridade 100%** | **Demonstrada** — não estimada |
| Migrar o teste junto com o código | **Aplicável** — o teste é rastreado e move junto, também com R100 |
| Alteração mínima nos consumidores | **Aplicável** — 4 arquivos, apenas caminho de import |

O clone foi descartado. **Nenhuma alteração foi feita no repositório.**

---

## 4. Validação da linha de base

| # | Verificação exigida | Resultado |
|---|---|---|
| 1 | Testes específicos presentes | **SIM** — `src/lib/data/tabelasMedidas.test.ts` |
| 2 | Testes executam | **SIM** |
| 3 | Todos aprovados | **14 tests · 14 pass · 0 fail · 0 skipped** |
| 4 | Build verde | **`✓ Compiled successfully in 25.9s`**, exit 0 |
| 5 | Suíte completa verde | **215 tests · 215 pass · 0 fail · 0 skipped** |
| 6 | Arquivo versionado | **SIM** — `git ls-files --error-unmatch` confirma |
| 7 | Hash consistente | Produção `fde18b7c7eba` · Teste `0d27260f9f9c` — **ambos idênticos a `HEAD`** |
| 8 | Nenhum arquivo não rastreado participa da evidência | **CONFIRMADO** — ver abaixo |

### 4.1 Prova de independência de arquivos não versionados

Um **clone independente** foi criado a partir do commit `049f2cf`, com **0 arquivos não
rastreados**. Nele:

- o arquivo de origem está presente;
- o arquivo de teste está presente;
- a Fase 2 foi reproduzida: **14 tests · 14 pass · 0 fail**.

Nenhuma evidência desta Pré-Abertura depende de conteúdo existente apenas na árvore de
trabalho. **Qualquer auditor reproduz este resultado a partir do repositório.**

---

## 5. Bloqueadores

| Categoria | Situação | Evidência objetiva |
|---|---|---|
| **Técnico** | **Ausente** | Arquivo folha, zero imports; `git mv` demonstrado com R100; 14/14 verdes; build exit 0 |
| **Arquitetural** | **Ausente** | Destino `modules/catalog` existe com as 5 camadas e README |
| **Governança** | **Ausente** | Bloqueio vigente nomeia dois arquivos; interseção com R10 e seus consumidores: **0**. Nenhum ADR pendente; RFC-001 não alcança Catalog |
| **Operacional** | **Ausente** | **B1 eliminado pela Release 014.** Arquivo de teste rastreado; linha de base reproduzível em clone limpo; Plano Executivo sem bloqueio registrado para R10 |

**Bloqueadores identificados: 0.** Declaração explícita, conforme *"nenhuma exceção
silenciosa"*.

---

## 6. Divergências em relação à execução anterior

A regra desta missão exige registrar, investigar e **resolver antes do parecer** qualquer
divergência. Quatro foram encontradas.

### 6.1 Divergências esperadas — causadas pela Release 014

| Item | Antes | Agora | Causa |
|---|---|---|---|
| Commit da linha principal | `e4bfb2a` | `049f2cf` | Releases 014 e seu registro |
| `tabelasMedidas.test.ts` | **não rastreado** | **rastreado**, blob `0d27260f9f9c` | Release 014 |
| Quadro Executivo, R10 | `Bloqueio: Sem linha de base` · `Criar linha de base` | `Bloqueio: Nenhum` · `Executar Pré-Abertura` | Release 014 |

**Resolvidas:** são precisamente o efeito declarado da Release 014. Nenhuma exige
investigação adicional.

### 6.2 Divergência que exigiu investigação — estado da RFC-001

**Constatação.** A Pré-Abertura anterior afirmou, no critério C16, *"Nenhuma RFC aberta"*.
Esta execução verificou o documento e encontrou, em seu cabeçalho:

> `- **Estado:** **ABERTA — aguardando decisão arquitetural**`

**A afirmação anterior era não verificada.** Registrado como falha de método da execução
anterior, não do repositório.

**Investigação.** O ADR-007, cujo estado é **APROVADO**, declara em seu cabeçalho:

> `- **Efeito:** encerra a RFC-001 e autoriza as alterações normativas listadas na §7`

Há, portanto, **inconsistência documental** no acervo de governança: o ADR que a delibera
está aprovado, mas o cabeçalho da RFC não foi atualizado para refletir seu encerramento.

**Resolução — e por que não afeta o parecer.** A questão é dispensável para R10, por
evidência da própria RFC. Em sua §5 — *Impacto* — ela declara:

> *"Os módulos cuja verdade não depende do ciclo de vida da Publication permanecem
> implementáveis: **Integration**, **Operation Center**, **Catalog** e **Identity &
> Access**. O que fica bloqueado é a implementação do ciclo de vida da Publication."*

**Catalog é o destino de R10** e está explicitamente entre os que **permanecem
implementáveis**. Sob qualquer das duas leituras — RFC aberta ou encerrada pelo ADR-007 —,
ela **não alcança R10**. C16 permanece **SIM**.

**Registrado, não corrigido:** a atualização do cabeçalho da RFC-001 é matéria de
governança e está fora do escopo desta missão, que proíbe alterar ADRs e documentação.
Anotado para deliberação futura.

### 6.3 Diferenças não classificadas como divergência de evidência

O tempo de build variou (`12.8s` → `25.9s`). Variação de máquina; o **desfecho** é
idêntico — compilação concluída, exit 0. Não constitui divergência de evidência.

**Idênticos entre as duas execuções, reproduzidos independentemente:** 14/14 testes de R10;
215/215 da suíte; hash de produção `fde18b7c7eba`; 4 consumidores; três formas de import.

---

## 7. Parecer

# ELEGÍVEL

**Regra de decisão aplicada**, na redação do Checklist:

> *"**ELEGÍVEL** exige `SIM` em **C6** e **C10** — os dois critérios de aprovação literais
> da Fase 1 — e ausência de qualquer bloqueador na seção 6, com as verificações
> antecipadas C11–C13 igualmente satisfeitas."*

- **C6 — SIM.** Nenhum bloqueio vigente alcança R10, por leitura da redação exata.
- **C10 — SIM.** Linha de base mensurável, versionada e reproduzível.
- **Bloqueadores — 0**, nas quatro categorias.
- **C11, C12, C13 — SIM.**

---

## 8. Justificativa

**Protocolo.** As duas condições literais de aprovação da Fase 1 estão satisfeitas.
Nenhum bloqueio vigente alcança R10 — a redação nomeia `mercadolivre.ts` e
`publicar/route.ts`, e a interseção com R10 e seus quatro consumidores é **zero**. Existe
linha de base mensurável — 14 testes verdes, versionados, reproduzíveis em clone limpo.
A conclusão veio **da leitura da redação**, não de interpretação.

**Plano Executivo.** R10 consta como `Não iniciada`, com bloqueio `Nenhum` e próxima ação
`Executar Pré-Abertura`. O pré-requisito que a detinha — *criar linha de base local* — está
registrado como **CONCLUÍDO na Release 014**.

**Checklist.** Dezessete critérios verificados nesta execução, dezessete aprovados, nenhum
copiado da execução anterior.

**Governança.** Nenhuma decisão pendente alcança R10. A única divergência encontrada — o
estado declarado da RFC-001 — foi investigada e **resolvida por evidência da própria RFC**,
que nomeia Catalog entre os módulos que permanecem implementáveis.

**O que esta reexecução acrescentou.** Duas coisas que a execução anterior não possuía:

1. **A similaridade de 100% foi demonstrada, não prevista.** O ensaio de `git mv` em clone
   descartável produziu `R100` para **ambos** os arquivos. A Fase 3 encontrará o instrumento
   probatório que o Protocolo exige — diferentemente de R11, que precisou de evidência
   substitutiva.
2. **A independência da evidência foi provada.** Clone com zero arquivos não rastreados
   reproduz a Fase 2 integralmente.

---

## 9. Autorização

**A abertura da Release 008 está formalmente AUTORIZADA.**

| Item | Valor |
|---|---|
| **Release** | 008 |
| **Tipo** | **Refatoração** *(Padrão de Release Engineering §3)* |
| **Responsabilidade** | R10 — exclusivamente |
| **Origem** | `src/lib/data/tabelasMedidas.ts` + `tabelasMedidas.test.ts` |
| **Destino** | `src/modules/catalog/domain/` |
| **Consumidores a alterar** | 4 — apenas caminho de import, preservando três convenções distintas |
| **Linha de base** | 14 testes · suíte 215 · build verde |
| **Evidência da Fase 3** | `git mv` com similaridade **100%**, já demonstrada |
| **Próxima fase** | Protocolo, **Fase 2** — estabelecimento da linha de base |

**Regra de reclassificação, registrada antecipadamente.** Para o tipo Refatoração: *"se for
necessário alterar comportamento para concluir, deixa de ser refatoração — a entrega é
interrompida e reclassificada."*

**Esta autorização não inicia a migração.** Nenhuma branch foi criada. Nenhum arquivo de
código foi alterado. Nenhum documento foi modificado nesta execução.

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
| Fase 3 · `git mv` com R100 demonstrado | ✓ |
| Independência de arquivos não versionados | ✓ |
| Bloqueadores registrados | **0** |
| **ELEGÍVEL** | **SIM** |
