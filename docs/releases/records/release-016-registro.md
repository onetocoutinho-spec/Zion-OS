# Registro da Release 016 — Institucionalização da Linha de Base da R2

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Institucionalizar a linha de base da responsabilidade **R2 — Persistência do vínculo do
canal**, eliminando o bloqueador operacional **B1** antes da futura Pré-Abertura da sua
migração.

**Nenhuma migração arquitetural foi realizada.** Nenhum arquivo de produção foi alterado.

- **Release:** 016 · **Tipo:** Documentação / Engenharia · **Data:** 21 de julho de 2026
- **Linha principal antes:** `9d29094` · **depois:** `dd25042`
- **Branch:** `docs/release-016-linha-de-base-r2` · **Commit:** `d8d6e8e`
- **Volume:** 3 arquivos — 2 adições, 1 modificação · **+604 / −6**

**Terceira execução do padrão da Release 014.** A primeira veio como correção, após a
Pré-Abertura da Release 008 reprovar por B1. As duas seguintes — 015 e esta — ocorreram
**preventivamente**, antes de qualquer Pré-Abertura. O padrão está estabelecido.

---

## 2. Artefatos institucionalizados

| Arquivo | Natureza | Conteúdo |
|---|---|---|
| `src/lib/marketplaces/canalServidor.test.ts` | **A** | **12 testes** — `lerCanalServidor`, `salvarRefreshTokenServidor`, `atualizarRefreshTokenServidor` |
| `docs/zion-os/engineering/linha-de-base-r2.md` | **A** | Registro da construção: delimitação, superfície comportamental, projeto, testes, build, suíte, mutação, achados, evidências descartadas e parecer |
| `docs/zion-os/engineering/plano-executivo-refatoracao.md` | **M** | Exclusivamente R2 |

### 2.1 O que a linha de base protege

R2 ocupa **um único arquivo** — diferentemente de R12, que atravessava dois. Os 12 testes
cobrem os **4 símbolos públicos** e os **8 invariantes** registrados na §2.4 do documento
de construção, entre eles:

- **A assimetria deliberada entre gravar e rotacionar** — `salvarRefreshTokenServidor`
  marca `ativo: true`; `atualizarRefreshTokenServidor` **não toca** `ativo`.
- **O no-op total do token vazio** — a guarda `if (!refreshToken) return;` faz com que o
  cliente de persistência **sequer seja chamado**.
- **Ausência de registro é `null`, não exceção** — `maybeSingle()`, não `single()`.
- **Os dois filtros sempre presentes** — remover `marketplace` faria a consulta atravessar
  canais.

### 2.2 Decisões de projeto registradas

**Estrutura neutra.** Um arquivo de teste ao lado da implementação. R2 ocupa um único
arquivo, então essa é a estrutura que **não antecipa nada** — acompanha o código em
movimento integral, em extração ou em qualquer outra estratégia. **Esta release não decide
a estratégia da futura migração.**

**Zero dependências externas.** O tipo do cliente foi derivado por
`Parameters<typeof lerCanalServidor>[0]`, **sem importar `@supabase/supabase-js`**. A
decisão endereça diretamente a limitação descoberta na Pré-Abertura da Release 010, quando
um clone sem `node_modules` invalidou uma medição — e seu valor foi **comprovado** nesta
release: ver evidência **EV8**.

**Testagem sem tocar produção.** As três funções recebem o cliente de persistência **por
parâmetro** — nenhuma o constrói. Isso permitiu substituí-lo integralmente sem alterar uma
linha de produção.

---

## 3. Evidências produzidas

| # | Evidência | Resultado |
|---|---|---|
| **EV1** | Testes de R2 | **12 tests · 12 pass · 0 fail** |
| **EV2** | Suíte completa | **243 tests · 243 pass · 0 fail · 0 skipped** — era 231 |
| **EV3** | Build | **`✓ Compiled successfully in 13.0s`**, exit 0 |
| **EV4** | Arquivos de produção alterados | **0** |
| **EV5** | `canalServidor.ts` — SHA-256 | **`e2c48485…`** — idêntico ao registrado no início da engenharia |
| **EV6** | `canalServidor.ts` — blob vs `origin/master` | **IDENTICO** |
| **EV7** | Detecção de regressão *(produzida na engenharia)* | **14 de 14 mutações**, nenhuma sobrevivente |
| **EV8** | **Reprodução por auditor** | Clone limpo em `d8d6e8e`, **0 não rastreados** e **sem `node_modules`**: **12/12** |
| **EV9** | Arquivos movidos | **0** |
| **EV10** | Artefatos normativos alterados | **0** — Protocolo, Checklist, ADRs, RFC, Constituição, Organização, Módulos |
| — | Pós-merge | escopo preservado (2 `A` + 1 `M`); 0 conflitos; local == remoto; árvore limpa |

