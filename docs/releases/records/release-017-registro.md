# Registro da Release 017 — Institucionalização do ADR-009, da Avaliação da R15 e da Pré-Abertura 012

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Incorporar à governança do Zion OS as **três decisões formais** produzidas após a Release
016. Nenhuma altera código ou comportamento; todas passam a integrar o registro
institucional.

- **Release:** 017 · **Tipo:** Documentação / Governança · **Data:** 21 de julho de 2026
- **Linha principal antes:** `2e84bcb` · **depois:** `10f33cb`
- **Branch:** `docs/release-017-institucionalizacao-adr-009` · **Commit:** `84331cd`
- **Volume:** 5 arquivos — 3 adições, 2 modificações · **+1.186 / −4**

**Primeira release do Zion OS que institucionaliza um ADR.** As Releases 014, 015 e 016
institucionalizaram linhas de base; esta institucionaliza uma **decisão arquitetural
normativa**.

---

## 2. Artefatos institucionalizados

### 2.1 `governance/ADR-009-estrategia-de-ports-e-escopo-da-r2.md` — 427 linhas

**Estado: APROVADO.** Produz **três determinações normativas**:

1. **Significado de *"Mover atrás de porta"*** — preservar o **ponto único de acesso** ao
   vínculo do canal; **não** construir artefato. Fundamento: o Mapeamento emprega *porta*
   três vezes, todas em torno de R2, e **duas inequivocamente no sentido coloquial** —
   *"é a única porta de leitura do canal"* (l. 56) e o Achado **A2** (l. 276).
2. **Status de Ports** — **não integram a arquitetura do Zion OS**. Os diretórios `ports/`
   e `adapters/` permanecem **reservados e vazios**. A abstração que a arquitetura adota e
   define é o **Repositório**.
3. **Escopo de R2** — movimento integral para `modules/integration/infrastructure/`, com
   `git mv`, sem Port, sem abstração e sem alterar contrato.

Rejeitou as alternativas B, C e D com justificativa registrada.

### 2.2 `engineering/avaliacao-arquitetural-r15.md` — 397 linhas

**Parecer: A) A premissa arquitetural permanece válida.** R15 continua bloqueada até
decisão arquitetural.

Registrou que o **escopo da premissa estreitou** — R12 e R13, as duas dependências puras,
foram migradas, restando acoplada ao navegador **apenas a E/S** — e identificou um **novo
impedimento**: o Mapeamento classifica **R14 e R15 juntas como *Orquestração*** (§6,
l. 303), e R14 está bloqueada por governança e pela inexistência do Operation Center.

### 2.3 `docs/releases/pre-abertura/release-012-checklist-r2.md` — 332 linhas

**Parecer: NÃO ELEGÍVEL.** 14 SIM · 2 NÃO · 1 não verificado. Foi o documento que
**originou o ADR-009**: apurou que a estratégia registrada admitia dois escopos
arquiteturalmente distintos e que executá-los sem decisão formal significaria **criar
arquitetura durante uma release de engenharia**.

Arquivada como evidência do impedimento e de sua causa — conforme o invariante de que
*"nenhum artefato de governança é apagado"*.

---

## 3. Impacto na governança

### 3.1 O que mudou

- O Zion OS passa a ter **três ADRs aprovados**: ADR-007, ADR-008 e **ADR-009**.
- **Ports adquirem status normativo — negativo.** Pela primeira vez, um documento oficial
  declara o que o Zion OS **não** adota.
- A ambiguidade de R2 deixa de existir: há **uma única interpretação oficial**.
- R15 passa a constar formalmente como **bloqueada por decisão arquitetural**.

### 3.2 O que permanece igual

- **Nenhuma linha de código.** Zero arquivos em `src/`.
- **Constituição, Organização e Módulos** — hash inalterado, nenhum tocado.
- **Protocolo de Migração e Checklist de Elegibilidade** — intocados.
- **Mapeamento Arquitetural** — **hash idêntico**. O ADR-009 fixa o *significado* da
  estratégia sem alterar sua *redação*.
- **ADR-007, ADR-008 e RFC-001** — intocados. Nenhum foi substituído.
- Bloqueio de governança sobre `mercadolivre.ts` e `publicar/route.ts` — **vigente**.

### 3.3 Decisão de escopo registrada

O ADR-009, em §6.3 e §9, agenda o preenchimento do campo *Estratégia* de R2 para **dentro
da Release 012** — não para esta. **A instrução foi honrada:** verificado no conteúdo
commitado que a entrada de R2 contém **zero ocorrências** de `Estratégia:`.

