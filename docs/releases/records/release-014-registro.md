# Registro da Release 014 — Institucionalização da Linha de Base da R10

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Institucionalizar a linha de base da responsabilidade **R10**, removendo o único
bloqueador identificado na Pré-Abertura da Release 008.

**Nenhuma migração arquitetural foi realizada.** Nenhum arquivo de produção foi alterado.

- **Release:** 014 · **Tipo:** Documentação / Engenharia · **Data:** 21 de julho de 2026
- **Linha principal antes:** `e4bfb2a` · **depois:** `1e3b693`
- **Branch:** `docs/release-014-linha-de-base-r10` · **Commit:** `cdaf3fb`
- **Volume:** 4 arquivos, **893 inserções**, **4 remoções**

---

## 2. Bloqueador removido

### 2.1 O que a Pré-Abertura da Release 008 constatou

Parecer **NÃO ELEGÍVEL**, com **17 critérios aprovados** e **um** bloqueador operacional:

> **B1 — A linha de base de R10 não está institucionalizada.**

Duas manifestações do mesmo fato:

**(a) O arquivo de teste não estava sob controle de versão.**
`src/lib/data/tabelasMedidas.test.ts` era **não rastreado**. Nenhum commit o continha. A
Release 008 criaria branch a partir de `origin/master`, que não continha a linha de base —
e o Protocolo, Fase 5, exige *"reexecutar **exatamente** os mesmos testes da Fase 2"*
comparando *"número a número"*. **Não existia estado no repositório onde os 14 testes
tivessem sido medidos antes.**

**(b) O Plano Executivo registrava R10 como carente de linha de base.**
Quadro Executivo: `Bloqueio: Sem linha de base` · `Próxima ação: Criar linha de base`.
Entrada de R10: *"não possui teste próprio (verificado)"* e *"Pré-requisitos: criar linha
de base local"*. O pré-requisito fora cumprido de fato, mas o registro institucional não
refletia isso — e aquela missão estava proibida de alterá-lo.

### 2.2 Como esta release o removeu

Ambas as manifestações foram eliminadas: **(a)** o arquivo de teste passa a integrar o
histórico oficial; **(b)** a entrada de R10 no Plano Executivo reflete a conclusão do
pré-requisito.

**Prova direta**, e não argumentativa: um **clone limpo** no commit `cdaf3fb`, com
**0 arquivos não rastreados**, contém o arquivo de teste e reproduz **14 tests · 14 pass ·
0 fail**. Ver §4, evidência **EV5**.

---

## 3. Artefatos institucionalizados

| Arquivo | Natureza | Conteúdo |
|---|---|---|
| `src/lib/data/tabelasMedidas.test.ts` | **A** | **14 testes** cobrindo os 9 símbolos públicos de R10; os 5 ramos de `montarTabelaMedidas`; a normalização de marca; o fallback para a grade 33–45 |
| `docs/zion-os/engineering/linha-de-base-r10.md` | **A** | Registro da construção: estratégia, justificativa por teste, cobertura, evidências, limitações, achado A1 e parecer `LINHA DE BASE SUFICIENTE` |
| `docs/zion-os/engineering/estrategia-linhas-de-base-grupo-b.md` | **A** | Análise das cinco responsabilidades do Grupo B; classificação A/B/C; dependências; estratégias; ordem; riscos; critérios de suficiência |
| `docs/zion-os/engineering/plano-executivo-refatoracao.md` | **M** | Exclusivamente a entrada da R10 |

### 3.1 Sobre o artefato opcional — decisão fundamentada

O escopo declarava a `estrategia-linhas-de-base-grupo-b.md` como **opcional**, condicionada
a *"caso se conclua que esse documento deve fazer parte permanente do acervo de
engenharia"*.

**Incluído.** O fundamento não é de conveniência, é de **integridade referencial**:

O parecer de `linha-de-base-r10.md` é sustentado explicitamente pelos critérios **C-S1 a
C-S6** e cita o risco **RS1** e a classificação em **categorias A/B/C**. Verificou-se por
busca (`git grep` sobre `HEAD`) que **nenhum arquivo já rastreado** define esses critérios —
eles existem apenas na estratégia. Institucionalizar o registro sem ela produziria um
documento oficial cujo parecer se apoia em definições **ausentes do repositório**.

