# Registro da Release 010 — Migração da R12 para Integration/domain

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Migrar a responsabilidade **R12 — Montagem do payload no formato do canal** de
`lib/marketplaces/` para `modules/integration/domain/`, preservando integralmente
comportamento, contratos, assinaturas, comentários, conteúdo e **histórico dos arquivos**.

R12 é a responsabilidade que **atravessa dois arquivos de produção** — a única do backlog
com essa característica. Destino: **Tradutor**, que a arquitetura do módulo Integration
descreve como *"o componente assinatura do módulo"*.

- **Release:** 010 · **Tipo:** **Refatoração** · **Data:** 21 de julho de 2026
- **Linha principal antes:** `e78ab0c` · **depois:** `c5ae4dc`
- **Branch:** `refactor/release-010-r12-payload-do-canal` · **Commit:** `6924d6c`
- **Pré-Abertura:** parecer `ELEGÍVEL`, 17/17 critérios, 0 bloqueadores, 7 constatações

---

## 2. Arquivos movidos

**Movimento integral de quatro arquivos.** Nenhum símbolo ficou para trás; nenhum arquivo
foi dividido; nenhum nome foi alterado.

| Origem | Destino |
|---|---|
| `src/lib/marketplaces/mlUserProducts.ts` | `src/modules/integration/domain/mlUserProducts.ts` |
| `src/lib/marketplaces/mlUserProducts.test.ts` | `src/modules/integration/domain/mlUserProducts.test.ts` |
| `src/lib/marketplaces/mlPayload.ts` | `src/modules/integration/domain/mlPayload.ts` |
| `src/lib/marketplaces/mlPayload.test.ts` | `src/modules/integration/domain/mlPayload.test.ts` |

**Consumidores atualizados — 3, apenas linha de import**, cada um preservando sua
convenção:

| Consumidor | Convenção | Import resultante |
|---|---|---|
| `app/api/ml/publicar/route.ts` | alias `@/`, sem extensão | `@/modules/integration/domain/mlUserProducts` |
| `lib/services/publicacaoML.ts` | relativo, sem extensão | `../../modules/integration/domain/mlPayload` |
| `modules/publication/domain/composicaoConteudo.ts` | relativo, sem extensão | `../../integration/domain/mlUserProducts` |

**Volume total: 7 arquivos, +6 / −6** — seis linhas de import, nada mais.

**Estado de `src/lib/marketplaces/` após a migração:** restam apenas `canalServidor.ts`
(R2) e `mercadolivre.ts` (R7, bloqueado por governança).

---

## 3. Similaridades obtidas

**As quatro conferem exatamente com as previstas na Pré-Abertura.**

| Arquivo | Prevista | **Observada** | Linhas alteradas |
|---|---|---|---|
| `mlUserProducts.ts` | R100 | **R100** | `0 0` |
| `mlUserProducts.test.ts` | R100 | **R100** | `0 0` |
| `mlPayload.ts` | R097 | **R097** | `2 2` |
| `mlPayload.test.ts` | R099 | **R099** | `1 1` |

**Nenhum valor divergiu.** O critério de interrupção declarado na Pré-Abertura — *"se
`mlUserProducts.ts` não sair R100, interromper"* — não foi acionado.

### 3.1 Classe A — R100 com SHA-256 idêntico

`mlUserProducts.ts` e seu teste atravessaram a migração **sem alterar um byte**. A razão é
estrutural e foi antecipada: o único import de `mlUserProducts.ts` é `./mlPayload.ts`, que
**move junto** — o caminho relativo permanece válido. O mesmo vale para o teste, cujo único
import local é `./mlUserProducts.ts`.

| Arquivo | SHA-256 antes | Depois |
|---|---|---|
| `mlUserProducts.ts` | `f76a1237125f29bb…` | **IDÊNTICO** |
| `mlUserProducts.test.ts` | `365b0f7104605201…` | **IDÊNTICO** |

### 3.2 Classe B — similaridade explicada linha a linha

`mlPayload.ts` e seu teste importam tipos por caminho relativo cuja **profundidade muda**
com o destino. A diferença é **exclusivamente** essa:

```
rename from src/lib/marketplaces/mlPayload.test.ts
rename to   src/modules/integration/domain/mlPayload.test.ts
@@ -11 +11 @@
-import type { AnuncioGerado } from "../agentes/esteira.ts";
+import type { AnuncioGerado } from "../../../lib/agentes/esteira.ts";

rename from src/lib/marketplaces/mlPayload.ts
rename to   src/modules/integration/domain/mlPayload.ts
@@ -11,2 +11,2 @@
-import type { AnuncioGerado } from "../agentes/esteira";
-import type { Produto } from "../types";
+import type { AnuncioGerado } from "../../../lib/agentes/esteira";
+import type { Produto } from "../../../lib/types";
```

**Três linhas no total. Nenhuma de lógica.** A similaridade inferior a 100% é **explicada,
não tolerada** — conforme o padrão probatório definido na Pré-Abertura.

### 3.3 Nomes conservados — e por quê

Os quatro arquivos mantiveram seus nomes. Isto não foi conveniência: a Pré-Abertura
registrou, por evidência, que o **R100 de `mlUserProducts.ts` depende de `mlPayload.ts`
conservar seu nome de arquivo** — renomeá-lo alteraria o import `./mlPayload.ts` e custaria
a prova. A restrição foi honrada.

---

## 4. Evidências

### 4.1 Linha de base (Fase 2) e validação (Fase 4)

| Medida | Antes | Depois | Resultado |
|---|---|---|---|
| Commit | `e78ab0c` | `c5ae4dc` | — |
| SHA-256 `mlUserProducts.ts` | `f76a1237…` | `f76a1237…` | **IDÊNTICO** |
| SHA-256 `mlUserProducts.test.ts` | `365b0f71…` | `365b0f71…` | **IDÊNTICO** |
| SHA-256 `mlPayload.ts` | `67416604…` | alterado | **explicado — 2 linhas de import** |
| SHA-256 `mlPayload.test.ts` | `2cb74d71…` | alterado | **explicado — 1 linha de import** |
| Assinatura pública | **7 exports** (4 + 3) | **7 exports** (4 + 3) | **CONSERVADA** |
| Testes específicos | 16 · 16 pass · 0 fail | 16 · 16 pass · 0 fail | **IDÊNTICO** |
| Suíte completa | 231 · 231 pass · 0 fail | 231 · 231 pass · 0 fail | **IDÊNTICO** |
| Build | `✓ 18.6s`, exit 0 | `✓ 12.6s`, exit 0 | **ÍNTEGRO** |
| Consumidores | 3 | 3 | **IDÊNTICO** |

### 4.2 As nove evidências exigidas pela Pré-Abertura

| # | Exigência | Resultado |
|---|---|---|
| 1 | Rename registrado para os quatro arquivos | **4 renames** — `git mv`, nunca copiar-e-apagar |
| 2 | R100 para `mlUserProducts.ts` e seu teste | **R100 em ambos** — critério de interrupção não acionado |
| 3 | Similaridade da Classe B explicada linha a linha | **3 linhas**, todas de caminho de import — §3.2 |
| 4 | SHA-256 dos quatro antes e depois | Classe A **idêntico**; Classe B alterado e explicado |
| 5 | Assinatura pública conservada | **7 = 4 + 3**, nominalmente idênticos |
| 6 | Diff dos 3 consumidores restrito a import | `1 1` em cada, convenções preservadas |
| 7 | 16 testes e suíte 231 antes e depois | Idênticos, número a número |
| 8 | Build íntegro antes e depois | exit 0 em ambos |
| 9 | Auditoria com inspeção do conteúdo commitado | **3 de 3** consumidores verificados no commit |

### 4.3 Responsabilidades e arquivos intactos

| Item | Verificação |
|---|---|
| R9 — `normalizarTamanho.ts` | hash **idêntico** |
| R10 — `tabelasMedidas.ts` | hash **idêntico** |
| R11 — `exigenciaModeloCanal.ts` | hash **idêntico** |
| R13 — `composicaoConteudo.ts` | **1 linha** de import alterada, nada mais |
| R2 — `canalServidor.ts` | hash **idêntico** |
| R7 — **`mercadolivre.ts`** | hash **idêntico** — **bloqueio de governança respeitado** |

---

## 5. Auditoria do Commit

**Nenhuma recorrência do incidente E1.** Antes do commit, a árvore foi conferida: os quatro
renames já indexados pelo `git mv` e os três consumidores modificados, **0 arquivos não
rastreados** em `src/`.