Um ADR que agenda a própria aplicação e é obedecido por quem o executa é a prova de que a
governança está operando — não apenas registrada.

---

## 4. Evidências

| # | Evidência | Resultado |
|---|---|---|
| **EV1** | Arquivos de código alterados | **0** |
| **EV2** | Documentos normativos modificados | **0** — `constitution/`, `organization/`, `modules/` |
| **EV3** | Protocolo e Checklist | **0** alterações |
| **EV4** | ADR-007, ADR-008, RFC-001 | **0** alterações |
| **EV5** | Mapeamento Arquitetural | **hash IDÊNTICO** a `origin/master` |
| **EV6** | Plano Executivo — responsabilidades tocadas | **2** — R15 e R2. Outras: **0** |
| **EV7** | Quadro Executivo — linhas alteradas | **4** — 2 removidas, 2 inseridas, ambas de R15 e R2 |
| **EV8** | Escopo do ADR-009 respeitado | Campo *Estratégia* de R2: **0** ocorrências no commit |
| **EV9** | Índices atualizados | ADR-009 e Avaliação R15 indexados; Pré-Abertura referenciada |
| **EV10** | Integridade referencial | ADR-009 cita a Pré-Abertura **6 vezes**; a Pré-Abertura cita ADR-008; ambos agora rastreados |
| — | Pós-merge | escopo preservado (3 `A` + 2 `M`); 0 conflitos; local == remoto; árvore limpa |

---

## 5. Auditoria do Commit

| Verificação | Resultado |
|---|---|
| Arquivos esperados / presentes | 5 / **5** |
| Staging composto só por caminhos existentes | **sim** — 5 de 5 verificados; exit 0 |
| Ausentes · Excedentes | **0** · **0** |
| Arquivos de código | **0** |
| Diff compatível | **`A A A M M`** |
| Árvore consistente com o commit | **0** pendências |

**APROVADA — 6 de 6, na primeira execução.** Nenhuma recorrência do incidente **E1**.

---

## 6. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Zero alterações funcionais | 0 arquivos de código | **APROVADO** |
| 2 | Zero alterações arquiteturais | 0 modificações em normativos | **APROVADO** |
| 3 | Somente institucionalização | 3 adições + 2 atualizações de registro e índice | **APROVADO** |
| 4 | Protocolo e Checklist intactos | 0 | **APROVADO** |
| 5 | ADR-007, ADR-008 e RFC-001 intactos | 0 | **APROVADO** |
| 6 | Mapeamento intacto | hash idêntico | **APROVADO** |
| 7 | Plano — só R15 e R2 | 4 linhas do Quadro; 0 outras responsabilidades | **APROVADO** |
| 8 | Índice consistente | 3 artefatos registrados | **APROVADO** |
| 9 | Escopo do ADR-009 respeitado | Campo *Estratégia* não preenchido | **APROVADO** |
| 10 | Suíte e build inalterados | Nenhum arquivo de código tocado | **APROVADO** |

**APROVADO — 10 de 10.**

---

## 7. Achados registrados — não corrigidos

**A1 — O índice do `docs/zion-os/README.md` está materialmente desatualizado.**
*Constatação:* **nove artefatos rastreados estão ausentes** do índice:
`checklist-elegibilidade-migracao.md`, `mapeamento-arquitetural-implementacao-atual.md`,
`protocolo-migracao-arquitetural.md`, `plano-executivo-refatoracao.md`,
`padrao-release-engineering.md`, `estrategia-linhas-de-base-grupo-b.md`,
`linha-de-base-r10.md`, `linha-de-base-r12.md`, `linha-de-base-r2.md` — e, o mais
consequente, **`ADR-008`**, um ADR **aprovado e vinculante**.
*Decisão:* **não corrigido.** O PASSO 3 desta missão determina registrar *"novo ADR, nova
Avaliação Arquitetural, nova Pré-Abertura"* — os três **novos** artefatos. Ampliar para os
nove excederia o escopo declarado.
*Impacto:* após esta release, o índice de governança lista ADR-007 e ADR-009, **mas não
ADR-008**. Uma leitura do índice poderia concluir que ADR-008 não existe ou não vige.
*Destino:* **correção por release de documentação própria.** Registrado como o achado de
maior consequência desta execução.

**A2 — Artefatos não rastreados permanecem na árvore.**
*Constatação:* `platform/` (projeto congelado), `docs/compiler/`, `docs/product/`,
`docs/representation/`, e os **ADR-003** e **ADR-005** em `docs/decisions/`.
*Decisão:* alheios a esta release. Já registrados em execuções anteriores.