O documento é, portanto, **pré-requisito de leitura** do artefato principal desta release —
não um anexo discricionário.

### 3.2 Alteração no Plano Executivo

**Duas hunks, ambas da R10.** Diff: **+6 −4**.

| Local | Antes | Depois |
|---|---|---|
| Entrada de R10 | *"**Por que NÃO pode migrar ainda:** não possui teste próprio (verificado)…"* · *"**Pré-requisitos:** criar linha de base local para `medidasDaMarca`."* | *"**Pré-requisito — CONCLUÍDO (Release 014):** …14 testes cobrindo os 9 símbolos públicos, com detecção de regressão comprovada por mutação (7 de 7)."* |
| Quadro Executivo | `\| R10 \| Não iniciada \| Sem linha de base \| 008 \| Aguardando preparação \| Criar linha de base \|` | `\| R10 \| Não iniciada \| Nenhum \| 008 \| Linha de base pronta (Release 014) \| Executar Pré-Abertura \|` |

**Preservado sem alteração**, verificado por contagem antes/depois: `Estado` (*Não
iniciada*), `Release prevista: 008`, `Risco: Médio` (4 ocorrências), `Complexidade: Média`
(4), `Estratégia: mover arquivo inteiro` (1), `Evidências mínimas`, `Dependências`,
prioridade e roadmap.

**Outras responsabilidades tocadas: 0.** As linhas de R11 e R13 aparecem no diff apenas
como **contexto**, inalteradas.

---

## 4. Evidências

| # | Evidência | Resultado |
|---|---|---|
| **EV1** | Arquivos no commit | **4 de 4** — 3 `A`, 1 `M` |
| **EV2** | Arquivos de **produção** alterados | **0** |
| **EV3** | `tabelasMedidas.ts` — hash vs `origin/master` | **IDENTICO** — comportamento não pôde mudar |
| **EV4** | Testes de R10 | **14 tests · 14 pass · 0 fail** |
| **EV5** | **Reprodução por auditor** | Clone limpo em `cdaf3fb`, **0 não rastreados**: arquivo presente, **14/14** |
| **EV6** | Suíte completa | **215 tests · 215 pass · 0 fail · 0 skipped** |
| **EV7** | Build | **`✓ Compiled successfully in 24.5s`**, exit 0 |
| **EV8** | Artefatos normativos alterados | **0** — Protocolo, Checklist, ADRs, Governança, Constituição, Organização, Módulos |
| **EV9** | Plano Executivo — responsabilidades além de R10 | **0** |
| — | Pós-merge | escopo preservado (4 arquivos); 0 conflitos; local == remoto; árvore limpa |

**Sobre EV5 — a evidência que encerra o bloqueador.** As demais evidências mostram que a
release fez o que declarou. Apenas esta demonstra que **o problema deixou de existir**: o
teste de auditoria foi executado num clone independente, sem acesso à árvore de trabalho
que originalmente continha o arquivo. É a diferença entre afirmar que a linha de base foi
versionada e **provar que ela é reproduzível por um terceiro**.

---

## 5. Auditoria do Commit

| Verificação | Resultado |
|---|---|
| Arquivos esperados | 4 |
| Arquivos presentes | **4** |
| Nenhum ausente | **0** |
| Nenhum excedente | **0** |
| Nenhum arquivo de produção | **0** |
| Diff compatível com o escopo | **`A A A M`** |
| Árvore consistente com o commit | **0** pendências em `src/` e `docs/zion-os/` |
| Commit consistente | **sim** |

**APROVADA — 8 de 8.**

---

## 6. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Somente os artefatos previstos foram alterados | 4 arquivos, todos declarados no escopo | **APROVADO** |
| 2 | Nenhum arquivo de produção modificado | 0 em `src/` fora de `.test.` | **APROVADO** |
| 3 | Nenhum comportamento mudou | `tabelasMedidas.ts` hash idêntico; suíte 215/215; build verde | **APROVADO** |
| 4 | Plano Executivo permanece consistente | 2 hunks, ambas de R10; 0 outras responsabilidades; campos protegidos com contagem idêntica | **APROVADO** |
| 5 | Bloqueador operacional removido | Clone limpo reproduz 14/14 com 0 não rastreados | **APROVADO** |