| Verificação | Resultado |
|---|---|
| Arquivos esperados / presentes | 7 / **7** |
| Renames | **4** |
| Modificações (consumidores) | **3** |
| Excedentes | **0** |
| Documentação no commit | **0** |
| Árvore consistente com o commit | **0** pendências em `src/` |
| **Conteúdo commitado — `publicar/route.ts`** | novo import **1**, antigo **0** |
| **Conteúdo commitado — `publicacaoML.ts`** | novo import **1**, antigo **0** |
| **Conteúdo commitado — `composicaoConteudo.ts`** | novo import **1**, imports antigos **0** |

**APROVADA — 8 de 8, na primeira execução.**

---

## 6. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Apenas R12 modificada | 7 arquivos: 4 de R12 + 3 consumidores | **APROVADO** |
| 2 | R9 intacta | hash idêntico | **APROVADO** |
| 3 | R10 intacta | hash idêntico | **APROVADO** |
| 4 | R11 intacta | hash idêntico | **APROVADO** |
| 5 | R13 — só o import mudou | `1 1` | **APROVADO** |
| 6 | R2 intacta | hash idêntico | **APROVADO** |
| 7 | `mercadolivre.ts` intacto | hash idêntico — bloqueio respeitado | **APROVADO** |
| 8 | Similaridades confirmadas | R100 · R100 · R097 · R099, todas iguais às previstas | **APROVADO** |
| 9 | Classe A com SHA-256 idêntico | 2 de 2 | **APROVADO** |
| 10 | Classe B restrita a import | 3 linhas, todas de caminho | **APROVADO** |
| 11 | Assinatura conservada | 7 antes e depois | **APROVADO** |
| 12 | Build e testes | `✓ 12.6s` · 16/16 · 231/231 | **APROVADO** |
| 13 | Documentação e governança | 0 arquivos em `docs/` no commit | **APROVADO** |
| 14 | Nomes conservados | 2 de 2 arquivos de produção | **APROVADO** |

**APROVADO — 14 de 14.**

---

## 7. Achados e exceções

**A1 — Comentários de execução com o caminho antigo.**
*Constatação:* a linha 3 de `mlUserProducts.test.ts` e de `mlPayload.test.ts` mantém
`// Rodar: node --test src/lib/marketplaces/…`.
*Decisão:* **não corrigidos** — a missão veda alterar comentários, e corrigi-los reduziria
a similaridade dos renames. Mesmo tratamento das Releases 003, 008 e 009.

**A2 — Import morto de `Produto` reapontado, não removido.**
*Constatação:* `mlPayload.ts` importa `Produto` de `../types` sem utilizá-lo. O caminho
deixou de resolver no destino e **teve de ser reapontado**, sob pena de o build quebrar.
*Decisão:* reapontado para `../../../lib/types`. **Não removido** — removê-lo excederia o
movimento e alteraria o arquivo além do necessário.
*Registro:* este é o achado **O4** da Pré-Abertura, que o antecipou com precisão. O
resultado é uma linha de código morto que agora aponta para um caminho mais longo.
*Destino:* registrado para deliberação futura.

**A3 — Literal `"17055160"` permanece duplicado.**
*Constatação:* constante `EMPTY_GTIN_REASON_ID` em `mlUserProducts.ts` e literal
*hardcoded* em `mlPayload.ts` l. 87. Ambos migraram juntos; a duplicação viajou intacta.
*Decisão:* **não corrigido** — unificá-los é alteração de implementação.
*Cobertura:* a linha de base asserta o valor **nos dois caminhos**.

**E1 — Evidência ambígua produzida e descartada.**
*Constatação:* a exibição do diff da Classe B, restrita por pathspec ao diretório de
destino, **quebrou a detecção de rename** — os arquivos apareceram como adição integral,
sugerindo que todas as linhas haviam mudado.
*Decisão:* evidência **rejeitada**; diff reexibido com `-M` sem pathspec restritivo,
filtrando por nome de arquivo, revelando **exatamente 3 linhas** alteradas.
*Fundamento:* *evidência ambígua não é evidência*. Décima primeira aplicação do princípio.

**E2 — Segunda evidência ambígua, na Auditoria.**
*Constatação:* a inspeção do conteúdo commitado de `composicaoConteudo.ts` reportou
`antigo: 1` — uma ocorrência de `lib/marketplaces/ml`.
*Decisão:* investigada antes de aprovar. Trata-se do **comentário de proveniência da
Release 009** (linha 4), não de import. Verificação refeita contando apenas linhas
iniciadas por `import`: **0 nos três consumidores**.

**E3 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável.

---

## 8. Merge