**Sobre EV8 — a evidência que encerra o bloqueador, e que desta vez prova mais.** Nas
Releases 014 e 015 o clone reproduziu a linha de base porque os testes não importavam
pacotes externos — mas isso era circunstancial. Aqui foi **deliberado**: o clone não possui
`node_modules`, e ainda assim os 12 testes rodaram. A linha de base de R2 é reproduzível
por qualquer auditor a partir do repositório, **sem instalar nada**.

---

## 4. Auditoria do Commit

Executada conforme a **Fase 4 do Protocolo**.

| Verificação | Resultado |
|---|---|
| Arquivos esperados / presentes | 3 / **3** |
| Staging composto só por caminhos existentes | **sim** — 3 de 3 verificados antes; exit 0 |
| Ausentes | **0** |
| Excedentes | **0** |
| Arquivos de produção no commit | **0** |
| Diff compatível com o escopo | **`A A M`** |
| Árvore consistente com o commit | **0** pendências |

**APROVADA — 7 de 7, na primeira execução.** Nenhuma recorrência do incidente **E1**.

---

## 5. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Escopo restrito | 3 arquivos, todos declarados | **APROVADO** |
| 2 | Nenhuma alteração em produção | 0 em `src/` fora de `.test.` | **APROVADO** |
| 3 | `canalServidor.ts` inalterado | hash idêntico | **APROVADO** |
| 4 | Documentação consistente | `linha-de-base-r2.md` não cita artefato não rastreado; não usa siglas definidas fora dele | **APROVADO** |
| 5 | Plano Executivo consistente | 3 hunks, todas de R2; **0** outras responsabilidades | **APROVADO** |
| 6 | Protocolo, Checklist, ADRs e RFC intactos | 0 arquivos tocados | **APROVADO** |
| 7 | Nenhum arquivo movido | 0 renames | **APROVADO** |
| 8 | Artefatos reproduzíveis | clone limpo, 0 não rastreados, **sem `node_modules`**, 12/12 | **APROVADO** |
| 9 | Build e testes | `✓ 13.0s` · 12/12 · 243/243 | **APROVADO** |

**APROVADO — 9 de 9.**

---

## 6. Merge

| Verificação | Resultado |
|---|---|
| Conflitos | **0** |
| Commit final | `dd25042` |
| Sincronização local / remota | local == `origin/master` |
| Árvore limpa | **0** pendências em `src/` e `docs/zion-os/` |
| Escopo preservado | 2 `A` + 1 `M` |

---

## 7. Atualização do Plano Executivo

Volume: **+9 / −6**. Três hunks, **todas de R2**.

**Entrada de R2:**

| Campo | Antes | Depois |
|---|---|---|
| Estado | `Não iniciada` · Release prevista 012 | `Não iniciada` · Release prevista 012 · **Categoria A** |
| Motivo de bloqueio | *"sem teste próprio; 6 consumidores…"* | **removido** |
| Pré-requisitos | *"linha de base local"* | **CONCLUÍDO (Release 016)** — 12 testes, 4 símbolos, 8 invariantes, mutação 14/14 |

**Quadro Executivo:**

| Antes | Depois |
|---|---|
| `Não iniciada \| Sem linha de base \| 012 \| Aguardando preparação \| Criar linha de base` | `Não iniciada \| Nenhum \| 012 \| Linha de base pronta (Release 016) \| Executar Pré-Abertura` |

**Tabela *Linha de base disponível*:**

| Arquivo | Antes | Depois |
|---|---|---|
| `canalServidor.ts` | **NÃO** | **SIM** (12 testes — R2, Release 016) |

**Resumo do backlog — não alterado, deliberadamente.** R2 **não foi migrada**; apenas sua
linha de base ficou pronta. Os contadores de conclusão permanecem em *5 concluídas · 2
aguardando engenharia adicional · 8 bloqueadas por governança · 2 sem destino*. Mesmo
critério aplicado na Release 015.

**Verificado:** responsabilidades no diff além de R2: **0**. As linhas de R15 e R3 aparecem
apenas como contexto. Campos protegidos com contagem idêntica — `Release prevista: 012`,
`Risco: Médio`, *prioridade de extração baixa*, `6 consumidores atualizados`.

---

## 8. Exceções e achados registrados

Os cinco achados da engenharia foram preservados no documento institucionalizado e
**nenhum foi corrigido**. Destacam-se:

**A1 — O cabeçalho do arquivo de produção atribui o código à responsabilidade errada.**
A linha 1 de `canalServidor.ts` declara `// Acesso ao canal de marketplace NO SERVIDOR
(R3).` O Mapeamento atribui o arquivo a **R2**; **R3** é *Determinação de categoria do
canal*, que reside em `mercadolivre.ts`. Não corrigido: é comentário, e alterá-lo
modificaria produção e reduziria a similaridade de uma futura migração.

**A2 — Comentários citam migrações de banco por número.** As linhas 6–7 referenciam
*"migração 009"* e *"migração 011"* — **migrações de banco de dados**, não Releases do
Plano Executivo. A coincidência numérica com as Releases 009 e 011 é acidental e pode
confundir uma leitura futura.

**A5 — O arquivo declara-se *server-only* sem mecanismo que o garanta.** A advertência da
linha 9 é **convencional**, não técnica. A verificação dos 5 consumidores confirma que a
convenção está sendo respeitada hoje — todos são rotas de API.

**E1 — Evidência inválida descartada durante a mutação.** Cinco das quatorze mutações não
se aplicaram na primeira rodada. Causa: o arquivo possui **terminadores CRLF**, e os
padrões multilinha usavam `\n`. Os cinco resultados foram **descartados** — uma mutação que
não se aplica **não é uma mutação que sobreviveu** — e refeitos com padrões tolerantes a
CRLF. **Todas as cinco foram detectadas.** Décima terceira aplicação do princípio
*evidência ambígua não é evidência*.

**E2 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável.

**Observação factual:** permanecem não rastreados na árvore `platform/` (projeto
congelado), `docs/compiler/`, `docs/product/`, `docs/representation/`, ADR-003 e ADR-005 —
todos alheios a esta release e já registrados em execuções anteriores.

---

## 9. Commit

| Item | Valor |
|---|---|
| Commit da release | **`d8d6e8e`** |
| Merge | `dd25042` |
| Autor | `onetocoutinho-spec` |
| Tipo declarado | **Documentação / Engenharia** |

---

## 10. Resultado final

- **Integração técnica:** concluída. Auditoria aprovada na primeira execução; gates
  verificados; merge preservou o histórico; reversão possível.
- **Integração documental:** concluída. O Plano Executivo reflete o estado real.
- **Encerramento operacional:** concluído. Cinco achados e duas exceções registrados;
  nenhum silencioso.

**Release 016 — CONCLUÍDA.**

**Bloqueador B1 — ELIMINADO para R2.**

### Critérios de sucesso

| Critério | Resultado |
|---|---|
| Artefatos da linha de base versionados | **SIM** — commit `d8d6e8e` |
| Produção byte a byte idêntica | **SIM** — SHA-256 `e2c48485…` inalterado |
| Build verde | **SIM** — `✓ 13.0s` |
| Suíte completa verde | **SIM** — 243/243 |
| Auditoria aprovar | **SIM** — 7/7 |
| Integration Review aprovar | **SIM** — 9/9 |
| Merge concluído | **SIM** — 0 conflitos |
| Plano Executivo atualizado | **SIM** |
| Registro oficial produzido | **SIM** — este documento |

---

## 11. Estado do backlog

| Grupo | Situação |
|---|---|
| **Concluídas** | R9 (003) · R11 (007) · R10 (008) · R13 (009) · R12 (010) |
| **Categoria A — linha de base pronta** | **R2** → Release 012 |
| **Categoria C — sem linha de base** | **R15** → Release 011 |
| **Grupo C** | 8 responsabilidades, bloqueadas pela validação operacional em produção |
| **Grupo D** | R5 e R16, sem destino arquitetural |

**Marco alcançado.** Com esta release, **R15 é a única responsabilidade do Grupo B sem
linha de base** — e a única de todo o backlog cujo pré-requisito **não é técnico**: o Plano
Executivo registra que ela depende de *"decisão sobre a mudança de camada
(cliente→servidor) — **não coberta** por este plano"*.

**Tensão registrada, não resolvida.** O roadmap prevê **R15 → 011** e **R2 → 012**. R2 já
tem linha de base; R15 não, e a construção da sua depende de uma decisão arquitetural
pendente. A análise do Grupo B já havia registrado que, **para construção de linha de
base**, a ordem inversa era a indicada — sem que isso alterasse a ordem de migração. Esta
release não altera o roadmap; apenas torna a tensão factual.

**Próxima ação possível:** Pré-Abertura da migração de R2, que deverá executar os 17
critérios do Checklist na íntegra e determinar a natureza da sua migração por evidência
própria — R2 ocupa um único arquivo, mas essa constatação **não antecipa** o veredito.
