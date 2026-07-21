# Registro da Release 012 — Migração da R2 para Integration/infrastructure

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Contexto

**Última Release de engenharia do Plano Executivo de Refatoração Arquitetural.**

R2 chegou aqui após um percurso que nenhuma outra responsabilidade percorreu:

| Etapa | Resultado |
|---|---|
| **Release 016** | Linha de base institucionalizada — 12 testes, mutação 14/14 |
| **Pré-Abertura (1ª)** | **NÃO ELEGÍVEL** — a estratégia *"Mover atrás de porta"* admitia dois escopos |
| **ADR-009** | Fixou o significado normativo e autorizou o escopo |
| **Release 017** | ADR-009 institucionalizado |
| **Pré-Abertura (2ª)** | **ELEGÍVEL** — 17/17, zero bloqueadores |
| **Release 012** | Esta execução |

- **Release:** 012 · **Tipo:** **Refatoração** · **Data:** 21 de julho de 2026
- **Autorização de escopo:** **ADR-009 §5.3**

---

## 2. Linha de base

Produzida novamente e conferida contra a Pré-Abertura aprovada.

| Medida | Valor |
|---|---|
| **HEAD inicial** | `d6d5e65b0011e9f2d44bdfb36de6255acd4abb8f` — **coincide** com a Pré-Abertura |
| Working tree | **0** pendências em `src/` e `docs/zion-os/` |
| Branch | `refactor/release-012-r2-vinculo-do-canal`, criada de `origin/master` |
| SHA-256 `canalServidor.ts` | `e2c484850a72487549f709902666a17dff6966507379313e43a5ca6ab6cd5c93` |
| SHA-256 `canalServidor.test.ts` | `e8c642531beb01a0385afb910775b605e3d68474c256f34c3a647e0a9cdee6c3` |
| Assinatura pública | **4 exports** |
| Testes de R2 | **12 · 12 pass · 0 fail** |
| Suíte completa | **243 · 243 pass · 0 fail · 0 skipped** |
| Build | `✓ Compiled successfully in 52s`, exit 0 |
| ADR-009 | **APROVADO**, rastreado |

---

## 3. Movimento dos arquivos

Executado **exclusivamente** com `git mv`, **antes de qualquer edição**:

| Origem | Destino |
|---|---|
| `src/lib/marketplaces/canalServidor.ts` | `src/modules/integration/infrastructure/canalServidor.ts` |
| `src/lib/marketplaces/canalServidor.test.ts` | `src/modules/integration/infrastructure/canalServidor.test.ts` |

---

## 4. Validação R100 — o primeiro diff, sem filtro

Executada **imediatamente após o `git mv`**, antes de qualquer edição, conforme o PASSO 3
da missão. O diff completo, na íntegra:

```
diff --git a/src/lib/marketplaces/canalServidor.test.ts b/src/modules/integration/infrastructure/canalServidor.test.ts
similarity index 100%
rename from src/lib/marketplaces/canalServidor.test.ts
rename to src/modules/integration/infrastructure/canalServidor.test.ts
diff --git a/src/lib/marketplaces/canalServidor.ts b/src/modules/integration/infrastructure/canalServidor.ts
similarity index 100%
rename from src/lib/marketplaces/canalServidor.ts
rename to src/modules/integration/infrastructure/canalServidor.ts
```

**O diff contém exclusivamente `similarity index 100%`, `rename from` e `rename to`.**
Nenhuma outra linha. **Zero linhas de conteúdo alteradas.**

| Arquivo | Similaridade | Linhas alteradas |
|---|---|---|
| `canalServidor.ts` | **R100** | `0 0` |
| `canalServidor.test.ts` | **R100** | `0 0` |

**Critério de interrupção não acionado.** A Pré-Abertura estabelecera que, aqui, R100 é
**estrito** — não havendo caminho relativo a reapontar nos arquivos movidos, qualquer valor
inferior indicaria alteração além do movimento.

**Por que foi possível.** Os quatro `from` dos dois arquivos são:

| Origem | Natureza | Muda com o movimento? |
|---|---|---|
| `@supabase/supabase-js` | pacote | não |
| `node:test` · `node:assert/strict` | *builtin* | não |
| `./canalServidor.ts` | mesmo diretório, move junto | não |

**É a única migração do backlog em que nenhum byte precisou mudar nos arquivos migrados.**

---

## 5. Atualização dos consumidores