**A3 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável.

---

## 8. Estado atualizado do Plano Executivo

Volume: **+23 / −4**. Quatro hunks — duas na entrada de R15, uma na de R2, uma no Quadro.

### 8.1 R15

| Campo | Antes | Depois |
|---|---|---|
| Estado | `Não iniciada` | **`BLOQUEADA — decisão arquitetural`** |
| Premissa | — | Registrada a reavaliação da Release 017 e o novo impedimento (R14) |
| Pré-requisitos | *"decisão… não coberta por este plano"* | acrescido: **exige ADR aprovado; nenhum existe** |
| Quadro | `Não iniciada \| Sem linha de base + mudança de camada \| Aguardando definição \| Criar linha de base` | `🔒 Bloqueada \| Decisão arquitetural (sem ADR) \| Premissa confirmada na Release 017 \| Deliberar ADR de camada` |

### 8.2 R2

| Campo | Antes | Depois |
|---|---|---|
| Ambiguidade | — | **RESOLVIDA pelo ADR-009**, com as três determinações registradas |
| Campo *Estratégia* | ausente | **ainda ausente** — agendado para a Release 012 pelo ADR-009 |
| Quadro | `Nenhum \| Linha de base pronta (Release 016) \| Executar Pré-Abertura` | `Nenhum \| Estratégia fixada pelo ADR-009 \| Reexecutar Pré-Abertura` |

### 8.3 Estado do backlog

| Situação | Responsabilidades |
|---|---|
| **Concluídas** | R9 (003) · R11 (007) · R10 (008) · R13 (009) · R12 (010) |
| **Elegível para Pré-Abertura** | **R2** — linha de base pronta, estratégia fixada |
| **Bloqueada por decisão arquitetural** | **R15** — exige ADR de camada |
| **Bloqueadas por governança** | 8 do Grupo C — validação operacional em produção |
| **Sem destino arquitetural** | R5 · R16 |

**Resumo — não alterado:** *5 concluídas · 2 aguardando engenharia adicional · 8 bloqueadas
por governança · 2 sem destino*. Nenhuma responsabilidade mudou de estado de conclusão
nesta release.

---

## 9. Resultado final

- **Integração técnica:** concluída. Auditoria aprovada na primeira execução; merge
  preservou o histórico; reversão possível.
- **Integração documental:** concluída. Três decisões formais na linha principal; índices
  registram os três artefatos.
- **Encerramento operacional:** concluído. Três achados registrados; nenhum silencioso.

**Release 017 — CONCLUÍDA.**

### Critérios de sucesso

| Critério | Resultado |
|---|---|
| Zero código alterado | **SIM** — 0 arquivos em `src/` |
| Somente documentos institucionais | **SIM** — 5 arquivos, todos em `docs/` |
| ADR-009 institucionalizado | **SIM** |
| Avaliação R15 institucionalizada | **SIM** |
| Pré-Abertura da R12 institucionalizada | **SIM** |
| Plano Executivo atualizado | **SIM** — exclusivamente R15 e R2 |
| Auditoria aprovada | **SIM** — 6/6 |
| Integration Review aprovado | **SIM** — 10/10 |

---

## 10. Próxima missão oficialmente autorizada

> ### Reexecução da Pré-Abertura da Release 012 (R2)

Aplicando integralmente os **17 critérios** do Checklist sobre o `HEAD` vigente, com os
critérios **C9** *(estratégia definida)* e **C16** *(nenhuma decisão pendente)*
fundamentados nas **§5.1 e §5.3 do ADR-009**, agora institucionalizado.

**Autorização e limites**, conforme §9 do ADR-009:

- **Autorizado:** reexecutar a Pré-Abertura.
- **Não autorizado:** abrir a Release 012 diretamente. O ADR-008 mantém o Checklist como
  artefato obrigatório de pré-abertura, e sua reexecução é **condição**, não formalidade.

**Sequência prevista, condicionada a cada resultado:**

1. Reexecução da Pré-Abertura da Release 012.
2. **Release 012 — migração de R2**, se o parecer for `ELEGÍVEL`.
3. Atualização do Mapeamento e do Plano Executivo conforme §6.3 do ADR-009, **dentro da
   Release 012**.

**Após a conclusão da Release 012, o backlog dependente apenas de engenharia estará
zerado.** Restarão exclusivamente responsabilidades condicionadas a **decisão de
arquitetura** — R15, R5, R16 — ou a **validação operacional em produção** — as oito do
Grupo C.