| Verificação | Resultado |
|---|---|
| Conflitos | **0** |
| Commit final | `c5ae4dc` |
| Sincronização local / remota | local == `origin/master` |
| Árvore limpa | **0** pendências em `src/` |
| Escopo preservado | 4 renames + 3 `M` |
| Verificação pós-merge | 16/16 reexecutados na linha principal |

---

## 9. Atualização do Plano Executivo

Volume: **+13 / −8**. Duas hunks na entrada de R12, uma no Quadro, uma no resumo.

| Campo | Antes | Depois |
|---|---|---|
| Estado | `Não iniciada` · Categoria A | **CONCLUÍDA** ✅ |
| Release | prevista 010 | **executada 010** |
| Destino | `modules/integration` — Tradutor | `modules/integration/domain/` — Tradutor ✔ |
| Quadro Executivo | `Não iniciada \| Nenhum \| 010 \| Linha de base pronta \| Executar Pré-Abertura` | `✅ Concluída \| — \| 010 \| Migrada \| Nenhuma` |

**Resumo do backlog:** de *4 concluídas · 3 aguardando* para **5 concluídas · 2
aguardando**.

**Verificado:** exatamente **uma** linha do Quadro alterada. Responsabilidades no diff além
de R12: **0**. As linhas de R13 e R15 aparecem apenas como contexto.

---

## 10. Commit

| Item | Valor |
|---|---|
| Commit da migração | **`6924d6c`** |
| Merge | `c5ae4dc` |
| Autor | `onetocoutinho-spec` |
| Tipo declarado | **Refatoração** |

---

## 11. Resultado final

- **Integração técnica:** concluída. Auditoria aprovada na primeira execução; gates
  verificados; merge preservou o histórico dos quatro arquivos; verificação pós-merge
  reproduziu o resultado; reversão possível.
- **Integração documental:** concluída. O Plano Executivo reflete o estado resultante.
- **Encerramento operacional:** concluído. Três achados e três exceções registrados;
  nenhum silencioso.

**Release 010 — CONCLUÍDA.**

**R12 — MIGRADA.** O módulo **Integration** passa a conter **duas** responsabilidades de
domínio: R11 (Capability — exigência do modelo do canal) e R12 (Tradutor — montagem do
payload).

### Critérios de sucesso

| Critério | Resultado |
|---|---|
| Quatro arquivos migrados integralmente | **SIM** |
| Similaridades previstas confirmadas | **SIM** — 4 de 4 |
| Build verde | **SIM** — `✓ 12.6s` |
| Suíte completa verde | **SIM** — 231/231 |
| 16 testes específicos verdes | **SIM** |
| Auditoria aprovar | **SIM** — 8/8 |
| Integration Review aprovar | **SIM** — 14/14 |
| Merge concluído | **SIM** — 0 conflitos |
| Plano Executivo atualizado | **SIM** |
| Registro oficial produzido | **SIM** |

---

## 12. Estado do backlog

| Grupo | Situação |
|---|---|
| **Concluídas** | **R9** (003) · **R11** (007) · **R10** (008) · **R13** (009) · **R12** (010) |
| **Grupo B restante** | R15 → 011 · R2 → 012 — ambas **categoria C**, sem linha de base |
| **Grupo C** | 8 responsabilidades, bloqueadas pela validação operacional em produção |
| **Grupo D** | R5 e R16, sem destino arquitetural |

**Ocupação dos módulos:** `integration/domain` e `publication/domain` com 2
responsabilidades cada; `catalog/domain` com 1. `operation-center` permanece vazio.

**Marco alcançado.** Com R12 migrada, **o Grupo B está esgotado de responsabilidades que
possuem linha de base**. As duas restantes — R15 e R2 — estão em **categoria C** e exigirão
construção de linha de base antes da respectiva Pré-Abertura, no padrão das Releases 014 e
015.

**Próxima ação prevista:** conforme a análise do Grupo B, **R2 é a mais barata das duas** —
cliente de persistência injetado por parâmetro, uma única dependência, e um padrão de
substituto já provado no repositório. **R15 é a única com pré-requisito não técnico
pendente**: a decisão sobre a mudança de camada cliente→servidor, explicitamente **não
coberta** pelo Plano Executivo. O roadmap prevê R15 → 011 e R2 → 012; a análise do Grupo B
registrou que, para **construção de linha de base**, a ordem inversa é a indicada — sem que
isso altere a ordem de migração.