**APROVADO — 5 de 5.**

---

## 7. Exceções registradas

**E1 — Evidência ambígua produzida e descartada.**
*Constatação:* a exibição do diff do Plano Executivo usou um filtro que exclui linhas
iniciadas por dois caracteres de `+`/`-`, para suprimir cabeçalhos de diff. Como itens de
lista Markdown começam com `- `, **toda linha de lista removida vira `--` e foi ocultada** —
o diff aparentava conter apenas metade das alterações.
*Decisão:* evidência **rejeitada**; diff reexibido sem o filtro, com `-U1 --no-prefix`,
revelando as duas hunks completas e confirmando `+6 −4`.
*Fundamento:* *evidência ambígua não é evidência*.
*Responsabilidade:* sexta aplicação do princípio. Como nas anteriores, **não correspondia a
falha real**.

**E2 — Artefato fora do escopo declarado, não institucionalizado.**
*Constatação:* `docs/releases/pre-abertura/release-008-checklist-r10.md` — o Checklist
preenchido cujo parecer `NÃO ELEGÍVEL` **motivou esta release** — permanece **não
rastreado**.
*Decisão:* **não incluído.** O escopo desta release é taxativo e não o menciona.
*Impacto:* este registro cita um documento ausente do repositório. O ADR-008 autoriza a
inclusão do Checklist preenchido *"no registro oficial da release correspondente"* — e,
tendo o parecer sido negativo, **não houve Release 008** à qual anexá-lo.
*Destino:* registrado para deliberação. Candidato natural à próxima Pré-Abertura da
Release 008, que produzirá seu próprio Checklist preenchido.
*Responsabilidade:* Release Manager desta execução.

**E3 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável —
hashes, contagens, execução em clone independente.

**Observação factual:** permanecem não rastreados na árvore de trabalho `platform/`
(projeto congelado), `docs/compiler/`, `docs/product/`, `docs/representation/`, ADR-003 e
ADR-005 — todos alheios a esta release e já registrados em execuções anteriores.

---

## 8. Resultado final

- **Integração técnica:** concluída. Auditoria e gates verificados; merge preservou o
  histórico; verificação pós-merge reproduziu o resultado; reversão possível.
- **Integração documental:** concluída. Os três documentos estão em `engineering/`; o Plano
  Executivo reflete o estado real; nenhum documento existente o contradiz.
- **Encerramento operacional:** concluído. Evidências preservadas; três exceções
  registradas.

**Release 014 — CONCLUÍDA.**

**Bloqueador B1 — ELIMINADO.**

### Critérios de sucesso

| Critério | Resultado |
|---|---|
| Linha de base integra o histórico oficial | **SIM** — commit `cdaf3fb` |
| Plano Executivo reflete a conclusão do pré-requisito | **SIM** — entrada e Quadro atualizados |
| Fase 2 reproduzível a partir de checkout limpo | **SIM** — clone independente, 14/14 |
| Nenhum arquivo de produção alterado | **SIM** — 0, hash idêntico |
| Bloqueador da Pré-Abertura da 008 deixa de existir | **SIM** |

---

## 9. Estado resultante

**R10** deixa de ter bloqueio registrado. O Quadro Executivo passa a indicar como próxima
ação **"Executar Pré-Abertura"**.

**A Release 008 não foi aberta.** Nenhuma branch de migração foi criada. Nenhum código de
produção foi movido.

**Próxima ação prevista:** **reexecutar integralmente a Pré-Abertura da Release 008**. Os
17 critérios deverão ser verificados novamente, do zero — o prognóstico registrado na
Pré-Abertura anterior era de `ELEGÍVEL` uma vez eliminado B1, mas **prognóstico não é
parecer**, e nenhum critério pode ser presumido a partir da execução anterior.