**Cinco rotas de API**, cada uma em **uma linha de import**, com o alias `@/` preservado:

| Consumidor | Símbolos |
|---|---|
| `app/api/ml/conectar/route.ts` | `salvarRefreshTokenServidor` |
| `app/api/ml/publicar/route.ts` | `lerCanalServidor`, `atualizarRefreshTokenServidor` |
| `app/api/ml/vendas/route.ts` | idem |
| `app/api/ml/importar-anuncios/route.ts` | idem |
| `app/api/ml/diagnostico-guias/route.ts` | idem |

`@/lib/marketplaces/canalServidor` → `@/modules/integration/infrastructure/canalServidor`

**Cinco linhas inseridas, cinco removidas.** Nenhuma lógica, assinatura ou comportamento
alterado.

**Nota sobre `publicar/route.ts`.** É um dos dois arquivos nomeados no bloqueio de
governança. A alteração foi **exclusivamente de import** — distinção estabelecida pelo
Plano Executivo para R11 e aplicada nas Releases 007, 009 e 010. `mercadolivre.ts`
permanece com **hash idêntico**.

---

## 6. Atualização da governança

Conforme determinado pelo **ADR-009 §6.3 e §9**, executada **dentro desta release**.

### 6.1 Plano Executivo — campo *Estratégia* preenchido

O campo, **ausente desde a criação do documento**, passou a registrar:

> *Movimento integral dos dois arquivos com `git mv`, para
> `src/modules/integration/infrastructure/`, **sem introduzir Port**, sem criar abstração e
> **sem alterar contrato**. A expressão do Mapeamento "Mover atrás de porta" significa
> **preservar o ponto único de acesso** ao vínculo do canal…*

A entrada de R2 passou a **CONCLUÍDA · Release 012**, e o Quadro Executivo foi atualizado.

### 6.2 Mapeamento — anotado, com o histórico preservado

Acrescida uma **Nota de interpretação institucional** logo abaixo da Matriz de Migração,
registrando o significado fixado pelo ADR-009 e a determinação de que Ports não integram a
arquitetura.

**A redação histórica foi preservada.** Verificado no repositório:

| Verificação | Resultado |
|---|---|
| Linha 324 da matriz — célula *Estratégia* de R2 | **`Mover atrás de porta`** — **intacta** |
| Ocorrências da expressão no documento | **2** — a original e a citada na nota |
| Linhas removidas do Mapeamento | **0** — a alteração é `+16 −0` |

**Nenhum registro histórico foi removido.**

---

## 7. Build

| Momento | Resultado |
|---|---|
| Antes | `✓ Compiled successfully in 52s`, exit 0 |
| Depois | **`✓ Compiled successfully in 18.9s`**, exit 0 |

---

## 8. Testes

| Conjunto | Antes | Depois |
|---|---|---|
| **12 testes de R2** | 12 · 12 pass · 0 fail | **12 · 12 pass · 0 fail** |
| **Suíte completa** | 243 · 243 pass · 0 fail · 0 skipped | **243 · 243 pass · 0 fail · 0 skipped** |
| Pós-merge, na linha principal | — | **12 · 12 pass · 0 fail** |

**Resultado esperado pela missão — 243/243 — confirmado.**

---

## 9. Auditoria

Executada conforme a **Fase 4 do Protocolo**. Antes do `git add`, os **9 caminhos** foram
verificados um a um: todos existentes; `git add` retornou exit 0 sem qualquer
`pathspec did not match`.

| Verificação | Resultado |
|---|---|
| Arquivos esperados / presentes | 9 / **9** |
| Renames R100 | **2** |
| Modificações | **7** — 5 consumidores + 2 documentos |
| Excedentes · Ausentes | **0** · **0** |
| Árvore consistente com o commit | **0** pendências |
| **Conteúdo commitado dos 5 consumidores** | **5 de 5** com o novo import; **0** com o antigo |

**APROVADA — na primeira execução.** **Nenhuma recorrência do incidente E1.**

---

