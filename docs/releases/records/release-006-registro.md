# Registro da Release 006 — Correção da Numeração do Roadmap

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Eliminar o **Achado A1**, registrado na Release 005: o conflito entre a numeração das
releases previstas no roadmap do Plano Executivo e o histórico de releases efetivamente
executadas.

Release **corretiva de documentação**. Não introduz decisão, não altera comportamento,
não altera arquitetura, não altera governança.

---

## 2. Origem — o Achado A1

O Plano Executivo foi elaborado **antes** da conclusão da Release 005 e designava
**"Release 005"** para a migração da responsabilidade **R11**. O número 005 foi, porém,
efetivamente consumido pela release que institucionalizou o próprio Plano.

O resultado foi a coexistência, no mesmo repositório, de duas designações distintas sob o
mesmo número — com significados diferentes. O registro da Release 005 documentou o
achado, declarou explicitamente **"não corrigido nesta release"** (a restrição de escopo
daquela execução vedava revisar o Plano) e destinou a correção a uma **release de
documentação própria**. Esta é essa release.

---

## 3. Escopo

**Declarado:** exclusivamente `docs/zion-os/engineering/plano-executivo-refatoracao.md`.
Somente a numeração das releases poderia ser modificada.

**Entregue:** idêntico ao declarado — 1 arquivo, 23 inserções, 18 remoções.

- **Release:** 006 · **Tipo:** Documentação (corretiva) · **Data:** 21 de julho de 2026
- **Linha principal antes:** `ba7440d` · **depois:** `e96726d`
- **Branch:** `docs/release-006-correcao-numeracao` · **Commit:** `8abd2d9`

---

## 4. Correspondência aplicada

O critério foi único: refletir o histórico real. As releases **001–005** já foram
executadas; **esta release corretiva é a 006**. As migrações previstas passam, portanto,
a começar em **007**, preservando a ordem original do roadmap.

| Responsabilidade | Antes | Depois |
|---|---|---|
| R11 | 005 | **007** |
| R10 | 006 | **008** |
| R13 | 007 | **009** |
| R12 | 008 | **010** |
| R15 | 009 | **011** |
| R2  | 010 | **012** |

**R9 não foi tocada** — sua entrada `003` registra uma release **já executada**, não uma
previsão.

Dezoito linhas foram renumeradas: seis títulos de seção `### Release`, seis linhas
`**Release prevista:**`, seis linhas da tabela executiva — uma das quais (`R13`) carrega
duas correções, pois sua coluna de próxima ação referenciava `Aguardar Release 006`,
agora `Aguardar Release 008`.

Acrescentou-se ainda uma **Nota de Revisão** de cinco linhas, declarando a natureza
documental da revisão e a ausência de alteração técnica.

---

## 5. Evidências coletadas

| # | Evidência | Resultado |
|---|---|---|
| Auditoria | Arquivo esperado no commit | **1 de 1** |
| Auditoria | Ausentes | **0** |
| Auditoria | Excedentes | **0** |
| Auditoria | Arquivos funcionais / de código | **0** |
| Auditoria | Árvore consistente | **0** pendências no escopo |
| Auditoria | Diff compatível | **`M`** — modificação pura |
| EV1 | Natureza das alterações | **1 `M`** — 0 adições, 0 remoções de arquivo |
| EV2 | Arquivos de código alterados | **0** (`src/`, `platform/`, `package.json`, `tsconfig.json`) |
| EV3 | Alterações fora do escopo | **0** |
| EV4 | Volume | 1 arquivo, **23 inserções**, **18 remoções** |
| EV5 | Commits / divergência | 1 commit; `0/1` |
| EV6 | Arquitetura e governança tocadas | **0** em `constitution/`, `organization/`, `modules/`, `governance/` |
| EV7 | Build | **`✓ Compiled successfully in 16.4s`**, exit 0 |
| — | Pós-merge | escopo preservado (1 `M`); 0 conflitos; local == remoto |

**Conservação verificada antes do commit.** Comparados antes/depois e **idênticos**: os
4 grupos, os 17 identificadores de responsabilidade, 14 ocorrências de `Risco:`, 15 de
`depend*`, 6 de `estratégia` e 13 de `Bloqueada`. A aritmética fecha exatamente:
18 linhas renumeradas + 5 linhas de nota = 23 inserções / 18 remoções, sem resíduo.

---

## 6. Exceções e achados registrados

