# Registro da Release 007 — Migração da R11 para Integration/domain

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Extrair a responsabilidade **R11 — Determinação de exigência do modelo do canal** de
`lib/marketplaces/mlUserProducts.ts` para `modules/integration/domain/`, preservando
integralmente comportamento, assinatura pública, contratos, testes, telemetria e
consumidores.

**Primeira migração arquitetural do Zion OS conduzida pelo sistema de engenharia completo**
— Checklist de Elegibilidade, Protocolo de Migração e Padrão de Release Engineering
aplicados em sequência.

---

## 2. Escopo

**Declarado:** exclusivamente R11.
**Entregue:** idêntico ao declarado — 5 arquivos, **53 inserções**, **41 remoções**.

- **Release:** 007 · **Tipo:** **Refatoração** · **Data:** 21 de julho de 2026
- **Linha principal antes:** `c1f0c38` · **depois:** `4f3913b`
- **Branch:** `refactor/release-007-r11-exigencia-modelo-canal` · **Commit:** `6e94138`
- **Pré-Abertura:** parecer `ELEGÍVEL`, 17/17 critérios, 0 bloqueadores

| Arquivo | Natureza |
|---|---|
| `src/modules/integration/domain/exigenciaModeloCanal.ts` | **A** — destino |
| `src/modules/integration/domain/exigenciaModeloCanal.test.ts` | **A** — testes migrados |
| `src/lib/marketplaces/mlUserProducts.ts` | **M** — origem, remoção dos símbolos |
| `src/lib/marketplaces/mlUserProducts.test.ts` | **M** — origem, remoção dos 2 testes |
| `src/app/api/ml/publicar/route.ts` | **M** — consumidor, apenas import |

**Reconciliação aritmética.** +53 = 27 (destino) + 21 (teste destino) + 4 (consumidor) +
1 (import colapsado na origem). −41 = 22 (origem) + 17 (teste origem) + 2 (consumidor).
Sem resíduo.

---

## 3. Estratégia utilizada

### 3.1 Extração, não movimento

R11 coabitava a unidade física com R12 e R13 (Mapeamento **M2**). Não havia arquivo a
mover: os quatro símbolos ocupavam as linhas 47–51 e 138–145, **com R12 entre eles**.

Isso tornou **inaplicável** a evidência característica da Fase 3 do Protocolo — `git mv`,
*rename* registrado, **similaridade 100%** —, extraída da Release 003, que foi um
movimento de arquivo inteiro.

A Pré-Abertura previu a lacuna e definiu a evidência substitutiva, conforme o próprio
Protocolo autoriza ao declarar-se *"o mínimo, não o suficiente para todos os casos"* e ao
delegar à Fase 1 a definição de evidência adicional.

### 3.2 Símbolos extraídos e preservados

| Símbolo | Visibilidade | Destino |
|---|---|---|
| `precisaUserProducts` | público | **extraído** |
| `dominioDaCategoria` | público | **extraído** |
| `CATEGORIAS_USER_PRODUCTS` | privado | **extraído** |
| `DOMINIO_POR_CATEGORIA` | privado | **extraído** |
| `montarItensUserProducts` (R12) | público | **preservado na origem** |
| `montarBundleUserProducts` (R13) | público | **preservado na origem** |
| `GENERO_ID`, `FOOTWEAR_TYPE_ID`, `EMPTY_GTIN_REASON_ID`, interfaces e tipos | público | **preservados na origem** |

**Justificativa técnica da separabilidade.** Verificado antes da extração que nenhum
símbolo de R11 é usado internamente por `mlUserProducts.ts`: `precisaUserProducts` e
`dominioDaCategoria` ocorrem **uma única vez cada**, em sua própria definição; as duas
constantes ocorrem **duas vezes cada**, na definição e na função correspondente. O
acoplamento de R11 com o resto do arquivo era **zero** — a extração não exigiu reexportação,
adaptação nem qualquer alteração de lógica.

### 3.3 Consumidor — divisão do import compartilhado

`publicar/route.ts` importava R11, R12 e R13 na **mesma instrução**. A extração exigiu
dividi-la em duas:

- R12 (`montarItensUserProducts`) e R13 (`BundleUserProducts`) **seguem apontando para
  `@/lib/marketplaces/mlUserProducts`** — implementação original, inalterada.
- Apenas R11 (`precisaUserProducts`, `dominioDaCategoria`) passa a consumir
  `@/modules/integration/domain/exigenciaModeloCanal`.

O alias `@/` foi preservado, conforme a convenção do arquivo consumidor — diferentemente
da Release 003, onde se preservou caminho relativo porque era a convenção *daquele*
consumidor.

**Distinção registrada, conforme exigido pelo Plano Executivo:** dividir uma *instrução de
import* não é mover, dividir ou reorganizar o *arquivo*. O bloqueio de governança sobre
`publicar/route.ts` **não foi violado**.

### 3.4 Testes migrados junto com o código

Conforme o Protocolo, Fase 3. Os 2 testes de R11 acompanharam os símbolos; os 7 restantes
permaneceram na origem. **Total 9, idêntico à linha de base, redistribuído entre dois
arquivos** — diferença antecipada e explicada na Pré-Abertura, não descoberta na validação.

---

## 4. Evidências

| # | Evidência | Resultado |
|---|---|---|
| **Linha de base** | Testes antes da migração | **9 total · 9 pass · 0 fail** |
| **Linha de base** | Assinatura pública de R11 | `precisaUserProducts(categoryId: string): boolean` · `dominioDaCategoria(categoryId: string): string \| null` |
| **Linha de base** | Build antes | `✓ Compiled successfully in 17.5s`, exit 0 |
| **EV1** | Build depois | **`✓ Compiled successfully in 18.2s`**, exit 0 |
| **EV2** | Nove testes aprovados | **2 (destino) + 7 (origem) = 9 · 9 pass · 0 fail** |
| **EV3** | Dois testes específicos de R11 | **2 pass · 0 fail**, no destino |
| **EV4** | Sete testes das demais responsabilidades | **7 pass · 0 fail**, na origem |
| **EV5** | Nenhuma alteração comportamental | Diff do consumidor restrito a linhas de import; nenhuma linha de lógica alterada em arquivo algum |
| **EV6** | Assinatura pública preservada | Origem: 11 → 9 exports (−2, exatamente R11). Destino: +2. **Soma conservada** |
| **EV7** | Contrato preservado | Conteúdo extraído **sha256 idêntico** ao da origem: `c86d398ab6c9e4aa94518d1266074e80` |
| **EV8** | Telemetria preservada | 0 alterações em marcações `ml.publicar`/`ml.guia`; `mercadolivre.ts` **hash idêntico** |
| **EV9** | Apenas R11 mudou de localização | 3 modificados + 2 criados = 5, exatamente os declarados |
| **EV10** | Nenhuma responsabilidade adicional migrada | R10 (`tabelasMedidas.ts`), R12 (`mlPayload.ts`) e R9 (`normalizarTamanho.ts`) **hash idêntico**; `montarItensUserProducts` e `montarBundleUserProducts` presentes na origem |
| — | Pós-merge | escopo preservado (5 arquivos); 0 conflitos; local == remoto; 9 testes reexecutados verdes |

**Sobre EV7 — a evidência que substituiu a similaridade 100%.** O hash SHA-256 do bloco
extraído, comparado entre o conteúdo em `HEAD` da origem e o conteúdo no destino, é
idêntico. Prova mecânica e não interpretável de que **nenhum byte da implementação mudou**
— cumprindo a mesma função probatória que o *rename* com similaridade 100% cumpriu na
Release 003.

---

## 5. Exceções registradas

**E1 — Três evidências ambíguas produzidas e descartadas.**

*Primeira:* a comparação de conteúdo (EV7) acusou divergência. Investigada: as **faixas de
linha da comparação estavam erradas** — o destino ia até a linha 27, não 26, e a origem
não incluía o separador em branco. Refeita com faixas corretas: **hash idêntico**.

*Segunda:* a verificação de integridade de R10 reportou `ALTERADO` para
`tabelasMedidas.ts`. Investigada: o **caminho estava errado** — o arquivo reside em
`src/lib/data/`, não em `src/lib/marketplaces/`. O comando falhou na leitura e a
comparação avaliou duas cadeias vazias. Refeita com o caminho real: **hash idêntico**.