## 10. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Movimento integral | 2 renames **R100**, 0 linhas alteradas | **APROVADO** |
| 2 | Zero alteração funcional | **0** linhas nos arquivos migrados | **APROVADO** |
| 3 | SHA-256 preservado | **idêntico** em ambos | **APROVADO** |
| 4 | Assinatura pública | 4 exports antes e depois | **APROVADO** |
| 5 | Consumidores | 5 alterados, **5 linhas** inseridas | **APROVADO** |
| 6 | Alias `@/` preservado | em todos os 5 | **APROVADO** |
| 7 | Aderência ao ADR-009 | destino `integration/infrastructure/`, sem Port, sem abstração | **APROVADO** |
| 8 | `ports/` permanece vazio | **0** arquivos nos 4 módulos | **APROVADO** |
| 9 | Redação histórica | *"Mover atrás de porta"* na matriz **preservada** | **APROVADO** |
| 10 | R9, R10, R11, R12, R13 intactas | hash idêntico nas cinco | **APROVADO** |
| 11 | `mercadolivre.ts` intacto | hash idêntico — bloqueio respeitado | **APROVADO** |
| 12 | Protocolo, Checklist e ADRs | **0** alterações | **APROVADO** |
| 13 | Build e testes | `✓ 18.9s` · 12/12 · 243/243 | **APROVADO** |
| 14 | Plano — só R2 | **0** outras responsabilidades no diff | **APROVADO** |

**APROVADO — 14 de 14.**

---

## 11. Commit

| Item | Valor |
|---|---|
| **Commit da migração** | **`bb87d0b`** |
| Autor | `onetocoutinho-spec` |
| Tipo declarado | **Refatoração** |
| Volume | 9 arquivos · **+39 / −11** |

---

## 12. Merge

| Item | Valor |
|---|---|
| **Merge** | **`fe7ca21`** |
| Conflitos | **0** |
| Sincronização | local == `origin/master` |
| Árvore limpa | **0** pendências |
| Verificação pós-merge | 12/12 na linha principal |

---

## 13. HEAD final

```
fe7ca21e4233db66ee617a27575f228957912215
```

---

## 14. Evidências

| # | Evidência | Resultado |
|---|---|---|
| **EV1** | Primeiro diff após `git mv` | **exclusivamente** `similarity index 100%`, `rename from`, `rename to` |
| **EV2** | Similaridade | **R100** em ambos |
| **EV3** | Linhas alteradas nos arquivos migrados | **0** |
| **EV4** | SHA-256 antes e depois | **idêntico** nos dois |
| **EV5** | Assinatura pública | 4 exports, inalterada |
| **EV6** | Diff dos consumidores | 5 arquivos, **1 linha cada**, só import |
| **EV7** | Testes | 12/12 e 243/243, antes e depois |
| **EV8** | Build | exit 0 em ambos os momentos |
| **EV9** | Auditoria do conteúdo commitado | 5 de 5 consumidores corretos |
| **EV10** | Responsabilidades já migradas | hash idêntico nas cinco |
| **EV11** | `mercadolivre.ts` | hash idêntico — bloqueio respeitado |
| **EV12** | `ports/` e `adapters/` | permanecem vazios, conforme ADR-009 |
| **EV13** | Redação histórica do Mapeamento | preservada; `+16 −0` |

### 14.1 Achados registrados — não corrigidos

**A1 — Comentário de execução com o caminho antigo.** A linha 4 de
`canalServidor.test.ts` mantém `// Rodar: node --test src/lib/marketplaces/canalServidor.test.ts`.
**Não corrigido:** corrigi-lo **quebraria o R100**, que é a evidência central desta
release. Mesmo tratamento das Releases 003, 008, 009 e 010.

**A2 — `canaisMarketplace.ts` referencia o caminho antigo em comentário** (l. 5). Achado
pré-existente, já registrado como **D2** na análise do Grupo B.

**A3 — O cabeçalho de `canalServidor.ts` atribui o código a "R3".** Achado **A1** da
Release 016. Não corrigido pela mesma razão.

**A4 — Autor e Revisor exercidos pela mesma função.** Veredito apoiado exclusivamente em
evidência mecanicamente verificável.

---

## 15. Lições aprendidas

**L1 — A ambiguidade custou três missões; a execução custou zero surpresas.** A primeira
Pré-Abertura reprovou; um ADR foi deliberado; uma release o institucionalizou; a segunda
Pré-Abertura aprovou. Só então a migração ocorreu — e foi a mais limpa do backlog inteiro:
**R100 em ambos, zero bytes alterados, auditoria aprovada de primeira**. O custo ficou onde
deve ficar: **na decisão, não na execução**.