**E1 — Conteúdo não rastreado extenso fora do escopo.**
*Constatação:* 163 arquivos não rastreados alheios a esta release permaneciam na árvore,
entre eles `platform/` (projeto congelado), `docs/compiler/`, `docs/representation/` e os
ADR-003 e ADR-005.
*Mitigação:* staging explícito de um único caminho; auditoria confirmou 0 excedentes,
antes e depois do merge.
*Responsabilidade:* Release Manager desta execução.

**E2 — Quatro arquivos rastreados com alteração pendente.**
*Constatação:* `.obsidian/*` e um canvas do Obsidian — artefatos de editor pré-existentes.
*Mitigação:* não entraram no commit; verificado 0 fora do escopo.
*Responsabilidade:* Release Manager desta execução.

**E3 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável.
*Responsabilidade:* Release Manager desta execução.

**E4 — Evidência ambígua produzida e descartada durante a Integration Review.**
*Constatação:* a verificação de "números antigos remanescentes" empregou uma expressão
regular (`00[5-9]|010`) que **também casa com os números novos** 007–010, retornando 4
falsos positivos.
*Decisão:* a evidência foi **rejeitada** e a verificação refeita de forma disjunta,
comparando o conjunto exato de valores contra `{005, 006}`: **0 ocorrências**.
*Fundamento:* princípio do Protocolo de Migração — *evidência ambígua não é evidência*.
*Responsabilidade:* registrado como aplicação bem-sucedida do princípio.

---

## 7. Parecer técnico

**APROVADO.**

*Fundamentação:* escopo entregue idêntico ao declarado; auditoria de commit sem ausências
nem excedentes; nenhum arquivo de código alterado; nenhum artefato de arquitetura ou
governança tocado; build íntegro; integração reversível por completo.

**Argumento de ausência de impacto:** a alteração incide sobre **rótulos de sequência**
em um documento de planejamento. Nenhum arquivo em `src/` foi tocado. Não existe caminho
pelo qual comportamento, arquitetura ou governança pudessem ter mudado.

**Argumento de não-alteração de decisão:** a correção não reordena o roadmap, não
reclassifica responsabilidades, não altera grupos, estados, dependências, riscos,
critérios de aceitação ou estratégias. Cada responsabilidade mantém exatamente a mesma
posição relativa que ocupava; apenas o número que a identifica foi deslocado em dois,
para não colidir com releases já consumidas.

---

## 8. Resultado final

- **Integração técnica:** concluída. Auditoria e gates verificados; merge preservou o
  histórico; verificação pós-merge reproduziu o resultado esperado; reversão possível.
- **Integração documental:** concluída. O roadmap está consistente com o histórico de
  releases; nenhum documento existente contradiz o estado resultante.
- **Encerramento operacional:** concluído. Parecer registrado; evidências preservadas;
  exceções registradas.

**Release 006 — CONCLUÍDA.**

**Achado A1 — ELIMINADO.**

**Nenhuma migração foi iniciada.** Nenhum código foi alterado.

---

## 9. Estado atualizado do roadmap

- **Concluída:** R9 (Release 003).
- **Grupo A — desbloqueada:** R11 → **Release 007**. Única migração pronta para executar.
- **Grupo B — dependem de linha de base local:** R10 → **008**, R13 → **009** (depende de
  R10), R12 → **010**, R15 → **011**, R2 → **012**.
- **Grupo C — bloqueadas por governança:** R3, R4, R8, R1, R6, R7, R17, R14. Oito
  responsabilidades dependem de **uma única condição**: a validação operacional do
  comportamento de reutilização de guias de medidas em produção.
- **Grupo D — sem destino arquitetural:** R5 (aguarda especificação de Vendas/Pedidos) e
  R16 (aguarda especificação de Identity & Access).

---

## 10. Próxima release prevista

**Release 007 — migração da responsabilidade R11.**

É a única migração desbloqueada. Diferentemente desta release, será uma release **de
código**, sujeita ao Protocolo de Migração Arquitetural na íntegra — incluindo a
exigência de linha de base que a R11 já satisfaz.

**Pendências registradas que permanecem em aberto:** validação operacional da
reutilização de guias (bloqueia o Grupo C inteiro); remoção da rota de diagnóstico
`/api/ml/diagnostico-guias` da produção; realocação do ADR-006 para `governance/`;
versionamento dos ADR-003 e ADR-005; avaliação de vigência de `docs/architecture/`;
investigação das estruturas `src/domain/`, `src/application/` e `src/infrastructure/` não
cobertas pelo Mapeamento Arquitetural.