*Terceira:* a verificação de escopo do Plano Executivo acusou "1 outra responsabilidade
tocada". Investigada: o contador casou com a **menção** a R12 e R13 no texto de
justificativa que a própria atualização acrescentou. Menção não é modificação. Refeita
sobre as linhas de estado e as linhas do Quadro Executivo: **exatamente uma de cada,
ambas de R11**.

*Fundamento:* princípio institucionalizado — *evidência ambígua não é evidência*.
*Responsabilidade:* terceira, quarta e quinta aplicações do princípio; nenhuma das três
falhas era real.

**E2 — Divergência entre o Mapeamento e o código quanto à faixa de linhas de R11.**
*Constatação:* o Mapeamento localiza R11 em `mlUserProducts.ts` **47–153**. Verificado no
código: essa faixa contém `montarItensUserProducts` (l. 90), que o próprio Mapeamento
atribui a **R12**.
*Decisão:* o escopo foi definido pelos **símbolos enumerados** pelo Mapeamento, não pela
faixa. A faixa é localizador.
*Impacto:* nulo — a migração extraiu exatamente os 4 símbolos nomeados.
*Destino:* registrado; o Mapeamento **não foi alterado** por esta release.

**E3 — Caminhos do Mapeamento são nomes de arquivo, não caminhos completos.**
*Constatação:* o Mapeamento registra `tabelasMedidas.ts`, `mlPayload.ts`,
`canalServidor.ts` sem diretório. `tabelasMedidas.ts` reside em `src/lib/data/`, fora de
`src/lib/marketplaces/` onde a leitura superficial o presumiria.
*Impacto:* causou a segunda evidência ambígua de E1.
*Destino:* registrado como observação para as próximas migrações. Nada foi alterado.

**E4 — Contagem de "Release prevista" no Plano Executivo caiu de 6 para 5.**
*Constatação:* esperado. R11 deixou de ter *Release prevista* e passou a ter *Release*,
exatamente como R9 está registrada desde a Release 003.
*Impacto:* nulo. Diferença explicada.

**E5 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável —
hashes, contagens de exports, execução de testes e compilação.
*Responsabilidade:* Release Manager desta execução.

---

## 6. Auditoria do Commit

Executada conforme a **Fase 4 do Protocolo**.

| Verificação | Resultado |
|---|---|
| Somente arquivos esperados | **5 de 5** |
| Nenhuma responsabilidade excedente | **0** |
| Nenhuma migração acidental | **0** — R10, R12, R13 hash idêntico |
| Consumidor único alterado | **1** arquivo em `app/` |
| Escopo preservado | **sim** |
| Árvore consistente | **0** pendências em `src/` |
| Commit consistente | **sim** |

**Verificação que interceptou o incidente E1 na Release 003:** inspeção do **conteúdo
commitado** do consumidor — não da árvore de trabalho — confirmou a presença do novo
import na linha 25. **Aprovada.**

**APROVADA — 7 de 7.**

---

## 7. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Somente R11 migrada | 2 símbolos públicos no destino, ambos de R11 | **APROVADO** |
| 2 | R10 intacta | `src/lib/data/tabelasMedidas.ts` hash idêntico | **APROVADO** |
| 3 | R12 intacta | `mlPayload.ts` hash idêntico; `montarItensUserProducts` presente na origem | **APROVADO** |
| 4 | R13 intacta | `montarBundleUserProducts` presente na origem | **APROVADO** |
| 5 | Consumidor único atualizado | 1 arquivo em `app/` | **APROVADO** |
| 6 | Build aprovado | `✓ 18.2s`, exit 0 | **APROVADO** |
| 7 | Nove testes aprovados | 2 + 7 = 9 pass, 0 fail | **APROVADO** |
| 8 | Assinatura preservada | Ambas as funções com tipos idênticos | **APROVADO** |
| 9 | Comportamento preservado | sha256 do conteúdo extraído idêntico | **APROVADO** |
| 10 | Contrato preservado | 0 alterações em interfaces e tipos exportados | **APROVADO** |

**APROVADO — 10 de 10.**

---

## 8. Resultado final

