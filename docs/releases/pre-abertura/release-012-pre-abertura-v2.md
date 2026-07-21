# Pré-Abertura da Release 012 — R2 · **Reexecução**

> **Segunda execução integral** do Checklist de Elegibilidade sobre R2, após a
> institucionalização do **ADR-009** pela Release 017.
>
> **Independência declarada.** Nenhuma conclusão da primeira execução foi reutilizada.
> Testes, build, hashes, buscas de consumidor, ensaio de `git mv` e leitura documental
> foram produzidos novamente sobre o commit `d6d5e65`.

---

## 1. Contexto

### 1.1 A primeira execução

A Pré-Abertura de `release-012-checklist-r2.md` produziu parecer **NÃO ELEGÍVEL** —
14 SIM · 2 NÃO · 1 não verificado — com **dois bloqueadores**:

- **C9** — *Estratégia de migração definida*: o Mapeamento registra *"Mover atrás de
  porta"*; o construto **porta** tinha zero ocorrências na arquitetura e zero
  implementações; o Plano **omitia** o campo *Estratégia* para R2.
- **C16** — *Nenhuma decisão pendente*: escolher entre os dois escopos admissíveis seria
  **criar arquitetura durante uma release de engenharia**.

### 1.2 O que foi decidido desde então

O **ADR-009 — Estratégia Arquitetural para Ports e Escopo da Responsabilidade R2** foi
aprovado e institucionalizado pela **Release 017** (commit `84331cd`, merge `10f33cb`).

### 1.3 Estado verificado nesta execução

| Item | Evidência |
|---|---|
| **HEAD** | `d6d5e65b0011e9f2d44bdfb36de6255acd4abb8f` · `master` == `origin/master` |
| **Árvore Git** | **0** pendências em `src/` e `docs/zion-os/` |
| **ADR-009** | **rastreado**, blob `==HEAD`, **Estado: APROVADO** |
| **Release 017** | `release-017-registro.md` **rastreado**, blob `==HEAD` |
| **Primeira Pré-Abertura** | **rastreada** — preservada como evidência, não apagada |
| **Linha de base** | `canalServidor.ts` SHA-256 `e2c484850a724875…` · teste `e8c642531beb01a0…` — ambos `==HEAD` |
| **Consumidores** | **5** de produção, por busca no código |
| **Dependências** | **1** — `SupabaseClient`, tipo, de **pacote**, injetado por parâmetro |
| **Testes de R2** | **12 tests · 12 pass · 0 fail** |
| **Suíte completa** | **243 tests · 243 pass · 0 fail · 0 skipped** |
| **Build** | **`✓ Compiled successfully in 38.9s`**, exit 0 |

---

## 2. Reexecução dos 17 critérios

| # | Critério | Resultado | Evidência produzida nesta execução | Origem |
|---|---|---|---|---|
| **C1** | Identificada no Mapeamento | **SIM** | §2 (finalidade, arquivo 81 linhas, funções, dependências, destino, acoplamento **alto**, prioridade **baixa**); §7 matriz l. 324 | Protocolo, Fase 1 |
| **C2** | Destino arquitetural definido | **SIM** | Matriz: `Integration / Connection (infra)`. **ADR-009 §5.3** precisa: `src/modules/integration/infrastructure/` | Mapeamento §7; ADR-009 |
| **C3** | Módulo de destino existe | **SIM** | `src/modules/integration/infrastructure/` **existe** — verificado no repositório | Plano Executivo |
| **C4** | Prevista no Plano Executivo | **SIM** | Grupo B; Quadro l. 339; Release prevista **012** | Plano Executivo |
| **C5** | Estado permite migração | **SIM** | Quadro l. 339: `Não iniciada` · Bloqueio **`Nenhum`** · *"Estratégia fixada pelo ADR-009"* · *"Reexecutar Pré-Abertura"* | Plano Executivo |
| **C6** | **Sem bloqueio de governança** | **SIM** | Redação relida: bloqueiam-se etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e `publicar/route.ts`. R2 reside em `canalServidor.ts` — não nomeado. `publicar/route.ts` sofreria **apenas alteração de import** — precedente das Releases 007, 009 e 010 | Protocolo, Fase 1 |
| **C7** | Dependências identificadas | **SIM** | Plano: *"Dependências: nenhuma"*. Verificado: **um único import**, de tipo, de pacote (`@supabase/supabase-js`), injetado por parâmetro | Mapeamento §7; Plano |
| **C8** | Consumidores por **busca no código** | **SIM** | **5 de produção**: `conectar` · `publicar` · `vendas` · `importar-anuncios` · `diagnostico-guias`. Nenhum de memória | Protocolo, Fase 1 — evidência obrigatória nº 2 |
| **C9** | **Estratégia de migração definida** | **SIM** | **Ver §3.1 — bloqueador eliminado** | Mapeamento §7; **ADR-009 §5.1 e §5.3** |
| **C10** | **Linha de base mensurável** | **SIM** | 12 testes rastreados, blob `==HEAD`; execução nova: **12 pass · 0 fail**. Institucionalizada na Release 016 | Protocolo, Fase 1 |
| **C11** | Testes verdes | **SIM** | R2: 12/12. Suíte completa: **243/243 · 0 fail · 0 skipped** | Protocolo, Fase 2; Padrão RE, G2 |
| **C12** | Build íntegro | **SIM** | **`✓ Compiled successfully in 38.9s`**, exit 0. *(Na primeira execução este critério ficou **não verificado**; agora foi executado)* | Protocolo, Fase 2; Padrão RE, G1 |
| **C13** | Evidências mínimas disponíveis | **SIM** | Plano: *"6 consumidores atualizados; build; auditoria de commit"* — todas obteníveis. Padrão probatório em §3.3 | Plano Executivo |
| **C14** | Riscos conhecidos | **SIM** | **Médio** — Matriz l. 324 e Plano | Mapeamento §7 |
| **C15** | Complexidade conhecida | **SIM** | **Média** | Plano Executivo |
| **C16** | **Nenhuma decisão pendente** | **SIM** | **Ver §3.2 — bloqueador eliminado** | Governança §5, §10; **ADR-009** |
| **C17** | Uma responsabilidade por migração | **SIM** | Escopo: exclusivamente R2. O arquivo é integralmente R2 — 4 exports, todos da responsabilidade | Protocolo, princípios 4 e 5 |