**L2 — Validar o movimento antes de qualquer edição é o que torna o R100 verificável.** A
missão exigiu inspecionar o diff **imediatamente após o `git mv`**, antes de tocar nos
consumidores. Isso separa duas evidências que, misturadas, se contaminam: *"o arquivo não
mudou"* e *"os consumidores mudaram só no import"*. Nas releases anteriores essa separação
era implícita; aqui foi procedimento — e a evidência ficou mais forte por isso.

**L3 — Um ADR pode decidir significado sem alterar redação.** O Mapeamento continua
registrando *"Mover atrás de porta"*, intacto, com `+16 −0`. O ADR-009 fixou o que a
expressão significa **sem apagar o que ela diz**. Preservar o registro e resolver a dúvida
não são objetivos concorrentes.

**L4 — O incidente E1 não ocorreu pela terceira vez.** Após duas ocorrências — Releases 003
e 008 —, a verificação prévia de que **todos os caminhos existem antes do `git add`** virou
procedimento. Nove caminhos conferidos, exit 0, auditoria aprovada de primeira.

**L5 — Injeção de dependência foi o que permitiu tudo.** R2 pôde ter linha de base sem
alterar produção, e migrar sem alterar um byte, porque recebe o cliente de persistência
**por parâmetro**. Registro factual, sem generalização: as responsabilidades que importam
suas dependências diretamente — R15 é o caso — não têm essa propriedade.

---

## 16. Próximo estado do Plano Executivo

**Release 012 — CONCLUÍDA. R2 — MIGRADA.**

### 16.1 Critérios de sucesso

| Critério | Resultado |
|---|---|
| Dois arquivos movidos integralmente | **SIM** |
| Git registrar R100 para ambos | **SIM** |
| Primeiro diff só com `rename from`/`rename to` | **SIM** — e `similarity index 100%` |
| Apenas imports dos consumidores alterados | **SIM** — 5 linhas |
| Nenhuma alteração funcional nos migrados | **SIM** — 0 linhas, SHA-256 idêntico |
| Plano Executivo atualizado conforme ADR-009 | **SIM** — campo *Estratégia* preenchido |
| Mapeamento anotado preservando o histórico | **SIM** — `+16 −0` |
| Build aprovado | **SIM** |
| 12 testes de R2 aprovados | **SIM** |
| Suíte completa aprovada | **SIM** — 243/243 |
| Auditoria aprovada | **SIM** |
| Integration Review aprovada | **SIM** — 14/14 |
| Commit e merge realizados | **SIM** — `bb87d0b` e `fe7ca21` |

### 16.2 Estado do backlog

| Situação | Responsabilidades |
|---|---|
| **Concluídas — 6** | R9 (003) · R11 (007) · R10 (008) · R13 (009) · R12 (010) · **R2 (012)** |
| **Bloqueada por decisão arquitetural — 1** | **R15** — exige ADR sobre a camada cliente→servidor |
| **Bloqueadas por governança — 8** | Grupo C — validação operacional da reutilização de guias em produção |
| **Sem destino arquitetural — 2** | R5 · R16 |

### 16.3 Marco alcançado

> **O backlog de engenharia elegível do Zion OS está zerado.**

Nenhuma responsabilidade restante depende apenas de trabalho de engenharia. Todas as
pendências são de **decisão** ou de **observação**:

- **R15** aguarda um ADR sobre a mudança de camada — a Avaliação Arquitetural confirmou que
  a premissa permanece válida.
- **As oito do Grupo C** aguardam uma única condição: a **validação operacional em
  produção** do comportamento de reutilização de guias. É uma **observação**, não
  engenharia.
- **R5 e R16** aguardam a especificação das arquiteturas de Vendas/Pedidos e de
  Identity & Access.

### 16.4 Ocupação dos módulos

| Módulo | Camada | Responsabilidades |
|---|---|---|
| `integration` | `domain` | R11 · R12 |
| `integration` | **`infrastructure`** | **R2** ✔ |
| `publication` | `domain` | R9 · R13 |
| `catalog` | `domain` | R10 |
| `operation-center` | — | vazio |

**`src/lib/marketplaces/` contém agora um único arquivo: `mercadolivre.ts`** — o arquivo
bloqueado por governança, que hospeda seis das oito responsabilidades do Grupo C.

**Próxima ação possível:** nenhuma de engenharia. O caminho crítico da refatoração passa
agora por uma **observação em produção** e por **duas decisões de arquitetura**.