- **Integração técnica:** concluída. Auditoria e gates verificados; merge preservou o
  histórico; verificação pós-merge reexecutou os 9 testes na linha principal; reversão
  possível.
- **Integração documental:** concluída. O Plano Executivo reflete o estado resultante;
  nenhum documento existente o contradiz.
- **Encerramento operacional:** concluído. Parecer registrado; evidências preservadas;
  cinco exceções registradas.

**Release 007 — CONCLUÍDA.**

**R11 — MIGRADA.** O módulo Integration deixa de estar vazio: passa a conter sua primeira
responsabilidade real, uma **Capability** — conhecimento sobre o que a contraparte exige.

---

## 9. Atualização do Plano Executivo

Alterado **exclusivamente** o estado de R11.

| Campo | Antes | Depois |
|---|---|---|
| Estado | **Não iniciada** | **CONCLUÍDA** |
| Release | prevista 007 | **executada 007** |
| Bloqueio | Nenhum | — |
| Situação | Pronta para migrar | Migrada, comportamento preservado |
| Próxima ação | Executar migração | Nenhuma |
| Destino | `modules/integration` — Capability | `modules/integration/domain/exigenciaModeloCanal.ts` ✔ |

**Resumo do backlog:** de *1 concluída · 1 pronta para migrar* para **2 concluídas**. Os
demais números permanecem: 5 aguardando engenharia adicional · 8 bloqueadas por governança
· 2 sem destino.

**Verificado:** exatamente **uma** linha do Quadro Executivo e **uma** linha de estado
foram alteradas, ambas de R11. Contagens de `Bloqueada` (13), `Risco:` (14) e
`Complexidade` (9) idênticas antes e depois.

**Grupo A está esgotado.** Nenhuma responsabilidade permanece imediatamente migrável.

---

## 10. Lições aprendidas

**L1 — A Pré-Abertura pagou por si mesma na primeira aplicação.** Os três fatos que
determinaram a forma da execução — a faixa de linhas do Mapeamento englobar R12, o import
do consumidor precisar ser dividido, e a Fase 3 não ter instrumento probatório para
extração — foram todos descobertos **antes** da branch existir. Sem o Checklist, os três
teriam sido encontrados no meio da migração, e o terceiro provavelmente teria sido
resolvido por improviso em vez de por evidência definida.

**L2 — O Protocolo estava certo ao declarar-se incompleto.** Sua nota de proporcionalidade
— *"estabelece o mínimo, não o suficiente para todos os casos"* — foi escrita antes de
existir qualquer migração por extração. Na primeira, a previsão se confirmou: `git mv` e
similaridade 100% não se aplicaram, e o mecanismo de escape que o próprio Protocolo criou
(evidência adicional definida na Fase 1) funcionou sem que fosse necessário alterá-lo.

**L3 — Hash é evidência melhor que similaridade percentual.** A identidade sha256 do
conteúdo extraído prova preservação byte a byte de forma **independente do mecanismo de
movimento**. Serve tanto para extração quanto para movimento de arquivo. Registro factual,
sem proposta: não foi avaliado se deveria complementar a similaridade nas próximas
migrações.

**L4 — Nenhuma das três evidências ambíguas correspondia a uma falha real.** Todas foram
erros dos comandos de coleta: faixas de linha erradas, caminho inexistente, contador
casando com menção textual. O princípio *evidência ambígua não é evidência* protegeu
contra **conclusões falsas em ambas as direções** — teria sido igualmente grave aceitar o
"ALTERADO" de R10 como real e interromper uma release correta.

**L5 — O acoplamento zero foi verificado, não presumido.** Antes de extrair, contou-se
quantas vezes cada símbolo de R11 aparecia na origem. O resultado — uma ocorrência por
função, duas por constante — provou que nenhum outro trecho do arquivo dependia deles.
Essa verificação de dez segundos é o que permitiu extrair sem reexportação nem adaptação.

**L6 — Observação registrada, sem interpretação.** As próximas migrações do Grupo B (R10,
R13, R12, R15, R2) e todas as do Grupo C são igualmente extrações ou divisões, não
movimentos de arquivo. **Não foi avaliado** se a evidência substitutiva definida aqui se
aplica a elas — cada uma definirá a sua na respectiva Fase 1, conforme o Protocolo exige.