**Resultado: 17 SIM · 0 NÃO · 0 N/A.**

---

## 3. Reavaliação dos bloqueadores

### 3.1 C9 — *Estratégia de migração definida*

**Primeira execução: NÃO.** *"Mover atrás de porta"* nomeava um construto com zero
especificação e zero implementações; o Plano omitia o campo.

**Reavaliação — o ADR-009 §5.1 determina, em redação normativa:**

> *"A expressão significa: mover a responsabilidade preservando sua propriedade de ser o
> **ponto único de acesso** ao vínculo do canal. **Não significa construir um artefato**."*

E o **§5.3** fixa o escopo:

> *"R2 migra para `src/modules/integration/infrastructure/` por **movimento integral**, com
> `git mv`, **sem introduzir Port**, sem criar abstração e **sem alterar contrato**."*

**A ambiguidade não é mais possível.** Antes, duas leituras. Agora, uma, com fonte
normativa aprovada. **C9 = SIM.**

**Verificação de que a estratégia é executável — ensaio de `git mv` em clone descartável:**

```
R100  canalServidor.ts       → src/modules/integration/infrastructure/canalServidor.ts
R100  canalServidor.test.ts  → src/modules/integration/infrastructure/canalServidor.test.ts
```

**Todos os `from` dos dois arquivos, sem exceção:**

| Origem | Natureza | Resolve após o movimento? |
|---|---|---|
| `@supabase/supabase-js` | pacote | **sim** |
| `node:test` · `node:assert/strict` | *builtin* | **sim** |
| `./canalServidor.ts` | mesmo diretório, move junto | **sim** |

**Nenhum caminho relativo sai do próprio diretório.** A estratégia não é apenas definida —
é **executável sem alterar uma linha dos arquivos movidos**. O clone foi descartado.

### 3.2 C16 — *Nenhuma decisão pendente*

**Primeira execução: NÃO.** A escolha entre os dois escopos era decisão arquitetural
inexistente.

**Reavaliação:**

| Verificação | Resultado |
|---|---|
| ADR-009 — estado | **APROVADO** |
| ADR-009 — efeito declarado | *"fixa o significado normativo… define o status arquitetural de Ports… e autoriza o escopo da migração de R2"* |
| ADR-009 institucionalizado | **SIM** — Release 017, rastreado, `==HEAD` |
| Decisão que a primeira execução apontou como faltante | **TOMADA** |
| Outros ADRs pendentes que alcancem R2 | **NENHUM** — ADR-007 trata da Publication; ADR-008, do Checklist |
| RFC aberta que alcance R2 | **NENHUMA** — RFC-001 lista **Integration** entre os módulos que *"permanecem implementáveis"* |

**A decisão que faltava existe, está aprovada e está institucionalizada. C16 = SIM.**

### 3.3 Padrão probatório para a Release 012

Determinado por evidência nesta execução, e coerente com o escopo do ADR-009 §5.3:

| Evidência | Valor esperado | Critério de interrupção |
|---|---|---|
| Renames registrados | **2** — `git mv`, nunca copiar-e-apagar | qualquer *delete + add* |
| **Similaridade** | **R100 em ambos** | **qualquer valor ≠ 100% interrompe** — significaria alteração além do movimento |
| SHA-256 antes e depois | **idêntico nos dois arquivos** | qualquer divergência |
| Assinatura pública | **4 exports**, nominalmente idênticos | qualquer diferença |
| Diff dos 5 consumidores | **1 linha cada**, apenas caminho de import, alias `@/` preservado | qualquer linha de lógica |
| Testes | **12 e 243**, número a número | qualquer divergência |
| Build | exit 0 antes e depois | falha |
| Auditoria do Commit | inspeção do **conteúdo commitado** dos 5 consumidores | divergência entre commit e árvore |

**Este é o primeiro caso do backlog em que se exige R100 estrito nos dois arquivos.** Nas
Releases 008 e 010 havia arquivos de Classe B, com similaridade inferior explicada por
caminhos relativos. Aqui **não existe caminho relativo a mudar** — logo, qualquer
similaridade inferior a 100% indicaria alteração indevida.

---

## 4. Consistência da governança

| Documento | Verificação | Resultado |
|---|---|---|
| **ADR-009** | Estado e efeito | **APROVADO**; rastreado; `==HEAD` |
| **Plano Executivo** | Registra o ADR-009 na entrada de R2 | **5 ocorrências**; Quadro l. 339 coerente |
| **Plano Executivo** | Campo *Estratégia* de R2 | **ausente — corretamente**. O ADR-009 §6.3 e §9 o agenda para **dentro da Release 012** |
| **Mapeamento** | Redação alterada? | **NÃO** — hash **idêntico** ao de `2e84bcb`. A matriz continua registrando *"Mover atrás de porta"* |
| **Checklist** | Alterado? | **NÃO** |
| **Protocolo** | Alterado? | **NÃO** |
| **Constituição · Organização · Módulos** | Alterados? | **NÃO** — 0 arquivos |
| **ADR-007 · ADR-008 · RFC-001** | Substituídos ou alterados? | **NÃO** — ADR-009 declara não substituir nenhum |

### 4.1 O aparente conflito, e por que não é um

O Mapeamento **continua registrando** *"Mover atrás de porta"*. Isso **não conflita** com o
ADR-009 — é exatamente o desenho da decisão: o ADR **fixa o significado** da expressão sem
**alterar sua redação**, preservando o registro factual. O próprio ADR-009 §6.3 determina
que a anotação no Mapeamento seja feita *"sem remover a redação original"*, em obediência
ao invariante *"nenhum artefato de governança é apagado"*.

**Precedência.** Governança §13: *"Documento de maior precedência prevalece."* O ADR é
**decisão normativa**; o Mapeamento é **registro factual de engenharia**. Onde a expressão
admitia leituras, prevalece o ADR.

**Nenhum conflito normativo identificado.**

---

## 5. Parecer

# ELEGÍVEL

**Regra de decisão aplicada**, na redação do Checklist:

> *"**ELEGÍVEL** exige `SIM` em **C6** e **C10** — os dois critérios de aprovação literais
> da Fase 1 — e ausência de qualquer bloqueador."*

- **C6 — SIM.** Nenhum bloqueio de gestão alcança R2; nenhuma RFC a alcança.
- **C10 — SIM.** Doze testes verdes, versionados, institucionalizados.
- **C9 — SIM.** Estratégia fixada em redação normativa pelo ADR-009 §5.1 e §5.3.
- **C16 — SIM.** A decisão pendente foi tomada, aprovada e institucionalizada.
- **C11, C12, C13 — SIM.** C12 passou de *não verificado* a **verificado**.
- **Bloqueadores — 0** nas quatro categorias.

### 5.1 Comparação entre as duas execuções

| Critério | 1ª execução | **Reexecução** | Causa da mudança |
|---|---|---|---|
| C9 | **NÃO** | **SIM** | ADR-009 §5.1 e §5.3 |
| C16 | **NÃO** | **SIM** | ADR-009 aprovado e institucionalizado |
| C12 | não verificado | **SIM** | Build executado nesta missão |
| Demais 14 | SIM | **SIM** | Reproduzidos, não copiados |
| **Parecer** | **NÃO ELEGÍVEL** | **ELEGÍVEL** | — |

**Nenhum critério regrediu.** As três mudanças são explicadas por decisão institucional ou
por execução de verificação antes pendente.

---

## 6. Autorização

# A abertura da Release 012 está formalmente AUTORIZADA

| Item | Valor |
|---|---|
| **Release** | 012 |
| **Tipo** | **Refatoração** *(Padrão de Release Engineering §3)* |
| **Responsabilidade** | R2 — exclusivamente |
| **Natureza da migração** | **Movimento integral de dois arquivos** |
| **Padrão probatório** | **`git mv`** com **R100 estrito em ambos** — §3.3 |
| **Origem** | `src/lib/marketplaces/` — `canalServidor.ts` e `canalServidor.test.ts` |
| **Destino** | `src/modules/integration/infrastructure/` |
| **Autorização de escopo** | **ADR-009 §5.3** |
| **Consumidores a alterar** | **5** — apenas caminho de import, alias `@/` preservado |
| **Linha de base** | 12 testes · suíte 243 · build verde |
| **Próxima fase** | Protocolo, **Fase 2** |

### 6.1 Obrigação registrada para a execução

O **ADR-009 §6.3 e §9** determina que, **dentro da Release 012**, sejam atualizados:

1. o **Mapeamento** — anotar que o ADR-009 fixou o significado da estratégia, **sem
   remover a redação original**;
2. o **Plano Executivo** — preencher o campo *Estratégia* de R2, hoje ausente.

### 6.2 Alertas registrados antecipadamente

1. **O incidente E1 ocorreu duas vezes** — Releases 003 e 008 —, sempre por `git add`
   referenciando caminhos de origem já movidos. O staging deve indexar **apenas caminhos
   existentes**, verificados um a um.
2. **R100 é critério de interrupção, não de conforto.** Não existe caminho relativo a
   alterar nos arquivos movidos; qualquer similaridade inferior a 100% indica alteração
   além do movimento — **interromper e investigar**.
3. **Cinco consumidores**, todos com alias `@/` sem extensão. A convenção deve ser
   preservada em cada um.
4. **Regra de reclassificação:** *"se for necessário alterar comportamento para concluir,
   deixa de ser refatoração — a entrega é interrompida e reclassificada."*

### 6.3 Achado registrado, sem impedir

**A1 — O índice do `docs/zion-os/README.md` continua sem o ADR-008.** Registrado como
achado da Release 017, com destino a release de documentação própria. Não alcança R2 e não
afeta este parecer.

**Esta autorização não inicia a migração.** Nenhuma branch foi criada. Nenhum arquivo de
código ou documentação foi alterado nesta execução.

---

## 7. Próxima missão autorizada

> ### Release 012 — Migração da responsabilidade R2

Executada integralmente pelo **Protocolo de Migração Arquitetural**, a partir da **Fase 2**,
com o padrão probatório de §3.3 e as obrigações documentais de §6.1.

**É a última Release de engenharia do Plano Executivo de Refatoração Arquitetural.**

Concluída ela, o backlog dependente **apenas de engenharia** estará **zerado**. Restarão
exclusivamente:

| Situação | Responsabilidades |
|---|---|
| Bloqueada por **decisão arquitetural** | **R15** — exige ADR de camada cliente→servidor |
| Bloqueadas por **governança** | **8** do Grupo C — validação operacional em produção |
| **Sem destino arquitetural** | **R5** · **R16** |

---

## Anexo — Matriz resumida

| Critério | 1ª execução | Reexecução |
|---|---|---|
| C1 · Identificada no Mapeamento | ✓ | ✓ |
| C2 · Destino arquitetural definido | ✓ | ✓ |
| C3 · Módulo de destino existe | ✓ | ✓ |
| C4 · Prevista no Plano Executivo | ✓ | ✓ |
| C5 · Estado permite migração | ✓ | ✓ |
| C6 · **Sem bloqueio de governança** | ✓ | ✓ |
| C7 · Dependências identificadas | ✓ | ✓ |
| C8 · Consumidores identificados por busca | ✓ | ✓ |
| C9 · **Estratégia definida** | **✗** | **✓** |
| C10 · **Linha de base existente** | ✓ | ✓ |
| C11 · Testes verdes | ✓ | ✓ |
| C12 · Build íntegro | não verificado | **✓** |
| C13 · Evidências mínimas disponíveis | ✓ | ✓ |
| C14 · Riscos conhecidos | ✓ | ✓ |
| C15 · Complexidade conhecida | ✓ | ✓ |
| C16 · **Nenhuma decisão pendente** | **✗** | **✓** |
| C17 · Uma responsabilidade por migração | ✓ | ✓ |
| Protocolo · Fase 1 | satisfeita | satisfeita |
| Ensaio de `git mv` | não executado | **R100 × 2** |
| Bloqueadores | **2** | **0** |
| **ELEGÍVEL** | **NÃO** | **SIM** |
